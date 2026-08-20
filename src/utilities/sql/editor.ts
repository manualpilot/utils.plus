import { PostgreSQL, sql, type SQLDialect, SQLite } from "@codemirror/lang-sql";
import { EditorView } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";
import type { ModeId } from "./engine";

export const EDITOR_EXTENSIONS: Record<ModeId, ReturnType<typeof extensions>> = {
  sqlite: extensions(SQLite),
  postgres: extensions(PostgreSQL),
};

function extensions(dialect: SQLDialect) {
  return [sql({ dialect, upperCaseKeywords: true }), EditorView.lineWrapping, ...EDITOR_SURFACE];
}
