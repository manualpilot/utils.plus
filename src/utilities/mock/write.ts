import type { JsonValue } from "../../common/schema/ir";

export type FormatId = "json" | "ndjson" | "csv" | "sql";

export interface Format {
  id: FormatId;
  label: string;
  extension: string;
  mime: string;
  write: (rows: JsonValue[], name: string) => string;
}

export const FORMATS: Record<FormatId, Format> = {
  json: {
    id: "json",
    label: "JSON",
    extension: "json",
    mime: "application/json",
    write: (rows) => `${JSON.stringify(rows, null, 2)}\n`,
  },
  ndjson: {
    id: "ndjson",
    label: "NDJSON",
    extension: "ndjson",
    mime: "application/x-ndjson",
    write: (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
  },
  csv: {
    id: "csv",
    label: "CSV",
    extension: "csv",
    mime: "text/csv",
    write: writeCsv,
  },
  sql: {
    id: "sql",
    label: "SQL",
    extension: "sql",
    mime: "application/sql",
    write: writeSql,
  },
};

export const FORMAT_OPTIONS = Object.values(FORMATS).map(({ id, label }) => ({ value: id, label }));

export function isFormat(value: string | null | undefined): value is FormatId {
  return value === "json" || value === "ndjson" || value === "csv" || value === "sql";
}

function writeCsv(rows: JsonValue[], name: string): string {
  const flat = rows.map((row) => flatten(row, name, "."));
  const columns = columnsOf(flat);
  const header = columns.map(quoteCsv).join(",");
  const body = flat.map((row) => columns.map((column) => quoteCsv(csvCell(row[column]))).join(","));
  return [header, ...body].join("\r\n") + "\r\n";
}

function writeSql(rows: JsonValue[], name: string): string {
  const table = identifier(name);
  const flat = rows.map((row) => flatten(row, name, "_"));
  const columns = columnsOf(flat);
  if (columns.length === 0) return "";

  const names = columns.map(identifier).join(", ");
  const statements = flat.map((row) =>
    `INSERT INTO ${table} (${names}) VALUES (${columns.map((column) => sqlLiteral(row[column])).join(", ")});`
  );
  return statements.join("\n") + "\n";
}

function columnsOf(rows: Record<string, JsonValue | undefined>[]): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns;
}

function flatten(row: JsonValue, name: string, separator: string): Record<string, JsonValue> {
  if (typeof row !== "object" || row === null || Array.isArray(row)) return { [identifierFor(name)]: row };

  const out: Record<string, JsonValue> = {};
  const walk = (value: JsonValue, prefix: string) => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        out[prefix] = {};
        return;
      }
      for (const key of keys) walk(value[key], prefix ? `${prefix}${separator}${key}` : key);
      return;
    }
    out[prefix] = value;
  };

  walk(row, "");
  return out;
}

function csvCell(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function quoteCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

function sqlLiteral(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const text = typeof value === "object" ? JSON.stringify(value) : value;
  return `'${text.replace(/'/g, "''")}'`;
}

function identifier(name: string): string {
  return `"${identifierFor(name).replace(/"/g, "\"\"")}"`;
}

function identifierFor(name: string): string {
  const snake = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_.]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return snake || "records";
}
