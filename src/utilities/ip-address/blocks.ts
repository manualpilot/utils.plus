import { type Address, BITS, type Family } from "./parse";

export interface Block {
  family: Family;
  network: bigint;
  prefix: number;
}

export interface Hosts {
  first: bigint;
  last: bigint;
  usable: bigint;
}

export function blockOf({ family, value }: Address, prefix: number): Block {
  return { family, network: value & maskFor(family, prefix), prefix };
}

export function maskFor(family: Family, prefix: number): bigint {
  return ((1n << BigInt(prefix)) - 1n) << BigInt(BITS[family] - prefix);
}

export function wildcardFor(family: Family, prefix: number): bigint {
  return (1n << BigInt(BITS[family] - prefix)) - 1n;
}

export function sizeOf({ family, prefix }: Block): bigint {
  return 1n << BigInt(BITS[family] - prefix);
}

export function lastOf(block: Block): bigint {
  return block.network + sizeOf(block) - 1n;
}

export function holds(block: Block, value: bigint): boolean {
  return value >= block.network && value <= lastOf(block);
}

export function holdsBlock(outer: Block, inner: Block): boolean {
  return inner.network >= outer.network && lastOf(inner) <= lastOf(outer);
}

export function hostsOf(block: Block): Hosts {
  const size = sizeOf(block);
  const last = lastOf(block);
  if (block.family === "ipv6" || size <= 2n) return { first: block.network, last, usable: size };
  return { first: block.network + 1n, last: last - 1n, usable: size - 2n };
}

export function splitCount(block: Block, prefix: number): bigint {
  if (prefix <= block.prefix || prefix > BITS[block.family]) return 0n;
  return 1n << BigInt(prefix - block.prefix);
}

export function split(block: Block, prefix: number, limit: number): Block[] {
  const count = splitCount(block, prefix);
  const shown = count < BigInt(limit) ? count : BigInt(limit);
  const step = 1n << BigInt(BITS[block.family] - prefix);

  const blocks: Block[] = [];
  for (let index = 0n; index < shown; index++) {
    blocks.push({ family: block.family, network: block.network + index * step, prefix });
  }
  return blocks;
}

export function roleOf({ family, value }: Address, block: Block): string {
  const size = sizeOf(block);
  if (size === 1n) return "A single address";
  if (family === "ipv4" && size === 2n) return "Usable host";
  if (value === block.network) return "Network address";
  if (family === "ipv4" && value === lastOf(block)) return "Broadcast address";
  return "Usable host";
}
