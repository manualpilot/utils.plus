export const MAX_ROWS = 1000;

const MAX_CELL = 500;

export type SortDirection = "asc" | "desc";

export function sortRows(rows: string[][], at: number, direction: SortDirection): string[][] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((first, second) => sign * compareCells(first[at] ?? "", second[at] ?? ""));
}

export function compareCells(first: string, second: string): number {
  const left = Number(first);
  const right = Number(second);
  if (first !== "" && second !== "" && !Number.isNaN(left) && !Number.isNaN(right)) return left - right;
  return first.localeCompare(second);
}

export function cellText(row: string[], at: number): string {
  const value = row[at] ?? "";
  return value.length > MAX_CELL ? `${value.slice(0, MAX_CELL)}…` : value;
}
