import { type JsonValue, type Schema, type SchemaDocument } from "../../common/schema/ir";

export function samplePayload(doc: SchemaDocument): JsonValue {
  return build(doc.root, doc, new Set());
}

function build(schema: Schema, doc: SchemaDocument, visiting: Set<string>): JsonValue {
  if (schema.default !== undefined) return schema.default;

  switch (schema.kind) {
    case "unknown":
    case "never":
    case "null":
      return null;

    case "boolean":
      return false;

    case "number":
      return 0;

    case "string":
      return "";

    case "literal":
      return schema.value;

    case "enum":
      return schema.values.length > 0 ? schema.values[0] : null;

    case "ref": {
      if (visiting.has(schema.name)) return null;
      const target = doc.defs.find((def) => def.name === schema.name)?.schema;
      if (!target) return null;
      visiting.add(schema.name);
      const value = build(target, doc, visiting);
      visiting.delete(schema.name);
      return value;
    }

    case "array": {
      const prefix = schema.prefix ?? [];
      const items = prefix.map((item) => build(item, doc, visiting));
      const wanted = Math.max(schema.minItems ?? 0, schema.items.kind === "unknown" ? 0 : prefix.length + 1);
      const room = schema.maxItems ?? wanted;
      while (items.length < Math.min(wanted, room)) items.push(build(schema.items, doc, visiting));
      return items;
    }

    case "object": {
      const out: { [key: string]: JsonValue } = {};
      for (const property of schema.properties) out[property.name] = build(property.schema, doc, visiting);
      return out;
    }

    case "union": {
      const first = schema.options.find((option) => option.kind !== "null") ?? schema.options[0];
      return first ? build(first, doc, visiting) : null;
    }

    case "intersection": {
      const parts = schema.parts.map((part) => build(part, doc, visiting));
      if (parts.every(isPlainObject)) return Object.assign({}, ...parts);
      return parts[0] ?? null;
    }
  }
}

function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
