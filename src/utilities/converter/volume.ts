import type { Category } from "./unit";

export const VOLUME: Category = {
  id: "volume",
  label: "Volume",
  defaultUnit: "l",
  units: [
    { id: "ml", name: "Millilitre", symbol: "mL", factor: 1e-3 },
    { id: "cm3", name: "Cubic centimetre", symbol: "cm³", factor: 1e-3 },
    { id: "tsp", name: "Teaspoon (US)", symbol: "tsp", factor: 0.00492892159375 },
    { id: "tbsp", name: "Tablespoon (US)", symbol: "tbsp", factor: 0.01478676478125 },
    { id: "in3", name: "Cubic inch", symbol: "in³", factor: 0.016387064 },
    { id: "floz-imp", name: "Fluid ounce (imperial)", symbol: "fl oz", factor: 0.0284130625 },
    { id: "floz", name: "Fluid ounce (US)", symbol: "fl oz", factor: 0.0295735295625 },
    { id: "cup", name: "Cup (US)", symbol: "cup", factor: 0.2365882365 },
    { id: "pt", name: "Pint (US)", symbol: "pt", factor: 0.473176473 },
    { id: "pt-imp", name: "Pint (imperial)", symbol: "pt", factor: 0.56826125 },
    { id: "qt", name: "Quart (US)", symbol: "qt", factor: 0.946352946 },
    { id: "l", name: "Litre", symbol: "L", factor: 1 },
    { id: "gal", name: "Gallon (US)", symbol: "gal", factor: 3.785411784 },
    { id: "gal-imp", name: "Gallon (imperial)", symbol: "gal", factor: 4.54609 },
    { id: "ft3", name: "Cubic foot", symbol: "ft³", factor: 28.316846592 },
    { id: "m3", name: "Cubic metre", symbol: "m³", factor: 1e3 },
  ],
};
