import adjectiveList from "../../../inline/top_english_adjs_lower_10000.json";
import nounList from "../../../inline/top_english_nouns_lower_10000.json";
import verbList from "../../../inline/top_english_verbs_lower_10000.json";
import { composition } from "../../common/composition";
import { randomBelow, shuffle } from "../../common/random";

export type WeightKey = "nouns" | "verbs" | "adjectives";
export type Weights = Record<WeightKey, number>;
export type Casing = keyof typeof CASINGS;
export type Separator = keyof typeof SEPARATORS;

export const WEIGHT_KEYS: WeightKey[] = ["nouns", "verbs", "adjectives"];

export const MAX_WORDS = 128;
export const DEFAULT_WORDS = 8;

export const WORDS: Record<WeightKey, { label: string; list: string[] }> = {
  nouns: { label: "Nouns", list: usable(nounList) },
  verbs: { label: "Verbs", list: usable(verbList) },
  adjectives: { label: "Adjectives", list: usable(adjectiveList) },
};

function usable(list: string[]): string[] {
  return list.filter((word) => /^[a-z]{3,}$/.test(word));
}

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

export function generatePassphrase(words: number, weights: Weights, casing: Casing, separator: Separator): string {
  const counts = composition(words, weights);
  const picked: string[] = [];

  for (const key of WEIGHT_KEYS) {
    const { list } = WORDS[key];
    for (let i = 0; i < counts[key]; i++) {
      picked.push(CASINGS[casing].apply(list[randomBelow(list.length)]));
    }
  }

  shuffle(picked);
  return picked.join(SEPARATORS[separator].character);
}

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

export function clampWeight(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function pickKey<T extends object>(options: T, value: unknown, fallback: keyof T): keyof T {
  return typeof value === "string" && value in options ? (value as keyof T) : fallback;
}
