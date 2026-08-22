import type { Algorithm } from "./hotp";

export type Mode = keyof typeof MODES;

export const MODES = {
  totp: { label: "TOTP", title: "Time-Based OTP" },
  hotp: { label: "HOTP", title: "Counter-Based OTP" },
  ocra: { label: "OCRA", title: "Challenge-Response OTP" },
};

export const MODE_OPTIONS = Object.entries(MODES).map(([value, { label }]) => ({ value, label }));

export const ALGORITHM_OPTIONS = [
  { value: "SHA1", label: "SHA-1" },
  { value: "SHA256", label: "SHA-256" },
  { value: "SHA512", label: "SHA-512" },
];

export const SECRET_SIZES: Record<Algorithm, number> = { SHA1: 20, SHA256: 32, SHA512: 64 };

export interface Range {
  min: number;
  max: number;
}

export const DIGIT_RANGE: Range = { min: 4, max: 10 };
export const PERIOD_RANGE: Range = { min: 1, max: 3600 };
export const MAX_COUNTER = Number.MAX_SAFE_INTEGER;

export const MAX_TIME = 8_640_000_000_000;

export const COUNTER_RANGE: Range = { min: 0, max: MAX_COUNTER };
export const TIME_RANGE: Range = { min: 0, max: MAX_TIME };

export function pickMode(value: unknown): Mode {
  return typeof value === "string" && value in MODES ? value as Mode : "totp";
}

export function pickAlgorithm(value: unknown): Algorithm {
  return ALGORITHM_OPTIONS.some((option) => option.value === value) ? value as Algorithm : "SHA1";
}

export function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function pickTextOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function parseWhole(value: number | string, { min, max }: Range): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

export function clampWhole(value: unknown, { min, max }: Range, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function describeCrypto(algorithm: Algorithm, digits: number): string {
  return digits === 0 ? `HMAC-${hashLabel(algorithm)}, untruncated` : `HMAC-${hashLabel(algorithm)}, ${digits} digits`;
}

export function hashLabel(algorithm: Algorithm): string {
  return ALGORITHM_OPTIONS.find((option) => option.value === algorithm)?.label ?? algorithm;
}
