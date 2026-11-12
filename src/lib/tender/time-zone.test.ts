import { describe, expect, it } from "vitest";
import { timeZoneLabel } from "./time-zone";
import { dateTime, time } from "./format";
import { formatTimestamp } from "@/components/result/field-format";

const winter = Date.UTC(2026, 0, 15, 12);
const summer = Date.UTC(2026, 6, 15, 12);

describe("market timestamp zones", () => {
  it.each([
    ["America/Los_Angeles", "PST", "PDT"],
    ["America/New_York", "EST", "EDT"],
    ["Europe/London", "GMT", "BST"],
    ["Asia/Seoul", "KST", "KST"],
    ["Asia/Tokyo", "JST", "JST"],
    ["Asia/Singapore", "SGT", "SGT"],
    ["Asia/Shanghai", "CST", "CST"],
    ["UTC", "UTC", "UTC"],
  ])("labels %s as %s in winter and %s in summer", (zone, winterLabel, summerLabel) => {
    expect(timeZoneLabel(zone, winter)).toBe(winterLabel);
    expect(timeZoneLabel(zone, summer)).toBe(summerLabel);
    for (const [at, label] of [[winter, winterLabel], [summer, summerLabel]] as const) {
      expect(time(at, zone)).toContain(label);
      expect(dateTime(at, zone)).toContain(label);
      expect(formatTimestamp(at, zone)).toContain(label);
    }
  });
});
