import { clamp, clampRgba, type Rgba } from "./rgba";
import { fromOklab, fromPolar, toOklab, toPolar } from "./spaces";

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

export function inGamut(lightness: number, chroma: number, hue: number, a: number): Rgba {
  const l = clamp(lightness, 0, 1);
  const h = ((hue % 360) + 360) % 360;
  const paint = (c: number) => fromOklab(fromPolar([l, c, h]));
  const asked = paint(chroma);
  if (holds(asked)) return clampRgba({ ...asked, a });

  let low = 0;
  let high = chroma;
  for (let step = 0; step < GAMUT_STEPS; step++) {
    const middle = (low + high) / 2;
    if (holds(paint(middle))) low = middle;
    else high = middle;
  }
  return clampRgba({ ...paint(low), a });
}

const GAMUT_STEPS = 20;

function holds({ r, g, b }: { r: number; g: number; b: number }): boolean {
  return [r, g, b].every((channel) => channel >= -0.5 && channel <= 255.5);
}
