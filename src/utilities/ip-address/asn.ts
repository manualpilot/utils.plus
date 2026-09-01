export const AS_MAX = 4294967295;

export type AsResult =
  | { kind: "blank" }
  | { kind: "reading"; number: number }
  | { kind: "error"; message: string };

export const AS_PROBLEM = `An AS number is a whole number from 0 to ${AS_MAX}, written with or without AS in front`;

export function readAsNumber(text: string): AsResult {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "blank" };

  const digits = /^(?:[Aa][Ss])?(\d{1,10})$/.exec(trimmed)?.[1];
  if (digits === undefined) return { kind: "error", message: AS_PROBLEM };

  const number = Number(digits);
  return number <= AS_MAX ? { kind: "reading", number } : { kind: "error", message: AS_PROBLEM };
}

export function writeAsNumber(number: number): string {
  return `AS${number}`;
}

export function asWidth(number: number): string {
  return number <= 65535 ? "16-bit" : "32-bit";
}

export function reservedUse(number: number): string {
  for (const [first, last, use] of RESERVED) {
    if (number >= first && number <= last) return use;
  }
  return "";
}

const RESERVED: [number, number, string][] = [
  [64496, 64511, "Documentation and sample code — RFC 5398"],
  [64512, 65534, "Private use — RFC 6996"],
  [65535, 65535, "Reserved — RFC 7300"],
  [4200000000, 4294967294, "Private use — RFC 6996"],
  [4294967295, 4294967295, "Reserved — RFC 7300"],
];
