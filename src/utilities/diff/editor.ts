import { Decoration, type DecorationSet, type EditorState, EditorView, type Extension, type Range, StateEffect, type StateEffectType, StateField } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { LineMark } from "./myers";

export function replaceDoc(view: EditorView | null, text: string) {
  view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

const DIFF_THEME = EditorView.theme({
  ".cm-line.cm-diff-removed": { backgroundColor: "rgba(224, 49, 49, 0.16)" },
  ".cm-line.cm-diff-added": { backgroundColor: "rgba(47, 158, 68, 0.18)" },
  ".cm-diff-removed-text": { backgroundColor: "rgba(224, 49, 49, 0.4)" },
  ".cm-diff-added-text": { backgroundColor: "rgba(47, 158, 68, 0.45)" },
});

const BASE_EXTENSIONS = [EditorView.lineWrapping, ...EDITOR_SURFACE, DIFF_THEME];

export function paneExtensions(marks: Extension, language: Extension | null): Extension[] {
  return language ? [...BASE_EXTENSIONS, marks, language] : [...BASE_EXTENSIONS, marks];
}

export interface DiffMarks {
  extension: Extension;
  set: StateEffectType<LineMark[]>;
}

export function diffMarks(lineClass: string, textClass: string): DiffMarks {
  const set = StateEffect.define<LineMark[]>();
  const lineDecoration = Decoration.line({ class: lineClass });
  const textDecoration = Decoration.mark({ class: textClass });

  const field = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(marks, tr) {
      for (const effect of tr.effects) {
        if (effect.is(set)) return buildDecorations(tr.state, effect.value, lineDecoration, textDecoration);
      }
      return tr.docChanged ? Decoration.none : marks;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return { extension: field, set };
}

function buildDecorations(
  state: EditorState,
  marks: LineMark[],
  lineDecoration: Decoration,
  textDecoration: Decoration,
): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const mark of marks) {
    if (mark.line < 1 || mark.line > state.doc.lines) continue;
    const line = state.doc.line(mark.line);
    ranges.push(lineDecoration.range(line.from));

    for (const span of mark.spans) {
      const from = line.from + span.from;
      const to = Math.min(line.from + span.to, line.to);
      if (to > from) ranges.push(textDecoration.range(from, to));
    }
  }

  return Decoration.set(ranges, true);
}

export const LEFT_MARKS = diffMarks("cm-diff-removed", "cm-diff-removed-text");
export const RIGHT_MARKS = diffMarks("cm-diff-added", "cm-diff-added-text");

export const NO_MARKS: LineMark[] = [];
