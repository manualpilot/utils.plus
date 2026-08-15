import { javascript as javascriptLanguage } from "@codemirror/lang-javascript";
import { EditorView } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";

export const EDITOR_EXTENSIONS = {
  javascript: [javascriptLanguage(), EditorView.lineWrapping, ...EDITOR_SURFACE],
  typescript: [javascriptLanguage({ typescript: true }), EditorView.lineWrapping, ...EDITOR_SURFACE],
};
