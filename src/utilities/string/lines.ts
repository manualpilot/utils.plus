import { graphemes } from "../../common/graphemes";
import { shuffle } from "../../common/random";

export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

export function mapLines(text: string, fn: (line: string) => string): string {
  return splitLines(text).map(fn).join("\n");
}

export function withLines(text: string, fn: (lines: string[]) => string[]): string {
  const lines = splitLines(text);
  const trailing = lines.length > 1 && lines[lines.length - 1] === "";
  if (trailing) lines.pop();
  return fn(lines).join("\n") + (trailing ? "\n" : "");
}

export function sortLines(text: string, variant: string): string {
  return withLines(text, (lines) => {
    const sorted = [...lines];
    if (variant === "length") sorted.sort((a, b) => a.length - b.length || ALPHABETICAL.compare(a, b));
    else sorted.sort(variant === "natural" ? NATURAL.compare : ALPHABETICAL.compare);
    if (variant === "descending") sorted.reverse();
    return sorted;
  });
}

export function dedupeLines(text: string, variant: string): string {
  return withLines(text, (lines) => {
    const key = (line: string) => variant === "insensitive" ? line.toLowerCase() : line;
    if (variant === "unique") {
      const tally = new Map<string, number>();
      for (const line of lines) tally.set(key(line), (tally.get(key(line)) ?? 0) + 1);
      return lines.filter((line) => tally.get(key(line)) === 1);
    }
    const seen = new Set<string>();
    return lines.filter((line) => {
      const seenKey = key(line);
      if (seen.has(seenKey)) return false;
      seen.add(seenKey);
      return true;
    });
  });
}

export function reverseLines(text: string, variant: string): string {
  if (variant === "characters") return mapLines(text, (line) => graphemes(line).reverse().join(""));
  return withLines(text, (lines) => [...lines].reverse());
}

export function shuffleLines(text: string): string {
  return withLines(text, (lines) => {
    const shuffled = [...lines];
    shuffle(shuffled);
    return shuffled;
  });
}

const ALPHABETICAL = new Intl.Collator("en", { sensitivity: "variant" });
const NATURAL = new Intl.Collator("en", { numeric: true, sensitivity: "variant" });
