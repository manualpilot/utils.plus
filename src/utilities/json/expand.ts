import { type JsonNode, readDocument, stringOf } from "./document";

export function expandEmbedded(node: JsonNode): { node: JsonNode; expanded: number } {
  let expanded = 0;

  const walk = (current: JsonNode): JsonNode => {
    if (current.kind === "object") {
      return { kind: "object", entries: current.entries.map((entry) => ({ ...entry, value: walk(entry.value) })) };
    }
    if (current.kind === "array") return { kind: "array", items: current.items.map(walk) };

    const spelled = stringOf(current);
    if (spelled === null || !CONTAINER_START.test(spelled)) return current;

    const read = readDocument(spelled);
    if (!read.ok) return current;

    expanded++;
    return walk(read.node);
  };

  return { node: walk(node), expanded };
}

const CONTAINER_START = /^\s*[[{]/;
