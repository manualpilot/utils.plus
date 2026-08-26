import { type Character, codePoint, isInvisible, readCharacter } from "./characters";
import { readPoints, writePoints } from "./points";
import type { Mode } from "./settings";
import { spansOf, valueAt } from "./table";
import blocks from "./tables/blocks.json";
import categories from "./tables/categories.json";
import emoji from "./tables/emoji.json";

export interface Key {
  text: string;
  label: string;
  name: string;
  code: number | null;
  invisible: boolean;
}

export interface Keys {
  keys: Key[];
  total: number;
  sifted: boolean;
}

export interface Section {
  name: string;
  groups: string[];
}

export interface Search {
  raw: string;
  text: string;
  code: number | null;
}

const SPANS = new Map(spansOf(blocks).filter(({ value }) => value !== "No Block").map((span) => [span.value, span]));

const EMOJI: Record<string, string[][]> = emoji;

export const EMOJI_GROUPS = Object.keys(EMOJI);
export const BLOCKS = [...SPANS.keys()];

export const SECTIONS: Section[] = [
  { name: "Emoji", groups: EMOJI_GROUPS },
  { name: "Blocks", groups: BLOCKS },
];

const NO_SEARCH: Search = { raw: "", text: "", code: null };

export const DEFAULT_GROUP = "Smileys & Emotion";

export const MAX_KEYS = 512;

export function isGroup(value: unknown): value is string {
  return typeof value === "string" && (value in EMOJI || SPANS.has(value));
}

export function keysOf(group: string, search: Search = NO_SEARCH): Keys {
  const sift = search.text !== "" && !group.toLowerCase().includes(search.text) ? search : NO_SEARCH;
  return group in EMOJI ? emojiKeys(group, sift) : blockKeys(group, sift);
}

function emojiKeys(group: string, search: Search): Keys {
  const found = (EMOJI[group] ?? []).filter(([text, name]) => search.text === "" || holds(text, name, search));
  return {
    keys: found.slice(0, MAX_KEYS).map(([text, name]) => ({
      text,
      label: text,
      name,
      code: [...text].length === 1 ? text.codePointAt(0) ?? null : null,
      invisible: false,
    })),
    total: found.length,
    sifted: search.text !== "",
  };
}

function blockKeys(block: string, search: Search): Keys {
  const span = SPANS.get(block);
  if (!span) return { keys: [], total: 0, sifted: false };

  const keys: Key[] = [];
  let total = 0;
  for (let code = span.start; code <= span.end; code++) {
    if (!isTypable(code)) continue;
    if (search.text !== "" && search.code !== code) continue;
    total++;
    if (keys.length < MAX_KEYS) keys.push(keyOf(readCharacter(code)));
  }
  return { keys, total, sifted: search.text !== "" };
}

export function keysLabel({ keys, total, sifted }: Keys): string {
  if (total > keys.length) return `${keys.length} of the ${total} ${sifted ? "that match" : "in it"}`;
  if (sifted) return `${total} match${total === 1 ? "" : "es"}`;
  return `${total} character${total === 1 ? "" : "s"}`;
}

export function filterSections(search: Search): Section[] {
  if (search.text === "") return SECTIONS;
  return SECTIONS
    .map(({ name, groups }) => ({
      name,
      groups: groups.filter((group) => group.toLowerCase().includes(search.text) || groupHolds(group, search)),
    }))
    .filter(({ groups }) => groups.length > 0);
}

export function readSearch(query: string): Search {
  const raw = query.trim();
  return { raw, text: raw.toLowerCase(), code: raw === "" ? null : codeOf(raw) };
}

function codeOf(query: string): number | null {
  const read = readPoints(query);
  const points = read.error === "" ? [...read.text] : [];
  const one = points.length === 1 ? points[0] : [...query].length === 1 ? query : "";
  return one === "" ? null : one.codePointAt(0) ?? null;
}

function groupHolds(group: string, search: Search): boolean {
  const found = EMOJI[group];
  if (found) return found.some(([text, name]) => holds(text, name, search));

  const span = SPANS.get(group);
  if (!span || search.code === null) return false;
  return search.code >= span.start && search.code <= span.end && isTypable(search.code);
}

function holds(text: string, name: string, search: Search): boolean {
  if (name.toLowerCase().includes(search.text)) return true;
  if (text.includes(search.raw)) return true;
  return search.code !== null && [...text].some((one) => one.codePointAt(0) === search.code);
}

function isTypable(code: number): boolean {
  const category = valueAt(categories, code);
  return category !== "Cn" && category !== "Cs";
}

function keyOf(character: Character): Key {
  return {
    text: character.text,
    label: keyLabel(character),
    name: "",
    code: character.code,
    invisible: isInvisible(character),
  };
}

export function keyLabel(character: Character): string {
  if (!isInvisible(character)) return character.text;
  return character.abbreviation || codePoint(character.code).slice("U+".length);
}

export function typed(key: Key, mode: Mode, before: string): string {
  if (mode !== "points") return key.text;
  return `${before === "" || /\s$/.test(before) ? "" : " "}${writePoints(key.text)} `;
}
