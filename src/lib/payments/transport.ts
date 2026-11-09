/** Never attach a deployment-access credential to a caller-selected origin. */
export function paymentTransportHeaders(url: URL, headers: HeadersInit | undefined, bypassSecret?: string, trustedPreviewUrl?: string): Headers {
  const result = new Headers(headers);
  result.delete("x-vercel-protection-bypass");
  if (!bypassSecret) return result;
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return result;
  if (!trustedPreviewUrl) throw new Error("Set TENDER_PREVIEW_URL to the trusted HTTPS deployment origin before using a bypass secret");
  const trusted = new URL(trustedPreviewUrl);
  if (url.protocol !== "https:" || trusted.protocol !== "https:" || url.origin !== trusted.origin || url.username || url.password || trusted.username || trusted.password) {
    throw new Error("Refusing to send a Vercel bypass secret to an untrusted origin");
  }
  result.set("x-vercel-protection-bypass", bypassSecret);
  return result;
}
