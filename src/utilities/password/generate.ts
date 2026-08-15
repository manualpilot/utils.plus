import { composition } from "../../common/composition";
import { randomBelow, shuffle } from "../../common/random";

export type WeightKey = "lowercase" | "uppercase" | "numbers" | "symbols";
export type Weights = Record<WeightKey, number>;

export const WEIGHT_KEYS: WeightKey[] = ["lowercase", "uppercase", "numbers", "symbols"];

export const MAX_LENGTH = 1024;
export const DEFAULT_LENGTH = 20;

const ALPHABETS: Record<WeightKey, string> = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!#$%&()*+,-./:;<=>?@[]^_{|}~",
};

export function generatePassword(length: number, weights: Weights): string {
  const counts = composition(length, weights);
  const chars: string[] = [];

  for (const key of WEIGHT_KEYS) {
    const alphabet = ALPHABETS[key];
    for (let i = 0; i < counts[key]; i++) {
      chars.push(alphabet[randomBelow(alphabet.length)]);
    }
  }

  shuffle(chars);
  return chars.join("");
}

export function parseLength(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= MAX_LENGTH ? rounded : null;
}

export function clampLength(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LENGTH;
  return Math.min(MAX_LENGTH, Math.max(1, Math.floor(value)));
}

export function clampWeight(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}
