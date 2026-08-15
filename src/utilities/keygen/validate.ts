import { DAY_MS, HOST_LABEL } from "./algorithms";

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

export function isAddress(value: string): boolean {
  if (value.includes(":")) return isIpv6(value);
  const octets = value.split(".");
  return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

export function isIpv6(value: string): boolean {
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const groups = halves.map((half) => half === "" ? [] : half.split(":"));
  if (groups.some((half) => half.some((group) => !/^[0-9a-f]{1,4}$/i.test(group)))) return false;
  const written = groups.reduce((count, half) => count + half.length, 0);
  return halves.length === 2 ? written < 8 : written === 8;
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
  return e instanceof Error ? e.message : "Key generation failed";
}
