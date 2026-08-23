import type { Block } from "./blocks";
import { type Address, BITS, type Family } from "./parse";

export function writeAddress({ family, value, zone }: Address): string {
  return withZone(writeValue(value, family), zone);
}

export function writeValue(value: bigint, family: Family): string {
  return family === "ipv4" ? writeQuad(value) : compress(hextets(value));
}

export function writeCidr(block: Block): string {
  return `${writeValue(block.network, block.family)}/${block.prefix}`;
}

export function writeExpanded({ family, value, zone }: Address): string {
  if (family === "ipv4") return withZone(writeQuad(value), zone);
  return withZone(hextets(value).map((group) => group.toString(16).padStart(4, "0")).join(":"), zone);
}

export function writeInteger({ value }: Address): string {
  return value.toString();
}

export function writeHex({ family, value }: Address): string {
  return `0x${value.toString(16).padStart(BITS[family] / 4, "0")}`;
}

export function writeBinary({ value }: Address): string {
  return octets(value).map((octet) => octet.toString(2).padStart(8, "0")).join(".");
}

export function writeArpa({ family, value }: Address): string {
  if (family === "ipv4") return `${octets(value).reverse().join(".")}.in-addr.arpa`;
  return `${[...value.toString(16).padStart(32, "0")].reverse().join(".")}.ip6.arpa`;
}

export function writeCount(value: bigint): string {
  return value.toLocaleString("en-US");
}

export function embeddedIpv4({ family, value }: Address): string {
  if (family !== "ipv6") return "";
  const groups = hextets(value);
  const mapped = groups[5] === 0xffff && groups.slice(0, 5).every((group) => group === 0);
  const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0);
  if (!mapped && !nat64) return groups[0] === 0x2002 ? writeQuad((value >> 80n) & 0xffffffffn) : "";
  return writeQuad(value & 0xffffffffn);
}

function withZone(text: string, zone: string): string {
  return zone ? `${text}%${zone}` : text;
}

function writeQuad(value: bigint): string {
  return octets(value).join(".");
}

function octets(value: bigint): number[] {
  return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 0xffn));
}

function hextets(value: bigint): number[] {
  const groups: number[] = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) groups.push(Number((value >> shift) & 0xffffn));
  return groups;
}

function compress(groups: number[]): string {
  if (groups[5] === 0xffff && groups.slice(0, 5).every((group) => group === 0)) {
    return `::ffff:${writeQuad((BigInt(groups[6]) << 16n) | BigInt(groups[7]))}`;
  }

  let start = -1;
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index <= groups.length; index++) {
    if (index < groups.length && groups[index] === 0) {
      if (start < 0) start = index;
      continue;
    }
    if (start >= 0 && index - start > bestLength) {
      bestStart = start;
      bestLength = index - start;
    }
    start = -1;
  }

  const written = groups.map((group) => group.toString(16));
  if (bestLength < 2) return written.join(":");
  return `${written.slice(0, bestStart).join(":")}::${written.slice(bestStart + bestLength).join(":")}`;
}
