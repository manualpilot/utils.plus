export type Mode = keyof typeof MODES;

export const MODES = {
  password: {
    label: "Password",
    title: "Generate Password",
    shares: "The shares are relative to each other and are scaled to fill the length, so a mix of 50/50/0/0 and one "
      + "of 100/100/0/0 produce the same password. A type left at 0% is kept out entirely.",
    empty: "Raise at least one share above 0% to have something to build a password from.",
  },
  passphrase: {
    label: "Passphrase",
    title: "Generate Passphrase",
    shares: "The shares are relative to each other and are scaled to fill the word count, so a mix of 50/50/0 and one "
      + "of 100/100/0 produce the same passphrase. A part of speech left at 0% is kept out entirely.",
    empty: "Raise at least one share above 0% to have something to build a passphrase from.",
  },
};

export const MODE_OPTIONS = Object.entries(MODES).map(([value, { label }]) => ({ value, label }));

export function clampWeight(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function pickKey<T extends object>(options: T, value: unknown, fallback: keyof T): keyof T {
  return typeof value === "string" && value in options ? (value as keyof T) : fallback;
}

export function countWidth(max: number): string {
  return `calc(${String(max).length + 1}ch + var(--input-padding-inline-start) + var(--input-padding-inline-end)
      + 0.125rem * var(--mantine-scale))`;
}
