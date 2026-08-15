import { describe, expect, it } from "vitest";
import type { Flavour } from "../src/utilities/cron/fields";
import { readCron } from "../src/utilities/cron/parse";
import { nextRuns } from "../src/utilities/cron/schedule";

const FROM = Date.parse("2026-08-10T12:34:56.789Z");

describe("the fields", () => {
  it.each([
    ["* * * * *", "unix"],
    ["*/5 9-17 1,15 JAN-MAR MON-FRI", "unix"],
    ["5/10 * * * *", "unix"],
    ["0 0 9 * * SUN", "seconds"],
    ["0 0 12 ? * MON#3 2026-2030", "quartz"],
  ])("reads %s", (text, flavour) => {
    const reading = readCron(text, flavour as Flavour);
    expect(reading.error).toBeNull();
    expect(reading.fieldErrors.filter(Boolean)).toEqual([]);
    expect(reading.schedule).not.toBeNull();
  });

  it("takes a name wherever it takes a number", () => {
    expect(describe_("0 0 * JAN,JUL MON-FRI")).toBe(describe_("0 0 * 1,7 1-5"));
  });

  it("counts Sunday as 0 and as 7", () => {
    expect(describe_("0 0 * * 0")).toBe("At 00:00 on Sunday");
    expect(describe_("0 0 * * 7")).toBe("At 00:00 on Sunday");
  });

  it("counts Sunday as 1 in Quartz", () => {
    expect(describe_("0 0 0 ? * 1", "quartz")).toBe("At 00:00 on Sunday");
    expect(describe_("0 0 0 ? * 2", "quartz")).toBe("At 00:00 on Monday");
  });

  it("holds a cleared field in the column it was cleared in", () => {
    const reading = readCron("0 9  * MON-FRI", "unix");
    expect(reading.tokens).toEqual(["0", "9", "", "*", "MON-FRI"]);
    expect(reading.error).toBe("Unix cron takes 5 fields; this has 4");
    expect(reading.schedule).toBeNull();
  });

  it("names the gap when the field count alone would not", () => {
    expect(readCron("0 9 * * MON-FRI 2026", "unix").error).toBe("Unix cron takes 5 fields; this has 6");
    expect(readCron("0 9 *  MON-FRI 2026", "unix")).toMatchObject({ error: "Month is empty", schedule: null });
  });

  it("says nothing at all about an empty box", () => {
    expect(readCron("   ", "unix")).toMatchObject({ error: null, description: "", schedule: null });
    expect(readCron("", "unix").fieldErrors.filter(Boolean)).toEqual([]);
  });
});

describe("what it refuses", () => {
  it.each([
    ["0 9 * *", "unix", "Unix cron takes 5 fields; this has 4"],
    ["0 9 * * * *", "unix", "Unix cron takes 5 fields; this has 6"],
    ["0 9 * * *", "seconds", "Cron with seconds takes 6 fields; this has 5"],
    ["0 0 12 * * *", "quartz", "Quartz wants ? in day of month or day of week"],
    ["0 0 12 ? * ?", "quartz", "Only one day field takes ?, the other needs a value"],
    ["@daily", "quartz", "Quartz has no @ shorthands"],
    ["@fortnightly", "unix", "No shorthand is spelled @fortnightly"],
  ])("refuses %s as a whole", (text, flavour, error) => {
    const reading = readCron(text, flavour as Flavour);
    expect(reading.error).toBe(error);
    expect(reading.schedule).toBeNull();
  });

  it.each([
    ["60 * * * *", "unix", 0, "Minute takes 0 through 59"],
    ["0 24 * * *", "unix", 1, "Hour takes 0 through 23"],
    ["0 0 0 * *", "unix", 2, "Day of month takes 1 through 31"],
    ["0 0 * 13 *", "unix", 3, "Month takes 1 through 12"],
    ["0 0 * * FUN", "unix", 4, "Day of week takes 0 through 7 or a name"],
    ["0 0 5-1 * *", "unix", 2, "Day of month ranges run upwards"],
    ["0 0 * NOV-FEB *", "unix", 3, "Month ranges run upwards"],
    ["*/0 * * * *", "unix", 0, "A step is a whole number, 1 or more"],
    ["0 0 1,,15 * *", "unix", 2, "Day of month has a gap in its list"],
    ["0 0 * * ?", "unix", 4, "? needs the Quartz flavour"],
    ["0 0 L * *", "unix", 2, "L and W need the Quartz flavour"],
    ["0 0 * * MON#3", "unix", 4, "# needs the Quartz flavour"],
    ["0 0 12 ? * MON#6", "quartz", 5, "# counts a week from 1 to 5"],
    ["0 0 12 L-40 * ?", "quartz", 3, "L counts back at most 30 days"],
    ["0 0 12 ? ? *", "quartz", 4, "? belongs to a day field"],
  ])("names the field %s got wrong", (text, flavour, index, error) => {
    const reading = readCron(text, flavour as Flavour);
    expect(reading.fieldErrors[index as number]).toBe(error);
    expect(reading.schedule).toBeNull();
  });
});

describe("what it says an expression means", () => {
  it.each([
    ["* * * * *", "Every minute"],
    ["*/5 * * * *", "Every 5 minutes"],
    ["5 * * * *", "At minute 5"],
    ["15,45 * * * *", "At minutes 15 and 45"],
    ["* 5 * * *", "Every minute past hour 5"],
    ["*/5 3 * * *", "Every 5 minutes past hour 3"],
    ["30 9-17 * * *", "At minute 30 past hours 9 through 17"],
    ["0 */2 * * *", "At minute 0 past every 2 hours"],
    ["5/10 * * * *", "Every 10 minutes from 5 through 59"],
    ["0 9 * * MON-FRI", "At 09:00 on Monday through Friday"],
    ["0 0 * * 5-7", "At 00:00 on Friday through Sunday"],
    ["0 0 1 1 *", "At 00:00 on day-of-month 1 in January"],
    ["0 0 1,15 * *", "At 00:00 on day-of-month 1 and 15"],
    ["0 0 1 */3 *", "At 00:00 on day-of-month 1 in every 3rd month"],
    ["0 0 * * MON,WED,FRI", "At 00:00 on Monday, Wednesday and Friday"],
  ])("reads %s as %s", (text, description) => {
    expect(describe_(text)).toBe(description);
  });

  it("says whether the two day fields are either-or or both", () => {
    expect(describe_("0 0 1 * MON")).toBe("At 00:00 on day-of-month 1 or Monday");
    expect(describe_("0 0 */2 * MON")).toBe("At 00:00 on every 2nd day-of-month and Monday");
  });

  it.each([
    ["* * * * * *", "Every second"],
    ["*/30 * * * * *", "Every 30 seconds"],
    ["0 */5 * * * *", "Every 5 minutes"],
    ["30 0 9 * * *", "At 09:00:30"],
    ["0 0 9 * * MON-FRI", "At 09:00 on Monday through Friday"],
  ])("reads %s with its second in front as %s", (text, description) => {
    expect(describe_(text, "seconds")).toBe(description);
  });

  it.each([
    ["0 0 12 L * ?", "At 12:00 on the last day of the month"],
    ["0 0 12 L-3 * ?", "At 12:00 on the 4th-to-last day of the month"],
    ["0 0 12 LW * ?", "At 12:00 on the last weekday of the month"],
    ["0 0 12 15W * ?", "At 12:00 on the weekday nearest the 15th"],
    ["0 0 12 ? * FRIL", "At 12:00 on the last Friday of the month"],
    ["0 0 12 ? * MON#3", "At 12:00 on the third Monday of the month"],
    ["0 0 12 1 NOV-FEB ?", "At 12:00 on day-of-month 1 in November through February"],
    ["0 0 12 1 1 ? 2030", "At 12:00 on day-of-month 1 in January of 2030"],
  ])("reads Quartz's %s as %s", (text, description) => {
    expect(describe_(text, "quartz")).toBe(description);
  });

  it("expands a shorthand and says what it stood for", () => {
    expect(readCron("@daily", "unix")).toMatchObject({
      description: "At 00:00",
      note: "the same as 0 0 * * *",
      tokens: ["0", "0", "*", "*", "*"],
    });
    expect(describe_("@weekly")).toBe("At 00:00 on Sunday");
    expect(describe_("@yearly")).toBe("At 00:00 on day-of-month 1 in January");
    expect(readCron("@hourly", "seconds").note).toBe("the same as 0 0 * * * *");
  });

  it("has no clock to read for @reboot", () => {
    expect(readCron("@reboot", "unix")).toMatchObject({
      startup: true,
      description: "When cron starts",
      schedule: null,
      error: null,
    });
  });
});

describe("the runs it works out", () => {
  it("keeps to the weekdays it was given", () => {
    expect(runs("0 9 * * MON-FRI", 6)).toEqual([
      "2026-08-11T09:00:00.000Z",
      "2026-08-12T09:00:00.000Z",
      "2026-08-13T09:00:00.000Z",
      "2026-08-14T09:00:00.000Z",
      "2026-08-17T09:00:00.000Z",
      "2026-08-18T09:00:00.000Z",
    ]);
  });

  it("starts from the next whole minute, not the second it was asked", () => {
    expect(runs("*/15 * * * *", 3)).toEqual([
      "2026-08-10T12:45:00.000Z",
      "2026-08-10T13:00:00.000Z",
      "2026-08-10T13:15:00.000Z",
    ]);
  });

  it("counts the seconds when the flavour has them", () => {
    expect(runs("*/15 * * * * *", 3, "seconds")).toEqual([
      "2026-08-10T12:35:00.000Z",
      "2026-08-10T12:35:15.000Z",
      "2026-08-10T12:35:30.000Z",
    ]);
  });

  it("takes either day field when both are given", () => {
    expect(runs("0 0 1 * MON", 4)).toEqual([
      "2026-08-17T00:00:00.000Z",
      "2026-08-24T00:00:00.000Z",
      "2026-08-31T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]);
  });

  it("takes both day fields when one of them is left open", () => {
    expect(runs("0 0 */2 * MON", 3)).toEqual([
      "2026-08-17T00:00:00.000Z",
      "2026-08-31T00:00:00.000Z",
      "2026-09-07T00:00:00.000Z",
    ]);
  });

  it("waits years for a 29 February", () => {
    expect(runs("0 0 29 2 *", 2)).toEqual(["2028-02-29T00:00:00.000Z", "2032-02-29T00:00:00.000Z"]);
  });

  it("gives nothing back for a date that never comes round", () => {
    expect(runs("0 0 30 2 *", 3)).toEqual([]);
  });

  it("stops at the year Quartz was given", () => {
    expect(runs("0 0 0 1 1 ? 2030", 3, "quartz")).toEqual(["2030-01-01T00:00:00.000Z"]);
  });

  it.each([
    ["0 0 12 L * ?", ["2026-08-31T12:00:00.000Z", "2026-09-30T12:00:00.000Z", "2026-10-31T12:00:00.000Z"]],
    ["0 0 12 L-3 * ?", ["2026-08-28T12:00:00.000Z", "2026-09-27T12:00:00.000Z", "2026-10-28T12:00:00.000Z"]],
    ["0 0 12 LW * ?", ["2026-08-31T12:00:00.000Z", "2026-09-30T12:00:00.000Z", "2026-10-30T12:00:00.000Z"]],
    ["0 0 12 15W * ?", ["2026-08-14T12:00:00.000Z", "2026-09-15T12:00:00.000Z", "2026-10-15T12:00:00.000Z"]],
    ["0 0 12 ? * FRIL", ["2026-08-28T12:00:00.000Z", "2026-09-25T12:00:00.000Z", "2026-10-30T12:00:00.000Z"]],
    ["0 0 12 ? * MON#3", ["2026-08-17T12:00:00.000Z", "2026-09-21T12:00:00.000Z", "2026-10-19T12:00:00.000Z"]],
  ])("works out where %s lands", (text, expected) => {
    expect(runs(text, 3, "quartz")).toEqual(expected);
  });

  it("runs a Quartz wrapping range across the turn of the year", () => {
    expect(runs("0 0 0 1 NOV-FEB ?", 5, "quartz")).toEqual([
      "2026-11-01T00:00:00.000Z",
      "2026-12-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
      "2027-02-01T00:00:00.000Z",
      "2027-11-01T00:00:00.000Z",
    ]);
  });
});

describe("across a daylight saving change in Berlin", () => {
  const BERLIN = "Europe/Berlin";

  it("holds a daily run to the wall clock either side of the change", () => {
    expect(runs("0 3 * * *", 3, "unix", BERLIN, Date.parse("2026-03-27T12:00:00Z"))).toEqual([
      "2026-03-28T02:00:00.000Z",
      "2026-03-29T01:00:00.000Z",
      "2026-03-30T01:00:00.000Z",
    ]);
  });

  it("carries a run through an hour the clocks take away", () => {
    expect(runs("30 2 * * *", 3, "unix", BERLIN, Date.parse("2026-03-27T12:00:00Z"))).toEqual([
      "2026-03-28T01:30:00.000Z",
      "2026-03-30T00:30:00.000Z",
      "2026-03-31T00:30:00.000Z",
    ]);
  });

  it("runs once through an hour the clocks hand back", () => {
    expect(runs("30 2 * * *", 2, "unix", BERLIN, Date.parse("2026-10-24T12:00:00Z"))).toEqual([
      "2026-10-25T00:30:00.000Z",
      "2026-10-26T01:30:00.000Z",
    ]);
  });

  it("counts the hours of the change itself as the clock ran them", () => {
    expect(runs("0 * * * *", 3, "unix", BERLIN, Date.parse("2026-03-29T00:15:00Z"))).toEqual([
      "2026-03-29T01:00:00.000Z",
      "2026-03-29T02:00:00.000Z",
      "2026-03-29T03:00:00.000Z",
    ]);
  });
});

function describe_(text: string, flavour: Flavour = "unix"): string {
  const reading = readCron(text, flavour);
  expect(reading.error).toBeNull();
  expect(reading.fieldErrors.filter(Boolean)).toEqual([]);
  return reading.description;
}

function runs(
  text: string,
  count: number,
  flavour: Flavour = "unix",
  zone: string = "UTC",
  from: number = FROM,
): string[] {
  const schedule = readCron(text, flavour).schedule;
  if (!schedule) throw new Error(`${text} does not parse`);
  return nextRuns(schedule, from, zone, count).map((run) => new Date(run).toISOString());
}
