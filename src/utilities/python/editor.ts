import { python as pythonLanguage } from "@codemirror/lang-python";
import { EditorView } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";

export const EDITOR_EXTENSIONS = [
  pythonLanguage(),
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];
