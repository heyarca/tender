import timeline from "./timeline.json";
import type { Timeline } from "./types";

export const tl = timeline as unknown as Timeline;

export const INK = "#03080A";
export const LIME = "#C8FF00";
export const OLIVE = "#4A6000";
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
