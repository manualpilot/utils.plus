import { inGamut } from "./gamut";
import type { Rgba } from "./rgba";
import { toOklab, toPolar } from "./spaces";

export interface Swatch {
  colour: Rgba;
  base: boolean;
}

export interface Harmony {
  id: string;
  label: string;
  angles: number[];
}

export const HARMONIES: Harmony[] = [
  { id: "complementary", label: "Complementary", angles: [0, 180] },
  { id: "analogous", label: "Analogous", angles: [-30, 0, 30] },
  { id: "triadic", label: "Triadic", angles: [0, 120, 240] },
  { id: "split", label: "Split complementary", angles: [0, 150, 210] },
  { id: "tetradic", label: "Tetradic", angles: [0, 90, 180, 270] },
];

export function harmony(colour: Rgba, angles: number[]): Swatch[] {
  const [l, c, h] = toPolar(toOklab(colour), 0);
  return angles.map((angle) => ({ colour: inGamut(l, c, h + angle, colour.a), base: angle === 0 }));
}

export const TONE_STEPS = [0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];

export function tones(colour: Rgba): Swatch[] {
  const [l, c, h] = toPolar(toOklab(colour), 0);
  const nearest = TONE_STEPS.reduce((best, step) => Math.abs(step - l) < Math.abs(best - l) ? step : best);
  return TONE_STEPS.map((step) => ({ colour: inGamut(step, c, h, colour.a), base: step === nearest }));
}
