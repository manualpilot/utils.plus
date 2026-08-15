import { splitWords } from "./text";

export function encodeMorse(text: string, variant: string): string {
  const encoded = splitWords(text)
    .map((word) =>
      Array.from(word, (char) => {
        const code = MORSE_CODES[char.toUpperCase()];
        if (code === undefined) throw new Error(`"${char}" has no Morse code`);
        return code;
      }).join(" ")
    )
    .join(variant === "spaces" ? "   " : " / ");
  return variant === "symbols" ? encoded.replace(/\./g, "·").replace(/-/g, "−") : encoded;
}

export function decodeMorse(text: string): string {
  const normalized = text.replace(/[·•∙]/g, ".").replace(/[–—−_]/g, "-");
  const words = normalized
    .split(/\s*\/+\s*|\s{2,}|\n/)
    .map((word) =>
      splitWords(word)
        .map((code) => {
          const char = MORSE_LOOKUP.get(code);
          if (char === undefined) throw new Error(`"${code}" is not a Morse code sequence`);
          return char;
        })
        .join("")
    );
  return words.filter((word) => word !== "").join(" ");
}

const MORSE_CODES: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  ":": "---...",
  ";": "-.-.-.",
  "?": "..--..",
  "!": "-.-.--",
  "'": ".----.",
  "\"": ".-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  "_": "..--.-",
  "/": "-..-.",
  "@": ".--.-.",
  "$": "...-..-",
};

const MORSE_LOOKUP = new Map(Object.entries(MORSE_CODES).map(([char, code]) => [code, char]));
