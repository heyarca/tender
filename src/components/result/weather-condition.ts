import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSun,
  Cloudy,
  Sun,
  SunDim,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { WeatherCondition } from "./types";

export interface WeatherConditionInfo {
  code: WeatherCondition;
  label: string;
  icon: LucideIcon;
}

export const WEATHER_CONDITIONS: Record<WeatherCondition, WeatherConditionInfo> = {
  clear: { code: "clear", label: "Clear", icon: Sun },
  "mostly-clear": { code: "mostly-clear", label: "Mostly clear", icon: SunDim },
  "partly-cloudy": { code: "partly-cloudy", label: "Partly cloudy", icon: CloudSun },
  "mostly-cloudy": { code: "mostly-cloudy", label: "Mostly cloudy", icon: Cloudy },
  overcast: { code: "overcast", label: "Overcast", icon: Cloud },
  fog: { code: "fog", label: "Fog", icon: CloudFog },
  drizzle: { code: "drizzle", label: "Drizzle", icon: CloudDrizzle },
  rain: { code: "rain", label: "Rain", icon: CloudRain },
  wind: { code: "wind", label: "Windy", icon: Wind },
};

/** Keyword fallbacks for free-form labels ("Light rain", "Haze"), checked in order. */
const KEYWORDS: ReadonlyArray<readonly [RegExp, WeatherCondition]> = [
  [/fog|mist|haze|smoke/, "fog"],
  [/drizzle/, "drizzle"],
  [/rain|shower|storm|thunder/, "rain"],
  [/wind|breez|gust/, "wind"],
  [/overcast/, "overcast"],
  [/partly/, "partly-cloudy"],
  [/mostly clear|mainly clear/, "mostly-clear"],
  [/cloud/, "mostly-cloudy"],
  [/clear|sun|fair/, "clear"],
];

function isCode(value: string): value is WeatherCondition {
  return Object.hasOwn(WEATHER_CONDITIONS, value);
}

/**
 * Resolves a condition code (`partly-cloudy`) or a display label (`Partly cloudy`, `Light rain`)
 * to a code, a label, and a lucide icon. Labels keep their own wording; unknown values use the
 * overcast icon.
 */
export function weatherCondition(condition: string): WeatherConditionInfo {
  const raw = condition.trim();
  if (isCode(raw)) return WEATHER_CONDITIONS[raw];
  const normalized = raw.toLowerCase().replace(/[\s_]+/g, " ");
  const slug = normalized.replace(/ /g, "-");
  const code: WeatherCondition = isCode(slug)
    ? slug
    : (KEYWORDS.find(([pattern]) => pattern.test(normalized))?.[1] ?? "overcast");
  const info = WEATHER_CONDITIONS[code];
  return { ...info, label: raw || info.label };
}
