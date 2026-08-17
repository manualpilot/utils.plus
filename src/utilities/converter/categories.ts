import { AREA } from "./area";
import { DATA } from "./data";
import { DISTANCE } from "./distance";
import { ENERGY } from "./energy";
import { MASS } from "./mass";
import { POWER } from "./power";
import { PRESSURE } from "./pressure";
import { SPEED } from "./speed";
import { TEMPERATURE } from "./temperature";
import type { Category, Unit } from "./unit";
import { VOLUME } from "./volume";

export const CATEGORIES: Category[] = [
  DISTANCE,
  AREA,
  VOLUME,
  MASS,
  TEMPERATURE,
  SPEED,
  DATA,
  ENERGY,
  POWER,
  PRESSURE,
];

export const CATEGORY_OPTIONS = CATEGORIES.map(({ id, label }) => ({ value: id, label }));

export const DEFAULT_AMOUNT = "1";

export function pickCategory(id: string | null | undefined): Category {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0];
}

export function pickUnit(category: Category, id: string | null | undefined): Unit {
  return category.units.find((unit) => unit.id === id)
    ?? category.units.find((unit) => unit.id === category.defaultUnit)
    ?? category.units[0];
}

export function unitOptions(category: Category) {
  return category.units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }));
}
