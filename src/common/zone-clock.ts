const RENAMED: Record<string, string> = {
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Louisville": "America/Kentucky/Louisville",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};

export const LOCAL_ZONE = currentName(Intl.DateTimeFormat().resolvedOptions().timeZone);

export const TIME_ZONES = zoneList();

function zoneList(): string[] {
  const named = new Set(Intl.supportedValuesOf("timeZone").map(currentName));
  named.add(LOCAL_ZONE);
  named.delete("UTC");
  return ["UTC", ...[...named].sort()];
}

function currentName(timeZone: string): string {
  return RENAMED[timeZone] ?? timeZone;
}

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface ZoneClock extends WallClock {
  timeZone: string;
  offsetMs: number;
  millisecond: number;
  weekday: number;
}

export function zoneClock(date: Date, timeZone: string): ZoneClock {
  const offsetMs = zoneOffsetMs(date, timeZone);
  const shifted = new Date(date.getTime() + offsetMs);
  return {
    timeZone,
    offsetMs,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
    weekday: shifted.getUTCDay(),
  };
}

const DAY_MS = 86400000;

export function zoneInstant(wall: WallClock, timeZone: string): number {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const early = guess - zoneOffsetMs(new Date(guess - DAY_MS), timeZone);
  const late = guess - zoneOffsetMs(new Date(guess + DAY_MS), timeZone);
  if (readsAs(early, wall, timeZone)) return early;
  if (readsAs(late, wall, timeZone)) return late;
  return early;
}

function readsAs(ms: number, wall: WallClock, timeZone: string): boolean {
  return wallKey(zoneClock(new Date(ms), timeZone)) === wallKey(wall);
}

export function wallKey(wall: WallClock): number {
  return ((((wall.year * 12 + wall.month) * 31 + wall.day) * 24 + wall.hour) * 60 + wall.minute) * 60 + wall.second;
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts: Record<string, string> = {};
  for (const part of offsetFormatter(timeZone).formatToParts(date)) parts[part.type] = part.value;
  const wall = utcDate(Number(parts.year), Number(parts.month), Number(parts.day));
  wall.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
  return wall.getTime() - Math.floor(date.getTime() / 1000) * 1000;
}

export function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

const OFFSET_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  return formatterFor(OFFSET_FORMATTERS, timeZone, {
    locale: "en-US",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatterFor(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  { locale, ...options }: Intl.DateTimeFormatOptions & { locale?: string },
): Intl.DateTimeFormat {
  let formatter = cache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    cache.set(timeZone, formatter);
  }
  return formatter;
}
