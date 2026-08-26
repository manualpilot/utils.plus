import { MAX_TIME, MIN_TIME } from "./formats";

export interface Duration {
  years: number;
  months: number;
  days: number;
  ms: number;
  negative: boolean;
}

export interface DurationReading {
  duration: Duration | null;
  source: string;
  error: string;
}

export function readDuration(text: string): DurationReading {
  const trimmed = text.trim();
  if (!trimmed) return { duration: null, source: "", error: "" };

  const iso = ISO_PATTERN.exec(trimmed);
  if (iso) return fromIso(iso);

  const clock = CLOCK_PATTERN.exec(trimmed);
  if (clock) return fromClock(clock);

  const number = NUMBER_PATTERN.exec(trimmed);
  if (number) return fromSeconds(number);

  return fromUnits(trimmed);
}

const ISO_PATTERN =
  /^([+-])?P(?!$)(?:(\d+(?:[.,]\d+)?)Y)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?!$)(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i;
const CLOCK_PATTERN = /^([+-])?(\d+):([0-5]\d)(?::([0-5]\d(?:[.,]\d+)?))?$/;
const NUMBER_PATTERN = /^([+-])?(\d+(?:[.,]\d+)?)$/;
const UNIT_TOKEN = /(\d+(?:[.,]\d+)?)\s*([a-zµμ]+)/gi;
const SEPARATORS = /^(?:[\s,]|and\b)*$/i;

const SECOND_MS = 1000;
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const MONTH_MS = 2629746000;

type Field = "years" | "months" | "days" | "ms";

const UNIT_SCALES: Record<string, [Field, number]> = {
  ...spellings(["y", "yr", "yrs", "year", "years"], "years", 1),
  ...spellings(["mo", "mos", "mon", "mons", "month", "months"], "months", 1),
  ...spellings(["w", "wk", "wks", "week", "weeks"], "days", 7),
  ...spellings(["d", "day", "days"], "days", 1),
  ...spellings(["h", "hr", "hrs", "hour", "hours"], "ms", HOUR_MS),
  ...spellings(["m", "min", "mins", "minute", "minutes"], "ms", MINUTE_MS),
  ...spellings(["s", "sec", "secs", "second", "seconds"], "ms", SECOND_MS),
  ...spellings(["ms", "msec", "msecs", "millisecond", "milliseconds"], "ms", 1),
  ...spellings(["us", "µs", "μs", "usec", "usecs", "microsecond", "microseconds"], "ms", 1 / 1000),
  ...spellings(["ns", "nsec", "nsecs", "nanosecond", "nanoseconds"], "ms", 1 / 1000000),
};

function spellings(names: string[], field: Field, scale: number): Record<string, [Field, number]> {
  return Object.fromEntries(names.map((name) => [name, [field, scale]]));
}

function fromIso(match: RegExpExecArray): DurationReading {
  const totals = empty();
  const error = fill(totals, [
    ["years", match[2], 1],
    ["months", match[3], 1],
    ["days", match[4], 7],
    ["days", match[5], 1],
    ["ms", match[6], HOUR_MS],
    ["ms", match[7], MINUTE_MS],
    ["ms", match[8], SECOND_MS],
  ]);
  return error ? fault(error) : finish(totals, match[1] === "-", "ISO 8601 duration");
}

function fromClock(match: RegExpExecArray): DurationReading {
  const totals = empty();
  const stopwatch = match[4] === undefined;
  const error = stopwatch
    ? fill(totals, [["ms", match[2], MINUTE_MS], ["ms", match[3], SECOND_MS]])
    : fill(totals, [["ms", match[2], HOUR_MS], ["ms", match[3], MINUTE_MS], ["ms", match[4], SECOND_MS]]);
  return error ? fault(error) : finish(totals, match[1] === "-", stopwatch ? "Clock, mm:ss" : "Clock, h:mm:ss");
}

function fromSeconds(match: RegExpExecArray): DurationReading {
  const totals = empty();
  const error = fill(totals, [["ms", match[2], SECOND_MS]]);
  return error ? fault(error) : finish(totals, match[1] === "-", "Seconds");
}

function fromUnits(text: string): DurationReading {
  const negative = text.startsWith("-");
  const body = /^[+-]/.test(text) ? text.slice(1) : text;
  const totals = empty();
  let index = 0;
  let tokens = 0;

  for (const match of body.matchAll(UNIT_TOKEN)) {
    if (!SEPARATORS.test(body.slice(index, match.index))) return fault(UNREADABLE);
    const unit = UNIT_SCALES[match[2].toLowerCase()];
    if (!unit) return fault(`There is no unit of time called ${match[2]}`);
    const error = fill(totals, [[unit[0], match[1], unit[1]]]);
    if (error) return fault(error);
    index = match.index + match[0].length;
    tokens++;
  }

  if (!tokens || !SEPARATORS.test(body.slice(index))) return fault(UNREADABLE);
  return finish(totals, negative, "Units");
}

const UNREADABLE = "That is not a duration this page can read";

interface Totals {
  years: number;
  months: number;
  days: number;
  ms: number;
}

function empty(): Totals {
  return { years: 0, months: 0, days: 0, ms: 0 };
}

function fill(totals: Totals, entries: [Field, string | undefined, number][]): string {
  for (const [field, text, scale] of entries) {
    if (text === undefined) continue;
    const error = add(totals, field, Number(text.replace(",", ".")) * scale);
    if (error) return error;
  }
  return "";
}

function add(totals: Totals, field: Field, amount: number): string {
  if (field === "ms") totals.ms += amount;
  else if (field === "days") {
    totals.days += Math.trunc(amount);
    totals.ms += (amount - Math.trunc(amount)) * DAY_MS;
  } else if (field === "years") {
    totals.years += Math.trunc(amount);
    return add(totals, "months", (amount - Math.trunc(amount)) * 12);
  } else if (!Number.isInteger(amount)) return "A fraction of a month is not a length this page can read";
  else totals.months += amount;
  return "";
}

function finish(totals: Totals, negative: boolean, source: string): DurationReading {
  const years = totals.years + Math.trunc(totals.months / 12);
  const duration = { years, months: totals.months % 12, days: totals.days, ms: totals.ms, negative };
  const weight = (years * 12 + duration.months) * MONTH_MS + duration.days * DAY_MS + duration.ms;
  if (!Number.isFinite(weight) || weight > MAX_TIME - MIN_TIME) {
    return fault("That is longer than the years this page can show");
  }
  return { duration, source, error: "" };
}

function fault(error: string): DurationReading {
  return { duration: null, source: "", error };
}

export function isoDuration(duration: Duration): string {
  const { hours, minutes, seconds } = exact(duration.ms);
  const date = unit(duration.years, "Y") + unit(duration.months, "M") + unit(duration.days, "D");
  const time = unit(hours, "H") + unit(minutes, "M") + unit(seconds, "S");
  if (!date && !time) return "PT0S";
  return `${duration.negative ? "-" : ""}P${date}${time ? `T${time}` : ""}`;
}

export function compactDuration(duration: Duration): string {
  const written = parts(duration).map(({ value, symbol }) => `${decimal(value)}${symbol}`);
  return `${duration.negative ? "-" : ""}${written.length ? written.join(" ") : "0s"}`;
}

export function signedCompact(duration: Duration, sign: number): string {
  const shift = sign < 0 ? { ...duration, negative: !duration.negative } : duration;
  return `${shift.negative ? "" : "+"}${compactDuration(shift)}`;
}

export function spelledDuration(duration: Duration): string {
  const written = parts(duration).map(({ value, unit: name }) => unitFormatter(name).format(value));
  const listed = written.length ? LIST_FORMATTER.format(written) : unitFormatter("second").format(0);
  return `${duration.negative ? "-" : ""}${listed}`;
}

export function clockDuration(ms: number): string {
  const total = Math.abs(ms);
  const seconds = Math.floor(total / SECOND_MS) % 60;
  const rest = total % SECOND_MS;
  const written = `${pad(Math.floor(total / HOUR_MS))}:${pad(Math.floor(total / MINUTE_MS) % 60)}:${pad(seconds)}`;
  return `${ms < 0 ? "-" : ""}${written}${rest ? decimal(rest / SECOND_MS).slice(1) : ""}`;
}

const TOTAL_UNITS: [string, number][] = [
  ["Weeks", 7 * DAY_MS],
  ["Days", DAY_MS],
  ["Hours", HOUR_MS],
  ["Minutes", MINUTE_MS],
  ["Seconds", SECOND_MS],
  ["Milliseconds", 1],
];

export function unitTotals(ms: number): { label: string; value: string }[] {
  return TOTAL_UNITS.map(([label, size]) => ({ label, value: decimal(ms / size) }));
}

type UnitName = "year" | "month" | "day" | "hour" | "minute" | "second" | "millisecond";

interface Part {
  unit: UnitName;
  symbol: string;
  value: number;
}

function parts(duration: Duration): Part[] {
  const { hours, minutes, seconds, millis } = exact(duration.ms);
  const written: Part[] = [
    { unit: "year", symbol: "y", value: duration.years },
    { unit: "month", symbol: "mo", value: duration.months },
    { unit: "day", symbol: "d", value: duration.days },
    { unit: "hour", symbol: "h", value: hours },
    { unit: "minute", symbol: "m", value: minutes },
    { unit: "second", symbol: "s", value: Math.trunc(seconds) },
    { unit: "millisecond", symbol: "ms", value: millis },
  ];
  return written.filter((part) => part.value !== 0);
}

function exact(ms: number): { hours: number; minutes: number; seconds: number; millis: number } {
  const millis = ms % SECOND_MS;
  return {
    hours: Math.floor(ms / HOUR_MS),
    minutes: Math.floor(ms / MINUTE_MS) % 60,
    seconds: Math.floor(ms / SECOND_MS) % 60 + millis / SECOND_MS,
    millis,
  };
}

function unit(value: number, letter: string): string {
  return value ? `${decimal(value)}${letter}` : "";
}

function decimal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(9);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return Number(trimmed) === 0 ? value.toExponential(2) : trimmed;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const UNIT_FORMATTERS = new Map<UnitName, Intl.NumberFormat>();
const LIST_FORMATTER = new Intl.ListFormat(undefined, { style: "long", type: "conjunction" });

function unitFormatter(name: UnitName): Intl.NumberFormat {
  let formatter = UNIT_FORMATTERS.get(name);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "unit",
      unit: name,
      unitDisplay: "long",
      maximumFractionDigits: 9,
    });
    UNIT_FORMATTERS.set(name, formatter);
  }
  return formatter;
}
