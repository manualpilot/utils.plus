import { type Field, type FieldKind, fieldOf } from "./fields";
import type { Exchange } from "./parse";

export interface Condition {
  key: number;
  field: string;
  comparator: string;
  value: string;
}

export interface Comparator {
  id: string;
  label: string;
  kinds: FieldKind[];
  negated?: boolean;
  holds(value: string | number, wanted: Wanted): boolean;
}

interface Wanted {
  text: string;
  number: number | null;
  pattern: RegExp | null;
}

export const COMPARATORS: Comparator[] = [
  { id: "is", label: "is", kinds: ["text", "number"], holds: (value, wanted) => same(value, wanted) },
  {
    id: "is-not",
    label: "is not",
    kinds: ["text", "number"],
    negated: true,
    holds: (value, wanted) => same(value, wanted),
  },
  { id: "contains", label: "contains", kinds: ["text"], holds: (value, wanted) => text(value).includes(wanted.text) },
  {
    id: "not-contains",
    label: "does not contain",
    kinds: ["text"],
    negated: true,
    holds: (value, wanted) => text(value).includes(wanted.text),
  },
  {
    id: "starts",
    label: "starts with",
    kinds: ["text"],
    holds: (value, wanted) => text(value).startsWith(wanted.text),
  },
  { id: "ends", label: "ends with", kinds: ["text"], holds: (value, wanted) => text(value).endsWith(wanted.text) },
  {
    id: "matches",
    label: "matches regex",
    kinds: ["text"],
    holds: (value, wanted) => wanted.pattern !== null && wanted.pattern.test(text(value)),
  },
  {
    id: "lt",
    label: "is less than",
    kinds: ["number"],
    holds: (value, wanted) => compare(value, wanted, (a, b) => a < b),
  },
  {
    id: "lte",
    label: "is at most",
    kinds: ["number"],
    holds: (value, wanted) => compare(value, wanted, (a, b) => a <= b),
  },
  {
    id: "gt",
    label: "is greater than",
    kinds: ["number"],
    holds: (value, wanted) => compare(value, wanted, (a, b) => a > b),
  },
  {
    id: "gte",
    label: "is at least",
    kinds: ["number"],
    holds: (value, wanted) => compare(value, wanted, (a, b) => a >= b),
  },
];

export const DEFAULT_COMPARATOR: Record<FieldKind, string> = { text: "contains", number: "is" };

export function comparatorsFor(kind: FieldKind): Comparator[] {
  return COMPARATORS.filter((comparator) => comparator.kinds.includes(kind));
}

export function comparatorOf(id: string | undefined, kind: FieldKind): Comparator {
  const named = COMPARATORS.find((comparator) => comparator.id === id);
  if (named && named.kinds.includes(kind)) return named;
  return COMPARATORS.find((comparator) => comparator.id === DEFAULT_COMPARATOR[kind])!;
}

export function comparatorOptions(kind: FieldKind) {
  return comparatorsFor(kind).map((comparator) => ({ value: comparator.id, label: comparator.label }));
}

export function isBlank(condition: Condition): boolean {
  return condition.value.trim() === "";
}

export function conditionProblem(condition: Condition): string {
  if (isBlank(condition)) return "";
  const field = fieldOf(condition.field);
  const comparator = comparatorOf(condition.comparator, field.kind);
  if (comparator.id === "matches") {
    try {
      new RegExp(condition.value, "i");
    } catch (error) {
      return error instanceof Error ? error.message : "Not a pattern";
    }
    return "";
  }
  if (field.kind === "number" && !Number.isFinite(Number(condition.value.trim()))) return "Not a number";
  return "";
}

export function filterExchanges(exchanges: Exchange[], conditions: Condition[]): Exchange[] {
  const asked = conditions.filter((condition) => !isBlank(condition)).map(prepare);
  if (asked.length === 0) return exchanges;
  return exchanges.filter((exchange) => asked.every((question) => holds(exchange, question)));
}

interface Question {
  field: Field;
  comparator: Comparator;
  wanted: Wanted;
  unusable: boolean;
}

function prepare(condition: Condition): Question {
  const field = fieldOf(condition.field);
  const comparator = comparatorOf(condition.comparator, field.kind);
  const value = condition.value.trim();
  const number = Number(value);
  return {
    field,
    comparator,
    wanted: {
      text: value.toLowerCase(),
      number: Number.isFinite(number) ? number : null,
      pattern: pattern(comparator, condition.value),
    },
    unusable: conditionProblem(condition) !== "",
  };
}

function pattern(comparator: Comparator, value: string): RegExp | null {
  if (comparator.id !== "matches") return null;
  try {
    return new RegExp(value, "i");
  } catch {
    return null;
  }
}

function holds(exchange: Exchange, question: Question): boolean {
  if (question.unusable) return false;
  const read = question.field.read(exchange).filter((value): value is string | number => value !== null);
  const values = question.field.kind === "text" && read.length === 0 ? [""] : read;
  if (values.length === 0) return false;
  const any = values.some((value) => question.comparator.holds(value, question.wanted));
  return question.comparator.negated ? !any : any;
}

function text(value: string | number): string {
  return String(value).toLowerCase();
}

function same(value: string | number, wanted: Wanted): boolean {
  if (typeof value === "number") return wanted.number !== null && value === wanted.number;
  return text(value) === wanted.text;
}

function compare(value: string | number, wanted: Wanted, held: (a: number, b: number) => boolean): boolean {
  if (typeof value !== "number" || wanted.number === null) return false;
  return held(value, wanted.number);
}

export type SharedCondition = [field: string, comparator: string, value: string];

export function writeConditions(conditions: Condition[]): SharedCondition[] | undefined {
  const asked = conditions.filter((condition) => !isBlank(condition));
  if (asked.length === 0) return undefined;
  return asked.map((condition) => [condition.field, condition.comparator, condition.value]);
}

export function readConditions(shared: unknown): Condition[] {
  if (!Array.isArray(shared)) return [blankCondition()];
  const conditions = shared
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => {
      const field = fieldOf(typeof row[0] === "string" ? row[0] : undefined);
      const comparator = comparatorOf(typeof row[1] === "string" ? row[1] : undefined, field.kind);
      return {
        key: nextKey(),
        field: field.id,
        comparator: comparator.id,
        value: typeof row[2] === "string" ? row[2] : "",
      };
    });
  return conditions.length > 0 ? conditions : [blankCondition()];
}

export function blankCondition(): Condition {
  const field = fieldOf(undefined);
  return { key: nextKey(), field: field.id, comparator: DEFAULT_COMPARATOR[field.kind], value: "" };
}

let keys = 0;

function nextKey(): number {
  return ++keys;
}
