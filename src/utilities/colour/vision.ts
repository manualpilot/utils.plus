import { LUMA } from "./contrast";
import { clampRgba, type Rgba } from "./rgba";
import { apply, fromLinear, type Matrix, toLinear } from "./spaces";

export function simulate(colour: Rgba, matrix: Matrix | null): Rgba {
  if (!matrix) return colour;
  return clampRgba({ ...fromLinear(apply(matrix, toLinear(colour))), a: colour.a });
}

const PROTANOPIA: Matrix = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];

const DEUTERANOPIA: Matrix = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];

const TRITANOPIA: Matrix = [
  [1.255528, -0.076749, -0.178779],
  [-0.078411, 0.930809, 0.147602],
  [0.004733, 0.691367, 0.3039],
];

const ACHROMATOPSIA: Matrix = [LUMA, LUMA, LUMA];

export interface Vision {
  id: string;
  label: string;
  note: string;
  matrix: Matrix | null;
}

export const VISIONS: Vision[] = [
  { id: "typical", label: "Typical", note: "All three cone types", matrix: null },
  { id: "protanopia", label: "Protanopia", note: "No long-wave cone, so red darkens", matrix: PROTANOPIA },
  { id: "deuteranopia", label: "Deuteranopia", note: "No middle-wave cone, so red meets green", matrix: DEUTERANOPIA },
  { id: "tritanopia", label: "Tritanopia", note: "No short-wave cone, so blue meets yellow", matrix: TRITANOPIA },
  { id: "achromatopsia", label: "Achromatopsia", note: "No hue at all, only lightness", matrix: ACHROMATOPSIA },
];
