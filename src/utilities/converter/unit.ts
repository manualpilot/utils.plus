export interface Unit {
  id: string;
  name: string;
  symbol: string;
  factor: number;
  offset?: number;
}

export interface Category {
  id: string;
  label: string;
  units: Unit[];
  defaultUnit: string;
}

export function convert(value: number, from: Unit, to: Unit): number {
  const base = value * from.factor + (from.offset ?? 0);
  const converted = (base - (to.offset ?? 0)) / to.factor;
  return Math.abs(converted) < cancelledToNothing(from, to) ? 0 : converted;
}

function cancelledToNothing(from: Unit, to: Unit): number {
  return Math.max(Math.abs(from.offset ?? 0), Math.abs(to.offset ?? 0)) * 1e-12 / to.factor;
}
