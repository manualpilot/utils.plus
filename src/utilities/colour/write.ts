import { HEX_NAMES, namedOklab } from "./names";
import type { Rgba } from "./rgba";
import { toCmyk, toHsl, toHsv, toLab, toOklab, toPolar } from "./spaces";

export function writeHex({ r, g, b, a }: Rgba): string {
  const opaque = `#${hexPair(r)}${hexPair(g)}${hexPair(b)}`;
  return a >= 1 ? opaque : `${opaque}${hexPair(Math.round(a * 255))}`;
}

export function writeRgb({ r, g, b, a }: Rgba): string {
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function writeRgba({ r, g, b, a }: Rgba): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function writeHsl(colour: Rgba): string {
  const { h, s, l } = toHsl(colour);
  const body = `${fixed(h, 0)}, ${fixed(s, 0)}%, ${fixed(l, 0)}%`;
  return colour.a >= 1 ? `hsl(${body})` : `hsla(${body}, ${colour.a})`;
}

export function writeHsv(colour: Rgba): string {
  const { h, s, v } = toHsv(colour);
  const body = `${fixed(h, 0)}, ${fixed(s, 0)}%, ${fixed(v, 0)}%`;
  return colour.a >= 1 ? `hsv(${body})` : `hsva(${body}, ${colour.a})`;
}

export function writeCmyk(colour: Rgba): string {
  const { c, m, y, k } = toCmyk(colour);
  return `cmyk(${fixed(c, 0)}%, ${fixed(m, 0)}%, ${fixed(y, 0)}%, ${fixed(k, 0)}%)`;
}

export function writeLab(colour: Rgba): string {
  const [l, a, b] = toLab(colour);
  return `lab(${fixed(l, 2)}% ${fixed(a, 2)} ${fixed(b, 2)}${alphaTail(colour)})`;
}

export function writeLch(colour: Rgba): string {
  const [l, c, h] = toPolar(toLab(colour), 0.005);
  return `lch(${fixed(l, 2)}% ${fixed(c, 2)} ${fixed(h, 2)}${alphaTail(colour)})`;
}

export function writeOklab(colour: Rgba): string {
  const [l, a, b] = toOklab(colour);
  return `oklab(${fixed(l * 100, 2)}% ${fixed(a, 4)} ${fixed(b, 4)}${alphaTail(colour)})`;
}

export function writeOklch(colour: Rgba): string {
  const [l, c, h] = toPolar(toOklab(colour), 0.00005);
  return `oklch(${fixed(l * 100, 2)}% ${fixed(c, 4)} ${fixed(h, 2)}${alphaTail(colour)})`;
}

export function writeName({ r, g, b, a }: Rgba): string {
  if (a < 1) return "";
  return HEX_NAMES.get((r << 16) | (g << 8) | b) ?? "";
}

export function nearestName(colour: Rgba): string {
  const [l, a, b] = toOklab(colour);
  let best = "";
  let bestDistance = Infinity;
  for (const [name, oklab] of namedOklab()) {
    const distance = (l - oklab[0]) ** 2 + (a - oklab[1]) ** 2 + (b - oklab[2]) ** 2;
    if (distance >= bestDistance) continue;
    best = name;
    bestDistance = distance;
  }
  return best;
}

export function alphaTail({ a }: Rgba): string {
  return a >= 1 ? "" : ` / ${a}`;
}

export function hexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}

export function fixed(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}
