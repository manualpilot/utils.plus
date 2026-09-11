import { clamp, clampRgba, type Rgba } from "./rgba";
import { fromOklab, fromPolar, toPolar, type Vector } from "./spaces";

export function intoGamut(oklab: Vector, a: number): Rgba {
  const [l, c, h] = toPolar(oklab, 0);
  return inGamut(l, c, h, a);
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
