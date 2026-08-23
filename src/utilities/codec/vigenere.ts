import type { Mode } from "./formats";

const UPPERCASE = 65;
const LOWERCASE = 97;

export function vigenere(text: string, variant: string, key: string, mode: Mode): string {
  const stream = keyStream(key);
  let index = 0;
  let out = "";

  for (const char of text) {
    const base = char >= "A" && char <= "Z" ? UPPERCASE : char >= "a" && char <= "z" ? LOWERCASE : 0;
    if (base === 0) {
      out += char;
      continue;
    }
    const value = char.charCodeAt(0) - base;
    const shift = stream[index % stream.length];
    index++;
    const result = variant === "beaufort"
      ? (shift - value + 26) % 26
      : mode === "encode"
      ? (value + shift) % 26
      : (value - shift + 26) % 26;
    if (variant === "autokey") stream.push(mode === "encode" ? value : result);
    out += String.fromCharCode(base + result);
  }
  return out;
}

function keyStream(key: string): number[] {
  const letters = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (letters === "") throw new Error("The Vigenère key must contain at least one letter");
  return Array.from(letters, (char) => char.charCodeAt(0) - UPPERCASE);
}
