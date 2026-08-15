export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function clampRgba({ r, g, b, a }: Rgba): Rgba {
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(b, 0, 255)),
    a: Math.round(clamp(a, 0, 1) * 100) / 100,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}
