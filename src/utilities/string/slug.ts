import { mapLines } from "./lines";

export function slugify(text: string, variant: string): string {
  const separator = variant === "underscore" ? "_" : "-";
  return mapLines(text, (line) => {
    const spelled = [...line.toLowerCase()].map((character) => SPELLED[character] ?? character).join("");
    return spelled
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .replaceAll("-", separator);
  });
}

const SPELLED: Record<string, string> = {
  "ß": "ss",
  "æ": "ae",
  "œ": "oe",
  "ø": "o",
  "đ": "d",
  "ð": "d",
  "þ": "th",
  "ł": "l",
  "ı": "i",
};
