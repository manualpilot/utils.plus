import { type Applicators, type ArraySchema, conditional, type Definition, type Dependency, exclusive, type JsonValue, type Meta, type NumberSchema, type ObjectSchema, type PatternProperty, type Property, type ReadResult, type Schema, type SchemaDocument, type SourceError, type StringSchema, union } from "./ir";
import { parseJson } from "./locate";

export const DIALECT = "https://json-schema.org/draft/2020-12/schema";

export function readJsonSchema(text: string): ReadResult {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return {
      document: null,
      errors: [{ message: parsed.error.message, from: parsed.error.from, to: parsed.error.to }],
    };
  }

  const errors: SourceError[] = [];
  const root = parsed.parsed.value;
  const defs: Definition[] = [];

  for (const holder of ["$defs", "definitions"]) {
    const bag = isObject(root) ? root[holder] : undefined;
    if (!isObject(bag)) continue;
    for (const [name, value] of Object.entries(bag)) defs.push({ name, schema: convert(value, errors) });
  }

  return { document: { root: convert(root, errors), defs }, errors };
}

function convert(value: JsonValue, errors: SourceError[]): Schema {
  if (value === true) return { kind: "unknown" };
  if (value === false) return { kind: "never" };
  if (!isObject(value)) {
    errors.push({ message: "A schema has to be an object or a boolean" });
    return { kind: "unknown" };
  }

  const meta = {
    ...text(value.title) !== undefined ? { title: text(value.title) } : {},
    ...text(value.description) !== undefined ? { description: text(value.description) } : {},
    ...value.default !== undefined ? { default: value.default } : {},
  };

  const schema = shape(value, meta, errors);
  const conditions = applicators(value, errors);
  if (conditions.not?.kind === "unknown" && !conditional(conditions.not)) return { ...meta, kind: "never" };
  if (conditions.not) note(errors, leftOut("not"));
  if (conditions.if) note(errors, leftOut("if"));
  for (const keyword of UNCHECKED) {
    if (value[keyword] !== undefined) note(errors, `\`${keyword}\` is not checked, and every conversion leaves it out`);
  }

  if (!conditions.not && !conditions.if) return schema;
  return conditional(schema)
    ? { kind: "intersection", parts: [schema, { kind: "unknown", ...conditions }] }
    : { ...schema, ...conditions };
}

function shape(value: { [key: string]: JsonValue }, meta: Meta, errors: SourceError[]): Schema {
  const ref = text(value.$ref);
  if (ref !== undefined) {
    const name = refName(ref);
    if (name === undefined) {
      errors.push({ message: `Only local references are resolved, and ${ref} points outside the document` });
      return { ...meta, kind: "unknown" };
    }
    return { ...meta, kind: "ref", name };
  }

  if (Array.isArray(value.enum)) return { ...meta, kind: "enum", values: value.enum };
  if (value.const !== undefined) return { ...meta, kind: "literal", value: value.const };

  const composed = compose(value, errors);
  if (composed) return { ...meta, ...composed };

  const types = typesOf(value, errors);
  if (types.length === 0) return { ...meta, kind: "unknown" };
  return { ...meta, ...union(types.map((name) => forType(name, value, errors))) };
}

function applicators(value: { [key: string]: JsonValue }, errors: SourceError[]): Applicators {
  const out: Applicators = {};
  if (value.not !== undefined) out.not = convert(value.not, errors);
  if (value.if !== undefined && (value.then !== undefined || value.else !== undefined)) {
    out.if = convert(value.if, errors);
    if (value.then !== undefined) out.then = convert(value.then, errors);
    if (value.else !== undefined) out.else = convert(value.else, errors);
  }
  return out;
}

function note(errors: SourceError[], message: string) {
  if (!errors.some((error) => error.message === message)) errors.push({ message });
}

function leftOut(keyword: string): string {
  return `\`${keyword}\` is checked against the payload, but converting to Zod or Pydantic leaves it out`;
}

function compose(value: { [key: string]: JsonValue }, errors: SourceError[]): Schema | null {
  const parts: Schema[] = [];

  if (Array.isArray(value.allOf)) parts.push(...value.allOf.map((item) => convert(item, errors)));
  if (Array.isArray(value.anyOf)) parts.push(union(value.anyOf.map((item) => convert(item, errors))));
  if (Array.isArray(value.oneOf)) {
    parts.push(exclusive(value.oneOf.map((item) => convert(item, errors))));
    note(
      errors,
      "`oneOf` is checked as exactly one, but converting to Zod or Pydantic writes it as a union that allows several",
    );
  }
  if (parts.length === 0) return null;

  const types = typesOf(value, errors);
  if (types.length > 0) parts.unshift(union(types.map((name) => forType(name, value, errors))));

  return parts.length === 1 ? parts[0] : { kind: "intersection", parts };
}

function typesOf(value: { [key: string]: JsonValue }, errors: SourceError[]): string[] {
  const declared = value.type;
  if (typeof declared === "string") return [declared];
  if (Array.isArray(declared)) return declared.filter((name): name is string => typeof name === "string");
  if (declared !== undefined) errors.push({ message: "`type` has to be a string or an array of strings" });

  const implied = TYPE_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => value[keyword] !== undefined));
  return implied ? [implied[0]] : [];
}

function forType(name: string, value: { [key: string]: JsonValue }, errors: SourceError[]): Schema {
  switch (name) {
    case "null":
      return { kind: "null" };
    case "boolean":
      return { kind: "boolean" };
    case "integer":
    case "number":
      return numberSchema(name === "integer", value);
    case "string":
      return stringSchema(value);
    case "array":
      return arraySchema(value, errors);
    case "object":
      return objectSchema(value, errors);
    default:
      errors.push({ message: `There is no JSON type called ${JSON.stringify(name)}` });
      return { kind: "unknown" };
  }
}

function numberSchema(integer: boolean, value: { [key: string]: JsonValue }): NumberSchema {
  return {
    kind: "number",
    ...integer ? { integer: true } : {},
    ...pick(value, "minimum", number),
    ...pick(value, "maximum", number),
    ...pick(value, "exclusiveMinimum", number),
    ...pick(value, "exclusiveMaximum", number),
    ...pick(value, "multipleOf", number),
  };
}

function stringSchema(value: { [key: string]: JsonValue }): StringSchema {
  return {
    kind: "string",
    ...pick(value, "minLength", number),
    ...pick(value, "maxLength", number),
    ...pick(value, "pattern", text),
    ...pick(value, "format", text),
  };
}

function arraySchema(value: { [key: string]: JsonValue }, errors: SourceError[]): ArraySchema {
  const tuple = Array.isArray(value.prefixItems)
    ? value.prefixItems
    : Array.isArray(value.items)
    ? value.items
    : undefined;
  const rest = Array.isArray(value.items) ? value.additionalItems : value.items;

  const contains = value.contains === undefined ? undefined : convert(value.contains, errors);
  if (contains) note(errors, leftOut("contains"));

  return {
    kind: "array",
    items: rest === undefined ? { kind: "unknown" } : convert(rest, errors),
    ...tuple ? { prefix: tuple.map((item) => convert(item, errors)) } : {},
    ...pick(value, "minItems", number),
    ...pick(value, "maxItems", number),
    ...value.uniqueItems === true ? { uniqueItems: true } : {},
    ...contains ? { contains, ...pick(value, "minContains", number), ...pick(value, "maxContains", number) } : {},
  };
}

function objectSchema(value: { [key: string]: JsonValue }, errors: SourceError[]): ObjectSchema {
  const required = new Set(
    Array.isArray(value.required) ? value.required.filter((name) => typeof name === "string") : [],
  );
  const properties: Property[] = [];
  if (isObject(value.properties)) {
    for (const [name, child] of Object.entries(value.properties)) {
      properties.push({ name, schema: convert(child, errors), required: required.has(name) });
    }
  }

  for (const name of required) {
    if (!properties.some((property) => property.name === name)) {
      properties.push({ name, schema: { kind: "unknown" }, required: true });
    }
  }

  const patterns: PatternProperty[] = [];
  if (isObject(value.patternProperties)) {
    for (const [pattern, child] of Object.entries(value.patternProperties)) {
      patterns.push({ pattern, schema: convert(child, errors) });
    }
    note(errors, leftOut("patternProperties"));
  }

  for (const keyword of ["minProperties", "maxProperties"]) {
    if (number(value[keyword]) !== undefined) note(errors, leftOut(keyword));
  }

  const dependencies = [
    ...dependenciesOf(value, "dependentRequired", errors),
    ...dependenciesOf(value, "dependencies", errors),
  ];

  const additional = value.additionalProperties;
  const names = isObject(value.propertyNames) ? text(value.propertyNames.pattern) : undefined;

  return {
    kind: "object",
    properties,
    ...additional === undefined ? {} : { additional: additional === false ? false : convert(additional, errors) },
    ...names !== undefined ? { keyPattern: names } : {},
    ...patterns.length > 0 ? { patterns } : {},
    ...pick(value, "minProperties", number),
    ...pick(value, "maxProperties", number),
    ...dependencies.length > 0 ? { dependencies } : {},
  };
}

function dependenciesOf(value: { [key: string]: JsonValue }, keyword: string, errors: SourceError[]): Dependency[] {
  const bag = value[keyword];
  if (!isObject(bag)) return [];

  const out: Dependency[] = [];
  for (const [name, requires] of Object.entries(bag)) {
    if (Array.isArray(requires)) {
      out.push({ name, requires: requires.filter((item): item is string => typeof item === "string") });
    } else {
      note(
        errors,
        `\`${keyword}\` naming a schema rather than a list of keys is not checked, and every conversion leaves it out`,
      );
    }
  }
  if (out.length > 0) note(errors, leftOut(keyword));
  return out;
}

function refName(ref: string): string | undefined {
  const match = /^#\/(?:\$defs|definitions)\/([^/]+)$/.exec(ref);
  return match ? match[1].replace(/~1/g, "/").replace(/~0/g, "~") : undefined;
}

export function writeJsonSchema(doc: SchemaDocument): string {
  const referenced = new Set<string>();
  for (const def of doc.defs) collectRefs(def.schema, referenced);
  if (doc.root.kind !== "ref") collectRefs(doc.root, referenced);

  const rootName = doc.root.kind === "ref" && !conditional(doc.root) ? doc.root.name : undefined;
  const inlined = rootName !== undefined && !referenced.has(rootName)
    ? doc.defs.find((def) => def.name === rootName)
    : undefined;

  const body = inlined ? { title: inlined.name, ...emit(inlined.schema) } : emit(doc.root);
  const rest = doc.defs.filter((def) => def !== inlined);

  const out: { [key: string]: JsonValue } = { $schema: DIALECT, ...body };
  if (rest.length > 0) {
    out.$defs = Object.fromEntries(rest.map((def) => [def.name, { title: def.name, ...emit(def.schema) }]));
  }

  return JSON.stringify(out, null, 2);
}

function collectRefs(schema: Schema, into: Set<string>) {
  for (const condition of [schema.not, schema.if, schema.then, schema.else]) {
    if (condition) collectRefs(condition, into);
  }

  switch (schema.kind) {
    case "ref":
      into.add(schema.name);
      return;
    case "array":
      collectRefs(schema.items, into);
      for (const item of schema.prefix ?? []) collectRefs(item, into);
      if (schema.contains) collectRefs(schema.contains, into);
      return;
    case "object":
      for (const property of schema.properties) collectRefs(property.schema, into);
      if (schema.additional) collectRefs(schema.additional, into);
      for (const pattern of schema.patterns ?? []) collectRefs(pattern.schema, into);
      return;
    case "union":
      for (const option of schema.options) collectRefs(option, into);
      return;
    case "intersection":
      for (const part of schema.parts) collectRefs(part, into);
  }
}

function emit(schema: Schema): { [key: string]: JsonValue } {
  const meta: { [key: string]: JsonValue } = {};
  if (schema.title !== undefined) meta.title = schema.title;
  if (schema.description !== undefined) meta.description = schema.description;

  const body = emitBody(schema);
  if (schema.not !== undefined && schema.kind !== "never") body.not = emit(schema.not);
  if (schema.if !== undefined) body.if = emit(schema.if);
  if (schema.then !== undefined) body.then = emit(schema.then);
  if (schema.else !== undefined) body.else = emit(schema.else);
  if (schema.default !== undefined) body.default = schema.default;
  return { ...meta, ...body };
}

function emitBody(schema: Schema): { [key: string]: JsonValue } {
  switch (schema.kind) {
    case "unknown":
      return {};
    case "never":
      return { not: {} };
    case "null":
      return { type: "null" };
    case "boolean":
      return { type: "boolean" };
    case "ref":
      return { $ref: `#/$defs/${schema.name.replace(/~/g, "~0").replace(/\//g, "~1")}` };
    case "literal":
      return { const: schema.value };
    case "enum":
      return { enum: schema.values };

    case "number":
      return {
        type: schema.integer ? "integer" : "number",
        ...pick(schema, "minimum", number),
        ...pick(schema, "maximum", number),
        ...pick(schema, "exclusiveMinimum", number),
        ...pick(schema, "exclusiveMaximum", number),
        ...pick(schema, "multipleOf", number),
      };

    case "string":
      return {
        type: "string",
        ...pick(schema, "minLength", number),
        ...pick(schema, "maxLength", number),
        ...pick(schema, "pattern", text),
        ...pick(schema, "format", text),
      };

    case "array":
      return {
        type: "array",
        ...schema.prefix ? { prefixItems: schema.prefix.map(emit) } : {},
        ...schema.items.kind === "unknown" ? {} : { items: emit(schema.items) },
        ...pick(schema, "minItems", number),
        ...pick(schema, "maxItems", number),
        ...schema.uniqueItems ? { uniqueItems: true } : {},
        ...schema.contains ? { contains: emit(schema.contains) } : {},
        ...pick(schema, "minContains", number),
        ...pick(schema, "maxContains", number),
      };

    case "object": {
      const required = schema.properties.filter((property) => property.required).map((property) => property.name);
      return {
        type: "object",
        ...schema.properties.length > 0
          ? {
            properties: Object.fromEntries(schema.properties.map((property) => [property.name, emit(property.schema)])),
          }
          : {},
        ...required.length > 0 ? { required } : {},
        ...schema.additional === undefined
          ? {}
          : { additionalProperties: schema.additional === false ? false : emit(schema.additional) },
        ...schema.keyPattern !== undefined ? { propertyNames: { pattern: schema.keyPattern } } : {},
        ...schema.patterns
          ? {
            patternProperties: Object.fromEntries(schema.patterns.map((entry) => [entry.pattern, emit(entry.schema)])),
          }
          : {},
        ...pick(schema, "minProperties", number),
        ...pick(schema, "maxProperties", number),
        ...schema.dependencies
          ? { dependentRequired: Object.fromEntries(schema.dependencies.map((entry) => [entry.name, entry.requires])) }
          : {},
      };
    }

    case "union": {
      if (schema.exclusive) return { oneOf: schema.options.map(emit) };
      if (schema.options.every((option) => option.kind === "literal")) {
        return { enum: schema.options.map((option) => (option as { value: JsonValue }).value) };
      }
      return { anyOf: schema.options.map(emit) };
    }

    case "intersection":
      return { allOf: schema.parts.map(emit) };
  }
}

function isObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function number(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function pick(source: object, key: string, as: (value: JsonValue | undefined) => JsonValue | undefined) {
  const value = as((source as Record<string, JsonValue | undefined>)[key]);
  return value === undefined ? {} : { [key]: value };
}

const TYPE_KEYWORDS: [string, string[]][] = [
  ["object", [
    "properties",
    "required",
    "additionalProperties",
    "propertyNames",
    "patternProperties",
    "minProperties",
    "maxProperties",
    "dependentRequired",
    "dependencies",
  ]],
  ["array", ["items", "prefixItems", "minItems", "maxItems", "uniqueItems", "contains", "minContains", "maxContains"]],
  ["string", ["minLength", "maxLength", "pattern", "format"]],
  ["number", ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"]],
];

const UNCHECKED = ["dependentSchemas", "unevaluatedProperties", "unevaluatedItems"];
