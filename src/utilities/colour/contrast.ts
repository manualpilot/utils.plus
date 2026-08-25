import type { Rgba } from "./rgba";
import { toLinear, type Vector } from "./spaces";

export function luminance(colour: Rgba): number {
  const [r, g, b] = toLinear(colour);
  return LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
}

export const LUMA: Vector = [0.2126, 0.7152, 0.0722];

export function contrastRatio(over: Rgba, under: Rgba): number {
  const front = luminance(composite(over, under));
  const back = luminance(opaque(under));
  const [lighter, darker] = front > back ? [front, back] : [back, front];
  return (lighter + 0.05) / (darker + 0.05);
}

export function composite(over: Rgba, under: Rgba): Rgba {
  const mix = (top: number, bottom: number) => Math.round(top * over.a + bottom * (1 - over.a));
  return { r: mix(over.r, under.r), g: mix(over.g, under.g), b: mix(over.b, under.b), a: 1 };
}

export function opaque(colour: Rgba): Rgba {
  return { ...colour, a: 1 };
}

export const BACKDROPS: { label: string; colour: Rgba }[] = [
  { label: "white", colour: { r: 255, g: 255, b: 255, a: 1 } },
  { label: "black", colour: { r: 0, g: 0, b: 0, a: 1 } },
];

export interface ContrastLevel {
  id: string;
  label: string;
  note: string;
  ratio: number;
}

export const CONTRAST_LEVELS: ContrastLevel[] = [
  { id: "aa", label: "AA text", note: "1.4.3", ratio: 4.5 },
  { id: "aa-large", label: "AA large", note: "1.4.3", ratio: 3 },
  { id: "aaa", label: "AAA text", note: "1.4.6", ratio: 7 },
  { id: "aaa-large", label: "AAA large", note: "1.4.6", ratio: 4.5 },
  { id: "non-text", label: "AA non-text", note: "1.4.11", ratio: 3 },
];

export function grade(ratio: number): string {
  if (ratio >= 7) return "Passes every level";
  if (ratio >= 4.5) return "Passes AA, and AAA at large sizes";
  if (ratio >= 3) return "Large text and interface parts only";
  return "Fails every level";
}

export function writeRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}
