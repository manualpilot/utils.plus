import { formatterFor, type WallClock, wallKey, zoneClock, zoneInstant } from "../../common/zone-clock";
import { type FieldSpec, HORIZON_YEARS, normalise, SEARCH_LIMIT } from "./fields";
import type { ParsedField, Schedule, Term } from "./parse";

export function nextRuns(schedule: Schedule, fromMs: number, zone: string, count: number): number[] {
  const runs: number[] = [];
  let after = fromMs;
  for (let index = 0; index < count; index++) {
    const next = nextRun(schedule, after, zone);
    if (next === null) break;
    runs.push(next);
    after = next;
  }
  return runs;
}

function nextRun(schedule: Schedule, afterMs: number, zone: string): number | null {
  const seconds = schedule.second ? schedule.second.values : [0];
  let wall: WallClock = zoneClock(new Date(Math.floor(afterMs / 1000) * 1000 + 1000), zone);
  const lastYear = wall.year + HORIZON_YEARS;

  for (let guard = 0; guard < SEARCH_LIMIT; guard++) {
    if (wall.year > lastYear) return null;

    if (schedule.year && !schedule.year.values.includes(wall.year)) {
      const year = nextValue(schedule.year.values, wall.year);
      if (year === null) return null;
      wall = { year, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
      continue;
    }

    if (!schedule.month.values.includes(wall.month)) {
      const month = nextValue(schedule.month.values, wall.month);
      wall = month === null
        ? { year: wall.year + 1, month: 1, day: 1, hour: 0, minute: 0, second: 0 }
        : { ...wall, month, day: 1, hour: 0, minute: 0, second: 0 };
      continue;
    }

    if (!dayMatches(schedule, wall)) {
      wall = nextDayStart(wall);
      continue;
    }

    if (!schedule.hour.values.includes(wall.hour)) {
      const hour = nextValue(schedule.hour.values, wall.hour);
      wall = hour === null ? nextDayStart(wall) : { ...wall, hour, minute: 0, second: 0 };
      continue;
    }

    if (!schedule.minute.values.includes(wall.minute)) {
      const minute = nextValue(schedule.minute.values, wall.minute);
      wall = minute === null ? nextHourStart(wall) : { ...wall, minute, second: 0 };
      continue;
    }

    if (!seconds.includes(wall.second)) {
      const second = nextValue(seconds, wall.second);
      wall = second === null ? nextMinuteStart(wall) : { ...wall, second };
      continue;
    }

    const ms = zoneInstant(wall, zone);
    const landed = zoneClock(new Date(ms), zone);
    if (wallKey(landed) !== wallKey(wall)) {
      wall = landed;
      continue;
    }
    return ms;
  }

  return null;
}

function dayMatches(schedule: Schedule, wall: WallClock): boolean {
  const weekday = weekdayOf(wall.year, wall.month, wall.day);
  const dom = dayFieldHits(schedule.dom, wall, weekday);
  const dow = dayFieldHits(schedule.dow, wall, weekday);
  return schedule.orDays ? dom || dow : dom && dow;
}

function dayFieldHits(field: ParsedField, wall: WallClock, weekday: number): boolean {
  const value = field.spec.key === "dom" ? wall.day : weekday;
  if (field.values.includes(value)) return true;
  return field.specials.some((term) => specialHits(term, field.spec, wall, weekday));
}

function specialHits(term: Term, spec: FieldSpec, wall: WallClock, weekday: number): boolean {
  switch (term.kind) {
    case "last-day":
      return wall.day === lastDayOf(wall.year, wall.month) - term.offset;
    case "last-weekday":
      return wall.day === lastWeekdayOf(wall.year, wall.month);
    case "nearest-weekday":
      return wall.day === nearestWeekdayTo(wall.year, wall.month, term.day);
    case "last-dow":
      return weekday === normalise(spec, term.day) && wall.day > lastDayOf(wall.year, wall.month) - 7;
    case "nth-dow":
      return weekday === normalise(spec, term.day) && Math.ceil(wall.day / 7) === term.nth;
    default:
      return false;
  }
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function lastWeekdayOf(year: number, month: number): number {
  let day = lastDayOf(year, month);
  while (isWeekend(weekdayOf(year, month, day))) day--;
  return day;
}

function nearestWeekdayTo(year: number, month: number, day: number): number {
  const last = lastDayOf(year, month);
  if (day > last) return -1;
  const weekday = weekdayOf(year, month, day);
  if (weekday === 6) return day > 1 ? day - 1 : day + 2;
  if (weekday === 0) return day < last ? day + 1 : day - 2;
  return day;
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

function nextValue(values: number[], from: number): number | null {
  for (const value of values) {
    if (value >= from) return value;
  }
  return null;
}

function nextDayStart(wall: WallClock): WallClock {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function nextHourStart(wall: WallClock): WallClock {
  return wall.hour >= 23 ? nextDayStart(wall) : { ...wall, hour: wall.hour + 1, minute: 0, second: 0 };
}

function nextMinuteStart(wall: WallClock): WallClock {
  return wall.minute >= 59 ? nextHourStart(wall) : { ...wall, minute: wall.minute + 1, second: 0 };
}

const RUN_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

export function runFormatter(timeZone: string): Intl.DateTimeFormat {
  return formatterFor(RUN_FORMATTERS, timeZone, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

const UNTIL_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31556952],
  ["month", 2629746],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

const UNTIL_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

export function untilPhrase(ms: number, nowMs: number): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const unit = UNTIL_UNITS.find(([, size]) => seconds >= size) ?? UNTIL_UNITS[UNTIL_UNITS.length - 1];
  return UNTIL_FORMATTER.format(Math.trunc(seconds / unit[1]), unit[0]);
}
