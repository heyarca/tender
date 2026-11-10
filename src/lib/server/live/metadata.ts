import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns";
import type { IncomingMessage } from "node:http";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { AnswerCache, LiveError } from "./cache";

export interface PageMetadata {
  url: string;
  title: string;
  description: string;
  image?: string;
}

const TIMEOUT_MS = 3000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Tender (https://tender.heyarca.app)";
const pages = new AnswerCache<PageMetadata>(10 * 60_000);

/** Addresses a page fetch must never reach: private, loopback, link-local, shared, multicast, and reserved ranges. */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED.addSubnet(network, prefix, "ipv4");
// IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are checked against the IPv4 ranges by BlockList itself.
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) BLOCKED.addSubnet(network, prefix, "ipv6");

const isBlocked = (address: string) => BLOCKED.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");

const blockedHost = () => new LiveError(400, "unsupported_input", "url must be an https URL on a public host");

/**
 * DNS lookup for the page socket that refuses private addresses. Checking at connect time (not before
 * the request) means a host cannot resolve to a public address first and a private one after.
 */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    if (!addresses.length || addresses.some((entry) => isBlocked(entry.address))) return callback(blockedHost() as NodeJS.ErrnoException, "", 0);
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

/** A public https URL (default port), or a 400. */
function publicUrl(value: string, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw blockedHost();
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) throw blockedHost();
  if (host === "localhost" || host.endsWith(".localhost") || (isIP(host) && isBlocked(host))) throw blockedHost();
  url.hash = "";
  return url;
}

function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request(url, { lookup: publicLookup, signal, headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" } }, resolve);
    req.on("error", reject);
    req.end();
  });
}

/** The page body as text, up to `MAX_BYTES` (a longer page is cut there; its head is all we read). */
function readBody(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= MAX_BYTES) response.destroy();
    });
    response.on("error", (error) => { if (size < MAX_BYTES) reject(error); });
    response.on("close", () => resolve(Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8")));
  });
}

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (text: string) =>
  text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();

function parseMetadata(html: string, url: URL): PageMetadata {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = new Map<string, string>();
    for (const [, name, , double, single] of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      attributes.set(name.toLowerCase(), double ?? single ?? "");
    }
    const key = (attributes.get("property") ?? attributes.get("name"))?.toLowerCase();
    const content = attributes.get("content");
    if (key && content && !meta.has(key)) meta.set(key, decode(content));
  }
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const imageValue = meta.get("og:image") ?? meta.get("twitter:image");
  let image: string | undefined;
  try {
    image = imageValue ? new URL(imageValue, url).href : undefined;
  } catch {
    image = undefined;
  }
  return {
    url: url.href,
    title: (meta.get("og:title") ?? (titleTag ? decode(titleTag) : "")) || url.hostname,
    description: meta.get("og:description") ?? meta.get("description") ?? meta.get("twitter:description") ?? "",
    ...(image ? { image } : {}),
  };
}

async function fetchMetadata(start: URL): Promise<PageMetadata> {
  // One deadline for every hop and the body.
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = start;
  for (let hop = 0; ; hop++) {
    const response = await get(url, signal);
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.destroy();
      if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects");
      // Every hop is checked again, including the addresses it resolves to.
      url = publicUrl(response.headers.location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.destroy();
      throw new Error(`Page HTTP ${status}`);
    }
    const type = String(response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "text/html" && type !== "application/xhtml+xml") {
      response.destroy();
      throw new LiveError(422, "no_match", "The URL is not an HTML page");
    }
    return parseMetadata(await readBody(response), url);
  }
}

/** Title, description, and preview image of a public https page. */
export function pageMetadata(value: string): Promise<PageMetadata> {
  const url = publicUrl(value);
  return pages.get(url.href, async () => {
    try {
      return await fetchMetadata(url);
    } catch (error) {
      if (error instanceof LiveError) throw error;
      console.error("Tender page fetch error", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
      throw new LiveError(502, "provider_error", "The page did not load. Check the URL and try again.");
    }
  });
}
