import { Cloud, CloudDrizzle, CloudFog, CloudRain, CloudSun, Sun, SunDim, Wind, type LucideIcon } from "lucide-react";
import type { WeatherCondition } from "./types";

export const WEATHER_CONDITIONS: Record<WeatherCondition, { label: string; icon: LucideIcon }> = {
  clear: { label: "Clear", icon: Sun },
  "mostly-clear": { label: "Mostly clear", icon: SunDim },
  "partly-cloudy": { label: "Partly cloudy", icon: CloudSun },
  overcast: { label: "Overcast", icon: Cloud },
  fog: { label: "Fog", icon: CloudFog },
  drizzle: { label: "Drizzle", icon: CloudDrizzle },
  rain: { label: "Rain", icon: CloudRain },
  wind: { label: "Windy", icon: Wind },
};

/** Label and lucide icon for a condition code. Unknown codes fall back to overcast. */
export function weatherCondition(condition: WeatherCondition | string) {
  return WEATHER_CONDITIONS[condition as WeatherCondition] ?? WEATHER_CONDITIONS.overcast;
}
