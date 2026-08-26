export type ConfigValue = null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };

export type ReadResult = { ok: true; value: ConfigValue } | { ok: false; error: ReadError };

export interface ReadError {
  message: string;
  line?: number;
  column?: number;
}

export type WriteResult = { ok: true; text: string; lost: string[] } | { ok: false; message: string };

export interface WriteOptions {
  indent: number;
}

export const readValue = (value: ConfigValue): ReadResult => ({ ok: true, value });

export const unreadable = (message: string, at?: { line: number; column: number }): ReadResult => ({
  ok: false,
  error: { message, ...at },
});

export const written = (text: string, lost: string[] = []): WriteResult => ({ ok: true, text, lost });

export const unwritable = (message: string): WriteResult => ({ ok: false, message });

export function isRecord(value: ConfigValue): value is { [key: string]: ConfigValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readScalar(text: string): ConfigValue {
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  return NUMERIC.test(text) && String(Number(text)) === text ? Number(text) : text;
}

export function writeScalar(value: ConfigValue): string {
  return value === null ? "null" : String(value);
}

export function ambiguousAsText(text: string): boolean {
  return readScalar(text) !== text;
}

export function describe(value: ConfigValue): string {
  if (Array.isArray(value)) return "a list";
  if (value === null) return "null";
  return typeof value === "string" ? "a single string" : `a single ${typeof value}`;
}

const NUMERIC = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
