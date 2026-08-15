import abbreviations from "@vvo/tzdb/abbreviations.json";
import { formatterFor, utcDate, type ZoneClock, zoneClock } from "../../common/zone-clock";

export function isoExtended(clock: ZoneClock): string {
  const date = `${year4(clock.year)}-${pad(clock.month)}-${pad(clock.day)}`;
  return `${date}T${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}${fraction(clock)}${
    zoneSuffix(clock, ":")
  }`;
}

export function isoBasic(clock: ZoneClock): string {
  const date = `${year4(clock.year)}${pad(clock.month)}${pad(clock.day)}`;
  return `${date}T${pad(clock.hour)}${pad(clock.minute)}${pad(clock.second)}${fraction(clock)}${zoneSuffix(clock, "")}`;
}

export function isoWeekDate(clock: ZoneClock): string {
  const weekday = clock.weekday === 0 ? 7 : clock.weekday;
  const thursday = utcDate(clock.year, clock.month, clock.day + 4 - weekday);
  const weekYear = thursday.getUTCFullYear();
  const elapsed = thursday.getTime() - utcDate(weekYear, 1, 1).getTime();
  return `${year4(weekYear)}-W${pad(Math.floor(elapsed / DAY_MS / 7) + 1)}-${weekday}`;
}

export function isoOrdinalDate(clock: ZoneClock): string {
  const elapsed = utcDate(clock.year, clock.month, clock.day).getTime() - utcDate(clock.year, 1, 1).getTime();
  return `${year4(clock.year)}-${String(Math.round(elapsed / DAY_MS) + 1).padStart(3, "0")}`;
}

export function rfc2822(clock: ZoneClock): string {
  return `${calendarText(clock)} ${offsetDigits(clock.offsetMs, "")}`;
}

export function httpDate(date: Date): string {
  return `${calendarText(zoneClock(date, "UTC"))} GMT`;
}

export function calendarText(clock: ZoneClock): string {
  const date = `${WEEKDAY_NAMES[clock.weekday]}, ${pad(clock.day)} ${MONTH_NAMES[clock.month - 1]} ${
    year4(clock.year)
  }`;
  return `${date} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`;
}

const SECOND_UNIT: [Intl.RelativeTimeFormatUnit, number] = ["second", 1];
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31556952],
  ["month", 2629746],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  SECOND_UNIT,
];

export function relativeTime(ms: number, nowMs: number): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const match = RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size);
  const [unit, size] = match ?? SECOND_UNIT;
  return RELATIVE_FORMATTER.format(Math.trunc(seconds / size), unit);
}

export function readable(date: Date, timeZone: string): string {
  return formatterFor(TEXT_FORMATTERS, timeZone, { dateStyle: "full", timeStyle: "medium" }).format(date);
}

export function zoneName(date: Date, timeZone: string, short = false): string {
  const longParts = formatterFor(NAME_FORMATTERS, timeZone, { timeZoneName: "long" }).formatToParts(date);
  const longName = longParts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;

  if (short) {
    const abbrev = (abbreviations as Record<string, string>)[longName];
    if (abbrev) return abbrev;

    const shortParts = formatterFor(SHORT_NAME_FORMATTERS, timeZone, { timeZoneName: "short" }).formatToParts(date);
    return shortParts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  }

  return longName;
}

const TEXT_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const NAME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const SHORT_NAME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const DAY_MS = 86400000;
export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;
export const MIN_TIME = utcDate(MIN_YEAR, 1, 1).getTime();
export const MAX_TIME = utcDate(MAX_YEAR, 12, 31).getTime() + DAY_MS - 1;

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function zoneSuffix(clock: ZoneClock, separator: string): string {
  return clock.timeZone === "UTC" ? "Z" : offsetDigits(clock.offsetMs, separator);
}

export function offsetDigits(offsetMs: number, separator: string): string {
  const minutes = Math.trunc(offsetMs / 60000);
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${pad(Math.floor(absolute / 60))}${separator}${pad(absolute % 60)}`;
}

function fraction(clock: ZoneClock): string {
  return clock.millisecond ? `.${String(clock.millisecond).padStart(3, "0")}` : "";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function year4(value: number): string {
  return String(value).padStart(4, "0");
}
