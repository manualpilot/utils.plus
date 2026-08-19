import { detectFormat } from "./formats";
import { type JsonValue, type Property, same, type Schema, type SchemaDocument, union } from "./ir";

export function inferSchema(value: JsonValue, name = "Root"): SchemaDocument {
  return { root: { ...infer(value), title: name }, defs: [] };
}

function infer(value: JsonValue): Schema {
  if (value === null) return { kind: "null" };

  if (Array.isArray(value)) {
    const items = value.map(infer).reduce<Schema | null>((merged, item) => merged ? merge(merged, item) : item, null);
    return { kind: "array", items: items ?? { kind: "unknown" } };
  }

  switch (typeof value) {
    case "boolean":
      return { kind: "boolean" };
    case "number":
      return Number.isInteger(value) ? { kind: "number", integer: true } : { kind: "number" };
    case "string": {
      const format = detectFormat(value);
      return format ? { kind: "string", format } : { kind: "string" };
    }
    default: {
      const object = value as { [key: string]: JsonValue };
      const properties: Property[] = Object.entries(object).map(([key, child]) => ({
        name: key,
        schema: infer(child),
        required: true,
      }));
      return { kind: "object", properties };
    }
  }
}

function merge(a: Schema, b: Schema): Schema {
  if (same(a, b)) return a;

  if (a.kind === "object" && b.kind === "object") {
    const names = [...a.properties.map((property) => property.name)];
    for (const property of b.properties) {
      if (!names.includes(property.name)) names.push(property.name);
    }

    const properties = names.map((name) => {
      const left = a.properties.find((property) => property.name === name);
      const right = b.properties.find((property) => property.name === name);
      const schema = left && right ? merge(left.schema, right.schema) : (left ?? right)!.schema;
      return { name, schema, required: Boolean(left && right) };
    });
    return { kind: "object", properties };
  }

  if (a.kind === "array" && b.kind === "array") {
    const items = a.items.kind === "unknown" ? b.items : b.items.kind === "unknown" ? a.items : merge(a.items, b.items);
    return { kind: "array", items };
  }

  if (a.kind === "number" && b.kind === "number") return { kind: "number" };
  if (a.kind === "string" && b.kind === "string") return { kind: "string" };

  return union([a, b]);
}
