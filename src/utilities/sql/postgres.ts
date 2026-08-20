import { PGlite } from "@electric-sql/pglite";
import type { Cell } from "./cells";
import type { Column, Constraint, Engine, Index, Outcome, Relation, Schema } from "./engine";

export async function openPostgres(): Promise<Engine> {
  const pg = new PGlite();

  try {
    await pg.waitReady;
  } catch (error) {
    await pg.close();
    throw error;
  }

  const spoken = await pg.query<{ version: string }>("SELECT version()");

  return {
    version: shorten(spoken.rows[0]?.version ?? "PostgreSQL"),

    async execute(sql: string): Promise<Outcome> {
      const notices: string[] = [];
      const results = await pg.exec(sql, { rowMode: "array", onNotice: (notice) => notices.push(writeNotice(notice)) });
      const last = results.at(-1);
      const command = last?.command ?? null;

      return {
        columns: last?.fields.map((field) => field.name) ?? [],
        rows: (last?.rows ?? []) as unknown as Cell[][],
        command,
        affected: command && WRITES.has(command) ? last?.rowCount ?? null : null,
        notices,
      };
    },

    async inspect(): Promise<Schema[]> {
      const [schemas, relations, columns, indexes, constraints] = await Promise.all([
        pg.query<SchemaRow>(SCHEMAS),
        pg.query<RelationRow>(RELATIONS),
        pg.query<ColumnRow>(COLUMNS),
        pg.query<IndexRow>(INDEXES),
        pg.query<ConstraintRow>(CONSTRAINTS),
      ]);

      const columnsOf = collect(columns.rows);
      const indexesOf = collect(indexes.rows);
      const constraintsOf = collect(constraints.rows);

      return schemas.rows.map((schema) => ({
        name: schema.name,
        relations: relations.rows
          .filter((relation) => relation.schema === schema.name)
          .map((relation): Relation => {
            const at = `${relation.schema}.${relation.name}`;
            return {
              name: relation.name,
              kind: RELATION_KINDS[relation.kind] ?? relation.kind,
              definition: relation.definition,
              columns: (columnsOf.get(at) ?? []).map(readColumn),
              indexes: (indexesOf.get(at) ?? []).map(readIndex),
              constraints: (constraintsOf.get(at) ?? []).map(readConstraint),
            };
          }),
      }));
    },

    async close(): Promise<void> {
      await pg.close();
    },
  };
}

const WRITES = new Set(["INSERT", "UPDATE", "DELETE", "MERGE", "COPY"]);

function shorten(version: string): string {
  return /^(PostgreSQL [^\s]+)/.exec(version)?.[1] ?? version;
}

function writeNotice(notice: Notice): string {
  const lines = [`${notice.severity ?? "NOTICE"}: ${notice.message ?? ""}`];
  if (notice.detail) lines.push(`DETAIL: ${notice.detail}`);
  if (notice.hint) lines.push(`HINT: ${notice.hint}`);
  return lines.join(" — ");
}

interface Notice {
  severity?: string;
  message?: string;
  detail?: string;
  hint?: string;
}

const RELATION_KINDS: Record<string, string> = {
  r: "table",
  p: "partitioned table",
  v: "view",
  m: "materialized view",
  f: "foreign table",
};

const CONSTRAINT_KINDS: Record<string, string> = {
  p: "PRIMARY KEY",
  f: "FOREIGN KEY",
  u: "UNIQUE",
  c: "CHECK",
  x: "EXCLUDE",
  t: "TRIGGER",
};

function collect<T extends { schema: string; relation: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const at = `${row.schema}.${row.relation}`;
    const group = groups.get(at);
    if (group) group.push(row);
    else groups.set(at, [row]);
  }
  return groups;
}

function readColumn(row: ColumnRow): Column {
  return {
    name: row.name,
    type: row.type,
    notNull: row.not_null,
    primaryKey: row.primary_key,
    fallback: row.fallback,
  };
}

function readIndex(row: IndexRow): Index {
  return {
    name: row.name,
    unique: row.is_unique,
    primary: row.is_primary,
    columns: row.columns ?? [],
  };
}

function readConstraint(row: ConstraintRow): Constraint {
  return {
    name: row.name,
    kind: CONSTRAINT_KINDS[row.kind] ?? row.kind,
    detail: row.definition.replace(/^(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|EXCLUDE)\s*/i, ""),
  };
}

interface SchemaRow {
  name: string;
}

interface RelationRow {
  schema: string;
  name: string;
  kind: string;
  definition: string | null;
}

interface ColumnRow {
  schema: string;
  relation: string;
  name: string;
  type: string;
  not_null: boolean;
  primary_key: boolean;
  fallback: string | null;
}

interface IndexRow {
  schema: string;
  relation: string;
  name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[] | null;
}

interface ConstraintRow {
  schema: string;
  relation: string;
  name: string;
  kind: string;
  definition: string;
}

function visible(alias: string): string {
  return `${alias}.nspname NOT LIKE 'pg\\_%' AND ${alias}.nspname <> 'information_schema'`;
}

const SCHEMAS = `SELECT n.nspname AS name FROM pg_namespace n WHERE ${visible("n")} ORDER BY n.nspname`;

const RELATIONS = `
  SELECT n.nspname AS schema,
         c.relname AS name,
         c.relkind AS kind,
         CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) END AS definition
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f') AND ${visible("n")}
  ORDER BY n.nspname, c.relkind, c.relname`;

const COLUMNS = `
  SELECT n.nspname AS schema,
         c.relname AS relation,
         a.attname AS name,
         format_type(a.atttypid, a.atttypmod) AS type,
         a.attnotnull AS not_null,
         EXISTS (
           SELECT 1 FROM pg_constraint k
           WHERE k.conrelid = c.oid AND k.contype = 'p' AND a.attnum = ANY (k.conkey)
         ) AS primary_key,
         pg_get_expr(d.adbin, d.adrelid) AS fallback
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND ${visible("n")}
  ORDER BY n.nspname, c.relname, a.attnum`;

const INDEXES = `
  SELECT n.nspname AS schema,
         c.relname AS relation,
         i.relname AS name,
         x.indisunique AS is_unique,
         x.indisprimary AS is_primary,
         (
           SELECT array_agg(pg_get_indexdef(x.indexrelid, k.i::int, true) ORDER BY k.i)
           FROM generate_series(1, x.indnkeyatts) AS k(i)
         ) AS columns
  FROM pg_index x
  JOIN pg_class c ON c.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE ${visible("n")}
  ORDER BY n.nspname, c.relname, i.relname`;

const CONSTRAINTS = `
  SELECT n.nspname AS schema,
         c.relname AS relation,
         con.conname AS name,
         con.contype AS kind,
         pg_get_constraintdef(con.oid, true) AS definition
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE ${visible("n")}
  ORDER BY n.nspname, c.relname, con.contype, con.conname`;
