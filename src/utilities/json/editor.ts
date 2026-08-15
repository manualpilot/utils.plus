import { json as jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorView } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";

export const EDITOR_EXTENSIONS = [
  jsonLanguage(),
  linter(jsonParseLinter()),
  lintGutter(),
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];
