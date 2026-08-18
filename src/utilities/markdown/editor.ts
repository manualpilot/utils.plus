import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap, Prec } from "@uiw/react-codemirror";
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
