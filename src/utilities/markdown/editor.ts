import { markdown } from "@codemirror/lang-markdown";
import { EditorView, type Extension, keymap, Prec } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import { formatEdit, type FormatKind } from "./format";
import { FORMAT_BUTTONS } from "./toolbar";

export function applyFormat(view: EditorView | null, kind: FormatKind) {
  if (!view) return;

  const { from, to } = view.state.selection.main;
  const edit = formatEdit(kind, view.state.doc.toString(), from, to);
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection[0], head: edit.selection[1] },
    scrollIntoView: true,
  });
  view.focus();
}

export function replaceDocument(view: EditorView | null, text: string) {
  if (!view) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
}

export function fileDropHandlers(
  onDragging: (dragging: boolean) => void,
  onFile: (file: File) => void,
): Extension {
  return EditorView.domEventHandlers({
    dragover: (event) => {
      if (!hasFile(event)) return false;
      event.preventDefault();
      onDragging(true);
      return true;
    },
    dragleave: (event, view) => {
      if (!view.dom.contains(event.relatedTarget as Node | null)) onDragging(false);
      return false;
    },
    drop: (event) => {
      onDragging(false);
      const file = hasFile(event) ? event.dataTransfer?.files.item(0) : null;
      if (!file) return false;
      event.preventDefault();
      onFile(file);
      return true;
    },
  });
}

function hasFile(event: DragEvent) {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

const FORMAT_KEYMAP = Prec.high(keymap.of(
  FORMAT_BUTTONS.flatMap(({ kind, key }) =>
    key
      ? [{
        key,
        run: (view: EditorView) => {
          applyFormat(view, kind);
          return true;
        },
      }]
      : []
  ),
));

export const EDITOR_EXTENSIONS = [
  markdown(),
  FORMAT_KEYMAP,
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];
