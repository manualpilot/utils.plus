import sqlite3InitModule, { type Database, type Sqlite3Static, type SqlValue } from "@sqlite.org/sqlite-wasm";
import type { Column, Constraint, Engine, Index, Outcome, Relation, Schema } from "./engine";
import { commandOf } from "./statements";

let runtime: Promise<Sqlite3Static> | null = null;

export async function openSqlite(): Promise<Engine> {
  const sqlite3 = await (runtime ??= sqlite3InitModule());
  const db = new sqlite3.oo1.DB(":memory:", "c");

  try {
    db.exec("PRAGMA foreign_keys = ON");
  } catch (error) {
    db.close();
    throw error;
  }

  return {
    version: `SQLite ${sqlite3.version.libVersion}`,

    async execute(sql: string): Promise<Outcome> {
      const columns: string[] = [];
      const before = Number(db.changes(true));
      const rows = db.exec(sql, { rowMode: "array", returnValue: "resultRows", columnNames: columns });
      const written = Number(db.changes(true)) - before;
      const command = commandOf(sql);

      return {
        columns,
        rows,
        command,
        affected: command && WRITES.has(command) ? written : null,
        notices: [],
      };
    },

    async inspect(): Promise<Schema[]> {
      return SCHEMA_NAMES.map((name) => ({ name, relations: relationsOf(db, name) })).filter((schema) =>
        schema.relations.length > 0
      );
    },

    async close(): Promise<void> {
      db.close();
    },
  };
}

const SCHEMA_NAMES = ["main", "temp"];

const WRITES = new Set(["INSERT", "UPDATE", "DELETE", "REPLACE", "MERGE"]);

function relationsOf(db: Database, schema: string): Relation[] {
  const listed = db.selectObjects(
    `SELECT name, type, sql FROM "${schema}".sqlite_master
     WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`,
  );

  return listed.map((row) => {
    const name = String(row.name);
    const kind = String(row.type);
    const ddl = row.sql === null || row.sql === undefined ? null : String(row.sql);
    const columns = columnsOf(db, schema, name);
    const indexes = kind === "table" ? indexesOf(db, schema, name) : [];

    return {
      name,
      kind,
      columns,
      indexes,
      definition: ddl,
      constraints: kind === "table" ? constraintsOf(db, schema, name, columns, indexes, ddl) : [],
    };
  });
}

function columnsOf(db: Database, schema: string, table: string): Column[] {
  const rows = db.selectObjects("SELECT * FROM pragma_table_info(?, ?)", [table, schema]);

  return rows.map((row) => ({
    name: String(row.name),
    type: String(row.type ?? "") || "any",
    notNull: Number(row.notnull) === 1,
    primaryKey: Number(row.pk) > 0,
    fallback: row.dflt_value === null || row.dflt_value === undefined ? null : String(row.dflt_value),
  }));
}

function indexesOf(db: Database, schema: string, table: string): Index[] {
  const rows = db.selectObjects("SELECT * FROM pragma_index_list(?, ?)", [table, schema]);

  return rows.map((row) => {
    const name = String(row.name);
    const parts = db.selectObjects("SELECT * FROM pragma_index_info(?, ?)", [name, schema]);

    return {
      name,
      unique: Number(row.unique) === 1,
      primary: row.origin === "pk",
      columns: parts.map((part) => part.name === null ? "‹expression›" : String(part.name)),
    };
  });
}

function constraintsOf(
  db: Database,
  schema: string,
  table: string,
  columns: Column[],
  indexes: Index[],
  ddl: string | null,
): Constraint[] {
  const constraints: Constraint[] = [];

  const key = columns.filter((column) => column.primaryKey).map((column) => column.name);
  if (key.length > 0) constraints.push({ name: "", kind: "PRIMARY KEY", detail: `(${key.join(", ")})` });

  for (const index of indexes) {
    if (!index.unique || index.primary) continue;
    constraints.push({ name: index.name, kind: "UNIQUE", detail: `(${index.columns.join(", ")})` });
  }

  const keys = db.selectObjects("SELECT * FROM pragma_foreign_key_list(?, ?)", [table, schema]);
  for (const group of groupBy(keys, (row) => String(row.id))) {
    const ordered = [...group].sort((a, b) => Number(a.seq) - Number(b.seq));
    const from = ordered.map((row) => String(row.from)).join(", ");
    const to = ordered.map((row) => row.to === null ? "" : String(row.to)).filter(Boolean).join(", ");
    const target = `${String(ordered[0].table)}${to ? ` (${to})` : ""}`;
    const rules = [
      String(ordered[0].on_update ?? "NO ACTION"),
      String(ordered[0].on_delete ?? "NO ACTION"),
    ];
    const actions = [
      rules[0] === "NO ACTION" ? "" : `ON UPDATE ${rules[0]}`,
      rules[1] === "NO ACTION" ? "" : `ON DELETE ${rules[1]}`,
    ].filter(Boolean).join(" ");

    constraints.push({
      name: "",
      kind: "FOREIGN KEY",
      detail: `(${from}) REFERENCES ${target}${actions ? ` ${actions}` : ""}`,
    });
  }

  for (const check of checksOf(ddl)) constraints.push({ name: "", kind: "CHECK", detail: check });

  return constraints;
}

function checksOf(ddl: string | null): string[] {
  if (!ddl) return [];
  const lower = ddl.toLowerCase();
  const found: string[] = [];

  for (let i = 0; i < ddl.length; i++) {
    if (!lower.startsWith("check", i)) continue;
    if (i > 0 && WORDISH.test(ddl[i - 1])) continue;
    if (i + 5 < ddl.length && WORDISH.test(ddl[i + 5])) continue;

    let open = i + 5;
    while (open < ddl.length && /\s/.test(ddl[open])) open++;
    if (ddl[open] !== "(") continue;

    const close = closingParen(ddl, open);
    if (close === -1) continue;
    found.push(ddl.slice(open, close + 1).replace(/\s+/g, " "));
    i = close;
  }

  return found;
}

function closingParen(text: string, open: number): number {
  let depth = 0;

  for (let i = open; i < text.length; i++) {
    const char = text[i];
    if (char === "'" || char === "\"") {
      for (i++; i < text.length && text[i] !== char; i++);
      continue;
    }
    if (char === "(") depth++;
    else if (char === ")" && --depth === 0) return i;
  }

  return -1;
}

function groupBy(rows: Record<string, SqlValue>[], key: (row: Record<string, SqlValue>) => string) {
  const groups = new Map<string, Record<string, SqlValue>[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups.values();
}

const WORDISH = /[A-Za-z0-9_]/;
