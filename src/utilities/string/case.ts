import { mapLines } from "./lines";

export function toIdentifierCase(text: string, operation: string): string {
  return mapLines(text, (line) => {
    const parts = words(line);
    if (parts.length === 0) return "";
    switch (operation) {
      case "camel":
        return parts.map((word, index) => index === 0 ? word.toLowerCase() : capitalise(word)).join("");
      case "pascal":
        return parts.map(capitalise).join("");
      case "snake":
        return parts.join("_").toLowerCase();
      case "constant":
        return parts.join("_").toUpperCase();
      default:
        return parts.join("-").toLowerCase();
    }
  });
}

export function toTitleCase(text: string, variant: string): string {
  return mapLines(text, (line) => {
    const last = (line.match(TITLE_WORD) ?? []).length - 1;
    let index = 0;
    return line.replace(TITLE_WORD, (word) => {
      const position = index++;
      const lower = word.toLowerCase();
      if (variant === "headline" && position !== 0 && position !== last && MINOR.has(lower)) return lower;
      return capitalise(lower);
    });
  });
}

export function toSentenceCase(text: string): string {
  return mapLines(
    text,
    (line) => line.toLowerCase().replace(SENTENCE_START, (_, lead, letter) => lead + letter.toUpperCase()),
  );
}

const WORD = /\p{Lu}+(?![\p{Ll}\p{M}])|\p{Lu}?[\p{Ll}\p{M}]+|\p{N}+|[\p{L}\p{M}]+/gu;

function words(line: string): string[] {
  return line.match(WORD) ?? [];
}

const TITLE_WORD = /[\p{L}\p{M}\p{N}'’]+/gu;

const SENTENCE_START = /(^[^\p{L}]*|[.!?…]["'’)\]]*\s+)(\p{L})/gu;

const MINOR = new Set(
  [
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "if",
    "in",
    "nor",
    "of",
    "on",
    "or",
    "per",
    "so",
    "the",
    "to",
    "up",
    "via",
    "vs",
    "yet",
  ],
);

function capitalise(word: string): string {
  const first = String.fromCodePoint(word.codePointAt(0) ?? 0);
  return first.toUpperCase() + word.slice(first.length).toLowerCase();
}
