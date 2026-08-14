import { describe, expect, it } from "vitest";
import { composition } from "../src/common/composition";

const mix = (lowercase: number, uppercase: number, numbers: number, symbols: number) => ({
  lowercase,
  uppercase,
  numbers,
  symbols,
});

const total = (counts: Record<string, number>) => Object.values(counts).reduce((sum, count) => sum + count, 0);

describe("composition", () => {
  it("splits the length by the shares", () => {
    expect(composition(20, mix(40, 30, 20, 10))).toEqual({ lowercase: 8, uppercase: 6, numbers: 4, symbols: 2 });
  });

  it("reads the shares as proportions, not absolute percentages", () => {
    expect(composition(12, mix(50, 50, 0, 0))).toEqual(composition(12, mix(100, 100, 0, 0)));
    expect(composition(12, mix(1, 1, 1, 1))).toEqual(composition(12, mix(25, 25, 25, 25)));
  });

  it("always adds up to the requested length", () => {
    for (const length of [1, 2, 3, 7, 13, 99, 1024]) {
      expect(total(composition(length, mix(40, 30, 20, 10)))).toBe(length);
      expect(total(composition(length, mix(1, 97, 1, 1)))).toBe(length);
    }
  });

  it("hands the rounding leftovers to the shares that were cut hardest", () => {
    expect(composition(10, mix(25, 25, 25, 25))).toEqual({ lowercase: 3, uppercase: 3, numbers: 2, symbols: 2 });
    expect(composition(13, mix(30, 30, 10, 30))).toEqual({ lowercase: 4, uppercase: 4, numbers: 1, symbols: 4 });
  });

  it("leaves a share at zero out however short the split is", () => {
    expect(composition(3, mix(50, 50, 0, 0))).toEqual({ lowercase: 2, uppercase: 1, numbers: 0, symbols: 0 });
    expect(composition(1, mix(1, 1, 1, 0)).symbols).toBe(0);
  });

  it("returns nothing when there is nothing to split", () => {
    expect(total(composition(20, mix(0, 0, 0, 0)))).toBe(0);
    expect(total(composition(0, mix(40, 30, 20, 10)))).toBe(0);
  });

  it("works over whatever keys the weights carry", () => {
    expect(composition(5, { nouns: 40, verbs: 20, adjectives: 40 })).toEqual({ nouns: 2, verbs: 1, adjectives: 2 });
    expect(composition(3, { a: 1 })).toEqual({ a: 3 });
  });
});
