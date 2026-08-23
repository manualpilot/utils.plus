import { Decoration, type DecorationSet, EditorSelection, EditorState, EditorView, type Extension, keymap, lineNumbers, Prec, type Range, StateEffect, StateField, ViewPlugin, type ViewUpdate, WidgetType } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { Doc } from "./bytes";
import { columnOf, formatOffset, rowGlyphs, spotAt } from "./dump";
import { TEXT_ENCODINGS, type TextEncoding } from "./encodings";

export type Column = "hex" | "text";

export interface Model {
  doc: Doc;
  perRow: number;
  upper: boolean;
  base: number;
  digits: number;
  encoding: TextEncoding;
  column: Column;
}

export const setModel = StateEffect.define<Model>();

export const modelField = StateField.define<Model>({
  create: () => EMPTY_MODEL,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setModel)) return effect.value;
    }
    return value;
  },
});

export interface Caret {
  cursor: number;
  start: number;
  end: number;
  nibble: number;
}

export function caretOf(state: EditorState): Caret {
  const { perRow, doc } = state.field(modelField);
  const size = doc.bytes.length;
  const range = state.selection.main;
  const last = Math.max(0, size - 1);

  const head = byteAt(state, range.head, perRow, last);
  const anchor = byteAt(state, range.anchor, perRow, last);
  return {
    cursor: head.offset,
    nibble: head.nibble,
    start: Math.min(head.offset, anchor.offset),
    end: range.empty ? head.offset : Math.max(head.offset, anchor.offset),
  };
}

function byteAt(state: EditorState, pos: number, perRow: number, last: number) {
  const line = state.doc.lineAt(pos);
  const spot = spotAt(pos - line.from, perRow);
  return { offset: Math.min((line.number - 1) * perRow + spot.index, last), nibble: spot.nibble };
}

export function positionOf(state: EditorState, offset: number, nibble = 0): number {
  const { perRow } = state.field(modelField);
  const row = Math.floor(offset / perRow);
  const line = state.doc.line(Math.min(row + 1, state.doc.lines));
  return line.from + columnOf(offset - row * perRow) + nibble;
}

export function selectBytes(view: EditorView, anchorByte: number, headByte: number, nibble = 0) {
  const single = anchorByte === headByte;
  view.dispatch({
    selection: EditorSelection.single(
      positionOf(view.state, anchorByte, single ? nibble : 0),
      positionOf(view.state, headByte, single ? nibble : 0),
    ),
    scrollIntoView: true,
  });
}

export interface Handlers {
  type(key: string): void;
  move(offset: number, extend: boolean): void;
  focus(column: Column): void;
}

export function hexExtensions(handlers: { current: Handlers }): Extension[] {
  return [
    modelField,
    lineNumbers({
      formatNumber: (line, state) => {
        const { perRow, base, digits, upper } = state.field(modelField);
        return formatOffset((line - 1) * perRow, base, digits, upper);
      },
    }),
    marks,
    MARK_THEME,
    Prec.highest(keymap.of([{ any: (view, event) => onKey(view, event, handlers.current) }])),
    EditorView.domEventHandlers({ mousedown: (event, view) => onMouseDown(event, view, handlers.current) }),
    EditorState.readOnly.of(true),
    EditorView.contentAttributes.of({ "aria-label": "The file, byte by byte" }),
    ...EDITOR_SURFACE,
  ];
}

class TextColumn extends WidgetType {
  constructor(readonly glyphs: string, readonly state: string, readonly from: number) {
    super();
  }

  eq(other: TextColumn): boolean {
    return other.glyphs === this.glyphs && other.state === this.state && other.from === this.from;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("span");
    box.className = "cm-hex-text";
    box.dataset.from = String(this.from);
    let at = 0;
    while (at < this.glyphs.length) {
      let until = at + 1;
      while (until < this.glyphs.length && this.state[until] === this.state[at]) until++;
      const piece = document.createElement("span");
      piece.className = classFor(this.state.charCodeAt(at) - ZERO);
      piece.textContent = this.glyphs.slice(at, until);
      box.appendChild(piece);
      at = until;
    }
    return box;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const CHANGED = 1;
const SELECTED = 2;
const CARET = 4;
const ZERO = 48;

function classFor(state: number): string {
  const names = ["cm-hex-glyph"];
  if (state & CHANGED) names.push("cm-hex-changed");
  if (state & SELECTED) names.push("cm-hex-selected");
  if (state & CARET) names.push("cm-hex-caret");
  return names.join(" ");
}

const CHANGED_MARK = Decoration.mark({ class: "cm-hex-changed" });
const SELECTED_MARK = Decoration.mark({ class: "cm-hex-selected" });
const CARET_MARK = Decoration.mark({ class: "cm-hex-caret" });

const marks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      const remodelled = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setModel)));
      if (update.docChanged || update.viewportChanged || update.selectionSet || remodelled) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function build(view: EditorView): DecorationSet {
  const { doc, perRow, encoding } = view.state.field(modelField);
  const size = doc.bytes.length;
  const { cursor, start, end } = caretOf(view.state);
  const selected = end > start;
  const ranges: Range<Decoration>[] = [];

  for (const visible of view.visibleRanges) {
    let pos = visible.from;
    while (pos <= visible.to) {
      const line = view.state.doc.lineAt(pos);
      const row = line.number - 1;
      const first = row * perRow;
      const state: string[] = [];

      let run = -1;
      for (let index = 0; index < perRow; index++) {
        const offset = first + index;
        const past = offset >= size;
        const changed = !past && doc.changed.has(offset);
        state.push(String.fromCharCode(ZERO + (changed ? CHANGED : 0)));
        if (changed && run < 0) run = index;
        if ((!changed || index === perRow - 1) && run >= 0) {
          const until = changed ? index : index - 1;
          ranges.push(CHANGED_MARK.range(line.from + columnOf(run), line.from + columnOf(until) + 2));
          run = -1;
        }
      }

      if (selected && end >= first && start < first + perRow) {
        const from = Math.max(start, first) - first;
        const to = Math.min(end, Math.min(first + perRow, size) - 1) - first;
        if (to >= from) {
          ranges.push(SELECTED_MARK.range(line.from + columnOf(from), line.from + columnOf(to) + 2));
          for (let index = from; index <= to; index++) {
            state[index] = String.fromCharCode(state[index].charCodeAt(0) + SELECTED);
          }
        }
      }

      if (cursor >= first && cursor < first + perRow && cursor < size) {
        const index = cursor - first;
        ranges.push(CARET_MARK.range(line.from + columnOf(index), line.from + columnOf(index) + 2));
        state[index] = String.fromCharCode(state[index].charCodeAt(0) + CARET);
      }

      ranges.push(
        Decoration.widget({
          widget: new TextColumn(rowGlyphs(doc.bytes, row, perRow, encoding), state.join(""), first),
          side: 1,
        }).range(line.to),
      );

      pos = line.to + 1;
    }
  }

  return Decoration.set(ranges, true);
}

const MARK_THEME = EditorView.theme({
  ".cm-hex-text": { paddingLeft: "2ch", whiteSpace: "pre" },
  ".cm-hex-glyph": { color: "var(--mantine-color-text)" },
  ".cm-hex-selected": { backgroundColor: "var(--mantine-color-dark-4)" },
  ".cm-hex-changed": { color: "var(--mantine-color-orange-4)", fontWeight: "600" },
  ".cm-hex-caret": { outline: "1px solid var(--mantine-color-orange-6)", outlineOffset: "-1px" },
  ".cm-selectionBackground": { backgroundColor: "transparent" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "transparent" },
  ".cm-line": { padding: "0" },
  ".cm-content": { padding: "0" },
});

function onMouseDown(event: MouseEvent, view: EditorView, handlers: Handlers): boolean {
  const box = (event.target as HTMLElement | null)?.closest<HTMLElement>(".cm-hex-text");
  if (!box?.dataset.from) {
    handlers.focus("hex");
    return false;
  }

  const { perRow, doc } = view.state.field(modelField);
  const first = Number(box.dataset.from);
  const inside = event.clientX - box.getBoundingClientRect().left - TEXT_PADDING * view.defaultCharacterWidth;
  const index = Math.floor(inside / view.defaultCharacterWidth);
  const offset = first + Math.max(0, Math.min(index, perRow - 1));
  if (offset >= doc.bytes.length) return false;

  event.preventDefault();
  view.focus();
  handlers.focus("text");
  selectBytes(view, offset, offset);
  return true;
}

const TEXT_PADDING = 2;

function onKey(view: EditorView, event: KeyboardEvent, handlers: Handlers): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  const { perRow, doc } = view.state.field(modelField);
  const size = doc.bytes.length;
  const { cursor } = caretOf(view.state);
  const lines = Math.max(1, Math.floor(view.dom.clientHeight / view.defaultLineHeight) - 1);
  const to = (offset: number) => {
    handlers.move(Math.max(0, Math.min(offset, size - 1)), event.shiftKey);
    return true;
  };

  switch (event.key) {
    case "ArrowLeft":
      return to(cursor - 1);
    case "ArrowRight":
      return to(cursor + 1);
    case "ArrowUp":
      return to(cursor - perRow);
    case "ArrowDown":
      return to(cursor + perRow);
    case "PageUp":
      return to(cursor - lines * perRow);
    case "PageDown":
      return to(cursor + lines * perRow);
    case "Home":
      return to(cursor - (cursor % perRow));
    case "End":
      return to(cursor - (cursor % perRow) + perRow - 1);
    case "Escape":
      return to(cursor);
    default:
      break;
  }

  if (event.key.length !== 1) return false;
  handlers.type(event.key);
  return true;
}

export const HEX_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  highlightSelectionMatches: false,
  searchKeymap: false,
  history: false,
  historyKeymap: false,
  defaultKeymap: false,
  completionKeymap: false,
  lintKeymap: false,
  foldKeymap: false,
  allowMultipleSelections: false,
  indentOnInput: false,
  rectangularSelection: false,
  crosshairCursor: false,
  dropCursor: false,
};

export const EMPTY_MODEL: Model = {
  doc: { bytes: new Uint8Array(0), original: new Uint8Array(0), changed: new Set() },
  perRow: 16,
  upper: false,
  base: 16,
  digits: 4,
  encoding: TEXT_ENCODINGS[0],
  column: "hex",
};
