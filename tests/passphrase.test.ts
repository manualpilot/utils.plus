import { describe, expect, it } from "vitest";
import { generatePassphrase, type Weights, WORDS } from "../src/utilities/passphrase/generate";

const mix = (nouns: number, verbs: number, adjectives: number): Weights => ({ nouns, verbs, adjectives });

const exclusive = (key: keyof typeof WORDS) => {
  const others = new Set(
    (Object.keys(WORDS) as (keyof typeof WORDS)[])
      .filter((other) => other !== key)
      .flatMap((other) => WORDS[other].list),
  );
  return new Set(WORDS[key].list.filter((word) => !others.has(word)));
};

describe("word lists", () => {
  it("keeps the initials, abbreviations and symbols out", () => {
    for (const { list } of Object.values(WORDS)) {
      expect(list.length).toBeGreaterThan(5000);
      expect(list.every((word) => /^[a-z]{3,}$/.test(word))).toBe(true);
    }
  });
});

describe("generatePassphrase", () => {
  it("produces the requested number of words", () => {
    for (const words of [1, 2, 5, 13, 64]) {
      expect(generatePassphrase(words, mix(40, 20, 40), "lower", "space").split(" ")).toHaveLength(words);
    }
  });

  it("joins the words with the chosen separator", () => {
    expect(generatePassphrase(4, mix(40, 20, 40), "lower", "dash")).toMatch(/^[a-z]+(-[a-z]+){3}$/);
    expect(generatePassphrase(4, mix(40, 20, 40), "lower", "underscore")).toMatch(/^[a-z]+(_[a-z]+){3}$/);
    expect(generatePassphrase(4, mix(40, 20, 40), "lower", "pipe")).toMatch(/^[a-z]+(\|[a-z]+){3}$/);
    expect(generatePassphrase(4, mix(40, 20, 40), "lower", "plus")).toMatch(/^[a-z]+(\+[a-z]+){3}$/);
    expect(generatePassphrase(4, mix(40, 20, 40), "lower", "backslash")).toMatch(/^[a-z]+(\\[a-z]+){3}$/);
    expect(generatePassphrase(4, mix(40, 20, 40), "lower", "slash")).toMatch(/^[a-z]+(\/[a-z]+){3}$/);
  });

  it("applies the chosen casing", () => {
    expect(generatePassphrase(6, mix(40, 20, 40), "lower", "dash")).toMatch(/^[a-z-]+$/);
    expect(generatePassphrase(6, mix(40, 20, 40), "upper", "dash")).toMatch(/^[A-Z-]+$/);
    expect(generatePassphrase(6, mix(40, 20, 40), "capital", "dash")).toMatch(/^([A-Z][a-z]+)(-[A-Z][a-z]+){5}$/);
  });

  it("draws each word from the list its share asked for", () => {
    for (const key of ["nouns", "verbs", "adjectives"] as const) {
      const only = new Set(WORDS[key].list);
      const weights = mix(key === "nouns" ? 100 : 0, key === "verbs" ? 100 : 0, key === "adjectives" ? 100 : 0);
      for (const word of generatePassphrase(50, weights, "lower", "space").split(" ")) {
        expect(only.has(word)).toBe(true);
      }
    }
  });

  it("returns nothing when every share is at zero", () => {
    expect(generatePassphrase(5, mix(0, 0, 0), "lower", "space")).toBe("");
  });

  it("shuffles, rather than laying the parts of speech out in order", () => {
    const verbsOnly = exclusive("verbs");
    const passphrases = Array.from({ length: 200 }, () => generatePassphrase(2, mix(50, 50, 0), "lower", "space"));
    expect(passphrases.some((passphrase) => verbsOnly.has(passphrase.split(" ")[0]))).toBe(true);
    expect(new Set(passphrases).size).toBeGreaterThan(150);
  });
});
