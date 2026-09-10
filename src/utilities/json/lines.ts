import { type JsonNode, printDocument, readDocument } from "./document";

export type ReadLines = { ok: true; nodes: JsonNode[] } | { ok: false; error: string };

export function readLines(text: string): ReadLines {
  const nodes: JsonNode[] = [];
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() === "") continue;
    const read = readDocument(lines[index]);
    if (!read.ok) return { ok: false, error: `Line ${index + 1} is not a JSON value, so this is not JSON Lines` };
    nodes.push(read.node);
  }

  if (nodes.length === 0) return { ok: false, error: "There are no lines to read" };
  return { ok: true, nodes };
}

export function isJsonLines(text: string): boolean {
  const read = readLines(text);
  return read.ok && read.nodes.length > 1;
}

export function writeLines(nodes: JsonNode[]): string {
  return nodes.map((node) => printDocument(node, 0)).join("\n") + "\n";
}
