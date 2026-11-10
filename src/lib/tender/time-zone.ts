const formatters = new Map<string, Intl.DateTimeFormat>();

/** A timestamp's actual zone abbreviation/offset, including daylight saving time. */
export function timeZoneLabel(timeZone: string, at: number): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
    formatters.set(timeZone, formatter);
  }
  return formatter.formatToParts(at).find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}
