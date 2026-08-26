import { pythonLanguage } from "@codemirror/lang-python";
import type { SyntaxNode } from "@lezer/common";
import { type Definition, isNullable, type JsonValue, type NumberSchema, type ObjectSchema, type Property, type ReadResult, resolve, type Schema, type SchemaDocument, type SourceError, type StringSchema, union } from "./ir";

export function readPydantic(text: string): ReadResult {
  const errors: SourceError[] = [];
  const tree = pythonLanguage.parser.parse(text);
  const defs: Definition[] = [];
  const models = new Map<string, Schema>();

  for (const node of kids(tree.topNode)) {
    if (node.name !== "ClassDefinition") continue;
    const name = textOf(text, node.getChild("VariableName"));
    if (!name) continue;

    const bases = kids(node.getChild("ArgList")).filter(named).map((base) => textOf(text, base));
    const body = node.getChild("Body");
    if (!body) continue;

    if (bases.some((base) => ENUM_BASES.has(lastName(base)))) {
      const values = enumValues(text, body);
      const schema: Schema = { kind: "enum", values, title: name };
      models.set(name, schema);
      defs.push({ name, schema });
      continue;
    }

    const inherited: Property[] = [];
    for (const base of bases) {
      const parent = models.get(lastName(base));
      if (parent?.kind === "object") inherited.push(...parent.properties);
    }
    if (!bases.some((base) => lastName(base) === "BaseModel") && inherited.length === 0) continue;

    models.set(name, { kind: "object", properties: [] });
    const own = fieldsOf(text, body, models, errors);
    const kept = inherited.filter((property) => !own.some((one) => one.name === property.name));
    const schema: Schema = { kind: "object", properties: [...kept, ...own], title: name };
    models.set(name, schema);
    defs.push({ name, schema });
  }

  const last = [...defs].reverse().find((def) => def.schema.kind === "object");
  if (!last) {
    errors.push({ message: "No models were found — a Pydantic schema is read from `class Name(BaseModel):`" });
    return { document: null, errors };
  }

  return { document: { root: { kind: "ref", name: last.name }, defs }, errors };
}

function enumValues(text: string, body: SyntaxNode): JsonValue[] {
  const values: JsonValue[] = [];
  for (const statement of kids(body)) {
    if (statement.name !== "AssignStatement") continue;
    const value = literalOf(text, assignedValue(statement));
    if (value !== undefined) values.push(value);
  }
  return values;
}

function fieldsOf(text: string, body: SyntaxNode, models: Map<string, Schema>, errors: SourceError[]): Property[] {
  const properties: Property[] = [];

  for (const statement of kids(body)) {
    if (statement.name !== "AssignStatement") continue;
    const typeDef = statement.getChild("TypeDef");
    if (!typeDef) continue;

    const name = textOf(text, statement.getChild("VariableName"));
    const annotation = kids(typeDef).find(named);
    if (!name || !annotation) continue;
    if (subscriptOf(text, annotation)?.base === "ClassVar") continue;

    const assigned = assignedValue(statement);
    const isField = assigned?.name === "CallExpression" && callName(text, assigned) === "Field";
    const field = isField ? fieldArguments(text, assigned!) : EMPTY_FIELD;

    let schema = typeFor(text, annotation, models, errors);
    schema = applyField(schema, field.keywords, errors);

    const { defaulted, value } = isField
      ? defaultOf(field)
      : assigned
      ? { defaulted: true, value: literalOf(text, assigned) }
      : { defaulted: false, value: undefined };

    if (value !== undefined) schema = { ...schema, default: value };
    properties.push({ name, schema, required: !defaulted });
  }

  return properties;
}

function defaultOf(field: FieldArguments): { defaulted: boolean; value: JsonValue | undefined } {
  if (field.keywords.has("default")) return { defaulted: true, value: field.keywords.get("default") };
  if (field.keywords.has("default_factory")) {
    return { defaulted: true, value: factoryValue(field.keywords.get("default_factory")) };
  }
  if (field.positional.length > 0) return { defaulted: true, value: field.positional[0] };
  return { defaulted: false, value: undefined };
}

const EMPTY_FIELD: FieldArguments = { positional: [], keywords: new Map() };

function factoryValue(name: JsonValue | undefined): JsonValue | undefined {
  if (name === "list") return [];
  if (name === "dict") return {};
  return undefined;
}

function typeFor(text: string, node: SyntaxNode, models: Map<string, Schema>, errors: SourceError[]): Schema {
  if (node.name === "BinaryExpression") {
    const parts = kids(node).filter((child) => child.name !== "BitOp" && named(child));
    return union(parts.map((part) => typeFor(text, part, models, errors)));
  }

  const subscript = subscriptOf(text, node);
  if (subscript) {
    const { base, args } = subscript;
    switch (base) {
      case "Optional":
        return union([...args.map((arg) => typeFor(text, arg, models, errors)), { kind: "null" }]);
      case "Union":
        return union(args.map((arg) => typeFor(text, arg, models, errors)));
      case "Literal": {
        const values = args.map((arg) => literalOf(text, arg)).filter((value): value is JsonValue =>
          value !== undefined
        );
        return values.length === 1 ? { kind: "literal", value: values[0] } : { kind: "enum", values };
      }
      case "Annotated": {
        const schema = args[0] ? typeFor(text, args[0], models, errors) : { kind: "unknown" as const };
        return annotations(text, args.slice(1), schema, errors);
      }
      case "list":
      case "List":
      case "Sequence":
      case "Iterable":
        return { kind: "array", items: args[0] ? typeFor(text, args[0], models, errors) : { kind: "unknown" } };
      case "set":
      case "Set":
      case "frozenset":
      case "FrozenSet":
        return {
          kind: "array",
          items: args[0] ? typeFor(text, args[0], models, errors) : { kind: "unknown" },
          uniqueItems: true,
        };
      case "tuple":
      case "Tuple": {
        const open = args.length === 2 && args[1].name === "Ellipsis";
        if (open) return { kind: "array", items: typeFor(text, args[0], models, errors) };
        const prefix = args.map((arg) => typeFor(text, arg, models, errors));
        return { kind: "array", prefix, items: { kind: "never" }, minItems: prefix.length, maxItems: prefix.length };
      }
      case "dict":
      case "Dict":
      case "Mapping":
        return {
          kind: "object",
          properties: [],
          additional: args[1] ? typeFor(text, args[1], models, errors) : { kind: "unknown" },
        };
      default:
        errors.push({ message: `${base}[…] is not a type this page knows how to read` });
        return { kind: "unknown" };
    }
  }

  if (node.name === "None") return { kind: "null" };

  const written = node.name === "String" ? pythonString(textOf(text, node)) : textOf(text, node);
  const name = lastName(written ?? "");
  const builtin = BUILTIN_TYPES[name];
  if (builtin) return { ...builtin };
  if (models.has(name)) return { kind: "ref", name };

  errors.push({ message: `${name || "That"} is not a type this page knows how to read` });
  return { kind: "unknown" };
}

function annotations(text: string, args: SyntaxNode[], schema: Schema, errors: SourceError[]): Schema {
  let out = schema;
  for (const arg of args) {
    if (arg.name !== "CallExpression") continue;
    const called = callName(text, arg);
    const { keywords, positional } = fieldArguments(text, arg);
    if (called === "Field") {
      out = applyField(out, keywords, errors);
      continue;
    }
    const keyword = ANNOTATED_TYPES[called ?? ""];
    if (keyword && positional.length > 0) out = applyField(out, new Map([[keyword, positional[0]]]), errors);
  }
  return out;
}

function applyField(schema: Schema, keywords: Map<string, JsonValue>, errors: SourceError[]): Schema {
  let out = schema;

  const title = keywords.get("title");
  if (typeof title === "string") out = { ...out, title };
  const description = keywords.get("description");
  if (typeof description === "string") out = { ...out, description };

  const target = out.kind === "union" ? out.options.find((option) => option.kind !== "null") : out;
  if (!target) return out;

  let inner = target;
  for (const [key, value] of keywords) {
    const numeric = NUMBER_KEYWORDS[key];
    if (numeric && typeof value === "number") {
      if (inner.kind !== "number") {
        errors.push({ message: `${key} has no meaning on ${inner.kind}` });
        continue;
      }
      inner = { ...inner, [numeric]: value } as NumberSchema;
      continue;
    }

    if (key === "min_length" || key === "max_length") {
      const lower = key === "min_length";
      if (inner.kind === "string" && typeof value === "number") {
        inner = { ...inner, ...lower ? { minLength: value } : { maxLength: value } } as StringSchema;
      } else if (inner.kind === "array" && typeof value === "number") {
        inner = { ...inner, ...lower ? { minItems: value } : { maxItems: value } };
      }
      continue;
    }

    if ((key === "pattern" || key === "regex") && typeof value === "string" && inner.kind === "string") {
      inner = { ...inner, pattern: value };
    }
  }

  if (inner === target) return out;
  if (out.kind !== "union") {
    return {
      ...inner,
      ...out.title !== undefined ? { title: out.title } : {},
      ...out.description !== undefined ? { description: out.description } : {},
    };
  }
  return { ...out, options: out.options.map((option) => option === target ? inner : option) };
}

interface FieldArguments {
  positional: JsonValue[];
  keywords: Map<string, JsonValue>;
}

function fieldArguments(text: string, call: SyntaxNode): FieldArguments {
  const positional: JsonValue[] = [];
  const keywords = new Map<string, JsonValue>();

  const list = call.getChild("ArgList");
  const children = kids(list).filter((child) => child.name !== "(" && child.name !== ")" && child.name !== ",");

  for (let index = 0; index < children.length; index++) {
    const node = children[index];
    if (children[index + 1]?.name === "AssignOp") {
      const value = children[index + 2];
      keywords.set(textOf(text, node), literalOf(text, value) ?? textOf(text, value));
      index += 2;
      continue;
    }
    if (node.name === "Ellipsis") continue;
    const value = literalOf(text, node);
    if (value !== undefined) positional.push(value);
  }

  return { positional, keywords };
}

function subscriptOf(text: string, node: SyntaxNode): { base: string; args: SyntaxNode[] } | null {
  if (node.name !== "MemberExpression") return null;
  const children = kids(node);
  const open = children.findIndex((child) => child.name === "[");
  if (open === -1) return null;

  const base = lastName(textOf(text, children[open - 1] ?? children[0]));
  const args = children.slice(open + 1).filter((child) => child.name !== "]" && child.name !== "," && named(child));
  return { base, args };
}

function callName(text: string, call: SyntaxNode): string | undefined {
  const callee = kids(call).find(named);
  return callee ? lastName(textOf(text, callee)) : undefined;
}

function assignedValue(statement: SyntaxNode): SyntaxNode | undefined {
  const children = kids(statement);
  const operator = children.findIndex((child) => child.name === "AssignOp");
  return operator === -1 ? undefined : children[operator + 1];
}

function literalOf(text: string, node: SyntaxNode | undefined): JsonValue | undefined {
  if (!node) return undefined;

  switch (node.name) {
    case "String":
      return pythonString(textOf(text, node));
    case "Number": {
      const value = Number(textOf(text, node).replace(/_/g, ""));
      return Number.isFinite(value) ? value : undefined;
    }
    case "Boolean":
      return textOf(text, node) === "True";
    case "None":
      return null;
    case "UnaryExpression": {
      const inner = literalOf(text, kids(node).filter(named)[0]);
      return typeof inner === "number" && textOf(text, node).startsWith("-") ? -inner : inner;
    }
    case "ArrayExpression": {
      const out: JsonValue[] = [];
      for (const child of kids(node).filter(named)) {
        const value = literalOf(text, child);
        if (value === undefined) return undefined;
        out.push(value);
      }
      return out;
    }
    case "DictionaryExpression": {
      const out: { [key: string]: JsonValue } = {};
      const children = kids(node).filter((child) => child.name !== "{" && child.name !== "}" && child.name !== ",");
      for (let index = 0; index + 1 < children.length; index += 2) {
        const key = literalOf(text, children[index]);
        const value = literalOf(text, children[index + 1]);
        if (typeof key !== "string" || value === undefined) return undefined;
        out[key] = value;
      }
      return out;
    }
    case "VariableName": {
      const name = textOf(text, node);
      if (name === "True") return true;
      if (name === "False") return false;
      return undefined;
    }
    default:
      return undefined;
  }
}

function pythonString(raw: string): string | undefined {
  const match = /^([A-Za-z]*)("""|'''|"|')([\s\S]*)\2$/.exec(raw);
  if (!match) return undefined;
  const prefix = match[1].toLowerCase();
  if (prefix.includes("f") || prefix.includes("b")) return undefined;
  const body = match[3];
  if (prefix.includes("r")) return body;
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (whole, escape: string) => {
    if (escape[0] === "u" || escape[0] === "x") return String.fromCharCode(parseInt(escape.slice(1), 16));
    return PYTHON_ESCAPES[escape] ?? escape;
  });
}

function kids(node: SyntaxNode | null | undefined): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = node?.firstChild; child; child = child.nextSibling) out.push(child);
  return out;
}

function named(node: SyntaxNode): boolean {
  return /^[A-Za-z]/.test(node.name);
}

function textOf(text: string, node: SyntaxNode | null | undefined): string {
  return node ? text.slice(node.from, node.to) : "";
}

function lastName(dotted: string): string {
  return dotted.split(".").pop() ?? dotted;
}

const ENUM_BASES = new Set(["Enum", "IntEnum", "StrEnum", "IntFlag", "Flag"]);

const PYTHON_ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "0": "\0",
  "\\": "\\",
  "\"": "\"",
  "'": "'",
};

const NUMBER_KEYWORDS: Record<string, string> = {
  ge: "minimum",
  le: "maximum",
  gt: "exclusiveMinimum",
  lt: "exclusiveMaximum",
  multiple_of: "multipleOf",
};

const ANNOTATED_TYPES: Record<string, string> = {
  Ge: "ge",
  Le: "le",
  Gt: "gt",
  Lt: "lt",
  MultipleOf: "multiple_of",
  MinLen: "min_length",
  MaxLen: "max_length",
};

const BUILTIN_TYPES: Record<string, Schema> = {
  str: { kind: "string" },
  bytes: { kind: "string" },
  int: { kind: "number", integer: true },
  float: { kind: "number" },
  Decimal: { kind: "number" },
  bool: { kind: "boolean" },
  None: { kind: "null" },
  Any: { kind: "unknown" },
  object: { kind: "unknown" },
  list: { kind: "array", items: { kind: "unknown" } },
  dict: { kind: "object", properties: [], additional: { kind: "unknown" } },
  datetime: { kind: "string", format: "date-time" },
  date: { kind: "string", format: "date" },
  time: { kind: "string", format: "time" },
  timedelta: { kind: "string", format: "duration" },
  UUID: { kind: "string", format: "uuid" },
  UUID4: { kind: "string", format: "uuid" },
  EmailStr: { kind: "string", format: "email" },
  AnyUrl: { kind: "string", format: "uri" },
  AnyHttpUrl: { kind: "string", format: "uri" },
  HttpUrl: { kind: "string", format: "uri" },
  IPv4Address: { kind: "string", format: "ipv4" },
  IPv6Address: { kind: "string", format: "ipv6" },
};

export function writePydantic(doc: SchemaDocument): string {
  const state: Writing = {
    imports: new Map(),
    blocks: [],
    used: new Set(doc.defs.map((def) => def.name)),
    emitted: new Set(),
    doc,
  };

  for (const def of order(doc)) {
    if (def.schema.kind === "object" && !isMap(def.schema)) {
      emitModel(def.schema, def.name, state);
      continue;
    }
    state.emitted.add(def.name);
    state.blocks.push(`${def.name} = ${annotation(def.schema, def.name, state)}`);
  }

  if (doc.root.kind !== "ref") {
    const name = className(doc.root.title ?? "Model", state);
    if (doc.root.kind === "object" && !isMap(doc.root)) emitModel(doc.root, name, state);
    else state.blocks.push(`${name} = ${annotation(doc.root, name, state)}`);
  }

  const header = [...state.imports.entries()]
    .sort(([left], [right]) => IMPORT_ORDER.indexOf(left) - IMPORT_ORDER.indexOf(right))
    .map(([module, names]) => `from ${module} import ${[...names].sort().join(", ")}`);

  return [header.join("\n"), ...state.blocks].join("\n\n\n").trimStart() + "\n";
}

interface Writing {
  imports: Map<string, Set<string>>;
  blocks: string[];
  used: Set<string>;
  emitted: Set<string>;
  doc: SchemaDocument;
}

function order(doc: SchemaDocument): Definition[] {
  const byName = new Map(doc.defs.map((def) => [def.name, def]));
  const out: Definition[] = [];
  const done = new Set<string>();
  const open = new Set<string>();

  const visit = (def: Definition) => {
    if (done.has(def.name) || open.has(def.name)) return;
    open.add(def.name);
    for (const name of refsOf(def.schema)) {
      const next = byName.get(name);
      if (next) visit(next);
    }
    open.delete(def.name);
    done.add(def.name);
    out.push(def);
  };

  for (const def of doc.defs) visit(def);
  return out;
}

function refsOf(schema: Schema, into = new Set<string>()): Set<string> {
  switch (schema.kind) {
    case "ref":
      into.add(schema.name);
      break;
    case "array":
      refsOf(schema.items, into);
      for (const item of schema.prefix ?? []) refsOf(item, into);
      break;
    case "object":
      for (const property of schema.properties) refsOf(property.schema, into);
      if (schema.additional) refsOf(schema.additional, into);
      break;
    case "union":
      for (const option of schema.options) refsOf(option, into);
      break;
    case "intersection":
      for (const part of schema.parts) refsOf(part, into);
      break;
  }
  return into;
}

function emitModel(schema: ObjectSchema, name: string, state: Writing): string {
  if (state.emitted.has(name)) return name;
  state.emitted.add(name);
  state.used.add(name);

  const fields = schema.properties.map((property) => field(property, name, state));
  need(state, "pydantic", "BaseModel");

  const lines = [`class ${name}(BaseModel):`];
  if (schema.description !== undefined) lines.push(`    """${schema.description}"""`, "");
  lines.push(...(fields.length > 0 ? fields.map((line) => `    ${line}`) : ["    pass"]));
  state.blocks.push(lines.join("\n"));
  return name;
}

function field(property: Property, owner: string, state: Writing): string {
  const schema = property.schema;
  const hint = `${owner}${pascal(property.name)}`;
  let type = annotation(schema, hint, state);

  const options: string[] = [];
  const name = pythonName(property.name);
  if (name !== property.name) options.push(`alias=${pythonLiteral(property.name)}`);
  if (schema.title !== undefined && schema.kind !== "object") options.push(`title=${pythonLiteral(schema.title)}`);
  if (schema.description !== undefined) options.push(`description=${pythonLiteral(schema.description)}`);
  options.push(...constraints(schema));

  const hasDefault = schema.default !== undefined;
  if (!property.required && !hasDefault && !isNullable(schema)) type = optional(type, state);

  if (options.length === 0) {
    if (property.required && !hasDefault) return `${name}: ${type}`;
    return `${name}: ${type} = ${hasDefault ? defaultExpression(schema.default!, state) : "None"}`;
  }

  need(state, "pydantic", "Field");
  const first = property.required && !hasDefault
    ? "..."
    : hasDefault
    ? factoryFor(schema.default!) ?? pythonLiteral(schema.default!)
    : "None";
  return `${name}: ${type} = Field(${[first, ...options].join(", ")})`;
}

function constraints(schema: Schema): string[] {
  switch (schema.kind) {
    case "number":
      return [
        ...schema.minimum !== undefined ? [`ge=${schema.minimum}`] : [],
        ...schema.maximum !== undefined ? [`le=${schema.maximum}`] : [],
        ...schema.exclusiveMinimum !== undefined ? [`gt=${schema.exclusiveMinimum}`] : [],
        ...schema.exclusiveMaximum !== undefined ? [`lt=${schema.exclusiveMaximum}`] : [],
        ...schema.multipleOf !== undefined ? [`multiple_of=${schema.multipleOf}`] : [],
      ];
    case "string":
      return [
        ...schema.minLength !== undefined ? [`min_length=${schema.minLength}`] : [],
        ...schema.maxLength !== undefined ? [`max_length=${schema.maxLength}`] : [],
        ...schema.pattern !== undefined ? [`pattern=${pythonLiteral(schema.pattern)}`] : [],
      ];
    case "array":
      return [
        ...schema.minItems !== undefined ? [`min_length=${schema.minItems}`] : [],
        ...schema.maxItems !== undefined ? [`max_length=${schema.maxItems}`] : [],
      ];
    case "union": {
      const inner = schema.options.find((option) => option.kind !== "null");
      return inner ? constraints(inner) : [];
    }
    default:
      return [];
  }
}

function annotation(schema: Schema, hint: string, state: Writing): string {
  switch (schema.kind) {
    case "unknown":
    case "never":
      need(state, "typing", "Any");
      return "Any";
    case "null":
      return "None";
    case "boolean":
      return "bool";
    case "number":
      return schema.integer ? "int" : "float";

    case "string": {
      const named = PYTHON_FORMATS[schema.format ?? ""];
      if (!named) return "str";
      need(state, named.module, named.name);
      return named.name;
    }

    case "literal":
      need(state, "typing", "Literal");
      return `Literal[${pythonLiteral(schema.value)}]`;

    case "enum":
      need(state, "typing", "Literal");
      return `Literal[${schema.values.map(pythonLiteral).join(", ")}]`;

    case "ref":
      return state.emitted.has(schema.name) ? schema.name : `"${schema.name}"`;

    case "array": {
      if (schema.prefix && schema.prefix.length > 0) {
        const items = schema.prefix.map((item, index) => annotation(item, `${hint}${index + 1}`, state));
        return `tuple[${items.join(", ")}]`;
      }
      const items = annotation(schema.items, singular(hint), state);
      return schema.uniqueItems && HASHABLE.has(schema.items.kind) ? `set[${items}]` : `list[${items}]`;
    }

    case "object": {
      if (isMap(schema)) {
        const values = schema.additional
          ? annotation(schema.additional, singular(hint), state)
          : (need(state, "typing", "Any"), "Any");
        return `dict[str, ${values}]`;
      }
      return emitModel(schema, className(schema.title ?? hint, state), state);
    }

    case "union": {
      const rest = schema.options.filter((option) => option.kind !== "null");
      if (rest.length < schema.options.length) {
        const inner = rest.length === 1
          ? annotation(rest[0], hint, state)
          : unionOf(rest.map((option) => annotation(option, hint, state)), state);
        return optional(inner, state);
      }
      return unionOf(schema.options.map((option) => annotation(option, hint, state)), state);
    }

    case "intersection": {
      const parts = schema.parts.map((part) => resolve(part, state.doc));
      if (parts.every((part) => part.kind === "object")) {
        const merged: Property[] = [];
        for (const part of parts as ObjectSchema[]) {
          for (const property of part.properties) {
            const existing = merged.findIndex((one) => one.name === property.name);
            if (existing === -1) merged.push(property);
            else merged[existing] = property;
          }
        }
        return emitModel({ kind: "object", properties: merged }, className(hint, state), state);
      }
      need(state, "typing", "Any");
      return "Any";
    }
  }
}

function unionOf(parts: string[], state: Writing): string {
  if (parts.length === 1) return parts[0];
  need(state, "typing", "Union");
  return `Union[${parts.join(", ")}]`;
}

function optional(type: string, state: Writing): string {
  if (type.startsWith("Optional[")) return type;
  need(state, "typing", "Optional");
  return `Optional[${type}]`;
}

function isMap(schema: ObjectSchema): boolean {
  return schema.properties.length === 0;
}

function defaultExpression(value: JsonValue, state: Writing): string {
  const factory = factoryFor(value);
  if (!factory) return pythonLiteral(value);
  need(state, "pydantic", "Field");
  return `Field(${factory})`;
}

function factoryFor(value: JsonValue): string | undefined {
  if (Array.isArray(value) && value.length === 0) return "default_factory=list";
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return "default_factory=dict";
  }
  return undefined;
}

function pythonLiteral(value: JsonValue): string {
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${pythonLiteral(item)}`).join(", ")}}`;
}

function need(state: Writing, module: string, name: string) {
  const names = state.imports.get(module) ?? new Set<string>();
  names.add(name);
  state.imports.set(module, names);
}

function className(hint: string, state: Writing): string {
  const base = pascal(hint) || "Model";
  if (!state.used.has(base)) return base;
  let index = 2;
  while (state.used.has(`${base}${index}`)) index++;
  return `${base}${index}`;
}

function pascal(name: string): string {
  return name.split(/[^A-Za-z0-9]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join("");
}

function singular(hint: string): string {
  if (/ies$/.test(hint)) return `${hint.slice(0, -3)}y`;
  if (/(?:s|x|z|ch|sh)es$/.test(hint)) return hint.slice(0, -2);
  if (/[^s]s$/.test(hint)) return hint.slice(0, -1);
  return `${hint}Item`;
}

function pythonName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `field_${cleaned}`;
}

const HASHABLE = new Set(["string", "number", "boolean", "literal", "enum"]);

const IMPORT_ORDER = ["__future__", "datetime", "enum", "ipaddress", "typing", "uuid", "pydantic"];

const PYTHON_FORMATS: Record<string, { module: string; name: string }> = {
  "date-time": { module: "datetime", name: "datetime" },
  date: { module: "datetime", name: "date" },
  time: { module: "datetime", name: "time" },
  duration: { module: "datetime", name: "timedelta" },
  uuid: { module: "uuid", name: "UUID" },
  email: { module: "pydantic", name: "EmailStr" },
  uri: { module: "pydantic", name: "AnyUrl" },
  ipv4: { module: "ipaddress", name: "IPv4Address" },
  ipv6: { module: "ipaddress", name: "IPv6Address" },
};
