import { UPSTREAM_TIMEOUT_MS } from "../reference";
import { AnswerCache, LiveError } from "./cache";

export interface GeocodeMatch {
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  source: string;
}

/** Sent to the keyless geocoders, which ask clients to identify themselves. */
const USER_AGENT = "Tender (https://tender.heyarca.app)";
const matches = new AnswerCache<GeocodeMatch>(10 * 60_000);

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
  return response.json();
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
/** Distinct non-empty parts joined with commas. */
const joinLabel = (parts: unknown[]) => [...new Set(parts.map(text).filter(Boolean))].join(", ");
const coordinate = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid coordinate");
  return value;
};

const noMatch = () => new LiveError(422, "no_match", "Nothing matches this query. Try a fuller address or place name.");

/** Addresses, landmarks, and districts from OpenStreetMap through Photon. */
async function searchAddress(query: string): Promise<GeocodeMatch> {
  const body = (await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`)) as {
    features?: { geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }[];
  };
  const feature = body.features?.[0];
  if (!feature) throw noMatch();
  const p = feature.properties ?? {};
  const street = [text(p.housenumber), text(p.street)].filter(Boolean).join(" ");
  return {
    label: joinLabel([p.name, street, p.city ?? p.district, p.state, p.country]),
    latitude: coordinate(feature.geometry?.coordinates?.[1]),
    longitude: coordinate(feature.geometry?.coordinates?.[0]),
    countryCode: text(p.countrycode).toUpperCase(),
    source: "photon",
  };
}

/** Cities and towns from GeoNames through the Open-Meteo geocoding API. */
async function searchPlace(query: string): Promise<GeocodeMatch> {
  const body = (await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`)) as {
    results?: Record<string, unknown>[];
  };
  const place = body.results?.[0];
  if (!place) throw noMatch();
  return {
    label: joinLabel([place.name, place.admin1, place.country]),
    latitude: coordinate(place.latitude),
    longitude: coordinate(place.longitude),
    countryCode: text(place.country_code).toUpperCase(),
    source: "open-meteo",
  };
}

/** Best match of `query`: `address` searches addresses and landmarks, `place` searches cities and towns. */
export function geocode(query: string, type: string): Promise<GeocodeMatch> {
  const key = `${type}:${query.toLowerCase()}`;
  return matches.get(key, async () => {
    try {
      return await (type === "place" ? searchPlace(query) : searchAddress(query));
    } catch (error) {
      if (error instanceof LiveError) throw error;
      console.error("Tender geocoder error", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
      throw new LiveError(502, "provider_error", "The geocoder did not answer. Try again shortly.");
    }
  });
}
