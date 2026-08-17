import type { Category } from "./unit";

export const MASS: Category = {
  id: "mass",
  label: "Mass",
  defaultUnit: "kg",
  units: [
    { id: "ug", name: "Microgram", symbol: "µg", factor: 1e-9 },
    { id: "mg", name: "Milligram", symbol: "mg", factor: 1e-6 },
    { id: "gr", name: "Grain", symbol: "gr", factor: 6.479891e-5 },
    { id: "ct", name: "Carat", symbol: "ct", factor: 2e-4 },
    { id: "g", name: "Gram", symbol: "g", factor: 1e-3 },
    { id: "oz", name: "Ounce", symbol: "oz", factor: 0.028349523125 },
    { id: "lb", name: "Pound", symbol: "lb", factor: 0.45359237 },
    { id: "kg", name: "Kilogram", symbol: "kg", factor: 1 },
    { id: "st", name: "Stone", symbol: "st", factor: 6.35029318 },
    { id: "ton-us", name: "Short ton (US)", symbol: "tn", factor: 907.18474 },
    { id: "t", name: "Tonne", symbol: "t", factor: 1e3 },
    { id: "ton-uk", name: "Long ton (imperial)", symbol: "LT", factor: 1016.0469088 },
  ],
};
