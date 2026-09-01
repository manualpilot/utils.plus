import type { Address } from "./parse";
import { load, type Reading, shardFor, useShard } from "./shards";
import index from "./tables/delegation-index.json";

export interface Delegation {
  rir: string;
  country: string;
  date: string;
  first: bigint;
  last: bigint;
}

export function delegationOf({ family, value }: Address): Promise<Delegation | undefined> {
  return family === "ipv4" ? readRanges("v4", value) : readPrefixes(value);
}

export function asDelegationOf(number: number): Promise<Delegation | undefined> {
  return readRanges("asn", BigInt(number));
}

export function useDelegation(address: Address | undefined): Reading<Delegation> {
  return useShard(
    address && `${address.family}:${address.value}`,
    (asked) => {
      const [family, value] = asked.split(":");
      return family === "ipv4" ? readRanges("v4", BigInt(value)) : readPrefixes(BigInt(value));
    },
  );
}

export function useAsDelegation(number: number | undefined): Reading<Delegation> {
  return useShard(number === undefined ? undefined : String(number), (asked) => readRanges("asn", BigInt(asked)));
}

async function readRanges(name: "v4" | "asn", value: bigint): Promise<Delegation | undefined> {
  const shard = shardFor(INDEX[name], value);
  if (shard < 0) return undefined;

  const rows = await load<(number | string)[]>(url(name, shard));
  if (!rows) return undefined;

  let start = 0n;
  for (let at = 0; at < rows.length; at += 5) {
    const step = BigInt(rows[at] as string);
    start = at === 0 ? step : start + step;
    const end = start + BigInt(rows[at + 1] as string);
    if (value < start) return undefined;
    if (value <= end) return held(start, end, rows[at + 2] as number, rows[at + 3] as number, rows[at + 4] as string);
  }
  return undefined;
}

async function readPrefixes(value: bigint): Promise<Delegation | undefined> {
  const shard = shardFor(INDEX.v6, value);
  if (shard < 0) return undefined;

  const rows = await load<(number | string)[]>(url("v6", shard));
  if (!rows) return undefined;

  for (let at = 0; at < rows.length; at += 5) {
    const start = BigInt(`0x${rows[at] as string}`);
    const end = start + (1n << BigInt(128 - (rows[at + 1] as number))) - 1n;
    if (value < start) return undefined;
    if (value <= end) return held(start, end, rows[at + 2] as number, rows[at + 3] as number, rows[at + 4] as string);
  }
  return undefined;
}

function held(first: bigint, last: bigint, rir: number, country: number, date: string): Delegation {
  return {
    rir: INDEX.rirs[rir] ?? "",
    country: INDEX.countries[country] ?? "",
    date: /^\d{8}$/.test(date) && date !== "00000000"
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
      : "",
    first,
    last,
  };
}

const FILES = import.meta.glob("./delegations/*.json", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

function url(name: string, shard: number): string | undefined {
  return FILES[`./delegations/${name}-${shard}.json`];
}

const INDEX = index as { rirs: string[]; countries: string[]; v4: string[]; v6: string[]; asn: string[] };

export function flagOf(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return "";
  return [...country].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
}
