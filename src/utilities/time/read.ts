import { type WallClock, zoneClock, zoneInstant } from "../../common/zone-clock";
import { isoExtended, MAX_TIME, MAX_YEAR, MIN_TIME, MIN_YEAR } from "./formats";

export interface Reading {
  date: Date | null;
  source: string;
  error: string;
}

const EPOCH_UNITS = [
  { digits: 11, name: "Unix seconds", multiply: 1000n, divide: 1n },
  { digits: 14, name: "Unix milliseconds", multiply: 1n, divide: 1n },
  { digits: 17, name: "Unix microseconds", multiply: 1n, divide: 1000n },
  { digits: 20, name: "Unix nanoseconds", multiply: 1n, divide: 1000000n },
];

const EPOCH_PATTERN = /^([+-]?)(\d+)(\.\d+)?$/;
const ISO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?(Z|[+-]\d{2}:?\d{2})?$/i;
const MONTH_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
const HTTP_PATTERN = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,.*\bGMT$/i;

export function readTimestamp(text: string): Reading {
  const trimmed = text.trim();
  if (!trimmed) return { date: null, source: "Following the clock", error: "" };

  const epoch = EPOCH_PATTERN.exec(trimmed);
  if (epoch) {
    const unit = EPOCH_UNITS.find((candidate) => epoch[2].length <= candidate.digits);
    if (!unit) return fault("That is more digits than any epoch unit uses");
    return asReading(epochMs(epoch, unit), epoch[3] ? `${unit.name}, fractional` : unit.name);
  }

  const iso = ISO_PATTERN.exec(trimmed);
  if (iso) return asReading(Date.parse(trimmed.replace(" ", "T")), isoSource(iso));

  return asReading(Date.parse(trimmed), textSource(trimmed));
}

const WALL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/;

export function wallToIso(text: string, timeZone: string): string | null {
  const match = WALL_PATTERN.exec(text);
  if (!match) return null;
  const wall: WallClock = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
  return isoExtended(zoneClock(new Date(zoneInstant(wall, timeZone)), timeZone));
}

function epochMs(match: RegExpExecArray, unit: (typeof EPOCH_UNITS)[number]): number {
  const magnitude = Number(BigInt(match[2]) * unit.multiply / unit.divide)
    + (match[3] ? Number(match[3]) * Number(unit.multiply) / Number(unit.divide) : 0);
  return match[1] === "-" ? -magnitude : magnitude;
}

function isoSource(match: RegExpExecArray): string {
  if (match[7]) return "ISO 8601";
  return match[4] ? "ISO 8601, no offset — read as local time" : "ISO 8601 date — read as UTC midnight";
}

function textSource(text: string): string {
  if (HTTP_PATTERN.test(text)) return "RFC 1123 (HTTP date)";
  if (MONTH_PATTERN.test(text)) return "RFC 2822";
  return "Date string, read by the browser";
}

function asReading(ms: number, source: string): Reading {
  if (!Number.isFinite(ms)) return fault("That is not an epoch or a date this page can read");
  if (ms < MIN_TIME || ms > MAX_TIME) return fault(`Only the years ${MIN_YEAR} through ${MAX_YEAR} can be shown`);
  return { date: new Date(Math.round(ms)), source, error: "" };
}

function fault(error: string): Reading {
  return { date: null, source: "", error };
}
