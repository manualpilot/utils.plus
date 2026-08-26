import { type JsonValue, lookup, type Schema, type SchemaDocument } from "../../common/schema/ir";
import { detectField } from "./detect";
import { type Field, FIELDS } from "./fields";
import { type Locale, type LocaleId, LOCALES } from "./locales";
import { stringFromPattern } from "./pattern";
import { type Rng, rowRng } from "./seed";

export type Optionality = "always" | "sometimes" | "never";

export interface BatchOptions {
  seed: string;
  count: number;
  locale: LocaleId;
  optional: Optionality;
}

export interface Batch {
  rows: JsonValue[];
  notes: string[];
}

export function generateBatch(doc: SchemaDocument, options: BatchOptions): Batch {
  const shape = rowSchema(doc);
  const notes = new Set<string>();
  const locale = LOCALES[options.locale] ?? LOCALES["en-US"];
  const rows: JsonValue[] = [];

  for (let index = 0; index < options.count; index++) {
    const context: Context = { doc, locale, optional: options.optional, notes, visiting: new Set() };
    const row = build(shape, rowName(doc), context, rowRng(options.seed, index), 0);
    rows.push(row === OMIT ? null : row);
  }

  return { rows, notes: [...notes] };
}

export function rowSchema(doc: SchemaDocument): Schema {
  const root = follow(doc.root, doc);
  return root.kind === "array" ? root.items : doc.root;
}

export function rowName(doc: SchemaDocument): string {
  const root = follow(doc.root, doc);
  if (root.kind === "array" && doc.root.kind !== "ref") {
    const items = doc.root.kind === "array" ? doc.root.items : root.items;
    if (items.kind === "ref") return items.name;
    if (items.title) return items.title;
  }
  if (doc.root.kind === "ref") return doc.root.name;
  return root.title ?? doc.defs[0]?.name ?? "records";
}

interface Context {
  doc: SchemaDocument;
  locale: Locale;
  optional: Optionality;
  notes: Set<string>;
  visiting: Set<string>;
}

function build(schema: Schema, name: string, context: Context, rng: Rng, depth: number): Built {
  switch (schema.kind) {
    case "null":
      return null;

    case "never":
      context.notes.add("A `never` in the schema has nothing that can be generated for it, so it is written as null.");
      return null;

    case "literal":
      return schema.value;

    case "enum":
      return schema.values.length > 0 ? rng.pick(schema.values) : null;

    case "boolean":
      return rng.chance(0.5);

    case "number":
      return buildNumber(schema, name, context, rng);

    case "string":
      return buildString(schema, name, context, rng);

    case "unknown":
      return valueOf(detectField(name, { kind: "string" }), context, rng);

    case "ref": {
      if (context.visiting.has(schema.name) || depth > MAX_DEPTH) return OMIT;
      const target = lookup(context.doc, schema.name);
      if (!target) {
        context.notes.add(`Nothing in the document defines ${schema.name}, so it is written as null.`);
        return null;
      }
      context.visiting.add(schema.name);
      const value = build(target, schema.name, context, rng, depth + 1);
      context.visiting.delete(schema.name);
      return value;
    }

    case "array":
      return buildArray(schema, name, context, rng, depth);

    case "object":
      return buildObject(schema, context, rng, depth);

    case "union": {
      const nullable = schema.options.some((option) => option.kind === "null");
      const options = schema.options.filter((option) => option.kind !== "null");
      if (options.length === 0) return null;
      if (context.optional === "sometimes" && nullable && rng.chance(NULL_CHANCE)) return null;

      for (const option of rng.shuffled(options)) {
        const value = build(option, name, context, rng, depth);
        if (value !== OMIT) return value;
      }
      return nullable ? null : OMIT;
    }

    case "intersection": {
      const built = schema.parts.map((part) => build(part, name, context, rng, depth));
      if (built.some((part) => part === OMIT)) return OMIT;
      const parts = built as JsonValue[];
      if (parts.every(isRecord)) return Object.assign({}, ...parts);
      return parts[0] ?? null;
    }
  }
}

function buildObject(schema: Schema & { kind: "object" }, context: Context, rng: Rng, depth: number): JsonValue {
  const out: { [key: string]: JsonValue } = {};

  for (const property of schema.properties) {
    if (!property.required && !includeOptional(context, rng)) continue;
    const value = build(property.schema, property.name, context, rng, depth + 1);
    if (value === OMIT) {
      if (!property.required) continue;
      context.notes.add(
        `${property.name} is required and refers back to itself, so past a few levels it is written as null.`,
      );
      out[property.name] = null;
      continue;
    }
    out[property.name] = value;
  }

  if (schema.properties.length === 0 && schema.additional && depth <= MAX_DEPTH) {
    const additional = schema.additional;
    for (let i = 0; i < rng.between(2, 4); i++) {
      const drawn = schema.keyPattern ? stringFromPattern(rng, schema.keyPattern) : null;
      const key = drawn ?? `${valueOf(FIELDS.word, context, rng)}_${i}`;
      const value = build(additional, "value", context, rng, depth + 1);
      if (value !== OMIT) out[key] = value;
    }
  }

  return out;
}

function buildArray(schema: Schema & { kind: "array" }, name: string, context: Context, rng: Rng, depth: number) {
  const prefix = schema.prefix ?? [];
  const items: JsonValue[] = [];
  for (const item of prefix) {
    const value = build(item, name, context, rng, depth + 1);
    if (value !== OMIT) items.push(value);
  }

  const least = Math.max(schema.minItems ?? prefix.length + 1, prefix.length);
  const most = Math.min(schema.maxItems ?? least + EXTRA_ITEMS, least + EXTRA_ITEMS);
  const wanted = depth > MAX_DEPTH ? Math.max(schema.minItems ?? 0, prefix.length) : rng.between(least, most);

  const seen = new Set(items.map((item) => JSON.stringify(item)));
  let attempts = 0;
  while (items.length < wanted && attempts < wanted + UNIQUE_TRIES) {
    attempts++;
    const value = build(schema.items, name, context, rng, depth + 1);
    if (value === OMIT) break;
    const key = JSON.stringify(value);
    if (schema.uniqueItems && seen.has(key)) continue;
    seen.add(key);
    items.push(value);
  }

  return items;
}

function buildString(schema: Schema & { kind: "string" }, name: string, context: Context, rng: Rng): string {
  if (schema.pattern) {
    const drawn = stringFromPattern(rng, schema.pattern);
    if (drawn !== null) {
      const clamped = clampLength(drawn, schema.minLength, schema.maxLength, rng);
      if (clamped === drawn) return drawn;
      context.notes.add(
        `No string matching ${schema.pattern} fits the length bounds beside it, so the pattern was kept and they were not.`,
      );
      return drawn;
    }
    context.notes.add(
      `The pattern ${schema.pattern} is not one this page can generate from, so those values are ordinary text.`,
    );
  }

  const value = String(valueOf(detectField(name, schema), context, rng));
  return clampLength(value, schema.minLength, schema.maxLength, rng);
}

function clampLength(value: string, minLength: number | undefined, maxLength: number | undefined, rng: Rng): string {
  let characters = [...value];
  if (maxLength !== undefined && characters.length > maxLength) characters = characters.slice(0, maxLength);
  while (minLength !== undefined && characters.length < minLength) {
    characters.push(FILLER[rng.below(FILLER.length)]);
  }
  return characters.join("");
}

function buildNumber(schema: Schema & { kind: "number" }, name: string, context: Context, rng: Rng): number {
  const integer = schema.integer === true;
  const natural = valueOf(detectField(name, schema), context, rng);
  const bounded = schema.minimum !== undefined || schema.maximum !== undefined
    || schema.exclusiveMinimum !== undefined || schema.exclusiveMaximum !== undefined
    || schema.multipleOf !== undefined;

  if (!bounded && typeof natural === "number") return integer ? Math.round(natural) : natural;

  const step = integer ? 1 : SMALLEST;
  const low = schema.minimum ?? (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + step : undefined);
  const high = schema.maximum ?? (schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum - step : undefined);
  const lo = low ?? (high !== undefined ? high - DEFAULT_SPAN : 0);
  const hi = high ?? lo + DEFAULT_SPAN;
  if (hi < lo) {
    context.notes.add("A number is bounded below by more than it is bounded above, so its range is empty.");
    return lo;
  }

  if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
    const first = Math.ceil(lo / schema.multipleOf - ROUNDING);
    const last = Math.floor(hi / schema.multipleOf + ROUNDING);
    if (first > last) {
      context.notes.add(`No multiple of ${schema.multipleOf} lies inside the range asked for, so the bound is used.`);
      return lo;
    }
    return round(rng.between(first, last) * schema.multipleOf, integer);
  }

  return integer ? rng.between(Math.ceil(lo), Math.floor(hi)) : round(rng.float(lo, hi, 2), false);
}

function round(value: number, integer: boolean): number {
  return integer ? Math.round(value) : Number(value.toPrecision(12));
}

function valueOf(field: Field, context: Context, rng: Rng): JsonValue {
  return field.generate(rng, context.locale);
}

function includeOptional(context: Context, rng: Rng): boolean {
  if (context.optional === "always") return true;
  if (context.optional === "never") return false;
  return rng.chance(PRESENT_CHANCE);
}

function follow(schema: Schema, doc: SchemaDocument): Schema {
  const seen = new Set<string>();
  let current = schema;
  while (current.kind === "ref" && !seen.has(current.name)) {
    seen.add(current.name);
    current = lookup(doc, current.name) ?? { kind: "unknown" };
  }
  return current;
}

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OMIT = Symbol("omit");

type Built = JsonValue | typeof OMIT;

const MAX_DEPTH = 6;

const EXTRA_ITEMS = 3;

const UNIQUE_TRIES = 8;

const PRESENT_CHANCE = 0.75;

const NULL_CHANCE = 0.15;

const DEFAULT_SPAN = 1000;

const SMALLEST = 0.01;

const ROUNDING = 1e-9;

const FILLER = "abcdefghijklmnopqrstuvwxyz";
