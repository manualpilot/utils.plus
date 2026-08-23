export const OPERATIONS = {
  camel: { label: "camelCase", group: "Case", variants: [], hint: "" },
  pascal: { label: "PascalCase", group: "Case", variants: [], hint: "" },
  snake: { label: "snake_case", group: "Case", variants: [], hint: "" },
  constant: { label: "CONSTANT_CASE", group: "Case", variants: [], hint: "" },
  kebab: { label: "kebab-case", group: "Case", variants: [], hint: "" },
  title: {
    label: "Title Case",
    group: "Case",
    variants: [
      { value: "every", label: "Every word" },
      { value: "headline", label: "Headline (short words lowercase)" },
    ],
    hint: "A headline keeps its first and last words",
  },
  sentence: { label: "Sentence case", group: "Case", variants: [], hint: "" },
  upper: { label: "UPPERCASE", group: "Case", variants: [], hint: "" },
  lower: { label: "lowercase", group: "Case", variants: [], hint: "" },
  slug: {
    label: "URL slug",
    group: "Case",
    variants: [
      { value: "hyphen", label: "Hyphens" },
      { value: "underscore", label: "Underscores" },
    ],
    hint: "Accents are dropped and the rest is joined",
  },
  sort: {
    label: "Sort lines",
    group: "Lines",
    variants: [
      { value: "ascending", label: "A to Z" },
      { value: "descending", label: "Z to A" },
      { value: "natural", label: "Natural (10 after 9)" },
      { value: "length", label: "Shortest first" },
    ],
    hint: "How two lines are compared",
  },
  dedupe: {
    label: "Remove duplicate lines",
    group: "Lines",
    variants: [
      { value: "first", label: "Keep the first of each" },
      { value: "insensitive", label: "Keep the first, ignoring case" },
      { value: "unique", label: "Keep only lines that appear once" },
    ],
    hint: "Which of the repeats is kept",
  },
  reverse: {
    label: "Reverse",
    group: "Lines",
    variants: [
      { value: "lines", label: "The order of the lines" },
      { value: "characters", label: "The characters in each line" },
    ],
    hint: "What the order is taken of",
  },
  shuffle: { label: "Shuffle lines", group: "Lines", variants: [], hint: "" },
  trim: {
    label: "Trim",
    group: "Whitespace",
    variants: [
      { value: "both", label: "Both ends of each line" },
      { value: "start", label: "The start of each line" },
      { value: "end", label: "The end of each line" },
    ],
    hint: "Which end the spaces come off",
  },
  collapse: {
    label: "Collapse",
    group: "Whitespace",
    variants: [
      { value: "spaces", label: "Runs of whitespace to one space" },
      { value: "blank", label: "Every blank line" },
      { value: "blank-one", label: "Runs of blank lines to one" },
    ],
    hint: "What is taken out",
  },
  wrap: {
    label: "Wrap",
    group: "Whitespace",
    variants: [
      { value: "words", label: "Never break a word" },
      { value: "anywhere", label: "Break a word past the column" },
    ],
    hint: "Each line keeps its own indent",
  },
  html: {
    label: "HTML entities",
    group: "Escaping",
    variants: [
      { value: "markup", label: "Escape & < > \" '" },
      { value: "all", label: "Escape those and everything above ASCII" },
      { value: "decode", label: "Read entities back" },
    ],
    hint: "A name nothing here knows is left as it is",
  },
  javascript: {
    label: "JavaScript string",
    group: "Escaping",
    variants: [
      { value: "escape", label: "Escape" },
      { value: "ascii", label: "Escape, non-ASCII as \\u" },
      { value: "unescape", label: "Unescape" },
    ],
    hint: "The body alone; the quotes are yours to write",
  },
  c: {
    label: "C string",
    group: "Escaping",
    variants: [
      { value: "escape", label: "Escape" },
      { value: "ascii", label: "Escape, non-ASCII as octal bytes" },
      { value: "unescape", label: "Unescape" },
    ],
    hint: "Octal, a hex escape running on past its byte",
  },
  shell: {
    label: "Shell word",
    group: "Escaping",
    variants: [
      { value: "single", label: "Single quotes" },
      { value: "double", label: "Double quotes" },
      { value: "unquote", label: "Unquote" },
    ],
    hint: "The quotes are the escaping, so they are written",
  },
  sql: {
    label: "SQL string",
    group: "Escaping",
    variants: [
      { value: "standard", label: "Standard, quotes doubled" },
      { value: "mysql", label: "MySQL backslash escapes" },
      { value: "unquote", label: "Unquote" },
    ],
    hint: "Doubling is standard; backslashes are MySQL's",
  },
} as const satisfies Record<string, OperationSpec>;

export type Operation = keyof typeof OPERATIONS;

export interface OperationSpec {
  label: string;
  group: string;
  variants: readonly { value: string; label: string }[];
  hint: string;
}

export const OPERATION_GROUPS = Object.entries(OPERATIONS).reduce<
  { group: string; items: { value: string; label: string }[] }[]
>(
  (groups, [value, spec]) => {
    const last = groups[groups.length - 1];
    if (last?.group === spec.group) last.items.push({ value, label: spec.label });
    else groups.push({ group: spec.group, items: [{ value, label: spec.label }] });
    return groups;
  },
  [],
);

export function isOperation(value: string | undefined | null): value is Operation {
  return value !== undefined && value !== null && value in OPERATIONS;
}

export function defaultVariant(operation: Operation): string {
  return OPERATIONS[operation].variants[0]?.value ?? "";
}

export function hasVariant(operation: Operation, variant: string): boolean {
  return OPERATIONS[operation].variants.some((item) => item.value === variant);
}

export function takesWidth(operation: Operation): boolean {
  return operation === "wrap";
}

export function isRandom(operation: Operation): boolean {
  return operation === "shuffle";
}

export const DEFAULT_WIDTH = "80";
