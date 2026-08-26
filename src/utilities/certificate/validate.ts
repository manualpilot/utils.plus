import { DAY_MS } from "./algorithms";
import { addressBytes } from "./names";

export function isHostOrAddress(value: string): boolean {
  return isAddress(value) || isHostName(value);
}

export function isHostName(value: string): boolean {
  if (value.length > 253) return false;
  const labels = value.split(".");
  if (labels[0] === "*") labels.shift();
  if (labels.length === 0 || !labels.every((label) => HOST_LABEL.test(label))) return false;
  return !/^\d+$/.test(labels[labels.length - 1]);
}

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function isAddress(value: string): boolean {
  return addressBytes(value) !== null;
}

export function splitAltNames(value: string): string[] {
  return value.split(/[,\s]+/).filter((entry) => entry !== "");
}

export function isCountry(value: string): boolean {
  return /^[A-Za-z]{2}$/.test(value);
}

export function parseWhole(value: number | string, max: number): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= max ? rounded : null;
}

export function clampWhole(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function expiryLabel(days: number): string {
  return `Until ${new Date(Date.now() + days * DAY_MS).toLocaleDateString()}`;
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : "This certificate could not be made";
}
