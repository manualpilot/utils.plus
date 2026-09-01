import { type Address, BITS, type Family } from "./parse";
import { load, type Reading, shardFor, shardStart, useShard } from "./shards";
import index from "./tables/roa-index.json";
import { writeValue } from "./write";

const INDEX = index as { release: string; v4: string[]; v6: string[] };

export interface Origins {
  covering: Roa[];
  release: string;
}

export interface Roa {
  cidr: string;
  prefix: number;
  maxLength: number;
  origins: number[];
}

export function originsOf({ family, value }: Address): Promise<Origins | undefined> {
  return family === "ipv4" ? readV4(value) : readV6(value);
}

export function useOrigins(address: Address | undefined): Reading<Origins> {
  return useShard(address && `${address.family}:${address.value}`, (asked) => {
    const [family, value] = asked.split(":");
    return family === "ipv4" ? readV4(BigInt(value)) : readV6(BigInt(value));
  });
}

async function readV4(value: bigint): Promise<Origins | undefined> {
  const shard = shardFor(INDEX.v4, value);
  if (shard < 0) return { covering: [], release: INDEX.release };

  const rows = await load<[number, number, number, number[]][]>(url("v4", shard));
  if (!rows) return undefined;

  const covering: Roa[] = [];
  let start = shardStart(INDEX.v4, shard);
  for (const [step, prefix, maxLength, origins] of rows) {
    start += BigInt(step);
    if (holds(start, prefix, value, "ipv4")) covering.push(roa(start, prefix, maxLength, origins, "ipv4"));
  }
  return { covering, release: INDEX.release };
}

async function readV6(value: bigint): Promise<Origins | undefined> {
  const shard = shardFor(INDEX.v6, value);
  if (shard < 0) return { covering: [], release: INDEX.release };

  const rows = await load<[string, number, number, number[]][]>(url("v6", shard));
  if (!rows) return undefined;

  const covering: Roa[] = [];
  for (const [start, prefix, maxLength, origins] of rows) {
    const at = BigInt(`0x${start}`);
    if (holds(at, prefix, value, "ipv6")) covering.push(roa(at, prefix, maxLength, origins, "ipv6"));
  }
  return { covering, release: INDEX.release };
}

function holds(start: bigint, prefix: number, value: bigint, family: Family): boolean {
  return value >= start && value <= start + (1n << BigInt(BITS[family] - prefix)) - 1n;
}

function roa(start: bigint, prefix: number, maxLength: number, origins: number[], family: Family): Roa {
  return { cidr: `${writeValue(start, family)}/${prefix}`, prefix, maxLength, origins };
}

const FILES = import.meta.glob("./roas/*.json", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

function url(name: string, shard: number): string | undefined {
  return FILES[`./roas/${name}-${shard}.json`];
}
