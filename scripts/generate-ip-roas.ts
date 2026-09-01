import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { type Index, shardCovering } from "./ip-shards.ts";

const run = promisify(execFile);

export const RELEASE = "2026/09/01";

const SHAPE = 1;

const PER_SHARD = 2048;

const ANCHORS = ["afrinic", "apnic", "arin", "lacnic", "ripencc"];

const cache = join(import.meta.dirname, "../.build", `ip-roas-${RELEASE.replaceAll("/", "-")}`);
const utility = join(import.meta.dirname, "../src/utilities/ip-address");
const tables = join(utility, "tables");
const roas = join(utility, "roas");
const stampFile = join(tables, "roa-stamp.txt");
const stamp = `${RELEASE} ${SHAPE}\n`;

if (import.meta.filename === process.argv[1]) {
  if (await readIfPresent(stampFile) === stamp) console.log("ip-roas: shards are current");
  else await writeRoas();
}

async function writeRoas(): Promise<void> {
  await mkdir(tables, { recursive: true });
  await rm(roas, { recursive: true, force: true });
  await mkdir(roas, { recursive: true });

  const { v4, v6, authorised } = await readAnchors();
  console.log(`ip-roas: ${v4.length} IPv4 prefixes, ${v6.length} IPv6, ${authorised} distinct AS numbers`);

  const four = await shardCovering(roas, "v4", v4, PER_SHARD, start, end, encodeV4);
  const six = await shardCovering(roas, "v6", v6, PER_SHARD, start, end, encodeV6);

  const index: RoaIndex = { release: RELEASE, v4: four.index, v6: six.index };
  await writeFile(join(tables, "roa-index.json"), JSON.stringify(index));
  await writeFile(stampFile, stamp);

  const rows = v4.length + v6.length;
  const repeated = four.written + six.written - rows;
  console.log(
    `ip-roas: ${RELEASE}, ${four.index.length + six.index.length} shards, `
      + `${repeated} covering rows repeated (${(repeated / rows * 100).toFixed(1)}%), ${await size()} MB`,
  );
}

interface RoaIndex {
  release: string;
  v4: Index;
  v6: Index;
}

interface Roa {
  start: bigint;
  prefix: number;
  maxLength: number;
  origins: number[];
}

function start(roa: Roa): bigint {
  return roa.start;
}

function end(roa: Roa): bigint {
  return roa.start + (1n << BigInt((roa.prefix > 32 ? 128 : 32) - roa.prefix)) - 1n;
}

async function readAnchors(): Promise<{ v4: Roa[]; v6: Roa[]; authorised: number }> {
  const found = new Map<string, Roa>();
  const numbers = new Set<number>();

  for (const anchor of ANCHORS) {
    const csv = await roaCsv(anchor);
    for (const line of csv.split("\n")) {
      if (!line || line.startsWith("URI,")) continue;
      const [, as, prefix, max] = line.split(",");
      const origin = Number((as ?? "").replace(/^AS/i, ""));
      if (!origin || !prefix) continue;

      const [body, width] = prefix.split("/");
      const length = Number(width);
      const key = `${prefix}/${max}`;
      const held = found.get(key);
      if (held) {
        if (!held.origins.includes(origin)) held.origins.push(origin);
      } else {
        found.set(key, {
          start: body.includes(":") ? ipv6(body) : ipv4(body),
          prefix: length,
          maxLength: Number(max) || length,
          origins: [origin],
        });
      }
      numbers.add(origin);
    }
  }

  const rows = [...found.values()];
  const order = (left: Roa, right: Roa) =>
    left.start < right.start ? -1 : left.start > right.start ? 1 : left.prefix - right.prefix;

  return {
    v4: rows.filter((roa) => roa.prefix <= 32 && roa.start < 1n << 32n).sort(order),
    v6: rows.filter((roa) => !(roa.prefix <= 32 && roa.start < 1n << 32n)).sort(order),
    authorised: numbers.size,
  };
}

function encodeV4(held: Roa[], from: bigint): [number, number, number, number[]][] {
  let previous = from;
  return held.map((roa) => {
    const step = Number(roa.start - previous);
    previous = roa.start;
    return [step, roa.prefix, roa.maxLength, roa.origins];
  });
}

function encodeV6(held: Roa[]): [string, number, number, number[]][] {
  return held.map((roa) => [roa.start.toString(16), roa.prefix, roa.maxLength, roa.origins]);
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

async function roaCsv(anchor: string): Promise<string> {
  const held = join(cache, `${anchor}.csv.xz`);
  if (!existsSync(held)) {
    await mkdir(cache, { recursive: true });
    const url = `https://ftp.ripe.net/rpki/${anchor}.tal/${RELEASE}/roas.csv.xz`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ip-roas: ${url} answered ${response.status}`);
    await writeFile(`${held}.part`, Buffer.from(await response.arrayBuffer()));
    await rename(`${held}.part`, held);
    console.log(`ip-roas: fetched ${anchor}`);
  }

  try {
    const { stdout } = await run("xz", ["-dc", held], { maxBuffer: 256 * 1024 * 1024 });
    return stdout;
  } catch (cause) {
    throw new Error("ip-roas: the RIRs publish these as xz, so `xz` has to be on the path", { cause });
  }
}

async function readIfPresent(path: string): Promise<string | undefined> {
  return existsSync(path) ? readFile(path, "utf8") : undefined;
}

async function size(): Promise<string> {
  let bytes = 0;
  for (const name of await readdir(roas)) bytes += (await stat(join(roas, name))).size;
  return (bytes / 1_000_000).toFixed(1);
}
