import { utcDate, type WallClock, zoneClock, zoneInstant } from "../../common/zone-clock";
import { type Duration } from "./duration";
import { MAX_TIME, MIN_TIME } from "./formats";

const DAY_MS = 86400000;

export function shiftInstant(date: Date, duration: Duration, sign: number, timeZone: string): Date | null {
  const ms = shiftedMs(date, duration, sign, timeZone);
  return ms >= MIN_TIME && ms <= MAX_TIME ? new Date(ms) : null;
}

export function elapsedMs(duration: Duration, anchor: Date, timeZone: string): number {
  return shiftedMs(anchor, duration, 1, timeZone) - anchor.getTime();
}

function shiftedMs(date: Date, duration: Duration, sign: number, timeZone: string): number {
  const direction = duration.negative ? -sign : sign;
  const exact = direction * duration.ms;
  if (!duration.years && !duration.months && !duration.days) return date.getTime() + exact;

  const clock = zoneClock(date, timeZone);
  const months = clock.year * 12 + clock.month - 1 + direction * (duration.years * 12 + duration.months);
  const year = Math.floor(months / 12);
  const month = months - year * 12 + 1;
  const landed = utcDate(year, month, Math.min(clock.day, monthLength(year, month)) + direction * duration.days);
  const wall: WallClock = {
    year: landed.getUTCFullYear(),
    month: landed.getUTCMonth() + 1,
    day: landed.getUTCDate(),
    hour: clock.hour,
    minute: clock.minute,
    second: clock.second,
  };
  return zoneInstant(wall, timeZone) + clock.millisecond + exact;
}

function monthLength(year: number, month: number): number {
  return utcDate(year, month + 1, 0).getUTCDate();
}

export function betweenInstants(from: Date, to: Date, timeZone: string): Duration {
  const negative = to.getTime() < from.getTime();
  const earlier = negative ? to : from;
  const target = (negative ? from : to).getTime();
  const start = zoneClock(earlier, timeZone);
  const end = zoneClock(negative ? from : to, timeZone);

  let months = (end.year - start.year) * 12 + end.month - start.month;
  if (months > 0 && advance(earlier, months, 0, timeZone) > target) months--;

  let days = Math.max(0, Math.floor((target - advance(earlier, months, 0, timeZone)) / DAY_MS));
  while (advance(earlier, months, days + 1, timeZone) <= target) days++;
  while (days > 0 && advance(earlier, months, days, timeZone) > target) days--;

  return {
    years: Math.trunc(months / 12),
    months: months % 12,
    days,
    ms: target - advance(earlier, months, days, timeZone),
    negative,
  };
}

function advance(date: Date, months: number, days: number, timeZone: string): number {
  return shiftedMs(date, { years: 0, months, days, ms: 0, negative: false }, 1, timeZone);
}
