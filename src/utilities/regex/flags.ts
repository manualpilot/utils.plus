export interface FlagInfo {
  letter: string;
  label: string;
  description: string;
}

export const FLAGS: FlagInfo[] = [
  { letter: "g", label: "global", description: "Find every match rather than stopping at the first one." },
  { letter: "i", label: "ignore case", description: "Treat upper and lower case as the same letter." },
  { letter: "m", label: "multiline", description: "^ and $ match at every line break, not only at the ends." },
  { letter: "s", label: "dot all", description: ". matches a line break as well as everything else." },
  { letter: "u", label: "unicode", description: "Read the pattern by code point, with \\p{…} and \\u{…} available." },
  { letter: "v", label: "unicode sets", description: "Unicode, plus set notation in classes: [\\p{L}--[a-f]]." },
  { letter: "y", label: "sticky", description: "Match only where the last one ended, never searching forward." },
  { letter: "d", label: "indices", description: "Record where each group started and ended on the match." },
];

export function normaliseFlags(value: string | undefined): string {
  if (!value) return "";

  const chosen = new Set(value);
  if (chosen.has("v")) chosen.delete("u");

  return FLAGS.filter((flag) => chosen.has(flag.letter)).map((flag) => flag.letter).join("");
}

export function chooseFlags(previous: string, next: string[]): string {
  const added = next.find((letter) => !previous.includes(letter));
  const exclusive = added === "u" ? "v" : added === "v" ? "u" : null;
  return normaliseFlags(next.filter((letter) => letter !== exclusive).join(""));
}
