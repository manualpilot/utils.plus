import { ensureSyntaxTree, foldedRanges, foldEffect, unfoldEffect } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import type { EditorState, EditorView, StateEffect } from "@uiw/react-codemirror";

export interface FoldRange {
  from: number;
  to: number;
}

export function foldRangesAt(state: EditorState, depth: number): FoldRange[] {
  const tree = ensureSyntaxTree(state, state.doc.length, TREE_BUDGET_MS);
  if (!tree) return [];

  const ranges: FoldRange[] = [];

  const visit = (node: SyntaxNode, level: number) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "Property") visit(child, level);
      if (child.name !== "Object" && child.name !== "Array") continue;
      if (level < depth) {
        visit(child, level + 1);
        continue;
      }
      const inside = insideOf(state, child);
      if (inside) ranges.push(inside);
    }
  };

  visit(tree.topNode, 0);
  return ranges;
}

function insideOf(state: EditorState, node: SyntaxNode): FoldRange | null {
  const open = node.firstChild;
  const close = node.lastChild;
  if (!open || !close || (close.name !== "}" && close.name !== "]")) return null;
  if (state.doc.lineAt(open.to).number === state.doc.lineAt(close.from).number) return null;
  return { from: open.to, to: close.from };
}

export function foldToLevel(view: EditorView, depth: number | null): void {
  const effects: StateEffect<FoldRange>[] = [];

  foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
    effects.push(unfoldEffect.of({ from, to }));
  });
  for (const range of depth === null ? [] : foldRangesAt(view.state, depth)) effects.push(foldEffect.of(range));

  if (effects.length) view.dispatch({ effects });
}

const TREE_BUDGET_MS = 500;
