import { DEFAULT_THEME } from "@mantine/core";
import type { Rgba } from "./rgba";
import { nearestName, writeCmyk, writeHex, writeHsl, writeHsv, writeLab, writeLch, writeName, writeOklab, writeOklch, writeRgb } from "./write";

export interface FormatSpec {
  id: string;
  label: string;
  write: (colour: Rgba) => string;
  placeholder?: (colour: Rgba) => string;
}

export const DEFAULT_COLOUR: Rgba = { r: 255, g: 112, b: 67, a: 1 };

export const SWATCHES = Object.values(DEFAULT_THEME.colors).map((shades) => shades[6]);

export const FORMAT_ROWS: FormatSpec[][] = [
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
