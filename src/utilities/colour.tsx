import { ActionIcon, Box, Card, ColorPicker, ColorSwatch, CopyButton, DEFAULT_THEME, Group, Stack, TextInput, Tooltip } from "@mantine/core";
import { useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy } from "../icons";

export default function Colour() {
  const initialState = useInitialHashState<{ colour?: string }>();

  const [colour, setColour] = useState<Rgba>(() => parseColour(initialState?.colour ?? "") ?? DEFAULT_COLOUR);
  const [draft, setDraft] = useState<{ format: string; text: string } | null>(null);

  useRegisterShareState(() => ({ colour: writeHex(colour) }));

  const draftError = draft && draft.text.trim() && !parseColour(draft.text) ? "Cannot read that as a colour" : null;

  const handleType = (format: string, text: string) => {
    setDraft({ format, text });
    const typed = parseColour(text);
    if (typed) setColour(typed);
  };

  const handlePick = (value: string) => {
    const picked = parseColour(value);
    if (!picked) return;
    setColour(picked);
    setDraft(null);
  };

  return (
    <Stack gap="md">
      <UtilityTitle file="colour.tsx">Colour</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="stretch" gap="lg" wrap="wrap">
          <ColorPicker
            format="rgba"
            value={writeRgba(colour)}
            onChange={handlePick}
            swatches={SWATCHES}
            size="lg"
            saturationLabel="Saturation and brightness"
            hueLabel="Hue"
            alphaLabel="Opacity"
          />
          <ColorSwatch
            color={writeRgba(colour)}
            radius="md"
            withShadow={false}
            aria-label="Selected colour"
            style={{ flex: "1 1 12rem", width: "auto", height: "auto", minHeight: "6rem" }}
          />
        </Group>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="md">
          {FORMAT_ROWS.map((row) => {
            const rowError = row.some((spec) => spec.id === draft?.format) ? draftError : null;
            return (
              <Box
                key={row.map((spec) => spec.id).join()}
                className={rowError ? "settings-row has-error" : "settings-row"}
                mb={rowError ? "md" : 0}
              >
                {row.map((spec) => (
                  <FormatField
                    key={spec.id}
                    spec={spec}
                    colour={colour}
                    draft={draft?.format === spec.id ? draft.text : null}
                    error={draft?.format === spec.id ? draftError : null}
                    onType={handleType}
                    onLeave={() => setDraft(null)}
                  />
                ))}
              </Box>
            );
          })}
        </Stack>
      </Card>
    </Stack>
  );
}

function FormatField({ spec, colour, draft, error, onType, onLeave }: FormatFieldProps) {
  const written = spec.write(colour);

  return (
    <TextInput
      label={spec.label}
      value={draft ?? written}
      placeholder={spec.placeholder?.(colour)}
      onChange={(event) => onType(spec.id, event.currentTarget.value)}
      onBlur={onLeave}
      error={error}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      classNames={{ root: "relative-root", error: "absolute-error" }}
      styles={{ input: { fontFamily: "monospace" } }}
      rightSectionPointerEvents="all"
      rightSection={
        <CopyButton value={written} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={copy}
                disabled={!written}
                aria-label={`Copy the ${spec.label} value`}
              >
                {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      }
    />
  );
}

interface FormatFieldProps {
  spec: FormatSpec;
  colour: Rgba;
  draft: string | null;
  error: string | null;
  onType: (format: string, text: string) => void;
  onLeave: () => void;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FormatSpec {
  id: string;
  label: string;
  write: (colour: Rgba) => string;
  placeholder?: (colour: Rgba) => string;
}

const DEFAULT_COLOUR: Rgba = { r: 255, g: 112, b: 67, a: 1 };

const SWATCHES = Object.values(DEFAULT_THEME.colors).map((shades) => shades[6]);

const FORMAT_ROWS: FormatSpec[][] = [
  [
    { id: "hex", label: "Hex", write: writeHex },
    { id: "name", label: "CSS name", write: writeName, placeholder: (colour) => `≈ ${nearestName(colour)}` },
  ],
  [
    { id: "rgb", label: "RGB", write: writeRgb },
    { id: "hsl", label: "HSL", write: writeHsl },
  ],
  [
    { id: "hsv", label: "HSV", write: writeHsv },
    { id: "cmyk", label: "CMYK", write: writeCmyk },
  ],
  [
    { id: "lab", label: "LAB", write: writeLab },
    { id: "lch", label: "LCH", write: writeLch },
  ],
  [
    { id: "oklab", label: "OKLAB", write: writeOklab },
    { id: "oklch", label: "OKLCH", write: writeOklch },
  ],
];

export function writeHex({ r, g, b, a }: Rgba): string {
  const opaque = `#${hexPair(r)}${hexPair(g)}${hexPair(b)}`;
  return a >= 1 ? opaque : `${opaque}${hexPair(Math.round(a * 255))}`;
}

export function writeRgb({ r, g, b, a }: Rgba): string {
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

function writeRgba({ r, g, b, a }: Rgba): string {
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

function alphaTail({ a }: Rgba): string {
  return a >= 1 ? "" : ` / ${a}`;
}

function hexPair(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function fixed(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

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

const ANGLE_DEGREES: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };

const LAB_SCALE = [100, 125, 125];
const LCH_SCALE = [100, 150];
const OKLAB_SCALE = [1, 0.4, 0.4];
const OKLCH_SCALE = [1, 0.4];

function clampRgba({ r, g, b, a }: Rgba): Rgba {
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(b, 0, 255)),
    a: Math.round(clamp(a, 0, 1) * 100) / 100,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function toHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const chroma = max - min;
  const l = (max + min) / 2;
  const s = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * l - 1));
  return { h: hueOf({ r, g, b }), s: s * 100, l: l * 100 };
}

function toHsv({ r, g, b }: Rgba): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b) / 255;
  const chroma = max - Math.min(r, g, b) / 255;
  return { h: hueOf({ r, g, b }), s: (max === 0 ? 0 : chroma / max) * 100, v: max * 100 };
}

function hueOf({ r, g, b }: { r: number; g: number; b: number }): number {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma === 0) return 0;
  const sixth = max === r ? (g - b) / chroma : max === g ? 2 + (b - r) / chroma : 4 + (r - g) / chroma;
  return ((sixth * 60) % 360 + 360) % 360;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * (clamp(s, 0, 100) / 100);
  return fromChroma(h, chroma, light - chroma / 2);
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const value = clamp(v, 0, 100) / 100;
  const chroma = value * (clamp(s, 0, 100) / 100);
  return fromChroma(h, chroma, value - chroma);
}

function fromChroma(h: number, chroma: number, offset: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360 / 60;
  const second = chroma * (1 - Math.abs(hue % 2 - 1));
  const sector = SECTORS[Math.floor(hue) % 6];
  const level = [0, second, chroma];
  return {
    r: (level[sector[0]] + offset) * 255,
    g: (level[sector[1]] + offset) * 255,
    b: (level[sector[2]] + offset) * 255,
  };
}

const SECTORS = [[2, 1, 0], [1, 2, 0], [0, 2, 1], [0, 1, 2], [1, 0, 2], [2, 0, 1]];

function toCmyk({ r, g, b }: Rgba): { c: number; m: number; y: number; k: number } {
  const black = 1 - Math.max(r, g, b) / 255;
  if (black === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const ink = (channel: number) => (1 - channel / 255 - black) / (1 - black) * 100;
  return { c: ink(r), m: ink(g), y: ink(b), k: black * 100 };
}

function cmykToRgb(c: number, m: number, y: number, k: number): { r: number; g: number; b: number } {
  const black = clamp(k, 0, 100) / 100;
  const channel = (ink: number) => 255 * (1 - clamp(ink, 0, 100) / 100) * (1 - black);
  return { r: channel(c), g: channel(m), b: channel(y) };
}

type Vector = [number, number, number];
type Matrix = [Vector, Vector, Vector];

function toLab(colour: Rgba): Vector {
  return xyzToLab(apply(XYZ_D65_TO_D50, apply(LINEAR_TO_XYZ, toLinear(colour))));
}

function fromLab(lab: Vector): { r: number; g: number; b: number } {
  return fromLinear(apply(XYZ_TO_LINEAR, apply(XYZ_D50_TO_D65, labToXyz(lab))));
}

function toOklab(colour: Rgba): Vector {
  const [l, m, s] = apply(LINEAR_TO_LMS, toLinear(colour));
  return apply(LMS_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
}

function fromOklab(oklab: Vector): { r: number; g: number; b: number } {
  const [l, m, s] = apply(OKLAB_TO_LMS, oklab);
  return fromLinear(apply(LMS_TO_LINEAR, [l ** 3, m ** 3, s ** 3]));
}

function toPolar([l, a, b]: Vector, smallest: number): Vector {
  const chroma = Math.sqrt(a * a + b * b);
  const hue = chroma < smallest ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return [l, chroma, hue];
}

function fromPolar([l, c, h]: Vector): Vector {
  const radians = h * Math.PI / 180;
  return [l, c * Math.cos(radians), c * Math.sin(radians)];
}

function toLinear({ r, g, b }: Rgba): Vector {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return [channel(r), channel(g), channel(b)];
}

function fromLinear([r, g, b]: Vector): { r: number; g: number; b: number } {
  const channel = (value: number) => {
    const size = Math.abs(value);
    const scaled = size <= 0.0031308 ? size * 12.92 : 1.055 * size ** (1 / 2.4) - 0.055;
    return Math.sign(value) * scaled * 255;
  };
  return { r: channel(r), g: channel(g), b: channel(b) };
}

const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;
const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

function xyzToLab(xyz: Vector): Vector {
  const [x, y, z] = xyz.map((value, index) => {
    const scaled = value / D50_WHITE[index];
    return scaled > LAB_EPSILON ? Math.cbrt(scaled) : (LAB_KAPPA * scaled + 16) / 116;
  });
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labToXyz([l, a, b]: Vector): Vector {
  const fy = (l + 16) / 116;
  const unfold = (f: number) => f ** 3 > LAB_EPSILON ? f ** 3 : (116 * f - 16) / LAB_KAPPA;
  return [
    unfold(a / 500 + fy) * D50_WHITE[0],
    (l > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : l / LAB_KAPPA) * D50_WHITE[1],
    unfold(fy - b / 200) * D50_WHITE[2],
  ];
}

function apply(matrix: Matrix, [x, y, z]: Vector): Vector {
  return [
    matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
    matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
    matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
  ];
}

const LINEAR_TO_XYZ: Matrix = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.7151686787677559, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

const XYZ_TO_LINEAR: Matrix = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];

const XYZ_D65_TO_D50: Matrix = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
];

const XYZ_D50_TO_D65: Matrix = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];

const LINEAR_TO_LMS: Matrix = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

const LMS_TO_OKLAB: Matrix = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

const OKLAB_TO_LMS: Matrix = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];

const LMS_TO_LINEAR: Matrix = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

const NAMED_LIST = `
aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff
beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff
blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00
chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c
cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9
darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f
darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f
darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3
deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff
firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc
ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000
greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c
indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5
lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff
lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1
lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899
lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6
magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3
mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc
mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5
navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23
orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98
paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f
pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399
red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072
sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0
skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa
springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8
tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff
whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32
`;

const NAMED_HEX = new Map<string, number>();
const HEX_NAMES = new Map<number, string>();

const NAMED_TOKENS = NAMED_LIST.trim().split(/\s+/);
for (let i = 0; i < NAMED_TOKENS.length; i += 2) {
  const value = parseInt(NAMED_TOKENS[i + 1], 16);
  NAMED_HEX.set(NAMED_TOKENS[i], value);
  if (!HEX_NAMES.has(value)) HEX_NAMES.set(value, NAMED_TOKENS[i]);
}

let namedOklabCache: [string, Vector][] | null = null;

function namedOklab(): [string, Vector][] {
  namedOklabCache ??= [...NAMED_HEX].map(([name, value]) => [
    name,
    toOklab({ r: value >> 16, g: (value >> 8) & 0xff, b: value & 0xff, a: 1 }),
  ]);
  return namedOklabCache;
}
