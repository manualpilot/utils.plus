export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  sepia: number;
  greyscale: number;
  invert: number;
}

export const NEUTRAL: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  sepia: 0,
  greyscale: 0,
  invert: 0,
};

export const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number; unit: string }[] = [
  { key: "brightness", label: "Brightness", min: 0, max: 200, unit: "%" },
  { key: "contrast", label: "Contrast", min: 0, max: 200, unit: "%" },
  { key: "saturation", label: "Saturation", min: 0, max: 200, unit: "%" },
  { key: "hue", label: "Hue", min: -180, max: 180, unit: "°" },
  { key: "sepia", label: "Sepia", min: 0, max: 100, unit: "%" },
  { key: "greyscale", label: "Greyscale", min: 0, max: 100, unit: "%" },
  { key: "invert", label: "Invert", min: 0, max: 100, unit: "%" },
];

export const PRESETS: { value: string; label: string; adjustments: Adjustments }[] = [
  { value: "none", label: "None", adjustments: NEUTRAL },
  { value: "mono", label: "Black and white", adjustments: { ...NEUTRAL, greyscale: 100, contrast: 110 } },
  { value: "noir", label: "Noir", adjustments: { ...NEUTRAL, greyscale: 100, contrast: 145, brightness: 92 } },
  { value: "sepia", label: "Sepia", adjustments: { ...NEUTRAL, sepia: 85, contrast: 105, brightness: 104 } },
  { value: "vivid", label: "Vivid", adjustments: { ...NEUTRAL, saturation: 150, contrast: 112 } },
  { value: "faded", label: "Faded", adjustments: { ...NEUTRAL, saturation: 70, contrast: 88, brightness: 108 } },
  { value: "cool", label: "Cool", adjustments: { ...NEUTRAL, hue: -18, saturation: 112 } },
  { value: "warm", label: "Warm", adjustments: { ...NEUTRAL, hue: 14, saturation: 112, brightness: 104 } },
  { value: "negative", label: "Negative", adjustments: { ...NEUTRAL, invert: 100 } },
];

export function isNeutral(adjustments: Adjustments): boolean {
  return SLIDERS.every(({ key }) => adjustments[key] === NEUTRAL[key]);
}

export function matchPreset(adjustments: Adjustments): string {
  const found = PRESETS.find((preset) => SLIDERS.every(({ key }) => preset.adjustments[key] === adjustments[key]));
  return found?.value ?? "";
}

export type ColourMatrix = number[];

export function matrixFor(adjustments: Adjustments): ColourMatrix {
  let matrix = IDENTITY;
  matrix = compose(scale(adjustments.brightness / 100), matrix);
  matrix = compose(contrast(adjustments.contrast / 100), matrix);
  matrix = compose(saturate(adjustments.saturation / 100), matrix);
  matrix = compose(hueRotate(adjustments.hue), matrix);
  matrix = compose(sepia(adjustments.sepia / 100), matrix);
  matrix = compose(saturate(1 - adjustments.greyscale / 100), matrix);
  matrix = compose(invert(adjustments.invert / 100), matrix);
  return matrix;
}

export function applyMatrix(pixels: Uint8ClampedArray, matrix: ColourMatrix) {
  const [rr, rg, rb, ro, gr, gg, gb, go, br, bg, bb, bo] = matrix;
  for (let at = 0; at < pixels.length; at += 4) {
    const red = pixels[at];
    const green = pixels[at + 1];
    const blue = pixels[at + 2];
    pixels[at] = rr * red + rg * green + rb * blue + ro;
    pixels[at + 1] = gr * red + gg * green + gb * blue + go;
    pixels[at + 2] = br * red + bg * green + bb * blue + bo;
  }
}

export function cssFilter(adjustments: Adjustments): string {
  const parts: string[] = [];
  if (adjustments.brightness !== 100) parts.push(`brightness(${adjustments.brightness}%)`);
  if (adjustments.contrast !== 100) parts.push(`contrast(${adjustments.contrast}%)`);
  if (adjustments.saturation !== 100) parts.push(`saturate(${adjustments.saturation}%)`);
  if (adjustments.hue !== 0) parts.push(`hue-rotate(${adjustments.hue}deg)`);
  if (adjustments.sepia !== 0) parts.push(`sepia(${adjustments.sepia}%)`);
  if (adjustments.greyscale !== 0) parts.push(`grayscale(${adjustments.greyscale}%)`);
  if (adjustments.invert !== 0) parts.push(`invert(${adjustments.invert}%)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

function compose(after: ColourMatrix, before: ColourMatrix): ColourMatrix {
  const out: ColourMatrix = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      let total = 0;
      for (let step = 0; step < 3; step++) total += after[row * 4 + step] * before[step * 4 + column];
      out[row * 4 + column] = total;
    }
    let offset = after[row * 4 + 3];
    for (let step = 0; step < 3; step++) offset += after[row * 4 + step] * before[step * 4 + 3];
    out[row * 4 + 3] = offset;
  }
  return out;
}

function scale(factor: number): ColourMatrix {
  return [factor, 0, 0, 0, 0, factor, 0, 0, 0, 0, factor, 0];
}

function contrast(factor: number): ColourMatrix {
  const offset = 127.5 * (1 - factor);
  return [factor, 0, 0, offset, 0, factor, 0, offset, 0, 0, factor, offset];
}

function saturate(amount: number): ColourMatrix {
  const [red, green, blue] = LUMINANCE;
  return [
    red + (1 - red) * amount,
    green - green * amount,
    blue - blue * amount,
    0,
    red - red * amount,
    green + (1 - green) * amount,
    blue - blue * amount,
    0,
    red - red * amount,
    green - green * amount,
    blue + (1 - blue) * amount,
    0,
  ];
}

function hueRotate(degrees: number): ColourMatrix {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    0.213 + cosine * 0.787 - sine * 0.213,
    0.715 - cosine * 0.715 - sine * 0.715,
    0.072 - cosine * 0.072 + sine * 0.928,
    0,
    0.213 - cosine * 0.213 + sine * 0.143,
    0.715 + cosine * 0.285 + sine * 0.14,
    0.072 - cosine * 0.072 - sine * 0.283,
    0,
    0.213 - cosine * 0.213 - sine * 0.787,
    0.715 - cosine * 0.715 + sine * 0.715,
    0.072 + cosine * 0.928 + sine * 0.072,
    0,
  ];
}

function sepia(amount: number): ColourMatrix {
  const kept = 1 - amount;
  return [
    0.393 + 0.607 * kept,
    0.769 - 0.769 * kept,
    0.189 - 0.189 * kept,
    0,
    0.349 - 0.349 * kept,
    0.686 + 0.314 * kept,
    0.168 - 0.168 * kept,
    0,
    0.272 - 0.272 * kept,
    0.534 - 0.534 * kept,
    0.131 + 0.869 * kept,
    0,
  ];
}

function invert(amount: number): ColourMatrix {
  const factor = 1 - 2 * amount;
  const offset = 255 * amount;
  return [factor, 0, 0, offset, 0, factor, 0, offset, 0, 0, factor, offset];
}

const IDENTITY: ColourMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

const LUMINANCE = [0.213, 0.715, 0.072];
