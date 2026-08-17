import type { Category } from "./unit";

export const TEMPERATURE: Category = {
  id: "temperature",
  label: "Temperature",
  defaultUnit: "c",
  units: [
    { id: "c", name: "Celsius", symbol: "°C", factor: 1, offset: 273.15 },
    { id: "f", name: "Fahrenheit", symbol: "°F", factor: 5 / 9, offset: 273.15 - 160 / 9 },
    { id: "k", name: "Kelvin", symbol: "K", factor: 1 },
    { id: "r", name: "Rankine", symbol: "°R", factor: 5 / 9 },
  ],
};
