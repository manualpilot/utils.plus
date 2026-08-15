import { describe, expect, it } from "vitest";
import { TIME_ZONES, zoneClock } from "../src/common/zone-clock";
import { httpDate, isoBasic, isoExtended, isoOrdinalDate, isoWeekDate, relativeTime, rfc2822 } from "../src/utilities/time/formats";
import { readTimestamp, wallToIso } from "../src/utilities/time/read";

const BERLIN_SUMMER = new Date("2026-08-10T12:34:56.789Z");
const BERLIN_WINTER = new Date("2026-01-10T12:34:56.000Z");

const read = (text: string) => readTimestamp(text);
const at = (text: string) => read(text).date?.toISOString();

describe("readTimestamp", () => {
  it("follows the clock when nothing has been typed", () => {
    expect(read("  ")).toEqual({ date: null, source: "Following the clock", error: "" });
  });

  it.each([
    ["1770726896", "Unix seconds", "2026-02-10T12:34:56.000Z"],
    ["1770726896789", "Unix milliseconds", "2026-02-10T12:34:56.789Z"],
    ["1770726896789000", "Unix microseconds", "2026-02-10T12:34:56.789Z"],
    ["1770726896789000000", "Unix nanoseconds", "2026-02-10T12:34:56.789Z"],
  ])("reads %s as %s", (text, source, iso) => {
    expect(read(text)).toMatchObject({ source, error: "" });
    expect(at(text)).toBe(iso);
  });

  it("keeps the milliseconds a nanosecond epoch carries past what a double counts singly", () => {
    expect(at("1770726896789123456")).toBe("2026-02-10T12:34:56.789Z");
  });

  it("reads a fractional epoch as the seconds it usually is", () => {
    expect(read("1770726896.789")).toMatchObject({ source: "Unix seconds, fractional" });
    expect(at("1770726896.789")).toBe("2026-02-10T12:34:56.789Z");
  });

  it("reads a signed epoch as the year before 1970 it names", () => {
    expect(at("-86400")).toBe("1969-12-31T00:00:00.000Z");
    expect(at("0")).toBe("1970-01-01T00:00:00.000Z");
  });

  it("says which end of an ISO string decided how it was read", () => {
    expect(read("2026-08-10T14:34:56+02:00").source).toBe("ISO 8601");
    expect(at("2026-08-10T14:34:56+02:00")).toBe("2026-08-10T12:34:56.000Z");
    expect(read("2026-08-10T12:34:56").source).toBe("ISO 8601, no offset — read as local time");
    expect(read("2026-08-10").source).toBe("ISO 8601 date — read as UTC midnight");
    expect(at("2026-08-10")).toBe("2026-08-10T00:00:00.000Z");
  });

  it("takes a space where an ISO string wants its T", () => {
    expect(at("2026-08-10 12:34:56Z")).toBe("2026-08-10T12:34:56.000Z");
  });

  it("names the mail and HTTP spellings apart", () => {
    expect(read("Mon, 10 Aug 2026 14:34:56 +0200").source).toBe("RFC 2822");
    expect(at("Mon, 10 Aug 2026 14:34:56 +0200")).toBe("2026-08-10T12:34:56.000Z");
    expect(read("Mon, 10 Aug 2026 12:34:56 GMT").source).toBe("RFC 1123 (HTTP date)");
    expect(at("Mon, 10 Aug 2026 12:34:56 GMT")).toBe("2026-08-10T12:34:56.000Z");
  });

  it("reads the largest epoch each digit count can spell", () => {
    expect(read("99999999999")).toMatchObject({ source: "Unix seconds" });
    expect(at("99999999999")).toBe("5138-11-16T09:46:39.000Z");
  });

  it.each([
    ["half past four", "That is not an epoch or a date this page can read"],
    ["2026-13-40", "That is not an epoch or a date this page can read"],
    ["99999999999999999999999", "That is more digits than any epoch unit uses"],
    ["+275760-09-13T00:00:00.000Z", "Only the years 1 through 9999 can be shown"],
    ["-99999999999", "Only the years 1 through 9999 can be shown"],
  ])("refuses %s", (text, error) => {
    expect(read(text)).toEqual({ date: null, source: "", error });
  });
});

describe("the zone list", () => {
  it("offers UTC first, then every zone once", () => {
    expect(TIME_ZONES[0]).toBe("UTC");
    expect(new Set(TIME_ZONES).size).toBe(TIME_ZONES.length);
    expect(TIME_ZONES.length).toBeGreaterThan(300);
  });

  it("carries no name Intl cannot format, renamed ones included", () => {
    expect(TIME_ZONES.filter((zone) => !formats(zone))).toEqual([]);
  });

  it("says Kolkata and Kyiv, which is where ICU's canonical names stopped", () => {
    expect(TIME_ZONES).toContain("Asia/Kolkata");
    expect(TIME_ZONES).toContain("Europe/Kyiv");
    expect(TIME_ZONES).not.toContain("Asia/Calcutta");
    expect(TIME_ZONES).not.toContain("Europe/Kiev");
  });
});

function formats(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(BERLIN_SUMMER);
    return true;
  } catch {
    return false;
  }
}

describe("zoneClock", () => {
  it.each([
    ["UTC", BERLIN_SUMMER, 0, 12],
    ["Europe/Berlin", BERLIN_SUMMER, 120, 14],
    ["Europe/Berlin", BERLIN_WINTER, 60, 13],
    ["America/New_York", BERLIN_SUMMER, -240, 8],
    ["America/New_York", BERLIN_WINTER, -300, 7],
    ["Asia/Kolkata", BERLIN_SUMMER, 330, 18],
    ["Pacific/Chatham", BERLIN_SUMMER, 765, 1],
  ])("puts %s at the offset its rules say for that date", (zone, date, offsetMinutes, hour) => {
    const clock = zoneClock(date, zone);
    expect(clock.offsetMs / 60000).toBe(offsetMinutes);
    expect(clock.hour).toBe(hour);
  });

  it("keeps the milliseconds the offset never touches", () => {
    expect(zoneClock(BERLIN_SUMMER, "Asia/Kolkata")).toMatchObject({ minute: 4, second: 56, millisecond: 789 });
  });

  it("holds the wall clock either side of a spring-forward", () => {
    expect(zoneClock(new Date("2026-03-29T00:59:00Z"), "Europe/Berlin").hour).toBe(1);
    expect(zoneClock(new Date("2026-03-29T01:00:00Z"), "Europe/Berlin").hour).toBe(3);
  });
});

describe("formats", () => {
  const berlin = zoneClock(BERLIN_SUMMER, "Europe/Berlin");
  const utc = zoneClock(BERLIN_SUMMER, "UTC");
  const kolkata = zoneClock(BERLIN_SUMMER, "Asia/Kolkata");
  const newYork = zoneClock(BERLIN_SUMMER, "America/New_York");

  it("writes ISO 8601 with the offset that belongs to the zone", () => {
    expect(isoExtended(berlin)).toBe("2026-08-10T14:34:56.789+02:00");
    expect(isoExtended(kolkata)).toBe("2026-08-10T18:04:56.789+05:30");
    expect(isoExtended(newYork)).toBe("2026-08-10T08:34:56.789-04:00");
  });

  it("spells UTC as Z and nothing else", () => {
    expect(isoExtended(utc)).toBe("2026-08-10T12:34:56.789Z");
    expect(isoBasic(utc)).toBe("20260810T123456.789Z");
    expect(isoExtended(zoneClock(BERLIN_WINTER, "Europe/London"))).toBe("2026-01-10T12:34:56+00:00");
  });

  it("leaves the fraction off an instant that lands on the second", () => {
    expect(isoExtended(zoneClock(BERLIN_WINTER, "Europe/Berlin"))).toBe("2026-01-10T13:34:56+01:00");
    expect(isoBasic(zoneClock(BERLIN_WINTER, "Europe/Berlin"))).toBe("20260110T133456+0100");
  });

  it("drops the separators for the basic form", () => {
    expect(isoBasic(berlin)).toBe("20260810T143456.789+0200");
    expect(isoBasic(kolkata)).toBe("20260810T180456.789+0530");
  });

  it.each([
    ["2026-08-10T12:00:00Z", "2026-W33-1"],
    ["2021-01-01T12:00:00Z", "2020-W53-5"],
    ["2026-01-01T12:00:00Z", "2026-W01-4"],
    ["2024-12-30T12:00:00Z", "2025-W01-1"],
    ["2020-12-31T12:00:00Z", "2020-W53-4"],
    ["2026-08-16T12:00:00Z", "2026-W33-7"],
  ])("puts %s in the ISO week %s", (iso, expected) => {
    expect(isoWeekDate(zoneClock(new Date(iso), "UTC"))).toBe(expected);
  });

  it.each([
    ["2026-01-01T12:00:00Z", "2026-001"],
    ["2026-08-10T12:00:00Z", "2026-222"],
    ["2026-12-31T12:00:00Z", "2026-365"],
    ["2024-12-31T12:00:00Z", "2024-366"],
  ])("counts %s as the ordinal date %s", (iso, expected) => {
    expect(isoOrdinalDate(zoneClock(new Date(iso), "UTC"))).toBe(expected);
  });

  it("writes RFC 2822 with digits for the zone, UTC included", () => {
    expect(rfc2822(berlin)).toBe("Mon, 10 Aug 2026 14:34:56 +0200");
    expect(rfc2822(newYork)).toBe("Mon, 10 Aug 2026 08:34:56 -0400");
    expect(rfc2822(utc)).toBe("Mon, 10 Aug 2026 12:34:56 +0000");
  });

  it("writes the HTTP date in GMT whatever zones are on screen", () => {
    expect(httpDate(BERLIN_SUMMER)).toBe("Mon, 10 Aug 2026 12:34:56 GMT");
    expect(httpDate(BERLIN_SUMMER)).toBe(BERLIN_SUMMER.toUTCString());
  });

  it.each(["UTC", "Europe/Berlin", "Asia/Kolkata", "America/New_York", "Pacific/Chatham", "Asia/Kathmandu"])(
    "round-trips through %s",
    (zone) => {
      const clock = zoneClock(BERLIN_SUMMER, zone);
      expect(Date.parse(isoExtended(clock))).toBe(BERLIN_SUMMER.getTime());
      expect(Date.parse(rfc2822(clock))).toBe(BERLIN_SUMMER.getTime() - BERLIN_SUMMER.getMilliseconds());
      expect(readTimestamp(isoExtended(clock)).date?.getTime()).toBe(BERLIN_SUMMER.getTime());
    },
  );
});

describe("wallToIso", () => {
  it.each([
    ["2026-02-10 13:34:56", "Europe/Berlin", "2026-02-10T13:34:56+01:00"],
    ["2026-08-10 14:34:56", "Europe/Berlin", "2026-08-10T14:34:56+02:00"],
    ["2026-02-10 12:34:56", "UTC", "2026-02-10T12:34:56Z"],
    ["2026-02-10 18:04:56", "Asia/Kolkata", "2026-02-10T18:04:56+05:30"],
  ])("writes %s in %s with the offset that applied", (wall, zone, expected) => {
    expect(wallToIso(wall, zone)).toBe(expected);
  });

  it("carries a wall clock a spring-forward took away through to the hour that replaced it", () => {
    expect(wallToIso("2026-03-29 02:30:00", "Europe/Berlin")).toBe("2026-03-29T03:30:00+02:00");
  });

  it("takes the first of an hour handed back", () => {
    expect(wallToIso("2026-10-25 02:30:00", "Europe/Berlin")).toBe("2026-10-25T02:30:00+02:00");
  });

  it.each(["2026-02-10", "2026-02-10 13:34", "half past four", ""])("has nothing to write for %s", (wall) => {
    expect(wallToIso(wall, "UTC")).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = BERLIN_SUMMER.getTime();
  const ago = (ms: number) => relativeTime(now - ms, now);

  it.each([
    [0, "now"],
    [45 * 1000, "45 seconds ago"],
    [5 * 60 * 1000, "5 minutes ago"],
    [3 * 3600 * 1000, "3 hours ago"],
    [3 * 86400000, "3 days ago"],
    [3 * 7 * 86400000, "3 weeks ago"],
    [200 * 86400000, "6 months ago"],
    [800 * 86400000, "2 years ago"],
  ])("describes %d ms back as %s", (ms, expected) => {
    expect(ago(ms)).toBe(expected);
  });

  it("counts forwards as readily as back", () => {
    expect(relativeTime(now + 2 * 3600 * 1000, now)).toBe("in 2 hours");
  });
});
