import type { Category } from "./unit";

export const AREA: Category = {
  id: "area",
  label: "Area",
  defaultUnit: "m2",
  units: [
    { id: "mm2", name: "Square millimetre", symbol: "mm²", factor: 1e-6 },
    { id: "cm2", name: "Square centimetre", symbol: "cm²", factor: 1e-4 },
    { id: "in2", name: "Square inch", symbol: "in²", factor: 0.00064516 },
    { id: "ft2", name: "Square foot", symbol: "ft²", factor: 0.09290304 },
    { id: "yd2", name: "Square yard", symbol: "yd²", factor: 0.83612736 },
    { id: "m2", name: "Square metre", symbol: "m²", factor: 1 },
    { id: "ac", name: "Acre", symbol: "ac", factor: 4046.8564224 },
    { id: "ha", name: "Hectare", symbol: "ha", factor: 1e4 },
    { id: "km2", name: "Square kilometre", symbol: "km²", factor: 1e6 },
    { id: "mi2", name: "Square mile", symbol: "mi²", factor: 2589988.110336 },
  ],
};
