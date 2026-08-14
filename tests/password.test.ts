import { describe, expect, it } from "vitest";
import { generatePassword, type Weights } from "../src/utilities/password";

const mix = (lowercase: number, uppercase: number, numbers: number, symbols: number): Weights => ({
  lowercase,
  uppercase,
  numbers,
  symbols,
});

const countOf = (password: string, pattern: RegExp) => (password.match(pattern) ?? []).length;

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
