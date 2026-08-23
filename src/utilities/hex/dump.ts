import type { TextEncoding } from "./encodings";

export const PER_ROW_OPTIONS = [8, 16, 24, 32];

export const GROUP = 8;

export function columnOf(index: number): number {
  return index * 3 + Math.floor(index / GROUP);
}

export function lineWidth(perRow: number): number {
  return columnOf(perRow - 1) + 2;
}

export function rowCount(size: number, perRow: number): number {
  return Math.ceil(size / perRow);
}

export interface Spot {
  index: number;
  nibble: number;
}

export function spotAt(column: number, perRow: number): Spot {
  let index = 0;
  while (index + 1 < perRow && columnOf(index + 1) <= column) index++;
  return { index, nibble: column === columnOf(index) + 1 ? 1 : 0 };
}

export function rowText(bytes: Uint8Array, row: number, perRow: number, upper: boolean): string {
  const table = upper ? UPPER : LOWER;
  const from = row * perRow;
  const parts: string[] = [];
  for (let index = 0; index < perRow; index++) {
    if (index > 0) parts.push(index % GROUP === 0 ? "  " : " ");
    const at = from + index;
    parts.push(at < bytes.length ? table[bytes[at]] : "  ");
  }
  return parts.join("");
}

export function dumpLines(bytes: Uint8Array, perRow: number, upper: boolean): string[] {
  const rows = rowCount(bytes.length, perRow);
  const lines: string[] = new Array(rows);
  for (let row = 0; row < rows; row++) lines[row] = rowText(bytes, row, perRow, upper);
  return rows === 0 ? [""] : lines;
}

export function rowGlyphs(bytes: Uint8Array, row: number, perRow: number, encoding: TextEncoding): string {
  const from = row * perRow;
  let line = "";
  for (let index = 0; index < perRow; index++) {
    const at = from + index;
    line += at < bytes.length ? encoding.glyph(bytes[at]) ?? "." : " ";
  }
  return line;
}

export function offsetDigits(size: number, base: number): number {
  const largest = Math.max(0, size - 1).toString(base).length;
  return base === 16 ? Math.max(4, largest + (largest % 2)) : largest;
}

export function formatOffset(offset: number, base: number, digits: number, upper: boolean): string {
  const spelled = offset.toString(base).padStart(digits, "0");
  return upper ? spelled.toUpperCase() : spelled;
}

export function formatByte(value: number, upper: boolean): string {
  return (upper ? UPPER : LOWER)[value];
}

const LOWER = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"));

const UPPER = LOWER.map((pair) => pair.toUpperCase());
