import rawTimeZones from "@vvo/tzdb/raw-time-zones.json";
import { describe, expect, it } from "vitest";
import { TIME_ZONES, wallDate, wallText, zoneClock } from "../src/common/zone-clock";
import { betweenInstants, elapsedMs, shiftInstant } from "../src/utilities/time/arithmetic";
import { clockDuration, compactDuration, isoDuration, readDuration, signedCompact, spelledDuration, unitTotals } from "../src/utilities/time/duration";
import { httpDate, isoBasic, isoExtended, isoOrdinalDate, isoWeekDate, relativeTime, rfc2822 } from "../src/utilities/time/formats";
import { readTimestamp } from "../src/utilities/time/read";
import { zoneFilter, zoneMatches } from "../src/utilities/time/zones";

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

describe("the zone search", () => {
  it("finds a zone by the country it is in, which its own name never says", () => {
    expect(search("new zealand")).toEqual(["Pacific/Auckland", "Pacific/Chatham", "Antarctica/McMurdo"]);
    expect(search("germany")).toEqual(["Europe/Berlin"]);
    expect(search("deutschland")).toEqual([]);
  });

  it("finds a zone by a city it keeps the time of and is not named after", () => {
    expect(search("wellington")).toEqual(["Pacific/Auckland"]);
    expect(search("rio de janeiro")).toEqual(["America/Sao_Paulo"]);
  });

  it("reads an underscore and a space as each other, which the IANA name spells one way", () => {
    expect(search("new york")).toContain("America/New_York");
    expect(search("new_york")).toEqual(search("new york"));
  });

  it("finds a zone by what its clock reads as well as by where it is", () => {
    expect(search("nzst")).toEqual(["Antarctica/McMurdo", "Pacific/Auckland"]);
    expect(search("+05:30")).toEqual(["Asia/Colombo", "Asia/Kolkata"]);
    expect(search("cst").slice(0, 3)).toEqual(["America/Bahia_Banderas", "America/Belize", "America/Chicago"]);
  });

  it("ranks the name on the label first, then the country, then the cities in it", () => {
    expect(search("chi").slice(0, 3)).toEqual(["America/Chicago", "America/Chihuahua", "Asia/Chita"]);
    expect(search("chi")).toContain("Asia/Shanghai");
    expect(search("china").slice(0, 2)).toEqual(["Asia/Shanghai", "Asia/Urumqi"]);
    expect(search("china")).toContain("America/Managua");
    expect(search("auckland")[0]).toBe("Pacific/Auckland");
  });

  it("offers the whole list for a search nobody has typed into, and none of it for a word nowhere on earth", () => {
    expect(search("   ")).toEqual(TIME_ZONES);
    expect(search("zzzz")).toEqual([]);
  });

  it("answers to every name it offers, UTC included", () => {
    expect(search("utc")).toEqual(["UTC"]);
    expect(TIME_ZONES.filter((zone) => !search(zone).includes(zone))).toEqual([]);
  });

  it("has tzdb's account of every zone the picker offers", () => {
    const known = new Set(rawTimeZones.flatMap((zone) => [zone.name, ...zone.group]));
    expect(TIME_ZONES.filter((zone) => zone !== "UTC" && !known.has(zone))).toEqual([]);
  });
});

describe("the reason a zone answered", () => {
  it("names the word that matched and never one the label already says", () => {
    expect(zoneMatches("Pacific/Auckland", "wellington")).toEqual(["Wellington"]);
    expect(zoneMatches("Pacific/Auckland", "auckland")).toEqual([]);
    expect(zoneMatches("Asia/Shanghai", "china")).toEqual(["China"]);
  });

  it("says one reason where two would say the same thing", () => {
    expect(zoneMatches("Pacific/Auckland", "new zealand")).toEqual(["New Zealand"]);
    expect(zoneMatches("Antarctica/McMurdo", "new zealand")).toEqual(["New Zealand Time"]);
  });

  it("names them in the order the bands are ranked in", () => {
    expect(zoneMatches("Africa/Abidjan", "a")).toEqual(["Ivory Coast", "Abobo", "Bouaké", "Greenwich Mean Time"]);
  });

  it("has nothing to say for a search nobody has typed, or a zone that is nowhere", () => {
    expect(zoneMatches("Pacific/Auckland", "   ")).toEqual([]);
    expect(zoneMatches("UTC", "utc")).toEqual([]);
  });
});

const ZONE_OPTIONS = TIME_ZONES.map((zone) => ({ value: zone, label: zone }));

function search(term: string): string[] {
  return zoneFilter({ options: ZONE_OPTIONS, search: term, limit: Infinity })
    .flatMap((option) => "value" in option ? [String(option.value)] : []);
}

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

describe("wallDate", () => {
  const iso = (wall: string, zone: string) => {
    const date = wallDate(wall, zone);
    return date && isoExtended(zoneClock(date, zone));
  };

  it.each([
    ["2026-02-10 13:34:56", "Europe/Berlin", "2026-02-10T13:34:56+01:00"],
    ["2026-08-10 14:34:56", "Europe/Berlin", "2026-08-10T14:34:56+02:00"],
    ["2026-02-10 12:34:56", "UTC", "2026-02-10T12:34:56Z"],
    ["2026-02-10 18:04:56", "Asia/Kolkata", "2026-02-10T18:04:56+05:30"],
  ])("reads %s in %s at the offset that applied", (wall, zone, expected) => {
    expect(iso(wall, zone)).toBe(expected);
  });

  it("carries a wall clock a spring-forward took away through to the hour that replaced it", () => {
    expect(iso("2026-03-29 02:30:00", "Europe/Berlin")).toBe("2026-03-29T03:30:00+02:00");
  });

  it("takes the first of an hour handed back", () => {
    expect(iso("2026-10-25 02:30:00", "Europe/Berlin")).toBe("2026-10-25T02:30:00+02:00");
  });

  it.each(["2026-02-10", "2026-02-10 13:34", "half past four", ""])("has nothing to read in %s", (wall) => {
    expect(wallDate(wall, "UTC")).toBeNull();
  });

  it.each([
    ["2026-02-10 13:34:56", "Europe/Berlin"],
    ["2026-08-10 14:34:56", "Europe/Berlin"],
    ["2026-02-10 12:34:56", "UTC"],
    ["2026-02-10 18:04:56", "Asia/Kolkata"],
    ["2026-02-10 21:34:56", "Asia/Tokyo"],
  ])("writes %s back as itself in %s", (wall, zone) => {
    const date = wallDate(wall, zone);
    expect(date && wallText(zoneClock(date, zone))).toBe(wall);
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

describe("readDuration", () => {
  const span = (text: string) => readDuration(text);
  const of = (text: string) => span(text).duration;

  it("has nothing to read in a blank box, and says so without calling it wrong", () => {
    expect(span("  ")).toEqual({ duration: null, source: "", error: "" });
  });

  it.each([
    ["1h 30m", "Units"],
    ["PT1H30M", "ISO 8601 duration"],
    ["01:30:00", "Clock, h:mm:ss"],
    ["90:00", "Clock, mm:ss"],
    ["5400", "Seconds"],
  ])("reads %s as %s", (text, source) => {
    expect(span(text)).toMatchObject({ source, error: "" });
    expect(of(text)).toEqual({ years: 0, months: 0, days: 0, ms: 5400000, negative: false });
  });

  it("takes two colons as hours and one as minutes", () => {
    expect(of("1:30")).toMatchObject({ ms: 90000 });
    expect(of("1:30:00")).toMatchObject({ ms: 5400000 });
  });

  it("keeps the calendar units apart from the fixed ones", () => {
    expect(of("P1Y2M3DT4H5M6S")).toEqual({ years: 1, months: 2, days: 3, ms: 14706000, negative: false });
    expect(of("1y 2mo 3d 4h 5m 6s")).toEqual(of("P1Y2M3DT4H5M6S"));
  });

  it("counts a week as seven days and carries twelve months into a year", () => {
    expect(of("P3W")).toMatchObject({ days: 21, months: 0 });
    expect(of("18mo")).toMatchObject({ years: 1, months: 6 });
  });

  it("reads a fraction of a year as months and of a day as hours", () => {
    expect(of("0.5y")).toMatchObject({ years: 0, months: 6 });
    expect(of("1.5d")).toMatchObject({ days: 1, ms: 43200000 });
    expect(of("PT1.5H")).toMatchObject({ ms: 5400000 });
  });

  it("reads the units a log is written in, down to the nanosecond", () => {
    expect(of("250ms")).toMatchObject({ ms: 250 });
    expect(of("1500ns")).toMatchObject({ ms: 0.0015 });
    expect(of("36h")).toEqual({ years: 0, months: 0, days: 0, ms: 129600000, negative: false });
  });

  it("takes a sign in front of the whole of it, and only there", () => {
    expect(of("-PT1H")).toEqual({ years: 0, months: 0, days: 0, ms: 3600000, negative: true });
    expect(of("-1h 30m")).toMatchObject({ ms: 5400000, negative: true });
    expect(of("+90s")).toMatchObject({ ms: 90000, negative: false });
  });

  it("takes the words somebody writes between the units", () => {
    expect(of("3 days and 4 hours")).toEqual(of("P3DT4H"));
    expect(of("1 hour, 30 minutes")).toEqual(of("PT1H30M"));
  });

  it.each([
    ["half an hour", "That is not a duration this page can read"],
    ["1h and then some", "That is not a duration this page can read"],
    ["P", "That is not a duration this page can read"],
    ["1 fortnight", "There is no unit of time called fortnight"],
    ["1.1mo", "A fraction of a month is not a length this page can read"],
    ["100000y", "That is longer than the years this page can show"],
  ])("refuses %s", (text, error) => {
    expect(span(text)).toEqual({ duration: null, source: "", error });
  });
});

describe("the duration forms", () => {
  const of = (text: string) => readDuration(text).duration!;

  it("writes back every ISO 8601 duration it read", () => {
    expect(isoDuration(of("P1Y2M3DT4H5M6S"))).toBe("P1Y2M3DT4H5M6S");
    expect(isoDuration(of("250ms"))).toBe("PT0.25S");
    expect(isoDuration(of("-1h"))).toBe("-PT1H");
    expect(isoDuration(of("0s"))).toBe("PT0S");
  });

  it("writes the compact form in the letters somebody would have typed", () => {
    expect(compactDuration(of("P1Y2M3DT4H5M6S"))).toBe("1y 2mo 3d 4h 5m 6s");
    expect(compactDuration(of("1500ns"))).toBe("0.0015ms");
    expect(compactDuration(of("0s"))).toBe("0s");
  });

  it("spells the units out", () => {
    expect(spelledDuration(of("PT1H30M"))).toBe("1 hour and 30 minutes");
    expect(spelledDuration(of("PT0S"))).toBe("0 seconds");
  });

  it("writes the clock past twenty-four hours and under a second", () => {
    expect(clockDuration(5400000)).toBe("01:30:00");
    expect(clockDuration(-5400000)).toBe("-01:30:00");
    expect(clockDuration(90061001)).toBe("25:01:01.001");
    expect(clockDuration(0)).toBe("00:00:00");
  });

  it("counts the whole of a span in every unit it fills", () => {
    expect(unitTotals(5400000)).toEqual([
      { label: "Weeks", value: "0.008928571" },
      { label: "Days", value: "0.0625" },
      { label: "Hours", value: "1.5" },
      { label: "Minutes", value: "90" },
      { label: "Seconds", value: "5400" },
      { label: "Milliseconds", value: "5400000" },
    ]);
  });

  it("says which way a shift goes, whichever way the duration was written", () => {
    expect(signedCompact(of("1h 30m"), 1)).toBe("+1h 30m");
    expect(signedCompact(of("1h 30m"), -1)).toBe("-1h 30m");
    expect(signedCompact(of("-1h 30m"), 1)).toBe("-1h 30m");
    expect(signedCompact(of("-1h 30m"), -1)).toBe("+1h 30m");
  });
});

describe("shiftInstant", () => {
  const of = (text: string) => readDuration(text).duration!;
  const shift = (iso: string, text: string, sign: number, zone: string) => {
    const landed = shiftInstant(new Date(iso), of(text), sign, zone);
    return landed && isoExtended(zoneClock(landed, zone));
  };

  it("keeps the wall clock a day later, whatever the day turned out to be worth", () => {
    expect(shift("2026-03-28T11:00:00Z", "1d", 1, "Europe/Berlin")).toBe("2026-03-29T12:00:00+02:00");
    expect(elapsedMs(of("1d"), new Date("2026-03-28T11:00:00Z"), "Europe/Berlin")).toBe(82800000);
  });

  it("adds twenty-four hours as twenty-four hours", () => {
    expect(shift("2026-03-28T11:00:00Z", "24h", 1, "Europe/Berlin")).toBe("2026-03-29T13:00:00+02:00");
    expect(elapsedMs(of("24h"), new Date("2026-03-28T11:00:00Z"), "Europe/Berlin")).toBe(86400000);
  });

  it("carries a wall clock a spring-forward took away through to the hour that replaced it", () => {
    expect(shift("2026-03-28T02:30:00+01:00", "1d", 1, "Europe/Berlin")).toBe("2026-03-29T03:30:00+02:00");
  });

  it("lands on the last day of a month with no thirty-first of its own", () => {
    expect(shift("2026-01-31T12:00:00Z", "1mo", 1, "UTC")).toBe("2026-02-28T12:00:00Z");
    expect(shift("2026-03-31T12:00:00Z", "1mo", -1, "UTC")).toBe("2026-02-28T12:00:00Z");
    expect(shift("2024-02-29T12:00:00Z", "1y", 1, "UTC")).toBe("2025-02-28T12:00:00Z");
  });

  it("takes a duration written backwards backwards", () => {
    expect(shift("2026-02-10T12:00:00Z", "-P1D", 1, "UTC")).toBe("2026-02-09T12:00:00Z");
    expect(shift("2026-02-10T12:00:00Z", "-P1D", -1, "UTC")).toBe("2026-02-11T12:00:00Z");
  });

  it("keeps the milliseconds a calendar knows nothing about", () => {
    expect(shift("2026-02-10T12:00:00.789Z", "1mo", 1, "UTC")).toBe("2026-03-10T12:00:00.789Z");
  });

  it("has nothing to show for a shift past the years this page holds", () => {
    expect(shift("9999-12-31T00:00:00Z", "1y", 1, "UTC")).toBeNull();
    expect(shift("0001-01-01T00:00:00Z", "1d", -1, "UTC")).toBeNull();
  });
});

describe("betweenInstants", () => {
  const gap = (from: string, to: string, zone: string) => betweenInstants(new Date(from), new Date(to), zone);

  it("counts whole months first and whole days after them", () => {
    expect(gap("2026-01-31T00:00:00Z", "2026-03-01T00:00:00Z", "UTC"))
      .toEqual({ years: 0, months: 1, days: 1, ms: 0, negative: false });
  });

  it("counts a leap day to the last day of February a year on as a year", () => {
    expect(gap("2024-02-29T00:00:00Z", "2025-02-28T00:00:00Z", "UTC"))
      .toMatchObject({ years: 1, months: 0, days: 0 });
  });

  it("counts the days a zone had, not the hours they came to", () => {
    expect(gap("2026-03-27T23:00:00Z", "2026-03-29T22:00:00Z", "Europe/Berlin")).toMatchObject({ days: 2, ms: 0 });
    expect(gap("2026-03-27T23:00:00Z", "2026-03-29T22:00:00Z", "UTC")).toMatchObject({ days: 1, ms: 82800000 });
  });

  it("says which way round the two instants were", () => {
    expect(gap("2026-03-01T00:00:00Z", "2026-01-31T00:00:00Z", "UTC"))
      .toEqual({ years: 0, months: 1, days: 1, ms: 0, negative: true });
    expect(gap("2026-03-01T00:00:00Z", "2026-03-01T00:00:00Z", "UTC"))
      .toEqual({ years: 0, months: 0, days: 0, ms: 0, negative: false });
  });

  it("leaves the hours a whole day could not take", () => {
    expect(gap("2020-01-01T00:00:00Z", "2026-08-26T15:30:45Z", "UTC"))
      .toEqual({ years: 6, months: 7, days: 25, ms: 55845000, negative: false });
  });

  it.each([
    ["2026-01-31T00:00:00Z", "2026-03-01T00:00:00Z", "UTC"],
    ["2026-03-27T23:00:00Z", "2026-03-29T22:00:00Z", "Europe/Berlin"],
    ["2020-01-01T00:00:00.123Z", "2026-08-26T15:30:45.456Z", "Asia/Kolkata"],
    ["1970-01-01T00:00:00Z", "2026-02-10T12:34:56.789Z", "America/New_York"],
  ])("counts %s to %s and back again", (from, to, zone) => {
    const landed = shiftInstant(new Date(from), betweenInstants(new Date(from), new Date(to), zone), 1, zone);
    expect(landed?.toISOString()).toBe(new Date(to).toISOString());
  });
});
