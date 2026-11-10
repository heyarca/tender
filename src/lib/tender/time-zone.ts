const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Abbreviations `Intl` does not give in en-US (it falls back to "GMT+9"). Zones without daylight
 * saving use one name; London switches with the offset, so it is decided per timestamp.
 */
const FIXED_ABBREVIATIONS: Readonly<Record<string, string>> = {
  "Asia/Seoul": "KST",
  "Asia/Tokyo": "JST",
  "Asia/Singapore": "SGT",
  "Asia/Shanghai": "CST",
};

/** A timestamp's zone abbreviation, including daylight saving time. */
export function timeZoneLabel(timeZone: string, at: number): string {
  const fixed = FIXED_ABBREVIATIONS[timeZone];
  if (fixed) return fixed;
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
    formatters.set(timeZone, formatter);
  }
  const label = formatter.formatToParts(at).find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  if (timeZone === "Europe/London") return label === "GMT+1" ? "BST" : "GMT";
  return label;
}
