import type { SyntaxNode } from "@lezer/common";
import { parser as xmlParser } from "@lezer/xml";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Index, shard } from "./ip-shards.ts";

export const RELEASE = "20260901";

export const IANA_RELEASE = "2026-08-20";

const SHAPE = 2;

const PER_SHARD = 2048;

const REGISTRIES = {
  "ipv4-space": "ipv4-address-space/ipv4-address-space.xml",
  "ipv6-space": "ipv6-unicast-address-assignments/ipv6-unicast-address-assignments.xml",
  "as-numbers": "as-numbers/as-numbers.xml",
  "multicast-v4": "multicast-addresses/multicast-addresses.xml",
  "multicast-v6": "ipv6-multicast-addresses/ipv6-multicast-addresses.xml",
};

const NOTABLE_V4 = [
  ["224.0.0.0", "224.0.1.255"],
  ["232.0.0.0", "232.255.255.255"],
  ["233.252.0.0", "233.252.0.255"],
  ["239.255.255.250", "239.255.255.255"],
];

const cache = join(import.meta.dirname, "../.build", `ip-registry-${RELEASE}-${IANA_RELEASE}`);
const utility = join(import.meta.dirname, "../src/utilities/ip-address");
const tables = join(utility, "tables");
const delegations = join(utility, "delegations");
const stampFile = join(tables, "registry-stamp.txt");
const stamp = `${RELEASE} ${IANA_RELEASE} ${SHAPE}\n`;

if (import.meta.filename === process.argv[1]) {
  if (await readIfPresent(stampFile) === stamp) console.log("ip-registry: tables are current");
  else await writeRegistry();
}

async function writeRegistry(): Promise<void> {
  await mkdir(tables, { recursive: true });
  await rm(delegations, { recursive: true, force: true });
  await mkdir(delegations, { recursive: true });

  await write("ipv4-space.json", await ipv4Space());
  await write("ipv6-space.json", await ipv6Space());
  await write("as-numbers.json", await asNumbers());
  await write("multicast-v4.json", await multicast("multicast-v4", "ipv4"));
  await write("multicast-v6.json", await multicast("multicast-v6", "ipv6"));

  const index = await writeDelegations();
  await write("delegation-index.json", index);

  await writeFile(stampFile, stamp);
  const files = (await readdir(delegations)).length;
  console.log(
    `ip-registry: IANA ${IANA_RELEASE}, NRO ${RELEASE}, ${index.v4.length + index.v6.length + index.asn.length} `
      + `shards in ${files} files, ${await size()} MB`,
  );
}

function write(file: string, written: unknown): Promise<void> {
  return writeFile(join(tables, file), JSON.stringify(written));
}

async function ipv4Space(): Promise<[number, string, string, string, string, string][]> {
  return (await records("ipv4-space")).map(({ node, xml }) => [
    Number(child(node, "prefix", xml).split("/")[0]),
    child(node, "designation", xml),
    child(node, "status", xml),
    child(node, "date", xml),
    child(node, "whois", xml),
    rdap(node, xml),
  ]);
}

async function ipv6Space(): Promise<[string, string, string, string, string][]> {
  return (await records("ipv6-space")).map(({ node, xml }) => [
    child(node, "prefix", xml),
    child(node, "description", xml),
    child(node, "status", xml),
    child(node, "whois", xml),
    rdap(node, xml),
  ]);
}

async function asNumbers(): Promise<[number, number, string, string, string][]> {
  const rows: [number, number, string, string, string][] = [];
  for (const { node, xml } of await records("as-numbers")) {
    const numbers = child(node, "number", xml);
    if (!numbers || child(node, "description", xml).startsWith("See Sub-registry")) continue;
    const [first, last] = numbers.split("-");
    const row: [number, number, string, string, string] = [
      Number(first),
      Number(last ?? first),
      child(node, "description", xml),
      child(node, "whois", xml),
      rdap(node, xml),
    ];
    const previous = rows.at(-1);
    if (previous && previous[2] === row[2] && previous[3] === row[3] && previous[1] + 1 === row[0]) {
      previous[1] = row[1];
    } else rows.push(row);
  }
  return rows.sort((left, right) => left[0] - right[0]);
}

async function multicast(name: keyof typeof REGISTRIES, family: "ipv4" | "ipv6"): Promise<[string, string, string][]> {
  const notable = NOTABLE_V4.map(([from, to]) => [ipv4(from), ipv4(to)]);
  const rows: [string, string, string][] = [];

  for (const { node, xml } of await records(name)) {
    const addresses = child(node, "addr", xml) || child(node, "address", xml);
    const description = child(node, "description", xml).replace(/\s+/g, " ");
    if (!addresses || !description || /^(?:unassigned|reserved)$/i.test(description)) continue;

    const [first, last] = addresses.split("-").map((part) => part.trim().toLowerCase());
    if (family === "ipv4" && !notable.some(([from, to]) => ipv4(first) >= from && ipv4(first) <= to)) continue;
    rows.push([first, last === undefined || last === first ? "" : last, description]);
  }
  return rows;
}

async function writeDelegations(): Promise<DelegationIndex> {
  const lines = (await nroStats()).split("\n");
  const rirs: string[] = [];
  const countries: string[] = [];
  const v4: Range[] = [];
  const v6: Prefix[] = [];
  const asn: Range[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [rir, country, type, start, count, date, status] = line.split("|");
    if (!status || status === "summary" || start === "*") continue;
    if (status === "reserved" || status === "available") continue;

    const held: Held = { rir: index(rirs, rir), country: index(countries, country), date, status };
    if (type === "asn") asn.push({ ...held, start: BigInt(start), end: BigInt(start) + BigInt(count) - 1n });
    else if (type === "ipv4") v4.push({ ...held, start: ipv4(start), end: ipv4(start) + BigInt(count) - 1n });
    else if (type === "ipv6") v6.push({ ...held, start: ipv6(start), prefix: Number(count) });
  }

  const ranges = { v4: merge(v4), asn: merge(asn) };
  v6.sort((left, right) => compare(left.start, right.start));

  return {
    rirs,
    countries,
    v4: await shard(delegations, "v4", ranges.v4, PER_SHARD, (row) => row.start, encodeRanges),
    asn: await shard(delegations, "asn", ranges.asn, PER_SHARD, (row) => row.start, encodeRanges),
    v6: await shard(delegations, "v6", v6, PER_SHARD, (row) => row.start, encodePrefixes),
  };
}

interface DelegationIndex {
  rirs: string[];
  countries: string[];
  v4: Index;
  v6: Index;
  asn: Index;
}

interface Held {
  rir: number;
  country: number;
  date: string;
  status: string;
}

interface Range extends Held {
  start: bigint;
  end: bigint;
}

interface Prefix extends Held {
  start: bigint;
  prefix: number;
}

function encodeRanges(run: Range[]): (number | string)[] {
  const flat: (number | string)[] = [];
  let previous = 0n;
  for (const [position, row] of run.entries()) {
    flat.push(
      (position === 0 ? row.start : row.start - previous).toString(),
      (row.end - row.start).toString(),
      row.rir,
      row.country,
      row.date,
    );
    previous = row.start;
  }
  return flat;
}

function encodePrefixes(run: Prefix[]): (number | string)[] {
  return run.flatMap((row) => [row.start.toString(16), row.prefix, row.rir, row.country, row.date]);
}

function merge(rows: Range[]): Range[] {
  rows.sort((left, right) => compare(left.start, right.start));
  const merged: Range[] = [];
  for (const row of rows) {
    const previous = merged.at(-1);
    const same = previous && previous.rir === row.rir && previous.country === row.country && previous.date === row.date;
    if (same && previous.end + 1n === row.start) previous.end = row.end;
    else merged.push({ ...row });
  }
  return merged;
}

function index(list: string[], value: string): number {
  const found = list.indexOf(value);
  if (found >= 0) return found;
  return list.push(value) - 1;
}

function ipv4(text: string): bigint {
  return text.split(".").reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
}

function ipv6(text: string): bigint {
  const [head, tail] = text.split("::");
  const first = head ? head.split(":") : [];
  const last = tail ? tail.split(":") : [];
  const groups = tail === undefined
    ? first
    : [...first, ...Array(8 - first.length - last.length).fill("0"), ...last];
  return groups.reduce((value, group) => (value << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function compare(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function records(name: keyof typeof REGISTRIES): Promise<{ node: SyntaxNode; xml: string }[]> {
  const xml = await registry(name);
  return elements(xmlParser.parse(xml).topNode, xml)
    .filter((node) => tagName(node, xml) === "record")
    .map((node) => ({ node, xml }));
}

function elements(node: SyntaxNode, xml: string): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "Element") found.push(child);
    else if (child.name === "Document") found.push(...elements(child, xml));
  }
  return found.flatMap((element) => [element, ...elements(element, xml)]);
}

function tagName(element: SyntaxNode, xml: string): string {
  const name = element.getChild("OpenTag")?.getChild("TagName");
  return name ? xml.slice(name.from, name.to) : "";
}

function rdap(element: SyntaxNode, xml: string): string {
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.name === "Element" && tagName(node, xml) === "rdap") return child(node, "server", xml);
  }
  return "";
}

function child(element: SyntaxNode, name: string, xml: string): string {
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.name !== "Element" || tagName(node, xml) !== name) continue;
    let found = "";
    for (let inner = node.firstChild; inner; inner = inner.nextSibling) {
      if (inner.name === "Text") found += xml.slice(inner.from, inner.to);
    }
    return found.trim();
  }
  return "";
}

function registry(name: keyof typeof REGISTRIES): Promise<string> {
  return download(`${name}.xml`, `https://www.iana.org/assignments/${REGISTRIES[name]}`);
}

function nroStats(): Promise<string> {
  return download(
    "nro-delegated-stats",
    `https://ftp.ripe.net/pub/stats/ripencc/nro-stats/${RELEASE}/nro-delegated-stats`,
  );
}

async function download(name: string, url: string): Promise<string> {
  const held = join(cache, name);
  if (!existsSync(held)) {
    await mkdir(cache, { recursive: true });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ip-registry: ${url} answered ${response.status}`);
    await writeFile(`${held}.part`, await response.text());
    await rename(`${held}.part`, held);
    console.log(`ip-registry: fetched ${name}`);
  }
  return readFile(held, "utf8");
}

async function readIfPresent(path: string): Promise<string | undefined> {
  return existsSync(path) ? readFile(path, "utf8") : undefined;
}

async function size(): Promise<string> {
  let bytes = 0;
  for (const directory of [tables, delegations]) {
    for (const name of await readdir(directory)) bytes += (await stat(join(directory, name))).size;
  }
  return (bytes / 1_000_000).toFixed(1);
}
