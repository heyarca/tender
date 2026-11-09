/**
 * Splits a formatted value into number and unit for `StatCard`
 * (`"210 ms"` → `["210", "ms"]`, `"1 h 12 min"` → `["1 h 12", "min"]`, `"99.94%"` → `["99.94%", ""]`).
 */
export function splitUnit(text: string): [value: string, unit: string] {
  const index = text.lastIndexOf(" ");
  if (index <= 0) return [text, ""];
  return [text.slice(0, index), text.slice(index + 1)];
}
