import { EditorView, Prec } from "@uiw/react-codemirror";

export const EDITOR_BACKGROUND = "var(--mantine-color-dark-6)";

const ACTIVE_LINE_TINT = "rgba(255, 255, 255, 0.04)";

export const EDITOR_SURFACE = [
  EditorView.theme({ "&.cm-focused": { outline: "none" } }),
  Prec.highest(EditorView.theme({
    "&": { backgroundColor: EDITOR_BACKGROUND },
    ".cm-gutters": { backgroundColor: EDITOR_BACKGROUND },
    ".cm-activeLine": { backgroundColor: ACTIVE_LINE_TINT },
    ".cm-activeLineGutter": { backgroundColor: ACTIVE_LINE_TINT },
  })),
];

export const EDITOR_STYLE = { height: "100%", fontSize: 14 };
