import { clamp, type Rgba } from "./rgba";

export function toHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const chroma = max - min;
  const l = (max + min) / 2;
  const s = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * l - 1));
  return { h: hueOf({ r, g, b }), s: s * 100, l: l * 100 };
}

export function toHsv({ r, g, b }: Rgba): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b) / 255;
  const chroma = max - Math.min(r, g, b) / 255;
  return { h: hueOf({ r, g, b }), s: (max === 0 ? 0 : chroma / max) * 100, v: max * 100 };
}

export function hueOf({ r, g, b }: { r: number; g: number; b: number }): number {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma === 0) return 0;
  const sixth = max === r ? (g - b) / chroma : max === g ? 2 + (b - r) / chroma : 4 + (r - g) / chroma;
  return ((sixth * 60) % 360 + 360) % 360;
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * (clamp(s, 0, 100) / 100);
  return fromChroma(h, chroma, light - chroma / 2);
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const value = clamp(v, 0, 100) / 100;
  const chroma = value * (clamp(s, 0, 100) / 100);
  return fromChroma(h, chroma, value - chroma);
}

export function fromChroma(h: number, chroma: number, offset: number): { r: number; g: number; b: number } {
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

export function toCmyk({ r, g, b }: Rgba): { c: number; m: number; y: number; k: number } {
  const black = 1 - Math.max(r, g, b) / 255;
  if (black === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const ink = (channel: number) => (1 - channel / 255 - black) / (1 - black) * 100;
  return { c: ink(r), m: ink(g), y: ink(b), k: black * 100 };
}

export function cmykToRgb(c: number, m: number, y: number, k: number): { r: number; g: number; b: number } {
  const black = clamp(k, 0, 100) / 100;
  const channel = (ink: number) => 255 * (1 - clamp(ink, 0, 100) / 100) * (1 - black);
  return { r: channel(c), g: channel(m), b: channel(y) };
}

export type Vector = [number, number, number];
export type Matrix = [Vector, Vector, Vector];

export function toLab(colour: Rgba): Vector {
  return xyzToLab(apply(XYZ_D65_TO_D50, apply(LINEAR_TO_XYZ, toLinear(colour))));
}

export function fromLab(lab: Vector): { r: number; g: number; b: number } {
  return fromLinear(apply(XYZ_TO_LINEAR, apply(XYZ_D50_TO_D65, labToXyz(lab))));
}

export function toOklab(colour: Rgba): Vector {
  const [l, m, s] = apply(LINEAR_TO_LMS, toLinear(colour));
  return apply(LMS_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
}

export function fromOklab(oklab: Vector): { r: number; g: number; b: number } {
  const [l, m, s] = apply(OKLAB_TO_LMS, oklab);
  return fromLinear(apply(LMS_TO_LINEAR, [l ** 3, m ** 3, s ** 3]));
}

export function toPolar([l, a, b]: Vector, smallest: number): Vector {
  const chroma = Math.sqrt(a * a + b * b);
  const hue = chroma < smallest ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  return [l, chroma, hue];
}

export function fromPolar([l, c, h]: Vector): Vector {
  const radians = h * Math.PI / 180;
  return [l, c * Math.cos(radians), c * Math.sin(radians)];
}

export function toLinear({ r, g, b }: Rgba): Vector {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return [channel(r), channel(g), channel(b)];
}

export function fromLinear([r, g, b]: Vector): { r: number; g: number; b: number } {
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

export function xyzToLab(xyz: Vector): Vector {
  const [x, y, z] = xyz.map((value, index) => {
    const scaled = value / D50_WHITE[index];
    return scaled > LAB_EPSILON ? Math.cbrt(scaled) : (LAB_KAPPA * scaled + 16) / 116;
  });
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function labToXyz([l, a, b]: Vector): Vector {
  const fy = (l + 16) / 116;
  const unfold = (f: number) => f ** 3 > LAB_EPSILON ? f ** 3 : (116 * f - 16) / LAB_KAPPA;
  return [
    unfold(a / 500 + fy) * D50_WHITE[0],
    (l > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : l / LAB_KAPPA) * D50_WHITE[1],
    unfold(fy - b / 200) * D50_WHITE[2],
  ];
}

export function apply(matrix: Matrix, [x, y, z]: Vector): Vector {
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
