import type { Category } from "./unit";

export const DISTANCE: Category = {
  id: "distance",
  label: "Distance",
  defaultUnit: "m",
  units: [
    { id: "nm", name: "Nanometre", symbol: "nm", factor: 1e-9 },
    { id: "um", name: "Micrometre", symbol: "µm", factor: 1e-6 },
    { id: "mm", name: "Millimetre", symbol: "mm", factor: 1e-3 },
    { id: "cm", name: "Centimetre", symbol: "cm", factor: 1e-2 },
    { id: "in", name: "Inch", symbol: "in", factor: 0.0254 },
    { id: "ft", name: "Foot", symbol: "ft", factor: 0.3048 },
    { id: "yd", name: "Yard", symbol: "yd", factor: 0.9144 },
    { id: "m", name: "Metre", symbol: "m", factor: 1 },
    { id: "km", name: "Kilometre", symbol: "km", factor: 1e3 },
    { id: "mi", name: "Mile", symbol: "mi", factor: 1609.344 },
    { id: "nmi", name: "Nautical mile", symbol: "nmi", factor: 1852 },
    { id: "au", name: "Astronomical unit", symbol: "au", factor: 149597870700 },
    { id: "ly", name: "Light year", symbol: "ly", factor: 9460730472580800 },
    { id: "pc", name: "Parsec", symbol: "pc", factor: 3.0856775814913673e16 },
  ],
};
