import type { Category } from "./unit";

export const POWER: Category = {
  id: "power",
  label: "Power",
  defaultUnit: "kw",
  units: [
    { id: "milliwatt", name: "Milliwatt", symbol: "mW", factor: 1e-3 },
    { id: "btu-h", name: "BTU per hour", symbol: "BTU/h", factor: 1055.05585262 / 3600 },
    { id: "watt", name: "Watt", symbol: "W", factor: 1 },
    { id: "ftlb-s", name: "Foot-pound per second", symbol: "ft·lbf/s", factor: 1.3558179483314004 },
    { id: "ps", name: "Metric horsepower", symbol: "PS", factor: 735.49875 },
    { id: "hp", name: "Horsepower", symbol: "hp", factor: 745.6998715822702 },
    { id: "kw", name: "Kilowatt", symbol: "kW", factor: 1e3 },
    { id: "megawatt", name: "Megawatt", symbol: "MW", factor: 1e6 },
    { id: "gigawatt", name: "Gigawatt", symbol: "GW", factor: 1e9 },
  ],
};
