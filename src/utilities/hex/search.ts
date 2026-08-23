import { parseHex } from "./bytes";
import { encodeText, type TextEncoding } from "./encodings";

export type Mode = "hex" | "text";

export const MODE_OPTIONS = [{ value: "hex", label: "Hex" }, { value: "text", label: "Text" }];

export type Needle = { bytes: Uint8Array } | { error: string };

export function needleFor(query: string, mode: Mode, encoding: TextEncoding): Needle | null {
  if (query.trim() === "") return null;
  if (mode === "hex") {
    const bytes = parseHex(query);
    return bytes ? { bytes } : { error: "That is not a run of hex bytes — pairs of digits, spaced however you like." };
  }
  const encoded = encodeText(query, encoding);
  if ("missing" in encoded) return { error: `${encoding.label} has no byte for ${encoded.missing}.` };
  return { bytes: encoded };
}

export function findNext(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const found = scan(haystack, needle, Math.max(0, from));
  return found >= 0 ? found : scan(haystack, needle, 0);
}

export function findPrevious(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const last = haystack.length - needle.length;
  const found = from < 0 ? -1 : scanBack(haystack, needle, Math.min(from, last));
  return found >= 0 ? found : scanBack(haystack, needle, last);
}

export const MATCH_CAP = 1000;

export function countMatches(haystack: Uint8Array, needle: Uint8Array): number {
  let found = 0;
  let at = 0;
  while (found < MATCH_CAP) {
    const next = scan(haystack, needle, at);
    if (next < 0) break;
    found++;
    at = next + 1;
  }
  return found;
}

function scan(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const last = haystack.length - needle.length;
  const first = needle[0];
  for (let at = from; at <= last; at++) {
    if (haystack[at] !== first) continue;
    if (equals(haystack, needle, at)) return at;
  }
  return -1;
}

function scanBack(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  for (let at = from; at >= 0; at--) {
    if (haystack[at] !== needle[0]) continue;
    if (equals(haystack, needle, at)) return at;
  }
  return -1;
}

function equals(haystack: Uint8Array, needle: Uint8Array, at: number): boolean {
  for (let index = 1; index < needle.length; index++) {
    if (haystack[at + index] !== needle[index]) return false;
  }
  return true;
}

export function parseOffset(text: string, size: number): number | { error: string } {
  const clean = text.trim().replace(/[\s,_]/g, "");
  if (clean === "") return { error: "Required" };
  const hex = /^(?:0x)?([0-9a-f]+)$/i.exec(clean);
  const decimal = /^([0-9]+)$/.exec(clean);
  const value = decimal ? Number.parseInt(decimal[1], 10) : hex ? Number.parseInt(hex[1], 16) : Number.NaN;
  if (!Number.isFinite(value)) return { error: "That is not an offset — a decimal number, or hex behind `0x`." };
  if (size === 0) return { error: "This file has no bytes to go to." };
  if (value >= size) return { error: `This file ends at ${size - 1}.` };
  return value;
}
