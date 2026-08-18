import type { MarkedOptions } from "marked";

export const FLAVOURS = [
  { value: "gfm", label: "GitHub Flavored", options: { gfm: true, breaks: false, pedantic: false } },
  { value: "gfm-breaks", label: "GitHub Flavored, Hard Breaks", options: { gfm: true, breaks: true, pedantic: false } },
  { value: "commonmark", label: "CommonMark", options: { gfm: false, breaks: false, pedantic: false } },
  { value: "original", label: "Original Markdown", options: { gfm: false, breaks: false, pedantic: true } },
] as const satisfies readonly Flavour[];

export const DEFAULT_FLAVOUR: FlavourId = "gfm";

export const FLAVOUR_OPTIONS = FLAVOURS.map(({ value, label }) => ({ value, label }));

export type FlavourId = typeof FLAVOURS[number]["value"];

interface Flavour {
  value: string;
  label: string;
  options: MarkedOptions;
}

export function isFlavour(value: string | null | undefined): value is FlavourId {
  return FLAVOURS.some((flavour) => flavour.value === value);
}

export function flavourOptions(flavour: FlavourId): MarkedOptions {
  return (FLAVOURS.find((entry) => entry.value === flavour) ?? FLAVOURS[0]).options;
}
