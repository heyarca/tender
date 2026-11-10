import { describe, expect, it } from "vitest";
import { timeZoneLabel } from "./time-zone";
import { dateTime, time } from "./format";
import { formatTimestamp } from "@/components/result/field-format";

const winter = Date.UTC(2026, 0, 15, 12);
const summer = Date.UTC(2026, 6, 15, 12);

describe("market timestamp zones", () => {
  it.each(["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Seoul", "Asia/Tokyo", "Asia/Singapore", "Asia/Shanghai", "UTC"])("uses one actual timestamp zone in %s", (zone) => {
    for (const at of [winter, summer]) {
      const expected = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")!.value;
      expect(timeZoneLabel(zone, at)).toBe(expected);
      expect(time(at, zone)).toContain(expected);
      expect(dateTime(at, zone)).toContain(expected);
      expect(formatTimestamp(at, zone)).toContain(expected);
    }
  });
  it("does not cache a seasonal label across DST", () => {
    expect(timeZoneLabel("America/Los_Angeles", winter)).toBe("PST");
    expect(timeZoneLabel("America/Los_Angeles", summer)).toBe("PDT");
    expect(timeZoneLabel("Europe/London", winter)).not.toBe(timeZoneLabel("Europe/London", summer));
  });
});
