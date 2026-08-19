export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Meta {
  title?: string;
  description?: string;
  default?: JsonValue;
}

export interface UnknownSchema extends Meta {
  kind: "unknown";
}

export interface NeverSchema extends Meta {
  kind: "never";
}

export interface NullSchema extends Meta {
  kind: "null";
}

export interface BooleanSchema extends Meta {
  kind: "boolean";
}

export interface NumberSchema extends Meta {
  kind: "number";
  integer?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
}

export interface StringSchema extends Meta {
  kind: "string";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

export interface LiteralSchema extends Meta {
  kind: "literal";
  value: JsonValue;
}

export interface EnumSchema extends Meta {
  kind: "enum";
  values: JsonValue[];
}

export interface ArraySchema extends Meta {
  kind: "array";
  items: Schema;
  prefix?: Schema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface Property {
  name: string;
  schema: Schema;
  required: boolean;
}

export interface ObjectSchema extends Meta {
  kind: "object";
  properties: Property[];
  additional?: Schema | false;
  keyPattern?: string;
}

export interface UnionSchema extends Meta {
  kind: "union";
  options: Schema[];
}

export interface IntersectionSchema extends Meta {
  kind: "intersection";
  parts: Schema[];
}

export interface RefSchema extends Meta {
  kind: "ref";
  name: string;
}

export type Schema =
  | UnknownSchema
  | NeverSchema
  | NullSchema
  | BooleanSchema
  | NumberSchema
  | StringSchema
  | LiteralSchema
  | EnumSchema
  | ArraySchema
  | ObjectSchema
  | UnionSchema
  | IntersectionSchema
  | RefSchema;

export interface Definition {
  name: string;
  schema: Schema;
}

export interface SchemaDocument {
  root: Schema;
  defs: Definition[];
}

export interface ReadResult {
  document: SchemaDocument | null;
  errors: SourceError[];
}

export interface SourceError {
  message: string;
  from?: number;
  to?: number;
}

export function lookup(doc: SchemaDocument, name: string): Schema | undefined {
  return doc.defs.find((def) => def.name === name)?.schema;
}

export function resolve(schema: Schema, doc: SchemaDocument): Schema {
  const seen = new Set<string>();
  let current = schema;
  while (current.kind === "ref") {
    if (seen.has(current.name)) return { kind: "unknown" };
    seen.add(current.name);
    const next = lookup(doc, current.name);
    if (!next) return { kind: "unknown" };
    current = next;
  }
  return current;
}

export function union(options: Schema[]): Schema {
  const flat: Schema[] = [];
  for (const option of options) {
    if (option.kind === "union") flat.push(...option.options);
    else if (option.kind !== "never") flat.push(option);
  }

  const unique: Schema[] = [];
  for (const option of flat) {
    if (!unique.some((kept) => same(kept, option))) unique.push(option);
  }

  if (unique.length === 0) return { kind: "never" };
  if (unique.length === 1) return unique[0];
  return { kind: "union", options: unique };
}

export function nullable(schema: Schema): Schema {
  return union([schema, { kind: "null" }]);
}

export function withoutNull(schema: Schema): Schema {
  if (schema.kind !== "union") return schema;
  return union(schema.options.filter((option) => option.kind !== "null"));
}

export function isNullable(schema: Schema): boolean {
  if (schema.kind === "null") return true;
  return schema.kind === "union" && schema.options.some((option) => option.kind === "null");
}

export function same(a: Schema, b: Schema): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function describe(schema: Schema): string {
  switch (schema.kind) {
    case "unknown":
      return "anything";
    case "never":
      return "nothing";
    case "null":
      return "null";
    case "boolean":
      return "a boolean";
    case "number":
      return schema.integer ? "an integer" : "a number";
    case "string":
      return schema.format ? `a string (${schema.format})` : "a string";
    case "literal":
      return JSON.stringify(schema.value) ?? "a literal";
    case "enum":
      return `one of ${schema.values.map((value) => JSON.stringify(value)).join(", ")}`;
    case "array":
      return "an array";
    case "object":
      return "an object";
    case "union":
      return schema.options.map(describe).join(" or ");
    case "intersection":
      return schema.parts.map(describe).join(" and ");
    case "ref":
      return schema.name;
  }
}

export function typeOf(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  switch (typeof value) {
    case "boolean":
      return "a boolean";
    case "number":
      return Number.isInteger(value) ? "an integer" : "a number";
    case "string":
      return "a string";
    default:
      return "an object";
  }
}
