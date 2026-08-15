import { NAMED_HEX } from "./names";
import { clampRgba, type Rgba } from "./rgba";
import { cmykToRgb, fromLab, fromOklab, fromPolar, hslToRgb, hsvToRgb, type Vector } from "./spaces";

export function parseColour(text: string): Rgba | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const named = NAMED_HEX.get(value);
  if (named !== undefined) return { r: named >> 16, g: (named >> 8) & 0xff, b: named & 0xff, a: 1 };

  const hex = parseHex(value);
  if (hex) return hex;

  const call = /^([a-z]+)\(\s*([^()]*?)\s*\)$/.exec(value);
  if (!call) return null;

  const pieces = call[2].split("/");
  if (pieces.length > 2) return null;
  const parts = pieces[0].split(/[\s,]+/).filter(Boolean);
  const slashAlpha = pieces.length === 2 ? readNumber(pieces[1].trim(), 1) : null;
  if (pieces.length === 2 && slashAlpha === null) return null;

  return readFunction(call[1], parts, slashAlpha);
}

function parseHex(value: string): Rgba | null {
  const digits = value.startsWith("#") ? value.slice(1) : value;
  if (!/^[0-9a-f]+$/.test(digits)) return null;

  const wide = digits.length <= 4 ? digits.replace(/./g, (digit) => digit + digit) : digits;
  if (wide.length !== 6 && wide.length !== 8) return null;

  const byte = (index: number) => parseInt(wide.slice(index * 2, index * 2 + 2), 16);
  return clampRgba({ r: byte(0), g: byte(1), b: byte(2), a: wide.length === 8 ? byte(3) / 255 : 1 });
}

function readFunction(name: string, parts: string[], slashAlpha: number | null): Rgba | null {
  switch (name) {
    case "rgb":
    case "rgba": {
      const split = splitAlpha(parts, 3, slashAlpha);
      if (!split) return null;
      const values = split.parts.map((part) => readNumber(part, 255));
      if (!allNumbers(values)) return null;
      return clampRgba({ r: values[0], g: values[1], b: values[2], a: split.alpha });
    }
    case "hsl":
    case "hsla":
    case "hsv":
    case "hsva":
    case "hsb":
    case "hsba": {
      const split = splitAlpha(parts, 3, slashAlpha);
      if (!split) return null;
      const values = [readAngle(split.parts[0]), readNumber(split.parts[1], 100), readNumber(split.parts[2], 100)];
      if (!allNumbers(values)) return null;
      const toRgb = name.startsWith("hsl") ? hslToRgb : hsvToRgb;
      return clampRgba({ ...toRgb(values[0], values[1], values[2]), a: split.alpha });
    }
    case "cmyk": {
      const split = splitAlpha(parts, 4, slashAlpha);
      if (!split) return null;
      const values = split.parts.map((part) => readNumber(part, 100));
      if (!allNumbers(values)) return null;
      return clampRgba({ ...cmykToRgb(values[0], values[1], values[2], values[3]), a: split.alpha });
    }
    case "lab":
    case "oklab": {
      const ok = name === "oklab";
      const split = splitAlpha(parts, 3, slashAlpha);
      if (!split) return null;
      const scale = ok ? OKLAB_SCALE : LAB_SCALE;
      const values = split.parts.map((part, index) => readNumber(part, scale[index]));
      if (!allNumbers(values)) return null;
      const lab: Vector = [values[0], values[1], values[2]];
      return clampRgba({ ...(ok ? fromOklab(lab) : fromLab(lab)), a: split.alpha });
    }
    case "lch":
    case "oklch": {
      const ok = name === "oklch";
      const split = splitAlpha(parts, 3, slashAlpha);
      if (!split) return null;
      const scale = ok ? OKLCH_SCALE : LCH_SCALE;
      const values = [
        readNumber(split.parts[0], scale[0]),
        readNumber(split.parts[1], scale[1]),
        readAngle(split.parts[2]),
      ];
      if (!allNumbers(values)) return null;
      const lab = fromPolar([values[0], values[1], values[2]]);
      return clampRgba({ ...(ok ? fromOklab(lab) : fromLab(lab)), a: split.alpha });
    }
    default:
      return null;
  }
}

function splitAlpha(
  parts: string[],
  count: number,
  slashAlpha: number | null,
): { parts: string[]; alpha: number } | null {
  if (slashAlpha !== null) return parts.length === count ? { parts, alpha: slashAlpha } : null;
  if (parts.length === count) return { parts, alpha: 1 };
  if (parts.length !== count + 1) return null;
  const alpha = readNumber(parts[count], 1);
  return alpha === null ? null : { parts: parts.slice(0, count), alpha };
}

function readNumber(part: string | undefined, full: number): number | null {
  const match = part === undefined ? null : /^([+-]?(?:\d+\.?\d*|\.\d+))(%?)$/.exec(part);
  if (!match) return null;
  return match[2] ? Number(match[1]) * full / 100 : Number(match[1]);
}

function readAngle(part: string | undefined): number | null {
  const match = part === undefined ? null : /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|rad|grad|turn)?$/.exec(part);
  if (!match) return null;
  return Number(match[1]) * ANGLE_DEGREES[match[2] ?? "deg"];
}

function allNumbers(values: (number | null)[]): values is number[] {
  return values.every((value) => value !== null);
}

export const ANGLE_DEGREES: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

export const LAB_SCALE = [100, 125, 125];
export const LCH_SCALE = [100, 150];
export const OKLAB_SCALE = [1, 0.4, 0.4];
export const OKLCH_SCALE = [1, 0.4];
