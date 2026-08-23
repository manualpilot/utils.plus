import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { EditorView, type Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";

export const COMMAND_EXTENSIONS: Extension[] = [
  StreamLanguage.define(shell),
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];

export const COMMAND_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
};
