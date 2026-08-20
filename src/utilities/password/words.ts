export type WordKey = "nouns" | "verbs" | "adjectives";
export type WordWeights = Record<WordKey, number>;
export type Casing = keyof typeof CASINGS;
export type Separator = keyof typeof SEPARATORS;

export type PassphraseBuilder = (
  words: number,
  weights: WordWeights,
  casing: Casing,
  separator: Separator,
) => string;

export const WORD_KEYS: WordKey[] = ["nouns", "verbs", "adjectives"];

export const MAX_WORDS = 128;
export const DEFAULT_WORDS = 8;

export const WORD_KINDS: Record<WordKey, string> = { nouns: "Nouns", verbs: "Verbs", adjectives: "Adjectives" };

export const CASINGS = {
  lower: { label: "lowercase", apply: (word: string) => word },
  upper: { label: "UPPERCASE", apply: (word: string) => word.toUpperCase() },
  capital: { label: "Capitalised", apply: (word: string) => word[0].toUpperCase() + word.slice(1) },
};

export const SEPARATORS = {
  space: { label: "Space", character: " " },
  dash: { label: "Dash", character: "-" },
  underscore: { label: "Underscore", character: "_" },
  pipe: { label: "Pipe", character: "|" },
  plus: { label: "Plus", character: "+" },
  backslash: { label: "Backslash", character: "\\" },
  slash: { label: "Forward slash", character: "/" },
};

export const CASING_OPTIONS = Object.entries(CASINGS).map(([value, { label }]) => ({ value, label }));
export const SEPARATOR_OPTIONS = Object.entries(SEPARATORS).map(([value, { label }]) => ({ value, label }));

export function parseWords(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= MAX_WORDS ? rounded : null;
}

export function clampWords(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_WORDS;
  return Math.min(MAX_WORDS, Math.max(1, Math.floor(value)));
}
