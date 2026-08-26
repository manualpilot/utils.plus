export function parseWhole(value: number | string, max: number): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= max ? rounded : null;
}

export function clampWhole(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : "Key generation failed";
}
