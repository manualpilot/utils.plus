import { json as jsonLanguage } from "@codemirror/lang-json";
import { yaml as yamlLanguage } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { EditorView, type Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { FormatId } from "./formats";

export function editorExtensions(format: FormatId): Extension[] {
  return EXTENSIONS[format];
}

export function replaceDoc(view: EditorView | null, text: string) {
  view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

const BASE = [EditorView.lineWrapping, ...EDITOR_SURFACE];

const EXTENSIONS: { [id in FormatId]: Extension[] } = {
  yaml: [yamlLanguage(), EditorView.contentAttributes.of({ "aria-label": "YAML" }), ...BASE],
  json: [jsonLanguage(), EditorView.contentAttributes.of({ "aria-label": "JSON" }), ...BASE],
  toml: [StreamLanguage.define(toml), EditorView.contentAttributes.of({ "aria-label": "TOML" }), ...BASE],
  env: [StreamLanguage.define(properties), EditorView.contentAttributes.of({ "aria-label": "dotenv" }), ...BASE],
  properties: [
    StreamLanguage.define(properties),
    EditorView.contentAttributes.of({ "aria-label": "Java properties" }),
    ...BASE,
  ],
};
