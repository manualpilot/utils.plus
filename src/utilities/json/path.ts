import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import type { EditorState } from "@uiw/react-codemirror";

export type Segment = string | number;

export function spellPath(segments: Segment[]): string {
  return "$" + segments.map((segment) => {
    if (typeof segment === "number") return `[${segment}]`;
    return SHORTHAND.test(segment) ? `.${segment}` : `[${quoteName(segment)}]`;
  }).join("");
}

export function normalizedPath(segments: Segment[]): string {
  return "$" + segments.map((segment) => `[${typeof segment === "number" ? segment : quoteName(segment)}]`).join("");
}

const SHORTHAND = /^[A-Za-z_\u0080-\u{10FFFF}][A-Za-z0-9_\u0080-\u{10FFFF}]*$/u;

function quoteName(name: string): string {
  const escaped = name.replace(/[\\'\u0000-\u001f]/g, (character) => {
    if (ESCAPES[character]) return ESCAPES[character];
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
  return `'${escaped}'`;
}

const ESCAPES: Record<string, string> = {
  "\\": "\\\\",
  "'": "\\'",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

export function caretPath(state: EditorState, at: number): Segment[] {
  const tree = syntaxTree(state);
  const before = segmentsOf(state, tree.resolveInner(at, -1));
  const after = segmentsOf(state, tree.resolveInner(at, 1));
  return after.length > before.length ? after : before;
}

function segmentsOf(state: EditorState, start: SyntaxNode): Segment[] {
  const segments: Segment[] = [];

  for (let node: SyntaxNode | null = start; node; node = node.parent) {
    const parent: SyntaxNode | null = node.parent;
    if (!parent) break;

    if (parent.name === "Property") {
      const name = parent.getChild("PropertyName");
      if (name) segments.unshift(nameOf(state.doc.sliceString(name.from, name.to)));
    } else if (parent.name === "Array" && VALUES.has(node.name)) {
      let index = 0;
      for (let sibling = node.prevSibling; sibling; sibling = sibling.prevSibling) {
        if (VALUES.has(sibling.name)) index++;
      }
      segments.unshift(index);
    }
  }

  return segments;
}

function nameOf(written: string): string {
  try {
    return JSON.parse(written) as string;
  } catch {
    return written.replace(/^"|"$/g, "");
  }
}

const VALUES = new Set(["True", "False", "Null", "Number", "String", "Object", "Array"]);
