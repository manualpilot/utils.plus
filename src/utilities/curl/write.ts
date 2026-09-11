import { bundledLetter, type Entry } from "./entries";
import { findLong } from "./options";
import { quoteCmd, quoteWord, type Shell } from "./shell";

const CONTINUATION: Record<Shell, string> = { bash: " \\\n  ", cmd: " ^\n  " };

const QUOTE: Record<Shell, Quote> = { bash: quoteWord, cmd: quoteCmd };

export function writeCurl(entries: Entry[], wrapped: boolean, shell: Shell = "bash"): string {
  return ["curl", ...writeWords(entries, QUOTE[shell])].join(wrapped ? CONTINUATION[shell] : " ");
}

function writeWords(entries: Entry[], quote: Quote): string[] {
  const words: string[] = [];
  let bundle: number | null = null;

  for (const entry of entries) {
    const letter = bundledLetter(entry);

    if (letter === null) {
      words.push(writeEntry(entry, quote));
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

function writeEntry(entry: Entry, quote: Quote): string {
  if (entry.kind === "unknown") return entry.flag;

  if (entry.kind === "url") {
    const value = quote(entry.value, entry.variables);
    return entry.flag ? `${entry.flag} ${value}` : value;
  }

  const spec = findLong(entry.name);
  if (spec?.value === "none") return entry.flag;

  return `${entry.flag} ${quote(entry.value, entry.variables)}`;
}

type Quote = (value: string, variables?: readonly string[]) => string;
