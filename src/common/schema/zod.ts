import { typescriptLanguage } from "@codemirror/lang-javascript";
import type { SyntaxNode } from "@lezer/common";
import { type Definition, type JsonValue, type ObjectSchema, type Property, type ReadResult, type Schema, type SchemaDocument, type SourceError, union } from "./ir";

export function readZod(text: string): ReadResult {
  const errors: SourceError[] = [];
  const tree = typescriptLanguage.parser.parse(text);
  const context: Context = { names: new Set(), errors, alias: aliasOf(text, tree.topNode), text };
  const defs: Definition[] = [];

  for (const statement of kids(tree.topNode)) {
    const declaration = statement.name === "ExportDeclaration"
      ? kids(statement).find((child) => child.name === "VariableDeclaration")
      : statement.name === "VariableDeclaration"
      ? statement
      : undefined;
    if (!declaration) continue;

    for (const { name, init } of declaratorsOf(text, declaration)) {
      context.names.add(name);
      defs.push({ name, schema: readExpression(init, context).schema });
    }
  }

  if (defs.length === 0) {
    errors.push({ message: "No schema declarations were found — a Zod schema is read from `const Name = z.…`" });
    return { document: null, errors };
  }

  const root: Schema = { kind: "ref", name: defs[defs.length - 1].name };
  return { document: { root, defs }, errors };
}

interface Context {
  names: Set<string>;
  errors: SourceError[];
  alias: string;
  text: string;
}

interface Read {
  schema: Schema;
  optional: boolean;
}

function declaratorsOf(text: string, declaration: SyntaxNode): { name: string; init: SyntaxNode }[] {
  const children = kids(declaration);
  const out: { name: string; init: SyntaxNode }[] = [];

  for (let index = 0; index < children.length; index++) {
    if (children[index].name !== "VariableDefinition") continue;
    const name = textOf(text, children[index]);

    let at = index + 1;
    while (at < children.length && children[at].name !== "Equals" && children[at].name !== "VariableDefinition") at++;
    if (children[at]?.name !== "Equals" || !children[at + 1]) continue;
    out.push({ name, init: children[at + 1] });
  }

  return out;
}

function aliasOf(text: string, top: SyntaxNode): string {
  for (const statement of kids(top)) {
    if (statement.name !== "ImportDeclaration") continue;
    const children = kids(statement);
    const source = children.find((child) => child.name === "String");
    if (!source || !/^zod(\/|$)/.test(jsString(textOf(text, source)) ?? "")) continue;

    const star = children.findIndex((child) => child.name === "Star");
    if (star !== -1) {
      const bound = children.slice(star).find((child) => child.name === "VariableDefinition");
      if (bound) return textOf(text, bound);
    }

    const group = children.find((child) => child.name === "ImportGroup");
    for (const [at, child] of kids(group).entries()) {
      const named = kids(group);
      if (child.name === "VariableName" && textOf(text, child) === "z") {
        const local = named.slice(at).find((one) => one.name === "VariableDefinition");
        if (local) return textOf(text, local);
      }
      if (child.name === "VariableDefinition" && textOf(text, child) === "z") return "z";
    }
  }
  return "z";
}

function readExpression(node: SyntaxNode, context: Context): Read {
  const inner = unwrap(node);

  switch (inner.name) {
    case "VariableName": {
      const name = textOf(context.text, inner);
      if (context.names.has(name)) return plain({ kind: "ref", name });
      context.errors.push({ ...where(inner), message: `${name} is not a schema declared in this file` });
      return plain({ kind: "unknown" });
    }

    case "CallExpression": {
      const callee = kids(inner)[0];
      const args = argumentsOf(inner);
      if (!callee || callee.name !== "MemberExpression") {
        context.errors.push({ ...where(inner), message: "Only `z.…` schema expressions are read" });
        return plain({ kind: "unknown" });
      }

      const parts = kids(callee);
      const method = textOf(context.text, parts[parts.length - 1]);
      const object = parts[0];

      const base = calleeBase(context, object);
      if (base !== null) return builder(base === "" ? method : `${base}.${method}`, args, context);
      return modifier(readExpression(object, context), method, args, context);
    }

    default:
      context.errors.push({ ...where(inner), message: `That is not something this page can read as a schema` });
      return plain({ kind: "unknown" });
  }
}

function calleeBase(context: Context, node: SyntaxNode): string | null {
  if (node.name === "VariableName") return textOf(context.text, node) === context.alias ? "" : null;
  if (node.name !== "MemberExpression") return null;

  const parts = kids(node);
  if (parts.length < 2 || parts[0].name !== "VariableName") return null;
  if (textOf(context.text, parts[0]) !== context.alias) return null;
  return textOf(context.text, parts[parts.length - 1]);
}

function builder(name: string, args: SyntaxNode[], context: Context): Read {
  switch (name) {
    case "string":
      return plain({ kind: "string" });
    case "number":
    case "float32":
    case "float64":
      return plain({ kind: "number" });
    case "int":
    case "int32":
    case "bigint":
      return plain({ kind: "number", integer: true });
    case "boolean":
      return plain({ kind: "boolean" });
    case "null":
      return plain({ kind: "null" });
    case "any":
    case "unknown":
      return plain({ kind: "unknown" });
    case "never":
      return plain({ kind: "never" });
    case "void":
    case "undefined":
      return { schema: { kind: "unknown" }, optional: true };
    case "date":
    case "iso.datetime":
      return plain({ kind: "string", format: "date-time" });
    case "iso.date":
      return plain({ kind: "string", format: "date" });
    case "iso.time":
      return plain({ kind: "string", format: "time" });
    case "iso.duration":
      return plain({ kind: "string", format: "duration" });
    case "email":
      return plain({ kind: "string", format: "email" });
    case "uuid":
    case "guid":
      return plain({ kind: "string", format: "uuid" });
    case "url":
    case "httpUrl":
      return plain({ kind: "string", format: "uri" });
    case "ipv4":
      return plain({ kind: "string", format: "ipv4" });
    case "ipv6":
      return plain({ kind: "string", format: "ipv6" });
    case "hostname":
      return plain({ kind: "string", format: "hostname" });

    case "literal": {
      const value = staticValue(args[0], context);
      if (Array.isArray(value)) return plain({ kind: "enum", values: value });
      return plain({ kind: "literal", value: value ?? null });
    }

    case "enum":
    case "nativeEnum": {
      const value = staticValue(args[0], context);
      if (Array.isArray(value)) return plain({ kind: "enum", values: value });
      if (value && typeof value === "object") return plain({ kind: "enum", values: Object.values(value) });
      context.errors.push({ message: "z.enum needs a list of values written out in the file" });
      return plain({ kind: "unknown" });
    }

    case "object":
    case "strictObject":
    case "looseObject": {
      const object = objectFrom(args[0], context);
      if (name === "strictObject") object.additional = false;
      if (name === "looseObject") object.additional = { kind: "unknown" };
      return plain(object);
    }

    case "array":
      return plain({ kind: "array", items: args[0] ? readExpression(args[0], context).schema : { kind: "unknown" } });

    case "tuple": {
      const items: Schema[] = elementsOf(args[0]).map((element) => readExpression(element, context).schema);
      const rest = args[1] ? readExpression(args[1], context).schema : undefined;
      return plain({
        kind: "array",
        prefix: items,
        items: rest ?? { kind: "never" },
        minItems: items.length,
        ...rest ? {} : { maxItems: items.length },
      });
    }

    case "union":
    case "discriminatedUnion": {
      const list = name === "discriminatedUnion" ? args[1] : args[0];
      if (!list || list.name !== "ArrayExpression") {
        context.errors.push({ message: `${name} needs its options written out as an array` });
        return plain({ kind: "unknown" });
      }
      return plain(union(elementsOf(list).map((element) => readExpression(element, context).schema)));
    }

    case "intersection":
      return plain({ kind: "intersection", parts: args.map((argument) => readExpression(argument, context).schema) });

    case "record": {
      const values = args.length > 1 ? args[1] : args[0];
      const keys = args.length > 1 ? readExpression(args[0], context).schema : undefined;
      const pattern = keys?.kind === "string" ? keys.pattern : undefined;
      return plain({
        kind: "object",
        properties: [],
        additional: values ? readExpression(values, context).schema : { kind: "unknown" },
        ...pattern !== undefined ? { keyPattern: pattern } : {},
      });
    }

    case "lazy": {
      const arrow = args[0];
      const body = arrow?.name === "ArrowFunction" ? afterArrow(arrow) : undefined;
      if (!body) {
        context.errors.push({ message: "z.lazy is read only as `z.lazy(() => …)`" });
        return plain({ kind: "unknown" });
      }
      return readExpression(body, context);
    }

    case "optional":
      return { schema: args[0] ? readExpression(args[0], context).schema : { kind: "unknown" }, optional: true };

    case "nullable":
      return plain(union([args[0] ? readExpression(args[0], context).schema : { kind: "unknown" }, { kind: "null" }]));

    case "coerce.string":
      return plain({ kind: "string" });
    case "coerce.number":
      return plain({ kind: "number" });
    case "coerce.boolean":
      return plain({ kind: "boolean" });

    default:
      context.errors.push({ message: `z.${name} is not a schema this page knows how to read` });
      return plain({ kind: "unknown" });
  }
}

function modifier(target: Read, method: string, args: SyntaxNode[], context: Context): Read {
  const schema = target.schema;
  const first = () => staticValue(args[0], context);
  const count = () => {
    const value = first();
    return typeof value === "number" ? value : undefined;
  };

  switch (method) {
    case "optional":
      return { ...target, optional: true };
    case "nullish":
      return { schema: union([schema, { kind: "null" }]), optional: true };
    case "nullable":
      return { ...target, schema: union([schema, { kind: "null" }]) };
    case "default":
    case "prefault": {
      const value = first();
      return { schema: { ...schema, ...value === undefined ? {} : { default: value } }, optional: true };
    }
    case "catch":
      return { ...target, optional: true };
    case "describe":
      return { ...target, schema: { ...schema, description: String(first() ?? "") } };
    case "meta": {
      const value = first();
      if (!value || typeof value !== "object" || Array.isArray(value)) return target;
      const meta = value as { [key: string]: JsonValue };
      return {
        ...target,
        schema: {
          ...schema,
          ...typeof meta.title === "string" ? { title: meta.title } : {},
          ...typeof meta.description === "string" ? { description: meta.description } : {},
        },
      };
    }
    case "array":
      return plain({ kind: "array", items: schema });
    case "readonly":
    case "brand":
    case "trim":
    case "toLowerCase":
    case "toUpperCase":
    case "strip":
      return target;

    case "min":
    case "max":
    case "length":
    case "nonempty":
      return { ...target, schema: bound(schema, method, count(), context) };

    case "gt":
      return { ...target, schema: { ...schema, ...numeric(schema, "exclusiveMinimum", count(), context) } };
    case "gte":
      return { ...target, schema: { ...schema, ...numeric(schema, "minimum", count(), context) } };
    case "lt":
      return { ...target, schema: { ...schema, ...numeric(schema, "exclusiveMaximum", count(), context) } };
    case "lte":
      return { ...target, schema: { ...schema, ...numeric(schema, "maximum", count(), context) } };
    case "positive":
      return { ...target, schema: { ...schema, ...numeric(schema, "exclusiveMinimum", 0, context) } };
    case "nonnegative":
      return { ...target, schema: { ...schema, ...numeric(schema, "minimum", 0, context) } };
    case "negative":
      return { ...target, schema: { ...schema, ...numeric(schema, "exclusiveMaximum", 0, context) } };
    case "nonpositive":
      return { ...target, schema: { ...schema, ...numeric(schema, "maximum", 0, context) } };
    case "int":
      return { ...target, schema: schema.kind === "number" ? { ...schema, integer: true } : schema };
    case "multipleOf":
    case "step":
      return { ...target, schema: { ...schema, ...numeric(schema, "multipleOf", count(), context) } };

    case "regex": {
      const source = args[0]?.name === "RegExp" ? REGEX_LITERAL.exec(textOf(context.text, args[0]))?.[1] : undefined;
      return { ...target, schema: schema.kind === "string" && source ? { ...schema, pattern: source } : schema };
    }
    case "startsWith": {
      const value = first();
      return typeof value === "string" ? { ...target, schema: withPattern(schema, `^${escapeRegex(value)}`) } : target;
    }
    case "endsWith": {
      const value = first();
      return typeof value === "string" ? { ...target, schema: withPattern(schema, `${escapeRegex(value)}$`) } : target;
    }
    case "includes": {
      const value = first();
      return typeof value === "string" ? { ...target, schema: withPattern(schema, escapeRegex(value)) } : target;
    }

    case "email":
    case "url":
    case "uuid":
    case "guid":
    case "datetime":
    case "date":
    case "time":
    case "duration":
    case "ipv4":
    case "ipv6": {
      const named = STRING_FORMATS[method];
      return { ...target, schema: schema.kind === "string" ? { ...schema, format: named } : schema };
    }

    case "strict":
      return { ...target, schema: schema.kind === "object" ? { ...schema, additional: false } : schema };
    case "passthrough":
      return { ...target, schema: schema.kind === "object" ? { ...schema, additional: { kind: "unknown" } } : schema };
    case "catchall":
      return {
        ...target,
        schema: schema.kind === "object" && args[0]
          ? { ...schema, additional: readExpression(args[0], context).schema }
          : schema,
      };

    case "extend": {
      if (schema.kind !== "object") return target;
      const added = objectFrom(args[0], context);
      const kept = schema.properties.filter((property) => !added.properties.some((one) => one.name === property.name));
      return { ...target, schema: { ...schema, properties: [...kept, ...added.properties] } };
    }
    case "partial":
      return {
        ...target,
        schema: schema.kind === "object"
          ? { ...schema, properties: schema.properties.map((property) => ({ ...property, required: false })) }
          : schema,
      };
    case "required":
      return {
        ...target,
        schema: schema.kind === "object"
          ? { ...schema, properties: schema.properties.map((property) => ({ ...property, required: true })) }
          : schema,
      };
    case "pick":
    case "omit": {
      if (schema.kind !== "object") return target;
      const named = new Set(Object.keys((first() as { [key: string]: JsonValue }) ?? {}));
      const keep = (property: Property) => method === "pick" ? named.has(property.name) : !named.has(property.name);
      return { ...target, schema: { ...schema, properties: schema.properties.filter(keep) } };
    }

    case "and":
      return plain({ kind: "intersection", parts: [schema, readExpression(args[0], context).schema] });
    case "or":
      return plain(union([schema, readExpression(args[0], context).schema]));

    case "refine":
    case "superRefine":
    case "check":
    case "transform":
    case "pipe":
      context.errors.push({ message: `.${method}() is a rule written in code, so it is left out of the conversion` });
      return target;

    default:
      context.errors.push({ message: `.${method}() is not something this page knows how to read` });
      return target;
  }
}

function bound(schema: Schema, method: string, value: number | undefined, context: Context): Schema {
  const amount = method === "nonempty" ? 1 : value;
  if (amount === undefined) return schema;

  const lower = method === "min" || method === "nonempty";
  switch (schema.kind) {
    case "string":
      if (method === "length") return { ...schema, minLength: amount, maxLength: amount };
      return lower ? { ...schema, minLength: amount } : { ...schema, maxLength: amount };
    case "array":
      if (method === "length") return { ...schema, minItems: amount, maxItems: amount };
      return lower ? { ...schema, minItems: amount } : { ...schema, maxItems: amount };
    case "number":
      return lower ? { ...schema, minimum: amount } : { ...schema, maximum: amount };
    default:
      context.errors.push({ message: `.${method}() has no meaning on ${schema.kind}` });
      return schema;
  }
}

function numeric(schema: Schema, keyword: string, value: number | undefined, context: Context) {
  if (value === undefined) return {};
  if (schema.kind !== "number") {
    context.errors.push({ message: `${keyword} has no meaning on ${schema.kind}` });
    return {};
  }
  return { [keyword]: value };
}

function withPattern(schema: Schema, pattern: string): Schema {
  if (schema.kind !== "string") return schema;
  return { ...schema, pattern: schema.pattern === undefined ? pattern : `(?=${schema.pattern})${pattern}` };
}

function objectFrom(node: SyntaxNode | undefined, context: Context): ObjectSchema {
  if (!node || node.name !== "ObjectExpression") {
    if (node) {
      context.errors.push({
        ...where(node),
        message: "The shape of an object schema has to be written out in the file",
      });
    }
    return { kind: "object", properties: [] };
  }

  const properties: Property[] = [];
  for (const member of kids(node)) {
    if (member.name === "Spread") {
      context.errors.push({ ...where(member), message: "A spread in an object schema is not read" });
      continue;
    }
    if (member.name !== "Property") continue;

    const parts = kids(member);
    const colon = parts.findIndex((part) => part.name === ":");
    const name = keyName(context.text, parts[0]);
    if (colon === -1 || name === undefined || !parts[colon + 1]) continue;

    const read = readExpression(parts[colon + 1], context);
    properties.push({ name, schema: read.schema, required: !read.optional });
  }

  return { kind: "object", properties };
}

function keyName(text: string, node: SyntaxNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.name === "PropertyDefinition" || node.name === "PropertyName" || node.name === "VariableName") {
    return textOf(text, node);
  }
  if (node.name === "String") return jsString(textOf(text, node));
  if (node.name === "Number") return textOf(text, node);
  return undefined;
}

function staticValue(node: SyntaxNode | undefined, context: Context): JsonValue | undefined {
  if (!node) return undefined;
  const text = context.text;

  switch (node.name) {
    case "String":
      return jsString(textOf(text, node));
    case "TemplateString": {
      const raw = textOf(text, node);
      return raw.includes("${") ? undefined : jsString(raw);
    }
    case "Number":
      return Number(textOf(text, node).replace(/_/g, ""));
    case "BooleanLiteral":
      return textOf(text, node) === "true";
    case "null":
      return null;
    case "UnaryExpression": {
      const inner = staticValue(kids(node)[1], context);
      return textOf(text, node).startsWith("-") && typeof inner === "number" ? -inner : inner;
    }
    case "ArrayExpression": {
      const out: JsonValue[] = [];
      for (const element of elementsOf(node)) {
        const value = staticValue(element, context);
        if (value === undefined) return undefined;
        out.push(value);
      }
      return out;
    }
    case "ObjectExpression": {
      const out: { [key: string]: JsonValue } = {};
      for (const member of kids(node)) {
        if (member.name !== "Property") continue;
        const parts = kids(member);
        const colon = parts.findIndex((part) => part.name === ":");
        const name = keyName(text, parts[0]);
        const value = colon === -1 ? undefined : staticValue(parts[colon + 1], context);
        if (name === undefined || value === undefined) return undefined;
        out[name] = value;
      }
      return out;
    }
    default:
      return undefined;
  }
}

function unwrap(node: SyntaxNode): SyntaxNode {
  let current = node;
  for (;;) {
    if (current.name === "ParenthesizedExpression") {
      const inner = kids(current).find((child) => child.name !== "(" && child.name !== ")");
      if (!inner) return current;
      current = inner;
      continue;
    }
    if (current.name === "BinaryExpression" && kids(current).some((child) => TYPE_OPERATORS.has(child.name))) {
      current = kids(current)[0];
      continue;
    }
    return current;
  }
}

function argumentsOf(call: SyntaxNode): SyntaxNode[] {
  const list = kids(call).find((child) => child.name === "ArgList");
  return kids(list).filter((child) => !PUNCTUATION.has(child.name));
}

function elementsOf(node: SyntaxNode | undefined): SyntaxNode[] {
  if (!node || node.name !== "ArrayExpression") return [];
  return kids(node).filter((child) => !PUNCTUATION.has(child.name));
}

function afterArrow(arrow: SyntaxNode): SyntaxNode | undefined {
  const children = kids(arrow);
  const at = children.findIndex((child) => child.name === "Arrow");
  return at === -1 ? undefined : children[at + 1];
}

function kids(node: SyntaxNode | null | undefined): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = node?.firstChild; child; child = child.nextSibling) out.push(child);
  return out;
}

function textOf(text: string, node: SyntaxNode | null | undefined): string {
  return node ? text.slice(node.from, node.to) : "";
}

function where(node: SyntaxNode) {
  return { from: node.from, to: node.to };
}

function jsString(raw: string): string | undefined {
  const quote = raw[0];
  if (!"\"'`".includes(quote) || raw.length < 2 || raw[raw.length - 1] !== quote) return undefined;

  return raw.slice(1, -1).replace(
    /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g,
    (_, escape: string) => {
      if (escape[0] === "u" && escape[1] === "{") return String.fromCodePoint(parseInt(escape.slice(2, -1), 16));
      if (escape[0] === "u" || escape[0] === "x") return String.fromCharCode(parseInt(escape.slice(1), 16));
      return JS_ESCAPES[escape] ?? escape;
    },
  );
}

function plain(schema: Schema): Read {
  return { schema, optional: false };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PUNCTUATION = new Set(["(", ")", ",", "[", "]", "{", "}"]);

const TYPE_OPERATORS = new Set(["as", "satisfies"]);

const REGEX_LITERAL = /^\/([\s\S]*)\/[a-z]*$/;

const JS_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
  "\\": "\\",
  "\"": "\"",
  "'": "'",
  "`": "`",
  "\n": "",
};

const STRING_FORMATS: Record<string, string> = {
  email: "email",
  url: "uri",
  uuid: "uuid",
  guid: "uuid",
  datetime: "date-time",
  date: "date",
  time: "time",
  duration: "duration",
  ipv4: "ipv4",
  ipv6: "ipv6",
};

export function writeZod(doc: SchemaDocument): string {
  const lines = ["import { z } from \"zod\";", ""];

  for (const def of doc.defs) {
    lines.push(`export const ${def.name} = ${expressionFor(def.schema, 0)};`, "");
  }

  if (doc.root.kind !== "ref") {
    lines.push(`export const ${identifier(doc.root.title ?? "Schema")} = ${expressionFor(doc.root, 0)};`, "");
  }

  return lines.join("\n").replace(/\n+$/, "\n");
}

function expressionFor(schema: Schema, depth: number): string {
  const pad = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);

  let out: string;
  switch (schema.kind) {
    case "unknown":
      out = "z.unknown()";
      break;
    case "never":
      out = "z.never()";
      break;
    case "null":
      out = "z.null()";
      break;
    case "boolean":
      out = "z.boolean()";
      break;
    case "ref":
      out = schema.name;
      break;
    case "literal":
      out = `z.literal(${JSON.stringify(schema.value)})`;
      break;

    case "enum":
      out = schema.values.every((value) => typeof value === "string")
        ? `z.enum([${schema.values.map((value) => JSON.stringify(value)).join(", ")}])`
        : `z.union([${schema.values.map((value) => `z.literal(${JSON.stringify(value)})`).join(", ")}])`;
      break;

    case "number": {
      out = schema.integer ? "z.int()" : "z.number()";
      if (schema.minimum !== undefined) out += `.min(${schema.minimum})`;
      if (schema.maximum !== undefined) out += `.max(${schema.maximum})`;
      if (schema.exclusiveMinimum !== undefined) out += `.gt(${schema.exclusiveMinimum})`;
      if (schema.exclusiveMaximum !== undefined) out += `.lt(${schema.exclusiveMaximum})`;
      if (schema.multipleOf !== undefined) out += `.multipleOf(${schema.multipleOf})`;
      break;
    }

    case "string": {
      out = schema.format !== undefined ? ZOD_FORMATS[schema.format] ?? "z.string()" : "z.string()";
      if (schema.minLength !== undefined && schema.minLength === schema.maxLength) {
        out += `.length(${schema.minLength})`;
      } else {
        if (schema.minLength !== undefined) out += `.min(${schema.minLength})`;
        if (schema.maxLength !== undefined) out += `.max(${schema.maxLength})`;
      }
      if (schema.pattern !== undefined) out += `.regex(${regexLiteral(schema.pattern)})`;
      break;
    }

    case "array": {
      if (schema.prefix && schema.prefix.length > 0) {
        const items = schema.prefix.map((item) => expressionFor(item, depth + 1)).join(", ");
        out = schema.items.kind === "never" || schema.items.kind === "unknown"
          ? `z.tuple([${items}])`
          : `z.tuple([${items}], ${expressionFor(schema.items, depth)})`;
        break;
      }
      out = `z.array(${expressionFor(schema.items, depth)})`;
      if (schema.minItems !== undefined) out += `.min(${schema.minItems})`;
      if (schema.maxItems !== undefined) out += `.max(${schema.maxItems})`;
      break;
    }

    case "object": {
      if (schema.properties.length === 0 && schema.additional) {
        const key = schema.keyPattern === undefined
          ? "z.string()"
          : `z.string().regex(${regexLiteral(schema.keyPattern)})`;
        out = `z.record(${key}, ${expressionFor(schema.additional, depth)})`;
        break;
      }

      if (schema.properties.length === 0) {
        out = "z.object({})";
      } else {
        const fields = schema.properties.map((property) => {
          const value = expressionFor(property.schema, depth + 1);
          const suffix = property.required || property.schema.default !== undefined ? "" : ".optional()";
          return `${inner}${propertyKey(property.name)}: ${value}${suffix},`;
        });
        out = `z.object({\n${fields.join("\n")}\n${pad}})`;
      }

      if (schema.additional === false) out += ".strict()";
      else if (schema.additional !== undefined) out += `.catchall(${expressionFor(schema.additional, depth)})`;
      break;
    }

    case "union": {
      const rest = schema.options.filter((option) => option.kind !== "null");
      if (rest.length === 1 && rest.length < schema.options.length) {
        out = `${expressionFor(rest[0], depth)}.nullable()`;
        break;
      }
      const options = schema.options.map((option) => expressionFor(option, depth + 1));
      out = `z.union([${options.join(", ")}])`;
      break;
    }

    case "intersection": {
      out = schema.parts
        .map((part) => expressionFor(part, depth))
        .reduce((left, right) => `z.intersection(${left}, ${right})`);
      break;
    }
  }

  if (schema.description !== undefined) out += `.describe(${JSON.stringify(schema.description)})`;
  if (schema.default !== undefined) out += `.default(${JSON.stringify(schema.default)})`;
  return out;
}

function regexLiteral(pattern: string): string {
  return `/${pattern.replace(/\//g, "\\/")}/`;
}

function propertyKey(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

export function identifier(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_$]/g, " ").split(" ").filter(Boolean)
    .map((word, index) => index === 0 ? word : word[0].toUpperCase() + word.slice(1))
    .join("");
  return IDENTIFIER.test(cleaned) ? cleaned : `Schema${cleaned}`;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const ZOD_FORMATS: Record<string, string> = {
  email: "z.email()",
  uuid: "z.uuid()",
  uri: "z.url()",
  "date-time": "z.iso.datetime()",
  date: "z.iso.date()",
  time: "z.iso.time()",
  duration: "z.iso.duration()",
  ipv4: "z.ipv4()",
  ipv6: "z.ipv6()",
};
