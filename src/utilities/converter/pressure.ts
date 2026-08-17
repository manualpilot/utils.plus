import type { Category } from "./unit";

export const PRESSURE: Category = {
  id: "pressure",
  label: "Pressure",
  defaultUnit: "bar",
  units: [
    { id: "pa", name: "Pascal", symbol: "Pa", factor: 1 },
    { id: "hpa", name: "Hectopascal", symbol: "hPa", factor: 100 },
    { id: "mbar", name: "Millibar", symbol: "mbar", factor: 100 },
    { id: "torr", name: "Torr", symbol: "Torr", factor: 101325 / 760 },
    { id: "mmhg", name: "Millimetre of mercury", symbol: "mmHg", factor: 133.322387415 },
    { id: "kpa", name: "Kilopascal", symbol: "kPa", factor: 1e3 },
    { id: "inhg", name: "Inch of mercury", symbol: "inHg", factor: 3386.388640341 },
    { id: "psi", name: "Pound per square inch", symbol: "psi", factor: 6894.757293168361 },
    { id: "kgfcm2", name: "Kilogram-force per cm²", symbol: "kgf/cm²", factor: 98066.5 },
    { id: "bar", name: "Bar", symbol: "bar", factor: 1e5 },
    { id: "atm", name: "Atmosphere", symbol: "atm", factor: 101325 },
    { id: "mpa", name: "Megapascal", symbol: "MPa", factor: 1e6 },
  ],
};
