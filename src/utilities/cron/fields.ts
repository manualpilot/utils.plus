export type Flavour = "unix" | "seconds" | "quartz";

export type Zone = "local" | "utc";

export const RUN_COUNT = 6;
export const HORIZON_YEARS = 100;
export const SEARCH_LIMIT = 20000;

export const FLAVOURS = [
  { value: "unix", label: "Unix (5 fields)" },
  { value: "seconds", label: "Seconds (6 fields)" },
  { value: "quartz", label: "Quartz (6 or 7 fields)" },
];

export const FLAVOUR_HINTS: Record<Flavour, string> = {
  unix: "crontab, where Sunday is 0 and 7",
  seconds: "crontab with a second in front",
  quartz: "Sunday is 1, and ? L W # are on offer",
};

export const FLAVOUR_NAMES: Record<Flavour, string> = {
  unix: "Unix cron",
  seconds: "Cron with seconds",
  quartz: "Quartz",
};

export const DEFAULT_EXPRESSIONS: Record<Flavour, string> = {
  unix: "0 9 * * MON-FRI",
  seconds: "0 0 9 * * MON-FRI",
  quartz: "0 0 9 ? * MON-FRI",
};

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface FieldSpec {
  key: "second" | "minute" | "hour" | "dom" | "month" | "dow" | "year";
  label: string;
  noun: string;
  plural: string;
  min: number;
  max: number;
  names?: readonly string[];
  fullNames?: readonly string[];
  weekday?: boolean;
  calendar?: boolean;
  optional?: boolean;
  hint: string;
  suggestions: string[];
}

const SECOND_FIELD: FieldSpec = {
  key: "second",
  label: "Second",
  noun: "second",
  plural: "seconds",
  min: 0,
  max: 59,
  hint: "0-59",
  suggestions: ["*", "0", "*/5", "*/10", "*/15", "*/30"],
};

const MINUTE_FIELD: FieldSpec = {
  key: "minute",
  label: "Minute",
  noun: "minute",
  plural: "minutes",
  min: 0,
  max: 59,
  hint: "0-59",
  suggestions: ["*", "0", "*/5", "*/10", "*/15", "*/30", "0,30"],
};

const HOUR_FIELD: FieldSpec = {
  key: "hour",
  label: "Hour",
  noun: "hour",
  plural: "hours",
  min: 0,
  max: 23,
  hint: "0-23",
  suggestions: ["*", "0", "9", "12", "*/2", "*/6", "9-17"],
};

const DOM_FIELD: FieldSpec = {
  key: "dom",
  label: "Day of month",
  noun: "day-of-month",
  plural: "day-of-month",
  min: 1,
  max: 31,
  calendar: true,
  hint: "1-31",
  suggestions: ["*", "1", "15", "1,15", "*/2"],
};

const MONTH_FIELD: FieldSpec = {
  key: "month",
  label: "Month",
  noun: "month",
  plural: "months",
  min: 1,
  max: 12,
  names: MONTH_NAMES,
  fullNames: MONTH_FULL,
  calendar: true,
  hint: "1-12 or JAN-DEC",
  suggestions: ["*", "1", "*/3", "JAN", "JAN-MAR", "JAN,APR,JUL,OCT"],
};

const DOW_FIELD: FieldSpec = {
  key: "dow",
  label: "Day of week",
  noun: "day-of-week",
  plural: "day-of-week",
  min: 0,
  max: 7,
  names: DAY_NAMES,
  fullNames: DAY_FULL,
  weekday: true,
  calendar: true,
  hint: "0-7 or SUN-SAT",
  suggestions: ["*", "MON-FRI", "SAT,SUN", "MON", "1-5", "0,6"],
};

const YEAR_FIELD: FieldSpec = {
  key: "year",
  label: "Year",
  noun: "year",
  plural: "years",
  min: 1970,
  max: 2099,
  calendar: true,
  optional: true,
  hint: "1970-2099, optional",
  suggestions: ["*", "2026", "2026-2030"],
};

const QUARTZ_DOM_FIELD: FieldSpec = {
  ...DOM_FIELD,
  hint: "1-31, L or W",
  suggestions: ["?", "*", "1", "15", "1,15", "L", "LW", "15W", "L-3"],
};

const QUARTZ_DOW_FIELD: FieldSpec = {
  ...DOW_FIELD,
  min: 1,
  max: 7,
  hint: "1-7, SUN-SAT, L, #",
  suggestions: ["?", "*", "MON-FRI", "SAT,SUN", "MON", "FRI#3", "FRIL"],
};

export const FIELD_SETS: Record<Flavour, FieldSpec[]> = {
  unix: [MINUTE_FIELD, HOUR_FIELD, DOM_FIELD, MONTH_FIELD, DOW_FIELD],
  seconds: [SECOND_FIELD, MINUTE_FIELD, HOUR_FIELD, DOM_FIELD, MONTH_FIELD, DOW_FIELD],
  quartz: [SECOND_FIELD, MINUTE_FIELD, HOUR_FIELD, QUARTZ_DOM_FIELD, MONTH_FIELD, QUARTZ_DOW_FIELD, YEAR_FIELD],
};

export function normalise(spec: FieldSpec, value: number): number {
  return spec.weekday ? (value - spec.min) % 7 : value;
}
