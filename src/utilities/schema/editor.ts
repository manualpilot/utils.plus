import { javascript } from "@codemirror/lang-javascript";
import { json as jsonLanguage } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { Decoration, type DecorationSet, EditorView, type Extension, type Range, StateEffect, StateField } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { LanguageId } from "../../common/schema/languages";

export interface Mark {
  from: number;
  to: number;
  message: string;
}

export const setMarks = StateEffect.define<Mark[]>();

export function replaceDoc(view: EditorView | null, text: string) {
  view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

const PROBLEM_THEME = EditorView.theme({
  ".cm-line.cm-schema-problem-line": { backgroundColor: "rgba(224, 49, 49, 0.12)" },
  ".cm-schema-problem": {
    textDecoration: "underline wavy var(--mantine-color-red-5)",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
});

const PROBLEM_LINE = Decoration.line({ class: "cm-schema-problem-line" });

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMarks)) return decorationsFor(tr.state.doc, effect.value);
    }
    return tr.docChanged ? marks.map(tr.changes) : marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function decorationsFor(doc: { length: number; lineAt: (at: number) => { from: number; to: number } }, marks: Mark[]) {
  const ranges: Range<Decoration>[] = [];
  const lines = new Set<number>();

  for (const mark of marks) {
    const from = Math.max(0, Math.min(mark.from, doc.length));
    const to = Math.max(from, Math.min(mark.to, doc.length));
    const line = doc.lineAt(from);

    if (!lines.has(line.from)) {
      lines.add(line.from);
      ranges.push(PROBLEM_LINE.range(line.from));
    }
    if (to > from && to <= line.to) {
      ranges.push(Decoration.mark({ class: "cm-schema-problem", attributes: { title: mark.message } }).range(from, to));
    }
  }

  return Decoration.set(ranges, true);
}

const BASE = [EditorView.lineWrapping, ...EDITOR_SURFACE];

export const PAYLOAD_EXTENSIONS: Extension[] = [
  marksField,
  PROBLEM_THEME,
  jsonLanguage(),
  EditorView.contentAttributes.of({ "aria-label": "JSON payload" }),
  ...BASE,
];

const SCHEMA_EXTENSIONS: Record<LanguageId, Extension[]> = {
  "json-schema": [jsonLanguage(), EditorView.contentAttributes.of({ "aria-label": "JSON Schema" }), ...BASE],
  zod: [
    javascript({ typescript: true }),
    EditorView.contentAttributes.of({ "aria-label": "Zod schema" }),
    ...BASE,
  ],
  pydantic: [python(), EditorView.contentAttributes.of({ "aria-label": "Pydantic model" }), ...BASE],
};

export function schemaExtensions(language: LanguageId): Extension[] {
  return SCHEMA_EXTENSIONS[language];
}
