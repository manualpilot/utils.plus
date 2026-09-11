import { checkFormat, formatNamed } from "./formats";
import { describe, type JsonValue, type Schema, type SchemaDocument, typeOf } from "./ir";
import { pointerOf } from "./locate";

export interface Problem {
  pointer: string;
  message: string;
  keyword: string;
  onKey?: boolean;
}

export function validate(value: JsonValue, doc: SchemaDocument): Problem[] {
  const problems: Problem[] = [];
  check(value, doc.root, [], doc, problems, new Set());
  return problems;
}

export function accepts(value: JsonValue, schema: Schema, doc: SchemaDocument): boolean {
  return validate(value, { root: schema, defs: doc.defs }).length === 0;
}

function check(
  value: JsonValue,
  schema: Schema,
  path: (string | number)[],
  doc: SchemaDocument,
  problems: Problem[],
  visiting: Set<string>,
) {
  checkKind(value, schema, path, doc, problems, visiting);

  const passes = (condition: Schema) => {
    const found: Problem[] = [];
    check(value, condition, path, doc, found, visiting);
    return found.length === 0;
  };

  if (schema.not !== undefined && passes(schema.not)) {
    const named = wholly(schema.not);
    problems.push({
      pointer: pointerOf(path),
      message: named ? `Must not be ${named}` : "Must not match the schema under `not`",
      keyword: "not",
    });
  }

  if (schema.if !== undefined) {
    const branch = passes(schema.if) ? schema.then : schema.else;
    if (branch) check(value, branch, path, doc, problems, visiting);
  }
}

function checkKind(
  value: JsonValue,
  schema: Schema,
  path: (string | number)[],
  doc: SchemaDocument,
  problems: Problem[],
  visiting: Set<string>,
) {
  const at = pointerOf(path);
  const say = (keyword: string, message: string, onKey?: boolean) =>
    problems.push(onKey ? { pointer: at, message, keyword, onKey } : { pointer: at, message, keyword });

  switch (schema.kind) {
    case "unknown":
      return;

    case "never":
      return say("never", "Nothing is allowed here");

    case "ref": {
      const mark = `${schema.name}@${at}`;
      if (visiting.has(mark)) return;
      const target = doc.defs.find((def) => def.name === schema.name)?.schema;
      if (!target) return say("$ref", `There is no definition named ${schema.name}`);
      visiting.add(mark);
      check(value, target, path, doc, problems, visiting);
      visiting.delete(mark);
      return;
    }

    case "null":
      if (value !== null) say("type", expected(schema, value));
      return;

    case "boolean":
      if (typeof value !== "boolean") say("type", expected(schema, value));
      return;

    case "number": {
      if (typeof value !== "number") return say("type", expected(schema, value));
      if (schema.integer && !Number.isInteger(value)) say("type", `Must be a whole number, found ${value}`);
      if (schema.minimum !== undefined && value < schema.minimum) {
        say("minimum", `Must be ${schema.minimum} or more, found ${value}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        say("maximum", `Must be ${schema.maximum} or less, found ${value}`);
      }
      if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
        say("exclusiveMinimum", `Must be greater than ${schema.exclusiveMinimum}, found ${value}`);
      }
      if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
        say("exclusiveMaximum", `Must be less than ${schema.exclusiveMaximum}, found ${value}`);
      }
      if (schema.multipleOf !== undefined && !isMultipleOf(value, schema.multipleOf)) {
        say("multipleOf", `Must be a multiple of ${schema.multipleOf}, found ${value}`);
      }
      return;
    }

    case "string": {
      if (typeof value !== "string") return say("type", expected(schema, value));
      const length = [...value].length;
      if (schema.minLength !== undefined && length < schema.minLength) {
        say("minLength", `Must be at least ${plural(schema.minLength, "character")} long, found ${length}`);
      }
      if (schema.maxLength !== undefined && length > schema.maxLength) {
        say("maxLength", `Must be at most ${plural(schema.maxLength, "character")} long, found ${length}`);
      }
      if (schema.pattern !== undefined && !matches(schema.pattern, value)) {
        say("pattern", `Must match /${schema.pattern}/`);
      }
      if (schema.format !== undefined && !checkFormat(schema.format, value)) {
        say("format", `Must be a valid ${formatNamed(schema.format)?.label ?? schema.format}`);
      }
      return;
    }

    case "literal":
      if (!equal(value, schema.value)) say("const", `Must be ${JSON.stringify(schema.value)}`);
      return;

    case "enum":
      if (!schema.values.some((allowed) => equal(value, allowed))) {
        say("enum", `Must be ${schema.values.map((allowed) => JSON.stringify(allowed)).join(" or ")}`);
      }
      return;

    case "array": {
      if (!Array.isArray(value)) return say("type", expected(schema, value));
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        say("minItems", `Must have at least ${plural(schema.minItems, "item")}, found ${value.length}`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        say("maxItems", `Must have at most ${plural(schema.maxItems, "item")}, found ${value.length}`);
      }
      if (schema.uniqueItems) {
        const repeat = firstRepeat(value);
        if (repeat) say("uniqueItems", `Items must be unique — ${repeat[0] + 1} and ${repeat[1] + 1} are the same`);
      }

      const prefix = schema.prefix ?? [];
      value.forEach((item, index) => {
        const itemSchema = index < prefix.length ? prefix[index] : schema.items;
        check(item, itemSchema, [...path, index], doc, problems, visiting);
      });

      const contains = schema.contains;
      if (contains !== undefined) {
        const accepted = value.filter((item, index) => {
          const found: Problem[] = [];
          check(item, contains, [...path, index], doc, found, visiting);
          return found.length === 0;
        }).length;
        const named = wholly(contains);
        const which = named ? `that is ${named}` : "that `contains` accepts";
        const least = schema.minContains ?? 1;
        if (accepted < least) {
          say("minContains", `Must have at least ${plural(least, "item")} ${which}, found ${accepted}`);
        }
        if (schema.maxContains !== undefined && accepted > schema.maxContains) {
          say("maxContains", `Must have at most ${plural(schema.maxContains, "item")} ${which}, found ${accepted}`);
        }
      }
      return;
    }

    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return say("type", expected(schema, value));
      }

      const has = (name: string) => Object.hasOwn(value, name);
      const declared = new Set(schema.properties.map((property) => property.name));
      for (const property of schema.properties) {
        if (!has(property.name)) {
          if (property.required) say("required", `Missing required property ${JSON.stringify(property.name)}`);
          continue;
        }
        check(value[property.name], property.schema, [...path, property.name], doc, problems, visiting);
      }

      for (const { name, requires } of schema.dependencies ?? []) {
        if (!has(name)) continue;
        for (const needed of requires.filter((one) => !has(one))) {
          say(
            "dependentRequired",
            `Missing property ${JSON.stringify(needed)}, which ${JSON.stringify(name)} requires`,
          );
        }
      }

      const count = Object.keys(value).length;
      if (schema.minProperties !== undefined && count < schema.minProperties) {
        say("minProperties", `Must have at least ${properties(schema.minProperties)}, found ${count}`);
      }
      if (schema.maxProperties !== undefined && count > schema.maxProperties) {
        say("maxProperties", `Must have at most ${properties(schema.maxProperties)}, found ${count}`);
      }

      for (const key of Object.keys(value)) {
        if (schema.keyPattern !== undefined && !matches(schema.keyPattern, key)) {
          problems.push({
            pointer: pointerOf([...path, key]),
            message: `Property names must match /${schema.keyPattern}/`,
            keyword: "propertyNames",
            onKey: true,
          });
        }
        const patterned = (schema.patterns ?? []).filter(({ pattern }) => compiled(pattern)?.test(key) ?? false);
        for (const { schema: matched } of patterned) {
          check(value[key], matched, [...path, key], doc, problems, visiting);
        }
        if (declared.has(key) || patterned.length > 0 || schema.additional === undefined) continue;
        if (schema.additional === false) {
          problems.push({
            pointer: pointerOf([...path, key]),
            message: `Unexpected property ${JSON.stringify(key)}`,
            keyword: "additionalProperties",
            onKey: true,
          });
          continue;
        }
        check(value[key], schema.additional, [...path, key], doc, problems, visiting);
      }
      return;
    }

    case "intersection":
      for (const part of schema.parts) check(value, part, path, doc, problems, visiting);
      return;

    case "union": {
      const branches = schema.options.map((option) => {
        const found: Problem[] = [];
        check(value, option, path, doc, found, visiting);
        return { option, found };
      });
      const matched = branches.filter((branch) => branch.found.length === 0).length;
      if (schema.exclusive && matched > 1) {
        return say("oneOf", `Must match exactly one of ${describe(schema)}, but matches ${matched}`);
      }
      if (matched > 0) return;

      const admitting = branches.filter(({ option }) => admits(option, value, doc));
      if (admitting.length === 1) {
        problems.push(...admitting[0].found);
        return;
      }
      say(schema.exclusive ? "oneOf" : "anyOf", `Expected ${describe(schema)}, found ${typeOf(value)}`);
    }
  }
}

function expected(schema: Schema, value: JsonValue): string {
  return `Expected ${describe(schema)}, found ${typeOf(value)}`;
}

function admits(schema: Schema, value: JsonValue, doc: SchemaDocument): boolean {
  switch (schema.kind) {
    case "unknown":
    case "never":
      return false;
    case "null":
      return value === null;
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "array":
      return Array.isArray(value);
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "literal":
      return typeOf(schema.value) === typeOf(value);
    case "enum":
      return schema.values.some((allowed) => typeOf(allowed) === typeOf(value));
    case "union":
      return schema.options.some((option) => admits(option, value, doc));
    case "intersection":
      return schema.parts.every((part) => admits(part, value, doc));
    case "ref": {
      const target = doc.defs.find((def) => def.name === schema.name)?.schema;
      return target ? admits(target, value, doc) : false;
    }
  }
}

export function equal(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => equal(item, b[index]));
  }

  const left = a as { [key: string]: JsonValue };
  const right = b as { [key: string]: JsonValue };
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

function wholly(schema: Schema): string | undefined {
  if (schema.not !== undefined || schema.if !== undefined) return undefined;
  switch (schema.kind) {
    case "null":
    case "boolean":
    case "literal":
    case "enum":
    case "ref":
      return describe(schema);
    case "number":
      return [schema.minimum, schema.maximum, schema.exclusiveMinimum, schema.exclusiveMaximum, schema.multipleOf]
          .every((bound) => bound === undefined)
        ? describe(schema)
        : undefined;
    case "string":
      return [schema.minLength, schema.maxLength, schema.pattern].every((bound) => bound === undefined)
        ? describe(schema)
        : undefined;
    case "union":
      return schema.options.every((option) => wholly(option) !== undefined) ? describe(schema) : undefined;
    default:
      return undefined;
  }
}

function firstRepeat(items: JsonValue[]): [number, number] | null {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (equal(items[i], items[j])) return [i, j];
    }
  }
  return null;
}

function isMultipleOf(value: number, divisor: number): boolean {
  const decimals = Math.max(decimalsOf(value), decimalsOf(divisor));
  const scale = 10 ** decimals;
  return Math.round(value * scale) % Math.round(divisor * scale) === 0;
}

function decimalsOf(value: number): number {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function matches(pattern: string, value: string): boolean {
  return compiled(pattern)?.test(value) ?? true;
}

export function compiled(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, "u");
  } catch {
    try {
      return new RegExp(pattern);
    } catch {
      return undefined;
    }
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function properties(count: number): string {
  return `${count} ${count === 1 ? "property" : "properties"}`;
}
