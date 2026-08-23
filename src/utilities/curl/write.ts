import { bundledLetter, type Entry } from "./entries";
import { findLong } from "./options";
import { quoteWord } from "./shell";

const CONTINUATION = " \\\n  ";

export function writeCurl(entries: Entry[], wrapped: boolean): string {
  return ["curl", ...writeWords(entries)].join(wrapped ? CONTINUATION : " ");
}

function writeWords(entries: Entry[]): string[] {
  const words: string[] = [];
  let bundle: number | null = null;

  for (const entry of entries) {
    const letter = bundledLetter(entry);

    if (letter === null) {
      words.push(writeEntry(entry));
      bundle = null;
      continue;
    }

    if (bundle !== null) {
      words[bundle] += letter;
      continue;
    }

    bundle = words.length;
    words.push(`-${letter}`);
  }

  return words;
}

function writeEntry(entry: Entry): string {
  if (entry.kind === "unknown") return entry.flag;

  if (entry.kind === "url") {
    const value = quoteWord(entry.value);
    return entry.flag ? `${entry.flag} ${value}` : value;
  }

  const spec = findLong(entry.name);
  if (spec?.value === "none") return entry.flag;

  return `${entry.flag} ${quoteWord(entry.value)}`;
}
