import type { Region } from "./regions";
import numbers from "./short-numbers.json";

export interface Short {
  region: Region;
  digits: string;
  emergency: boolean;
  cost: string;
  carrierSpecific: boolean;
  smsService: boolean;
}

const SHORT: Record<string, Patterns | undefined> = numbers;

interface Patterns {
  shortCode: string;
  emergency?: string;
  tollFree?: string;
  standardRate?: string;
  premiumRate?: string;
  carrierSpecific?: string;
  smsServices?: string;
}

export function shortReading(digits: string, region: Region): Short | undefined {
  const patterns = SHORT[region.code];
  if (!patterns || !matches(patterns.shortCode, digits)) return undefined;

  const emergency = matches(patterns.emergency, digits);
  return {
    region,
    digits,
    emergency,
    cost: cost(patterns, digits, emergency),
    carrierSpecific: matches(patterns.carrierSpecific, digits),
    smsService: matches(patterns.smsServices, digits),
  };
}

function cost(patterns: Patterns, digits: string, emergency: boolean): string {
  if (matches(patterns.premiumRate, digits)) return "Premium rate";
  if (matches(patterns.standardRate, digits)) return "Standard rate";
  if (matches(patterns.tollFree, digits) || emergency) return "Toll free";
  return "Unknown cost";
}

function matches(pattern: string | undefined, digits: string): boolean {
  if (!pattern) return false;
  let expression = compiled.get(pattern);
  if (!expression) compiled.set(pattern, expression = new RegExp(`^(?:${pattern})$`));
  return expression.test(digits);
}

const compiled = new Map<string, RegExp>();
