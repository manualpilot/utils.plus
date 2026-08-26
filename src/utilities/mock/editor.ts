import { javascript } from "@codemirror/lang-javascript";
import { json as jsonLanguage } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { sql as sqlLanguage } from "@codemirror/lang-sql";
import { EditorView, type Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { LanguageId } from "../../common/schema/languages";
import type { FormatId } from "./write";

export function schemaExtensions(language: LanguageId): Extension[] {
  return SCHEMA_EXTENSIONS[language];
}

export function outputExtensions(format: FormatId): Extension[] {
  return OUTPUT_EXTENSIONS[format];
}

const BASE = [EditorView.lineWrapping, ...EDITOR_SURFACE];

const READ_ONLY = [EditorView.editable.of(false), ...BASE];

const SCHEMA_EXTENSIONS: Record<LanguageId, Extension[]> = {
  "json-schema": [jsonLanguage(), EditorView.contentAttributes.of({ "aria-label": "JSON Schema" }), ...BASE],
  zod: [javascript({ typescript: true }), EditorView.contentAttributes.of({ "aria-label": "Zod schema" }), ...BASE],
  pydantic: [python(), EditorView.contentAttributes.of({ "aria-label": "Pydantic model" }), ...BASE],
};

const OUTPUT_EXTENSIONS: Record<FormatId, Extension[]> = {
  json: [jsonLanguage(), EditorView.contentAttributes.of({ "aria-label": "Generated JSON" }), ...READ_ONLY],
  ndjson: [EditorView.contentAttributes.of({ "aria-label": "Generated NDJSON" }), ...READ_ONLY],
  csv: [EditorView.contentAttributes.of({ "aria-label": "Generated CSV" }), ...READ_ONLY],
  sql: [sqlLanguage(), EditorView.contentAttributes.of({ "aria-label": "Generated SQL" }), ...READ_ONLY],
};
