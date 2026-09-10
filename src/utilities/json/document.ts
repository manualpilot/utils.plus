import { jsonLanguage } from "@codemirror/lang-json";
import type { SyntaxNode } from "@lezer/common";

export type JsonNode =
  | { kind: "object"; entries: JsonEntry[] }
  | { kind: "array"; items: JsonNode[] }
  | { kind: "scalar"; type: ScalarType; text: string };

export type ScalarType = "string" | "number" | "true" | "false" | "null";

export interface JsonEntry {
  key: string;
  name: string;
  value: JsonNode;
}

export type Read = { ok: true; node: JsonNode } | { ok: false; error: string };

export function readDocument(text: string): Read {
  const tree = jsonLanguage.parser.parse(text);
  let fault: number | null = null;

  tree.iterate({
    enter: (node) => {
      if (fault !== null) return false;
      if (node.type.isError) fault = node.from;
    },
  });

  const top = tree.topNode.firstChild;
  if (fault === null && !top) fault = text.length;
  if (fault !== null) return { ok: false, error: `Not valid JSON at ${placeOf(text, fault)}` };

  return { ok: true, node: nodeOf(top!, text) };
}

function nodeOf(node: SyntaxNode, text: string): JsonNode {
  const slice = (from: number, to: number) => text.slice(from, to);

  if (node.name === "Object") {
    const entries = node.getChildren("Property").map((property) => {
      const name = property.getChild("PropertyName")!;
      const key = slice(name.from, name.to);
      return { key, name: JSON.parse(key) as string, value: nodeOf(property.lastChild!, text) };
    });
    return { kind: "object", entries };
  }

  if (node.name === "Array") {
    const items: JsonNode[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (SCALARS[child.name] || child.name === "Object" || child.name === "Array") items.push(nodeOf(child, text));
    }
    return { kind: "array", items };
  }

  return { kind: "scalar", type: SCALARS[node.name], text: slice(node.from, node.to) };
}

const SCALARS: Record<string, ScalarType> = {
  String: "string",
  Number: "number",
  True: "true",
  False: "false",
  Null: "null",
};

export function placeOf(text: string, at: number): string {
  const before = text.slice(0, at).split("\n");
  return `line ${before.length}, column ${before[before.length - 1].length + 1}`;
}

export function printDocument(node: JsonNode, indent: number): string {
  return print(node, indent, "");
}

function print(node: JsonNode, indent: number, pad: string): string {
  if (node.kind === "scalar") return node.text;

  const inner = pad + " ".repeat(indent);
  const parts = node.kind === "object"
    ? node.entries.map(({ key, value }) => `${key}${indent ? ": " : ":"}${print(value, indent, inner)}`)
    : node.items.map((item) => print(item, indent, inner));

  const [open, close] = node.kind === "object" ? ["{", "}"] : ["[", "]"];
  if (parts.length === 0) return open + close;
  if (!indent) return open + parts.join(",") + close;
  return `${open}\n${inner}${parts.join(`,\n${inner}`)}\n${pad}${close}`;
}

export function sortKeys(node: JsonNode): JsonNode {
  if (node.kind === "array") return { kind: "array", items: node.items.map(sortKeys) };
  if (node.kind === "scalar") return node;

  const entries = node.entries.map((entry) => ({ ...entry, value: sortKeys(entry.value) }));
  entries.sort((first, second) => first.name < second.name ? -1 : first.name > second.name ? 1 : 0);
  return { kind: "object", entries };
}

export function stringOf(node: JsonNode): string | null {
  return node.kind === "scalar" && node.type === "string" ? JSON.parse(node.text) as string : null;
}
