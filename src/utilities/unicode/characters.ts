import { valueAt } from "./table";
import abbreviations from "./tables/abbreviations.json";
import ages from "./tables/ages.json";
import blocks from "./tables/blocks.json";
import categories from "./tables/categories.json";
import confusables from "./tables/confusables.json";
import scripts from "./tables/scripts.json";

export interface Character {
  code: number;
  text: string;
  at: number;
  category: string;
  script: string;
  block: string;
  age: string;
  abbreviation: string;
  looksLike: string;
}

export function readCharacters(text: string): Character[] {
  const found: Character[] = [];
  let at = 0;
  for (const character of text) {
    found.push(readCharacter(character.codePointAt(0) ?? 0, at));
    at += character.length;
  }
  return found;
}

export function readCharacter(code: number, at = 0): Character {
  return {
    code,
    text: String.fromCodePoint(code),
    at,
    category: valueAt(categories, code),
    script: valueAt(scripts, code).replace(/_/g, " "),
    block: valueAt(blocks, code),
    age: valueAt(ages, code),
    abbreviation: ABBREVIATIONS[hex(code)] ?? "",
    looksLike: CONFUSABLES[hex(code)] ?? "",
  };
}

export function categoryName(category: string): string {
  return CATEGORY_NAMES[category] ?? category;
}

export function isInvisible({ category }: Character): boolean {
  return INVISIBLE_CATEGORIES.has(category);
}

export function placeholder(character: Character): string {
  return character.abbreviation || PLACEHOLDER;
}

export function codePoint(code: number): string {
  return `U+${hex(code)}`;
}

function hex(code: number): string {
  return code.toString(16).toUpperCase().padStart(4, "0");
}

const PLACEHOLDER = "▯";

const INVISIBLE_CATEGORIES = new Set(["Cc", "Cf", "Cn", "Co", "Cs", "Zl", "Zp", "Zs"]);

const CATEGORY_NAMES: Record<string, string> = {
  Lu: "Uppercase letter",
  Ll: "Lowercase letter",
  Lt: "Titlecase letter",
  Lm: "Modifier letter",
  Lo: "Other letter",
  Mn: "Non-spacing mark",
  Mc: "Spacing combining mark",
  Me: "Enclosing mark",
  Nd: "Decimal digit",
  Nl: "Letter number",
  No: "Other number",
  Pc: "Connector punctuation",
  Pd: "Dash punctuation",
  Ps: "Opening punctuation",
  Pe: "Closing punctuation",
  Pi: "Initial quotation",
  Pf: "Final quotation",
  Po: "Other punctuation",
  Sm: "Maths symbol",
  Sc: "Currency symbol",
  Sk: "Modifier symbol",
  So: "Other symbol",
  Zs: "Space separator",
  Zl: "Line separator",
  Zp: "Paragraph separator",
  Cc: "Control",
  Cf: "Format",
  Cs: "Surrogate",
  Co: "Private use",
  Cn: "Unassigned",
};

const ABBREVIATIONS: Record<string, string> = abbreviations;
const CONFUSABLES: Record<string, string> = confusables;
