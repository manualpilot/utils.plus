import { delimiterLabel } from "./delimiters";
import type { CsvTable } from "./parse";
import { MAX_ROWS } from "./rows";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export const FILE_TOO_BIG = `That file is larger than ${
  MAX_FILE_BYTES / (1024 * 1024)
} MB, which is more than the editor will hold.`;

export const READ_FAILED = "The browser could not read that file.";

export const UNTERMINATED_QUOTE = "A quote is left open, so the rest of the document is one field.";

export function summarise(table: CsvTable, rows: number): string {
  const columns = table.columns.length;
  if (columns === 0) return "Nothing to read yet.";
  return `${count(rows, "row")}, ${count(columns, "column")}, split on ${
    delimiterLabel(table.delimiter).toLowerCase()
  }.`;
}

export function raggedWarning(ragged: number): string {
  return `${count(ragged, "row")} ${ragged === 1 ? "is" : "are"} not as wide as the widest one.`;
}

export function truncatedMessage(rows: number): string {
  return `Showing the first ${MAX_ROWS.toLocaleString()} of ${rows.toLocaleString()} rows.`;
}

function count(many: number, noun: string): string {
  return `${many.toLocaleString()} ${noun}${many === 1 ? "" : "s"}`;
}
