export const PAPERS = ["white", "dark"] as const;

export type PaperId = typeof PAPERS[number];

export const DEFAULT_PAPER: PaperId = "dark";

export function isPaper(value: unknown): value is PaperId {
  return PAPERS.some((paper) => paper === value);
}
