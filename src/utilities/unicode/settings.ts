import { isGroup } from "./keys";
import { writePoints } from "./points";

export const MODES = {
  text: {
    label: "Text",
    title: "Unicode Inspector",
    field: "Text",
    hint: "Anything at all — a name, a filename, a line out of a diff",
  },
  points: {
    label: "Code points",
    title: "Unicode Code Points",
    field: "Code points",
    hint: "Hex, however they were written: U+0041, 0041, 0x41, \\u{41} or &#x41;",
  },
};

export type Mode = keyof typeof MODES;

export const MODE_OPTIONS = Object.entries(MODES).map(([value, { label }]) => ({ value, label }));

export const SAMPLE = "Caf\u00E9 \u2615 \u0430pple.com";

export const MAX_ROWS = 512;

export function pickMode(value: unknown): Mode {
  return value === "points" ? "points" : "text";
}

export function pickValue(value: unknown, mode: Mode): string {
  if (typeof value === "string") return value;
  return mode === "points" ? writePoints(SAMPLE) : SAMPLE;
}

export function pickGroup(value: unknown): string | null {
  return isGroup(value) ? value : null;
}

export function pickAt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}
