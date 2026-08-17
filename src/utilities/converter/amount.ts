const SIGNIFICANT_DIGITS = 12;

export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
}
