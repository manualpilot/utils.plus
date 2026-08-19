import { Decoration, type DecorationSet, EditorState, EditorView, type Range, StateEffect, StateField } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { MatchSpan } from "./match";

export const MATCH_COLOUR = "rgba(250, 176, 5, 0.2)";

export const GROUP_COLOURS = [
  "rgba(51, 154, 240, 0.4)",
  "rgba(64, 192, 87, 0.4)",
  "rgba(190, 75, 219, 0.4)",
  "rgba(21, 170, 191, 0.4)",
  "rgba(252, 196, 25, 0.4)",
];

export function groupColour(index: number): string {
  return GROUP_COLOURS[(index - 1) % GROUP_COLOURS.length];
}

export const setMatches = StateEffect.define<MatchSpan[]>();

const MATCH_DECORATION = Decoration.mark({ class: "cm-regex-match" });
const GROUP_DECORATIONS = GROUP_COLOURS.map((_, index) => Decoration.mark({ class: `cm-regex-group-${index}` }));

const MATCH_THEME = EditorView.theme({
  ".cm-regex-match": { backgroundColor: MATCH_COLOUR },
  ...Object.fromEntries(
    GROUP_COLOURS.map((colour, index) => [`.cm-regex-group-${index}`, { backgroundColor: colour }]),
  ),
});

const matchField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMatches)) return decorationsFor(effect.value, tr.state.doc.length);
    }
    return tr.docChanged ? marks.map(tr.changes) : marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function decorationsFor(matches: MatchSpan[], length: number): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  const add = (decoration: Decoration, from: number, to: number) => {
    const start = Math.max(0, Math.min(from, length));
    const end = Math.max(0, Math.min(to, length));
    if (end > start) ranges.push(decoration.range(start, end));
  };

  for (const match of matches) {
    add(MATCH_DECORATION, match.from, match.to);
    for (const group of match.groups) {
      add(GROUP_DECORATIONS[(group.index - 1) % GROUP_DECORATIONS.length], group.from, group.to);
    }
  }

  return Decoration.set(ranges, true);
}

const SINGLE_LINE = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.newDoc.lines === 1) return tr;

  const changes: { from: number; to: number; insert: string }[] = [];
  tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
    changes.push({ from, to, insert: inserted.toString().replace(/[\n\r]/g, "") });
  });

  return { changes, scrollIntoView: true };
});

export const PATTERN_EXTENSIONS = [
  SINGLE_LINE,
  EditorView.contentAttributes.of({ "aria-label": "Regular expression" }),
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];

export const SUBJECT_EXTENSIONS = [
  matchField,
  MATCH_THEME,
  EditorView.contentAttributes.of({ "aria-label": "Text to match" }),
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];

export const PATTERN_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
};
