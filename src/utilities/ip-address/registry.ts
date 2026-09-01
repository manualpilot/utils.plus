import { type Address, BITS, type Family, parseAddress } from "./parse";
import asNumberTable from "./tables/as-numbers.json";
import ipv4Table from "./tables/ipv4-space.json";
import ipv6Table from "./tables/ipv6-space.json";
import multicastV4 from "./tables/multicast-v4.json";
import multicastV6 from "./tables/multicast-v6.json";

export interface Administration {
  designation: string;
  status: string;
  date: string;
  whois: string;
  rdap: string;
  cidr: string;
}

export function administrationOf({ family, value }: Address): Administration | undefined {
  return family === "ipv4" ? ipv4Administration(value) : ipv6Administration(value);
}

function ipv4Administration(value: bigint): Administration | undefined {
  const row = IPV4_SPACE.get(Number(value >> 24n));
  if (!row) return undefined;
  const [octet, designation, status, date, whois, rdap] = row;
  return { designation, status, date, whois, rdap, cidr: `${octet}.0.0.0/8` };
}

function ipv6Administration(value: bigint): Administration | undefined {
  for (const { start, end, row } of IPV6_SPACE) {
    if (value < start || value > end) continue;
    return { designation: row[1], status: row[2], date: "", whois: row[3], rdap: row[4], cidr: row[0] };
  }
  return undefined;
}

export function multicastGroup({ family, value }: Address): string {
  for (const { start, end, name, mask } of MULTICAST[family]) {
    const at = mask === undefined ? value : value & mask;
    if (at >= start && at <= end) return name;
  }
  return "";
}

export interface AsRange {
  first: number;
  last: number;
  designation: string;
  whois: string;
  rdap: string;
}

export function asRangeOf(number: number): AsRange | undefined {
  for (const [first, last, designation, whois, rdap] of AS_NUMBERS) {
    if (number >= first && number <= last) return { first, last, designation, whois, rdap };
  }
  return undefined;
}

const IPV4_SPACE = new Map(
  (ipv4Table as [number, string, string, string, string, string][]).map((row) => [row[0], row]),
);

const AS_NUMBERS = asNumberTable as [number, number, string, string, string][];

const IPV6_SPACE = (ipv6Table as [string, string, string, string, string][])
  .map((row) => {
    const { start, end } = range(row[0], "ipv6");
    return { start, end, row, prefix: Number(row[0].split("/")[1]) };
  })
  .sort((left, right) => right.prefix - left.prefix);

const SCOPE = ~(0xfn << 112n) & ((1n << 128n) - 1n);

interface Group {
  start: bigint;
  end: bigint;
  name: string;
  mask?: bigint;
}

const MULTICAST: Record<Family, Group[]> = {
  ipv4: groups(multicastV4 as [string, string, string][], "ipv4"),
  ipv6: groups(multicastV6 as [string, string, string][], "ipv6"),
};

function groups(rows: [string, string, string][], family: Family): Group[] {
  return rows.map(([first, last, name]) => {
    const scoped = first.includes("x");
    const mask = scoped ? SCOPE : undefined;
    const from = scoped ? first.replaceAll("x", "0") : first;
    const to = (scoped ? last.replaceAll("x", "0") : last) || from;
    if (from.includes("/")) return { ...range(from, family), name, mask };
    return { start: value(from, family), end: value(to, family), name, mask };
  });
}

function range(cidr: string, family: Family): { start: bigint; end: bigint } {
  const [body, width] = cidr.split("/");
  const prefix = Number(width);
  const start = value(body, family) & (((1n << BigInt(prefix)) - 1n) << BigInt(BITS[family] - prefix));
  return { start, end: start + (1n << BigInt(BITS[family] - prefix)) - 1n };
}

function value(text: string, family: Family): bigint {
  const address = parseAddress(text, family);
  if (address === null) throw new Error(`Not a ${family} address: ${text}`);
  return address.value;
}
