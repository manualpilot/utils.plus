import { conditional, type JsonValue, lookup, type ObjectSchema, type Schema, type SchemaDocument, type UnionSchema } from "../../common/schema/ir";
import { accepts, compiled, validate } from "../../common/schema/validate";
import { detectField } from "./detect";
import { type Field, FIELDS } from "./fields";
import { type Locale, type LocaleId, LOCALES } from "./locales";
import { merge } from "./merge";
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
  if (conditional(schema) || schema.kind === "intersection") return buildChecked(schema, name, context, rng, depth);
  return construct(schema, name, context, rng, depth);
}

function buildChecked(schema: Schema, name: string, context: Context, rng: Rng, depth: number): Built {
  let last: Built = OMIT;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const merged = merge(partsOf(schema, context, rng, new Set()), context.doc, rng);
    const target = merged?.kind === "unknown" && attempt > 0 ? rng.pick(ANY_KIND) : merged;
    const value = target ? construct(target, name, context, rng, depth) : loose(schema, name, context, rng, depth);
    if (value === OMIT) break;
    if (accepts(value, schema, context.doc)) return value;
    last = value;
  }
  if (last !== OMIT) unmet(last, schema, context);
  return last;
}

function partsOf(schema: Schema, context: Context, rng: Rng, seen: Set<string>): Schema[] {
  const target = schema.kind === "ref" && !seen.has(schema.name) ? lookup(context.doc, schema.name) : undefined;
  if (schema.kind === "ref" && target) seen.add(schema.name);
  const own = target
    ? partsOf(target, context, rng, seen)
    : schema.kind === "intersection"
    ? schema.parts.flatMap((part) => partsOf(part, context, rng, seen))
    : [schema];
  if (!schema.if) return own;
  const sides = [[schema.if, ...schema.then ? [schema.then] : []], schema.else ? [schema.else] : []];
  return [...own, ...rng.pick(sides)];
}

function loose(schema: Schema, name: string, context: Context, rng: Rng, depth: number): Built {
  const parts = schema.kind === "intersection" ? schema.parts : [schema];
  const built = schema.kind === "intersection"
    ? parts.map((part) => build(part, name, context, rng, depth))
    : [construct(schema, name, context, rng, depth)];
  if (built.some((part) => part === OMIT)) return OMIT;
  const values = built as JsonValue[];
  if (values.every(isRecord)) return joined(values);
  return values.find((value) => parts.every((part) => accepts(value, part, context.doc))) ?? values[0] ?? null;
}

function unmet(value: JsonValue, schema: Schema, context: Context) {
  for (const { keyword } of validate(value, { root: schema, defs: context.doc.defs })) {
    context.notes.add(`Nothing this page built satisfied the schema's \`${keyword}\`, so some rows fail it.`);
  }
}

function construct(schema: Schema, name: string, context: Context, rng: Rng, depth: number): Built {
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
      if (schema.exclusive) return buildExclusive(schema, options, nullable, name, context, rng, depth);
      if (context.optional === "sometimes" && nullable && rng.chance(NULL_CHANCE)) return null;

      for (const option of rng.shuffled(options)) {
        const value = build(option, name, context, rng, depth);
        if (value !== OMIT) return value;
      }
      return nullable ? null : OMIT;
    }

    case "intersection":
      return loose(schema, name, context, rng, depth);
  }
}

function buildExclusive(
  schema: UnionSchema,
  options: Schema[],
  nullable: boolean,
  name: string,
  context: Context,
  rng: Rng,
  depth: number,
): Built {
  if (context.optional === "sometimes" && nullable && rng.chance(NULL_CHANCE) && accepts(null, schema, context.doc)) {
    return null;
  }
  let last: Built = OMIT;
  for (const option of rng.shuffled(options)) {
    for (let attempt = 0; attempt < TRIES_PER_BRANCH; attempt++) {
      const value = build(option, name, context, rng, depth);
      if (value === OMIT) break;
      if (accepts(value, schema, context.doc)) return value;
      last = value;
    }
  }
  if (last === OMIT) return nullable ? null : OMIT;
  unmet(last, schema, context);
  return last;
}

function buildObject(schema: ObjectSchema, context: Context, rng: Rng, depth: number): JsonValue {
  const out = record();

  for (const property of schema.properties) {
    if (!property.required && !includeOptional(context, rng)) continue;
    const value = valueFor(schema, property.name, property.name, context, rng, depth);
    if (value === REFUSED) continue;
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

  if (schema.properties.length === 0 && (schema.additional || schema.patterns) && depth <= MAX_DEPTH) {
    for (let i = 0; i < rng.between(2, 4); i++) {
      const key = freshKey(schema, context, rng, i);
      if (key === null) continue;
      const value = valueFor(schema, key, "value", context, rng, depth);
      if (value !== OMIT && value !== REFUSED) out[key] = value;
    }
  }

  if (schema.dependencies || schema.minProperties !== undefined || schema.maxProperties !== undefined) {
    settle(out, schema, context, rng, depth);
  }
  return out;
}

function valueFor(
  schema: ObjectSchema,
  key: string,
  name: string,
  context: Context,
  rng: Rng,
  depth: number,
): Built | typeof REFUSED {
  const declared = schema.properties.find((property) => property.name === key)?.schema;
  const patterned = (schema.patterns ?? []).filter(({ pattern }) => compiled(pattern)?.test(key) ?? false);
  const own = declared ?? (patterned.length > 0 ? undefined : schema.additional ?? UNKNOWN);
  if (own === false) return REFUSED;
  const parts = [...own ? [own] : [], ...patterned.map((entry) => entry.schema)];
  return build(parts.length === 1 ? parts[0] : { kind: "intersection", parts }, name, context, rng, depth + 1);
}

function freshKey(schema: ObjectSchema, context: Context, rng: Rng, index: number): string | null {
  const draws: (() => string | null)[] = (schema.patterns ?? []).map(({ pattern }) => () =>
    stringFromPattern(rng, pattern)
  );
  if (schema.additional !== false) {
    const drawn = () => (schema.keyPattern ? stringFromPattern(rng, schema.keyPattern) : null);
    draws.push(() => drawn() ?? `${valueOf(FIELDS.word, context, rng)}_${index}`);
  }
  if (draws.length === 0) return null;
  const key = (draws.length === 1 ? draws[0] : rng.pick(draws))();
  if (key === null || schema.keyPattern === undefined) return key;
  return compiled(schema.keyPattern)?.test(key) ?? true ? key : null;
}

function settle(out: Mapping, schema: ObjectSchema, context: Context, rng: Rng, depth: number) {
  const has = (key: string) => Object.hasOwn(out, key);
  const count = () => Object.keys(out).length;
  const required = (key: string) => schema.properties.some((property) => property.name === key && property.required);
  const neededBy = (key: string) =>
    (schema.dependencies ?? []).some(({ name, requires }) => has(name) && requires.includes(key));
  const put = (key: string) => {
    const value = valueFor(schema, key, key, context, rng, depth);
    if (value === OMIT || value === REFUSED) return false;
    out[key] = value;
    return true;
  };

  const bring = () => {
    for (let round = 0; round <= (schema.dependencies?.length ?? 0); round++) {
      let changed = false;
      for (const { name, requires } of schema.dependencies ?? []) {
        for (const needed of requires) {
          if (!has(name) || has(needed)) continue;
          if (put(needed)) changed = true;
          else if (required(name)) context.notes.add(DEPENDENCY_UNMET);
          else changed = delete out[name];
        }
      }
      if (!changed) return;
    }
  };

  bring();
  const least = schema.minProperties ?? 0;
  if (count() < least) {
    for (const property of rng.shuffled(schema.properties)) {
      if (count() >= least) break;
      if (!has(property.name)) put(property.name);
    }
    for (let tries = 0; count() < least && tries < TRIES * least; tries++) {
      const key = freshKey(schema, context, rng, count());
      if (key !== null && !has(key)) put(key);
    }
    bring();
    if (count() < least) context.notes.add(MIN_PROPERTIES_UNMET);
  }

  const most = schema.maxProperties;
  if (most !== undefined && count() > most) {
    for (const key of rng.shuffled(Object.keys(out))) {
      if (count() <= most) break;
      if (has(key) && !required(key) && !neededBy(key)) delete out[key];
    }
    if (count() > most) context.notes.add(MAX_PROPERTIES_UNMET);
  }
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

  if (schema.contains) return withContains(schema, items, name, context, rng, depth);
  return items;
}

function withContains(
  schema: Schema & { kind: "array" },
  items: JsonValue[],
  name: string,
  context: Context,
  rng: Rng,
  depth: number,
): JsonValue[] {
  const contains = schema.contains ?? UNKNOWN;
  const fixed = schema.prefix?.length ?? 0;
  const counts = (item: JsonValue) => accepts(item, contains, context.doc);
  const both: Schema = { kind: "intersection", parts: [schema.items, contains] };
  let counted = items.filter(counts).length;

  for (let tries = 0; counted < (schema.minContains ?? 1) && tries < TRIES; tries++) {
    const value = build(both, name, context, rng, depth + 1);
    if (value === OMIT || !counts(value)) continue;
    if (schema.uniqueItems && items.some((item) => JSON.stringify(item) === JSON.stringify(value))) continue;
    if (schema.maxItems === undefined || items.length < schema.maxItems) {
      items.splice(rng.between(fixed, items.length), 0, value);
    } else {
      const spare = items.findIndex((item, index) => index >= fixed && !counts(item));
      if (spare === -1) break;
      items[spare] = value;
    }
    counted++;
  }

  const most = schema.maxContains;
  for (let index = items.length - 1; most !== undefined && counted > most && index >= fixed; index--) {
    if (!counts(items[index]) || items.length <= (schema.minItems ?? 0)) continue;
    items.splice(index, 1);
    counted--;
  }

  if (!accepts(items, schema, context.doc)) unmet(items, schema, context);
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

function record(): Mapping {
  return Object.create(null);
}

function joined(values: Mapping[]): Mapping {
  const out = record();
  for (const value of values) for (const key of Object.keys(value)) out[key] = value[key];
  return out;
}

function isRecord(value: JsonValue): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OMIT = Symbol("omit");

type Built = JsonValue | typeof OMIT;

type Mapping = { [key: string]: JsonValue };

const REFUSED = Symbol("refused");

const UNKNOWN: Schema = { kind: "unknown" };

const ANY_KIND: Schema[] = [UNKNOWN, { kind: "number", integer: true }, { kind: "boolean" }, { kind: "null" }];

const TRIES = 16;

const TRIES_PER_BRANCH = 6;

const DEPENDENCY_UNMET = "`dependentRequired` asks for a key the object does not allow, so some objects break it.";

const MIN_PROPERTIES_UNMET =
  "`minProperties` asks for more keys than the schema lets this page write, so some objects fall short of it.";

const MAX_PROPERTIES_UNMET =
  "`maxProperties` allows fewer keys than the object requires, so some objects carry more than it allows.";

const MAX_DEPTH = 6;

const EXTRA_ITEMS = 3;

const UNIQUE_TRIES = 8;

const PRESENT_CHANCE = 0.75;

const NULL_CHANCE = 0.15;

const DEFAULT_SPAN = 1000;

const SMALLEST = 0.01;

const ROUNDING = 1e-9;

const FILLER = "abcdefghijklmnopqrstuvwxyz";
