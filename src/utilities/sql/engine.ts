import type { Cell } from "./cells";

export const MODES = [{ value: "sqlite", label: "SQLite" }, { value: "postgres", label: "PostgreSQL" }] as const;

export type ModeId = typeof MODES[number]["value"];

export function isMode(value: unknown): value is ModeId {
  return MODES.some((mode) => mode.value === value);
}

export const ENGINE_NAMES: Record<ModeId, string> = { sqlite: "SQLite", postgres: "PostgreSQL" };

export interface Engine {
  readonly version: string;
  execute(sql: string): Promise<Outcome>;
  inspect(): Promise<Schema[]>;
  close(): Promise<void>;
}

export interface Outcome {
  columns: string[];
  rows: Cell[][];
  command: string | null;
  affected: number | null;
  notices: string[];
}

export interface Schema {
  name: string;
  relations: Relation[];
}

export interface Relation {
  name: string;
  kind: string;
  columns: Column[];
  indexes: Index[];
  constraints: Constraint[];
  definition: string | null;
}

export interface Column {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  fallback: string | null;
}

export interface Index {
  name: string;
  unique: boolean;
  primary: boolean;
  columns: string[];
}

export interface Constraint {
  name: string;
  kind: string;
  detail: string;
}

export async function openDatabase(mode: ModeId): Promise<Engine> {
  const open = mode === "sqlite" ? (await import("./sqlite")).openSqlite : (await import("./postgres")).openPostgres;
  return open();
}

export function failureText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error);
}
