import { type ArraySchema, conditional, type NumberSchema, type ObjectSchema, type Property, resolve, type Schema, type SchemaDocument, type StringSchema, type UnionSchema } from "../../common/schema/ir";
import { accepts, compiled } from "../../common/schema/validate";
import type { Rng } from "./seed";

export function merge(parts: Schema[], doc: SchemaDocument, rng: Rng): Schema | null {
  let merged: Schema | null = UNKNOWN;
  for (const part of parts) {
    merged = fold(merged, part, doc, rng);
    if (!merged) return null;
  }
  return merged;
}

function fold(a: Schema, b: Schema, doc: SchemaDocument, rng: Rng): Schema | null {
  const left = shapeOf(a, doc);
  const right = shapeOf(b, doc);
  if (left.kind === "unknown") return right;
  if (right.kind === "unknown") return left;
  if (left.kind === "never" || right.kind === "never") return { kind: "never" };
  if (left.kind === "intersection") return fold(merge(left.parts, doc, rng) ?? NEVER, right, doc, rng);
  if (right.kind === "intersection") return fold(left, merge(right.parts, doc, rng) ?? NEVER, doc, rng);
  if (left.kind === "union") return anyOption(left, right, doc, rng);
  if (right.kind === "union") return anyOption(right, left, doc, rng);
  if (left.kind === "enum" || left.kind === "literal") return valuesOf(left, right, doc);
  if (right.kind === "enum" || right.kind === "literal") return valuesOf(right, left, doc);
  if (left.kind !== right.kind) return null;

  switch (left.kind) {
    case "number":
      return numbers(left, right as NumberSchema);
    case "string":
      return strings(left, right as StringSchema);
    case "array":
      return arrays(left, right as ArraySchema);
    case "object":
      return objects(left, right as ObjectSchema);
    default:
      return left;
  }
}

function anyOption(union: UnionSchema, other: Schema, doc: SchemaDocument, rng: Rng): Schema | null {
  for (const option of rng.shuffled(union.options)) {
    const folded = fold(option, other, doc, rng);
    if (folded) return folded;
  }
  return null;
}

function valuesOf(listed: Schema & { kind: "enum" | "literal" }, other: Schema, doc: SchemaDocument): Schema | null {
  const values = listed.kind === "enum" ? listed.values : [listed.value];
  const kept = values.filter((value) => accepts(value, other, doc));
  if (kept.length === 0) return null;
  return kept.length === 1 ? { kind: "literal", value: kept[0] } : { kind: "enum", values: kept };
}

function numbers(left: NumberSchema, right: NumberSchema): NumberSchema {
  return defined({
    ...left,
    integer: left.integer || right.integer || undefined,
    minimum: most(left.minimum, right.minimum),
    maximum: least(left.maximum, right.maximum),
    exclusiveMinimum: most(left.exclusiveMinimum, right.exclusiveMinimum),
    exclusiveMaximum: least(left.exclusiveMaximum, right.exclusiveMaximum),
    multipleOf: right.multipleOf ?? left.multipleOf,
  });
}

function strings(left: StringSchema, right: StringSchema): StringSchema {
  return defined({
    ...left,
    minLength: most(left.minLength, right.minLength),
    maxLength: least(left.maxLength, right.maxLength),
    pattern: right.pattern ?? left.pattern,
    format: left.format ?? right.format,
  });
}

function arrays(left: ArraySchema, right: ArraySchema): ArraySchema {
  const length = Math.max(left.prefix?.length ?? 0, right.prefix?.length ?? 0);
  const prefix = Array.from(
    { length },
    (_unused, index) => both(left.prefix?.[index] ?? left.items, right.prefix?.[index] ?? right.items),
  );
  const contains = left.contains && right.contains
    ? both(left.contains, right.contains)
    : left.contains ?? right.contains;
  return defined({
    ...left,
    items: both(left.items, right.items),
    prefix: length > 0 ? prefix : undefined,
    minItems: most(left.minItems, right.minItems),
    maxItems: least(left.maxItems, right.maxItems),
    uniqueItems: left.uniqueItems || right.uniqueItems || undefined,
    contains,
    minContains: most(left.minContains, right.minContains),
    maxContains: least(left.maxContains, right.maxContains),
  });
}

function objects(left: ObjectSchema, right: ObjectSchema): ObjectSchema {
  const properties: Property[] = [];
  for (const property of [...left.properties, ...right.properties]) {
    const at = properties.findIndex((kept) => kept.name === property.name);
    if (at === -1) properties.push(property);
    else {
      const kept = properties[at];
      properties[at] = {
        name: kept.name,
        schema: both(kept.schema, property.schema),
        required: kept.required || property.required,
      };
    }
  }

  const additional = left.additional === false || right.additional === false
    ? false
    : left.additional && right.additional
    ? both(left.additional, right.additional)
    : left.additional ?? right.additional;
  const patterns = [...left.patterns ?? [], ...right.patterns ?? []];
  const dependencies = [...left.dependencies ?? [], ...right.dependencies ?? []];

  return defined({
    ...left,
    properties: properties.filter((property) =>
      property.required || [left, right].every((part) => takes(part, property.name))
    ),
    additional,
    keyPattern: left.keyPattern ?? right.keyPattern,
    patterns: patterns.length > 0 ? patterns : undefined,
    minProperties: most(left.minProperties, right.minProperties),
    maxProperties: least(left.maxProperties, right.maxProperties),
    dependencies: dependencies.length > 0 ? dependencies : undefined,
  });
}

function takes(part: ObjectSchema, name: string): boolean {
  return part.additional !== false || part.properties.some((property) => property.name === name)
    || (part.patterns ?? []).some(({ pattern }) => compiled(pattern)?.test(name) ?? false);
}

function both(a: Schema, b: Schema): Schema {
  if (a.kind === "unknown" && !conditional(a)) return b;
  if (b.kind === "unknown" && !conditional(b)) return a;
  return { kind: "intersection", parts: [a, b] };
}

function shapeOf(schema: Schema, doc: SchemaDocument): Schema {
  const { not: _not, if: _if, then: _then, else: _else, ...shape } = resolve(schema, doc);
  return shape as Schema;
}

function most(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined ? b : b === undefined ? a : Math.max(a, b);
}

function least(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined ? b : b === undefined ? a : Math.min(a, b);
}

function defined<T extends object>(schema: T): T {
  return Object.fromEntries(Object.entries(schema).filter(([, value]) => value !== undefined)) as T;
}

const UNKNOWN: Schema = { kind: "unknown" };

const NEVER: Schema = { kind: "never" };
