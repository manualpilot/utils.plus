import { type JsonNode, printDocument, readDocument, sortKeys as sortNode, stringOf } from "./document";
import { expandEmbedded } from "./expand";
import { isJsonLines, readLines, writeLines } from "./lines";
import { repairDocument } from "./repair";

export interface Notice {
  tone: "error" | "done";
  message: string;
}

export interface Outcome {
  text?: string;
  notice?: Notice;
}

export type Transform = (text: string, indent: number) => Outcome;

const fault = (message: string): Outcome => ({ notice: { tone: "error", message } });
const done = (text: string | undefined, message: string): Outcome => ({ text, notice: { tone: "done", message } });

export const format: Transform = (text, indent) => {
  const read = readDocument(text);
  if (read.ok) return { text: printDocument(read.node, indent) };
  if (isJsonLines(text)) return fault("JSON Lines keeps one value to a line, so make it an array to format it");
  return fault(read.error);
};

export const minify: Transform = (text) => perDocument(text, (node) => node, 0);
export const sortKeys: Transform = (text, indent) => perDocument(text, sortNode, indent);

function perDocument(text: string, rewrite: (node: JsonNode) => JsonNode, indent: number): Outcome {
  const read = readDocument(text);
  if (read.ok) return { text: printDocument(rewrite(read.node), indent) };
  const lines = readLines(text);
  if (lines.ok && lines.nodes.length > 1) return { text: writeLines(lines.nodes.map(rewrite)) };
  return fault(read.error);
}

export const escape: Transform = (text) => ({ text: JSON.stringify(text) });

export const unescape: Transform = (text) => {
  const read = readDocument(text);
  if (!read.ok) return fault(read.error);
  const spelled = stringOf(read.node);
  if (spelled === null) return fault("Only a document that is a single JSON string can be unescaped");
  return { text: spelled };
};

export const expand: Transform = (text, indent) => {
  const read = readDocument(text);
  if (!read.ok) return fault(read.error);
  const { node, expanded } = expandEmbedded(read.node);
  if (!expanded) return done(undefined, "No string here holds a JSON object or array");
  return done(
    printDocument(node, indent),
    `Expanded ${expanded} embedded ${expanded === 1 ? "document" : "documents"}`,
  );
};

export const repair: Transform = (text, indent) => {
  const repaired = repairDocument(text);
  if (!repaired.ok) return fault(repaired.error);
  if (!repaired.fixes.length) return done(undefined, "Nothing needed repairing");
  return done(printDocument(repaired.node, indent), `Repaired: ${repaired.fixes.join(", ")}`);
};

export const toLines: Transform = (text) => {
  const read = readDocument(text);
  if (read.ok && read.node.kind === "array") {
    if (!read.node.items.length) return fault("The array is empty, so there are no lines to write");
    return { text: writeLines(read.node.items) };
  }
  if (read.ok) return fault("Only an array can become JSON Lines, one element to a line");
  if (isJsonLines(text)) return done(undefined, "This is JSON Lines already");
  return fault(read.error);
};

export const toArray: Transform = (text, indent) => {
  const lines = readLines(text);
  if (!lines.ok) return fault(lines.error);
  return { text: printDocument({ kind: "array", items: lines.nodes }, indent) };
};
