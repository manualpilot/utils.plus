import { describeSchedule } from "./describe";
import { DEFAULT_EXPRESSIONS, FIELD_SETS, type FieldSpec, type Flavour, FLAVOUR_NAMES, FLAVOURS, MACROS, normalise } from "./fields";

export type Term =
  | { kind: "all" }
  | { kind: "value"; value: number }
  | { kind: "range"; from: number; to: number }
  | { kind: "step"; from: number; to: number; step: number; whole: boolean }
  | { kind: "last-day"; offset: number }
  | { kind: "last-weekday" }
  | { kind: "nearest-weekday"; day: number }
  | { kind: "last-dow"; day: number }
  | { kind: "nth-dow"; day: number; nth: number };

export interface ParsedField {
  spec: FieldSpec;
  text: string;
  terms: Term[];
  values: number[];
  specials: Term[];
  open: boolean;
}

export interface Schedule {
  second: ParsedField | null;
  minute: ParsedField;
  hour: ParsedField;
  dom: ParsedField;
  month: ParsedField;
  dow: ParsedField;
  year: ParsedField | null;
  orDays: boolean;
}

export interface CronReading {
  tokens: string[];
  fieldErrors: (string | null)[];
  error: string | null;
  schedule: Schedule | null;
  description: string;
  note: string;
  startup: boolean;
}

export function readCron(text: string, flavour: Flavour): CronReading {
  const trimmed = text.trimEnd();
  if (!trimmed.trim()) return blankReading(flavour);
  if (trimmed.startsWith("@")) return readMacro(trimmed, flavour);
  return readTokens(splitTokens(trimmed), flavour, "");
}

function blankReading(flavour: Flavour): CronReading {
  return {
    tokens: [],
    fieldErrors: FIELD_SETS[flavour].map(() => null),
    error: null,
    schedule: null,
    description: "",
    note: "",
    startup: false,
  };
}

function readMacro(text: string, flavour: Flavour): CronReading {
  const name = text.toLowerCase();
  const blank = blankReading(flavour);
  if (flavour === "quartz") return { ...blank, error: "Quartz has no @ shorthands" };
  if (name === "@reboot") {
    return { ...blank, description: "When cron starts", note: "@reboot has no clock of its own", startup: true };
  }
  const expansion = MACROS[name];
  if (!expansion) return { ...blank, error: `No shorthand is spelled ${text}` };
  const full = flavour === "unix" ? expansion : `0 ${expansion}`;
  return readTokens(splitTokens(full), flavour, `the same as ${full}`);
}

function readTokens(tokens: string[], flavour: Flavour, note: string): CronReading {
  const specs = FIELD_SETS[flavour];
  const fields: (ParsedField | null)[] = [];
  const fieldErrors: (string | null)[] = [];

  for (let index = 0; index < specs.length; index++) {
    const token = tokens[index] ?? "";
    if (token === "") {
      fields.push(null);
      fieldErrors.push(null);
      continue;
    }
    const result = parseField(token, specs[index], flavour);
    fields.push(result.field ?? null);
    fieldErrors.push(result.error ?? null);
  }

  const filled = tokens.filter((token) => token !== "").length;
  const required = specs.filter((spec) => !spec.optional).length;
  const gap = specs.findIndex((spec, index) => !spec.optional && (tokens[index] ?? "") === "");

  let error: string | null = null;
  if (filled < required || filled > specs.length) {
    error = `${FLAVOUR_NAMES[flavour]} takes ${fieldCount(required, specs.length)}; this has ${filled}`;
  } else if (gap !== -1) {
    error = `${specs[gap].label} is empty`;
  } else if (flavour === "quartz") {
    error = quartzDayProblem(tokens);
  }

  const settled = error === null && fieldErrors.every((field) => field === null);
  const schedule = settled ? buildSchedule(fields as ParsedField[], specs) : null;

  return {
    tokens,
    fieldErrors,
    error,
    schedule,
    description: schedule ? describeSchedule(schedule) : "",
    note: schedule ? note : "",
    startup: false,
  };
}

function fieldCount(required: number, total: number): string {
  return required === total ? `${required} fields` : `${required} or ${total} fields`;
}

function quartzDayProblem(tokens: string[]): string | null {
  const dom = tokens[3] === "?";
  const dow = tokens[5] === "?";
  if (dom && dow) return "Only one day field takes ?, the other needs a value";
  if (!dom && !dow) return "Quartz wants ? in day of month or day of week";
  return null;
}

function buildSchedule(fields: ParsedField[], specs: FieldSpec[]): Schedule {
  const byKey = new Map(specs.map((spec, index) => [spec.key, fields[index]]));
  const dom = byKey.get("dom")!;
  const dow = byKey.get("dow")!;
  return {
    second: byKey.get("second") ?? null,
    minute: byKey.get("minute")!,
    hour: byKey.get("hour")!,
    dom,
    month: byKey.get("month")!,
    dow,
    year: byKey.get("year") ?? null,
    orDays: !dom.open && !dow.open,
  };
}

interface FieldResult {
  field?: ParsedField;
  error?: string;
}

export function parseField(text: string, spec: FieldSpec, flavour: Flavour): FieldResult {
  const quartz = flavour === "quartz";

  if (text === "?") {
    if (!quartz) return { error: "? needs the Quartz flavour" };
    if (spec.key !== "dom" && spec.key !== "dow") return { error: "? belongs to a day field" };
    return { field: openField(spec, text) };
  }

  const terms: Term[] = [];
  const specials: Term[] = [];
  const values = new Set<number>();

  for (const piece of text.split(",")) {
    const result = parsePiece(piece, spec, quartz);
    if (result.error !== undefined) return { error: result.error };
    terms.push(result.term!);
    if (result.values) { for (const value of result.values) values.add(value); }
    else specials.push(result.term!);
  }

  return {
    field: {
      spec,
      text,
      terms,
      values: [...values].sort((left, right) => left - right),
      specials,
      open: text.startsWith("*"),
    },
  };
}

export function openField(spec: FieldSpec, text: string): ParsedField {
  return {
    spec,
    text,
    terms: [{ kind: "all" }],
    values: expand(spec, spec.min, spec.max, 1, false),
    specials: [],
    open: true,
  };
}

interface PieceResult {
  term?: Term;
  values?: number[];
  error?: string;
}

function parsePiece(piece: string, spec: FieldSpec, quartz: boolean): PieceResult {
  if (piece === "") return { error: `${spec.label} has a gap in its list` };

  const special = quartz ? parseSpecial(piece, spec) : refuseSpecial(piece, spec);
  if (special) return special;

  const slash = piece.indexOf("/");
  const base = slash === -1 ? piece : piece.slice(0, slash);
  let step = 1;
  if (slash !== -1) {
    const text = piece.slice(slash + 1);
    if (!/^\d+$/.test(text) || Number(text) < 1) return { error: "A step is a whole number, 1 or more" };
    step = Number(text);
  }

  if (base === "*") {
    const term: Term = step === 1
      ? { kind: "all" }
      : { kind: "step", from: spec.min, to: spec.max, step, whole: true };
    return { term, values: expand(spec, spec.min, spec.max, step, false) };
  }

  const dash = base.indexOf("-");
  if (dash > 0) {
    const from = readValue(base.slice(0, dash), spec);
    if (typeof from === "string") return { error: from };
    const to = readValue(base.slice(dash + 1), spec);
    if (typeof to === "string") return { error: to };
    const wrap = from > to;
    if (wrap && !(quartz && (spec.key === "month" || spec.key === "dow"))) {
      return { error: `${spec.label} ranges run upwards` };
    }
    const term: Term = step === 1
      ? { kind: "range", from, to }
      : { kind: "step", from, to, step, whole: from === spec.min && to === spec.max };
    return { term, values: expand(spec, from, to, step, wrap) };
  }

  const value = readValue(base, spec);
  if (typeof value === "string") return { error: value };
  if (slash === -1) return { term: { kind: "value", value }, values: [normalise(spec, value)] };
  return {
    term: { kind: "step", from: value, to: spec.max, step, whole: false },
    values: expand(spec, value, spec.max, step, false),
  };
}

function readValue(text: string, spec: FieldSpec): number | string {
  if (spec.names) {
    const index = spec.names.indexOf(text.toUpperCase());
    if (index !== -1) return spec.min + index;
  }
  if (!/^\d+$/.test(text)) {
    return spec.names
      ? `${spec.label} takes ${range(spec)} or a name`
      : `${spec.label} takes ${range(spec)}`;
  }
  const value = Number(text);
  if (value < spec.min || value > spec.max) return `${spec.label} takes ${range(spec)}`;
  return value;
}

function range(spec: FieldSpec): string {
  return `${spec.min} through ${spec.max}`;
}

function parseSpecial(piece: string, spec: FieldSpec): PieceResult | null {
  const text = piece.toUpperCase();

  if (spec.key === "dom") {
    if (text === "L") return { term: { kind: "last-day", offset: 0 } };
    if (text === "LW") return { term: { kind: "last-weekday" } };
    const before = /^L-(\d+)$/.exec(text);
    if (before) {
      const offset = Number(before[1]);
      if (offset > 30) return { error: "L counts back at most 30 days" };
      return { term: { kind: "last-day", offset } };
    }
    const nearest = /^(\d+)W$/.exec(text);
    if (nearest) {
      const day = readValue(nearest[1], spec);
      if (typeof day === "string") return { error: day };
      return { term: { kind: "nearest-weekday", day } };
    }
  }

  if (spec.key === "dow") {
    if (text === "L") return { term: { kind: "value", value: spec.max }, values: [normalise(spec, spec.max)] };
    const last = /^(.+)L$/.exec(text);
    if (last) {
      const day = readValue(last[1], spec);
      if (typeof day === "string") return { error: day };
      return { term: { kind: "last-dow", day } };
    }
    const nth = /^(.+)#(\d+)$/.exec(text);
    if (nth) {
      const day = readValue(nth[1], spec);
      if (typeof day === "string") return { error: day };
      const count = Number(nth[2]);
      if (count < 1 || count > 5) return { error: "# counts a week from 1 to 5" };
      return { term: { kind: "nth-dow", day, nth: count } };
    }
  }

  return null;
}

function refuseSpecial(piece: string, spec: FieldSpec): PieceResult | null {
  if (piece.includes("#")) return { error: "# needs the Quartz flavour" };
  if (spec.key === "dom" && /^(L|LW|L-\d+|\d+W)$/i.test(piece)) return { error: "L and W need the Quartz flavour" };
  if (spec.key === "dow" && /L$/i.test(piece)) return { error: "L needs the Quartz flavour" };
  return null;
}

export function expand(spec: FieldSpec, from: number, to: number, step: number, wrap: boolean): number[] {
  const cycle = spec.max - spec.min + 1;
  const span = wrap ? to - from + cycle : to - from;
  const values: number[] = [];
  for (let offset = 0; offset <= span; offset += step) {
    values.push(normalise(spec, spec.min + ((from - spec.min + offset) % cycle)));
  }
  return values;
}

export function splitTokens(text: string): string[] {
  return text === "" ? [] : text.split(" ");
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").replace(/^ +/, "");
}

export function pickFlavour(value: unknown): Flavour {
  return FLAVOURS.some((item) => item.value === value) ? value as Flavour : "unix";
}

export function pickExpression(value: unknown, flavour: Flavour): string {
  return typeof value === "string" ? collapseSpaces(value) : DEFAULT_EXPRESSIONS[flavour];
}
