import { describe, expect, it } from "vitest";
import { type CharacterWeights, generatePassword } from "../src/utilities/password/characters";
import { generatePassphrase, LISTS } from "../src/utilities/password/vocabulary";
import type { WordWeights } from "../src/utilities/password/words";

const mix = (lowercase: number, uppercase: number, numbers: number, symbols: number): CharacterWeights => ({
  lowercase,
  uppercase,
  numbers,
  symbols,
});

const words = (nouns: number, verbs: number, adjectives: number): WordWeights => ({ nouns, verbs, adjectives });

const countOf = (password: string, pattern: RegExp) => (password.match(pattern) ?? []).length;

const exclusive = (key: keyof typeof LISTS) => {
  const others = new Set(
    (Object.keys(LISTS) as (keyof typeof LISTS)[])
      .filter((other) => other !== key)
      .flatMap((other) => LISTS[other]),
  );
  return new Set(LISTS[key].filter((word) => !others.has(word)));
};

describe("generatePassword", () => {
  it("produces a password of the requested length", () => {
    expect(generatePassword(20, mix(40, 30, 20, 10))).toHaveLength(20);
    expect(generatePassword(1024, mix(25, 25, 25, 25))).toHaveLength(1024);
    expect(generatePassword(1, mix(0, 0, 100, 0))).toMatch(/^[0-9]$/);
  });

  it("matches the composition exactly", () => {
    const password = generatePassword(50, mix(40, 30, 20, 10));
    expect(countOf(password, /[a-z]/g)).toBe(20);
    expect(countOf(password, /[A-Z]/g)).toBe(15);
    expect(countOf(password, /[0-9]/g)).toBe(10);
    expect(countOf(password, /[^a-zA-Z0-9]/g)).toBe(5);
  });

  it("never uses a type that was left at zero", () => {
    expect(generatePassword(200, mix(50, 50, 0, 0))).toMatch(/^[a-zA-Z]+$/);
    expect(generatePassword(200, mix(0, 0, 0, 100))).not.toMatch(/[a-zA-Z0-9]/);
  });

  it("keeps quotes, backslashes and backticks out of the symbols", () => {
    expect(generatePassword(500, mix(0, 0, 0, 100))).not.toMatch(/["'`\\\s]/);
  });

  it("shuffles, rather than laying the types out in order", () => {
    const passwords = Array.from({ length: 20 }, () => generatePassword(20, mix(50, 0, 50, 0)));
    expect(passwords.some((password) => /[0-9].*[a-z]/.test(password))).toBe(true);
    expect(new Set(passwords).size).toBe(passwords.length);
  });
});

describe("word lists", () => {
  it("keeps the initials, abbreviations and symbols out", () => {
    for (const list of Object.values(LISTS)) {
      expect(list.length).toBeGreaterThan(5000);
      expect(list.every((word) => /^[a-z]{3,}$/.test(word))).toBe(true);
    }
  });
});

describe("generatePassphrase", () => {
  it("produces the requested number of words", () => {
    for (const count of [1, 2, 5, 13, 64]) {
      expect(generatePassphrase(count, words(40, 20, 40), "lower", "space").split(" ")).toHaveLength(count);
    }
  });

  it("joins the words with the chosen separator", () => {
    expect(generatePassphrase(4, words(40, 20, 40), "lower", "dash")).toMatch(/^[a-z]+(-[a-z]+){3}$/);
    expect(generatePassphrase(4, words(40, 20, 40), "lower", "underscore")).toMatch(/^[a-z]+(_[a-z]+){3}$/);
    expect(generatePassphrase(4, words(40, 20, 40), "lower", "pipe")).toMatch(/^[a-z]+(\|[a-z]+){3}$/);
    expect(generatePassphrase(4, words(40, 20, 40), "lower", "plus")).toMatch(/^[a-z]+(\+[a-z]+){3}$/);
    expect(generatePassphrase(4, words(40, 20, 40), "lower", "backslash")).toMatch(/^[a-z]+(\\[a-z]+){3}$/);
    expect(generatePassphrase(4, words(40, 20, 40), "lower", "slash")).toMatch(/^[a-z]+(\/[a-z]+){3}$/);
  });

  it("applies the chosen casing", () => {
    expect(generatePassphrase(6, words(40, 20, 40), "lower", "dash")).toMatch(/^[a-z-]+$/);
    expect(generatePassphrase(6, words(40, 20, 40), "upper", "dash")).toMatch(/^[A-Z-]+$/);
    expect(generatePassphrase(6, words(40, 20, 40), "capital", "dash")).toMatch(/^([A-Z][a-z]+)(-[A-Z][a-z]+){5}$/);
  });

  it("draws each word from the list its share asked for", () => {
    for (const key of ["nouns", "verbs", "adjectives"] as const) {
      const only = new Set(LISTS[key]);
      const weights = words(key === "nouns" ? 100 : 0, key === "verbs" ? 100 : 0, key === "adjectives" ? 100 : 0);
      for (const word of generatePassphrase(50, weights, "lower", "space").split(" ")) {
        expect(only.has(word)).toBe(true);
      }
    }
  });

  it("returns nothing when every share is at zero", () => {
    expect(generatePassphrase(5, words(0, 0, 0), "lower", "space")).toBe("");
  });

  it("shuffles, rather than laying the parts of speech out in order", () => {
    const verbsOnly = exclusive("verbs");
    const passphrases = Array.from({ length: 200 }, () => generatePassphrase(2, words(50, 50, 0), "lower", "space"));
    expect(passphrases.some((passphrase) => verbsOnly.has(passphrase.split(" ")[0]))).toBe(true);
    expect(new Set(passphrases).size).toBeGreaterThan(150);
  });
});
