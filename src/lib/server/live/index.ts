/**
 * Live results of the fields markets (every contract besides weather.current and prices.spot, whose
 * live inputs anchor the engine instead; see `../reference`). The engine still selects the provider and
 * models its latency and failures; a live source then supplies the result fields.
 */
import type { MarketSpec } from "@/lib/registry";
import { loadAirQuality, type Place } from "../reference";
import { chat, translate } from "./ai";
import { geocode } from "./geocoding";
import { pageMetadata } from "./metadata";

export { LiveError } from "./cache";

export interface LiveResult {
  data: Record<string, unknown>;
  /** Upstream that produced the fields, e.g. "open-meteo" or the model id. */
  source: string;
  timestamp: string;
}

const AIR_QUALITY_PLACES: Readonly<Record<string, Place>> = {
  seoul: { latitude: 37.5665, longitude: 126.978 },
  london: { latitude: 51.5074, longitude: -0.1278 },
  "los-angeles": { latitude: 34.0522, longitude: -118.2437 },
};

/** US EPA AQI category. */
function aqiCategory(aqi: number): string {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy-sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very-unhealthy";
  return "hazardous";
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * The live result of a fields market for the request's inputs, built over the engine's `data`.
 * `undefined` when the market has no live source, or (air quality) when the keyless source fails
 * and the engine's values are served. Throws `LiveError` when an input-driven source fails.
 */
export async function liveResult(spec: MarketSpec, inputs: Readonly<Record<string, string>>, data: Record<string, unknown>): Promise<LiveResult | undefined> {
  if (spec.source !== "upstream") return undefined;
  switch (spec.contractId) {
    case "translation.text": {
      const answer = await translate(inputs.text, spec.params.source, spec.params.target);
      return { source: answer.model, timestamp: answer.at, data: {
        translation: answer.text, sourceLanguage: spec.params.source, targetLanguage: spec.params.target,
        characters: [...inputs.text].length,
      } };
    }
    case "chat.complete": {
      const answer = await chat(inputs.prompt, spec.params.model);
      return { source: answer.model, timestamp: answer.at, data: {
        model: spec.params.model, output: answer.text, finishReason: answer.finishReason,
        inputTokens: answer.inputTokens, outputTokens: answer.outputTokens,
      } };
    }
    case "geocoding.search": {
      const match = await geocode(inputs.query, spec.params.type);
      return { source: match.source, timestamp: new Date().toISOString(), data: {
        label: match.label, latitude: match.latitude, longitude: match.longitude, countryCode: match.countryCode,
      } };
    }
    case "web.metadata": {
      const page = await pageMetadata(inputs.url);
      return { source: new URL(page.url).hostname, timestamp: new Date().toISOString(), data: { ...page } };
    }
    case "airQuality.current": {
      const place = AIR_QUALITY_PLACES[spec.params.location];
      const input = place ? await loadAirQuality(place) : null;
      if (!input) return undefined;
      const air = input.value;
      return { source: input.source, timestamp: input.timestamp, data: {
        ...data, aqi: Math.round(air.aqi), category: aqiCategory(air.aqi), dominantPollutant: air.dominant_pollutant,
        pm25: round(air.pm25, 1), pm10: round(air.pm10, 1), ozone: round(air.ozone_ppm, 3),
      } };
    }
    default:
      return undefined;
  }
}
