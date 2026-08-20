export type Cell = unknown;

const MAX_CELL = 2000;

export const MAX_ROWS = 1000;

export function writeCell(value: Cell): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return clip(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return writeBytes(value);
  if (value instanceof ArrayBuffer) return writeBytes(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return writeBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));

  try {
    return clip(JSON.stringify(value) ?? String(value));
  } catch {
    return String(value);
  }
}

export function isNull(value: Cell): boolean {
  return value === null || value === undefined;
}

function writeBytes(bytes: Uint8Array): string {
  const shown = bytes.subarray(0, MAX_BLOB);
  let hex = "";
  for (const byte of shown) hex += byte.toString(16).padStart(2, "0");
  return bytes.length > MAX_BLOB ? `x'${hex}…' (${bytes.length} bytes)` : `x'${hex}'`;
}

function clip(text: string): string {
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL)}…` : text;
}

const MAX_BLOB = 64;
