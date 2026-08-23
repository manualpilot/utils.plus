export type Family = "ipv4" | "ipv6";

export const BITS: Record<Family, number> = { ipv4: 32, ipv6: 128 };

export interface Address {
  family: Family;
  value: bigint;
  zone: string;
}

export interface Reading {
  address: Address;
  prefix: number;
}

export type Result =
  | { kind: "blank" }
  | { kind: "reading"; reading: Reading }
  | { kind: "error"; message: string };

export function readCidr(text: string, family: Family): Result {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "blank" };

  const slash = trimmed.indexOf("/");
  const address = parseAddress(slash < 0 ? trimmed : trimmed.slice(0, slash), family);
  if (address === null) return { kind: "error", message: ADDRESS_PROBLEM[family] };

  const prefix = slash < 0 ? BITS[family] : parsePrefix(trimmed.slice(slash + 1).trim(), family);
  if (prefix === null) return { kind: "error", message: `A prefix length is a whole number from 0 to ${BITS[family]}` };

  return { kind: "reading", reading: { address, prefix } };
}

export function parseAddress(text: string, family: Family): Address | null {
  const cut = text.indexOf("%");
  const zone = cut < 0 ? "" : text.slice(cut + 1);
  if (cut >= 0 && (family !== "ipv6" || zone === "")) return null;

  const value = parseValue(cut < 0 ? text : text.slice(0, cut), family);
  return value === null ? null : { family, value, zone };
}

function parseValue(text: string, family: Family): bigint | null {
  const whole = parseWhole(text);
  if (whole !== null) return whole < 1n << BigInt(BITS[family]) ? whole : null;
  return family === "ipv4" ? parseIpv4(text) : parseIpv6(text);
}

function parseWhole(text: string): bigint | null {
  if (/^\d+$/.test(text) || /^0[xX][0-9a-fA-F]+$/.test(text)) return BigInt(text);
  return null;
}

function parseIpv4(text: string): bigint | null {
  const octets = text.split(".");
  if (octets.length !== 4) return null;

  let value = 0n;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null;
    if (octet.length > 1 && octet.startsWith("0")) return null;
    const number = Number(octet);
    if (number > 255) return null;
    value = (value << 8n) | BigInt(number);
  }
  return value;
}

function parseIpv6(text: string): bigint | null {
  const halves = text.split("::");
  if (halves.length > 2) return null;

  const head = parseGroups(halves[0], halves.length === 1);
  const tail = halves.length === 2 ? parseGroups(halves[1], true) : [];
  if (head === null || tail === null) return null;

  const written = head.length + tail.length;
  if (halves.length === 1 ? written !== 8 : written > 7) return null;

  const groups = [...head, ...Array(8 - written).fill(0), ...tail];
  return groups.reduce<bigint>((value, group) => (value << 16n) | BigInt(group), 0n);
}

function parseGroups(half: string, embedded: boolean): number[] | null {
  if (half === "") return [];

  const tokens = half.split(":");
  const groups: number[] = [];
  for (const [index, token] of tokens.entries()) {
    if (embedded && index === tokens.length - 1 && token.includes(".")) {
      const quad = parseIpv4(token);
      if (quad === null) return null;
      groups.push(Number(quad >> 16n), Number(quad & 0xffffn));
      continue;
    }
    if (!/^[0-9a-fA-F]{1,4}$/.test(token)) return null;
    groups.push(parseInt(token, 16));
  }
  return groups;
}

function parsePrefix(text: string, family: Family): number | null {
  if (!/^\d{1,3}$/.test(text)) return null;
  const prefix = Number(text);
  return prefix <= BITS[family] ? prefix : null;
}

export function prefixOf(text: string, family: Family): number | null {
  const slash = text.indexOf("/");
  return slash < 0 ? BITS[family] : parsePrefix(text.slice(slash + 1).trim(), family);
}

export function withPrefix(text: string, prefix: number): string {
  const slash = text.indexOf("/");
  return `${(slash < 0 ? text : text.slice(0, slash)).trim()}/${prefix}`;
}

export function familyOf(text: string): Family | null {
  const body = text.split("/")[0].trim();
  if (body.includes(":")) return "ipv6";
  return body.includes(".") ? "ipv4" : null;
}

const ADDRESS_PROBLEM: Record<Family, string> = {
  ipv4: "Four numbers 0 to 255 separated by dots, or a whole number up to 4294967295",
  ipv6: "Up to eight groups of four hex digits, with :: standing in for a run of zeros",
};
