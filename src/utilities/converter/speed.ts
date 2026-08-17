import type { Category } from "./unit";

export const SPEED: Category = {
  id: "speed",
  label: "Speed",
  defaultUnit: "km-h",
  units: [
    { id: "km-h", name: "Kilometre per hour", symbol: "km/h", factor: 1 / 3.6 },
    { id: "ft-s", name: "Foot per second", symbol: "ft/s", factor: 0.3048 },
    { id: "mph", name: "Mile per hour", symbol: "mph", factor: 0.44704 },
    { id: "kn", name: "Knot", symbol: "kn", factor: 1852 / 3600 },
    { id: "m-s", name: "Metre per second", symbol: "m/s", factor: 1 },
    { id: "mach", name: "Mach", symbol: "Ma", factor: 340.29 },
    { id: "light", name: "Speed of light", symbol: "c", factor: 299792458 },
  ],
};
