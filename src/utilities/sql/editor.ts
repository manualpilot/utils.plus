import { PostgreSQL, sql, type SQLDialect, SQLite } from "@codemirror/lang-sql";
import { EditorView, type Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import { catalogueCompletion } from "./completion";
import type { ModeId, Schema } from "./engine";

export function editorExtensions(mode: ModeId, read: () => Schema[]): Extension[] {
  return [...DIALECT_EXTENSIONS[mode], catalogueCompletion(DIALECTS[mode], mode, read)];
}

const DIALECTS: Record<ModeId, SQLDialect> = { sqlite: SQLite, postgres: PostgreSQL };

const DIALECT_EXTENSIONS: Record<ModeId, Extension[]> = {
  sqlite: extensions("sqlite"),
  postgres: extensions("postgres"),
};

function extensions(mode: ModeId): Extension[] {
  return [sql({ dialect: DIALECTS[mode], upperCaseKeywords: true }), EditorView.lineWrapping, ...EDITOR_SURFACE];
}
