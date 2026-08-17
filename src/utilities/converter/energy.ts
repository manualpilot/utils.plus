import type { Category } from "./unit";

export const ENERGY: Category = {
  id: "energy",
  label: "Energy",
  defaultUnit: "kj",
  units: [
    { id: "ev", name: "Electronvolt", symbol: "eV", factor: 1.602176634e-19 },
    { id: "j", name: "Joule", symbol: "J", factor: 1 },
    { id: "ftlb", name: "Foot-pound", symbol: "ft·lbf", factor: 1.3558179483314004 },
    { id: "cal", name: "Calorie", symbol: "cal", factor: 4.184 },
    { id: "kj", name: "Kilojoule", symbol: "kJ", factor: 1e3 },
    { id: "btu", name: "British thermal unit", symbol: "BTU", factor: 1055.05585262 },
    { id: "wh", name: "Watt hour", symbol: "Wh", factor: 3600 },
    { id: "kcal", name: "Kilocalorie", symbol: "kcal", factor: 4184 },
    { id: "kwh", name: "Kilowatt hour", symbol: "kWh", factor: 3.6e6 },
    { id: "tnt", name: "Tonne of TNT", symbol: "tTNT", factor: 4.184e9 },
  ],
};
