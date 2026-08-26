import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const RELEASE = "17.0.0";

const EMOJI_RELEASE = RELEASE.replace(/\.\d+$/, "");

const SHAPE = 2;

const NAMES_BITS = 12;

const DEFAULTS = { category: "Cn", script: "Unknown", block: "No Block", age: "" };

const COMPUTED: Record<string, Omit<Algorithmic, "start" | "end"> | undefined> = {
  "CJK Ideograph": { kind: "hex", prefix: "CJK UNIFIED IDEOGRAPH-" },
  "Tangut Ideograph": { kind: "hex", prefix: "TANGUT IDEOGRAPH-" },
  "Hangul Syllable": { kind: "hangul", prefix: "HANGUL SYLLABLE " },
};

const cache = join(import.meta.dirname, "../.build", `unicode-${RELEASE}`);
const utility = join(import.meta.dirname, "../src/utilities/unicode");
const tables = join(utility, "tables");
const names = join(utility, "names");
const stampFile = join(tables, "stamp.txt");
const stamp = `${RELEASE} ${SHAPE}\n`;

if (import.meta.filename === process.argv[1]) {
  if (await readIfPresent(stampFile) === stamp) console.log("unicode: tables are current");
  else await writeTables();
}

async function writeTables(): Promise<void> {
  const characters = await readCharacters();

  await rm(tables, { recursive: true, force: true });
  await rm(names, { recursive: true, force: true });
  await mkdir(tables, { recursive: true });
  await mkdir(names, { recursive: true });

  const files = nameFiles(characters.names);
  for (const [file, written] of Object.entries(files)) await writeFile(join(names, file), JSON.stringify(written));

  await write("categories.json", rangeTable(characters.categories, DEFAULTS.category));
  await write("scripts.json", rangeTable(await spans("Scripts.txt"), DEFAULTS.script));
  await write("blocks.json", rangeTable(await spans("Blocks.txt"), DEFAULTS.block));
  await write("ages.json", rangeTable(await spans("DerivedAge.txt"), DEFAULTS.age));
  await write("algorithmic.json", characters.algorithmic);
  await write("abbreviations.json", await abbreviations());
  await write("jamo.json", await jamo());
  await write("confusables.json", await confusables());
  await write("emoji.json", await emoji());

  await writeFile(stampFile, stamp);
  const written = Object.keys(files).length;
  console.log(`unicode: ${RELEASE}, ${characters.names.size} names in ${written} files, ${await size()} MB`);
}

function write(file: string, written: unknown): Promise<void> {
  return writeFile(join(tables, file), JSON.stringify(written));
}

interface Characters {
  names: Map<number, string>;
  categories: Span[];
  algorithmic: Algorithmic[];
}

interface Span {
  start: number;
  end: number;
  value: string;
}

interface Algorithmic {
  start: number;
  end: number;
  kind: "hex" | "hangul";
  prefix: string;
}

async function readCharacters(): Promise<Characters> {
  const found: Characters = { names: new Map(), categories: [], algorithmic: [] };
  let opened: { start: number; label: string; category: string } | undefined;

  for (const fields of records(await file("UnicodeData.txt"))) {
    const code = Number.parseInt(fields[0], 16);
    const [name, category] = [fields[1], fields[2]];
    const marker = /^<(.+), (First|Last)>$/.exec(name);

    if (marker?.[2] === "First") {
      opened = { start: code, label: marker[1], category };
      continue;
    }
    if (marker?.[2] === "Last" && opened) {
      found.categories.push({ start: opened.start, end: code, value: category });
      const computed = COMPUTED[opened.label.replace(/ (?:Extension|Supplement).*$/, "")];
      if (computed) found.algorithmic.push({ start: opened.start, end: code, ...computed });
      opened = undefined;
      continue;
    }

    found.categories.push({ start: code, end: code, value: category });
    if (!name.startsWith("<")) found.names.set(code, name);
  }

  for (const [code, name] of await aliases("control")) found.names.set(code, name);
  return found;
}

function nameFiles(found: Map<number, string>): Record<string, Record<string, string>> {
  const files: Record<string, Record<string, string>> = {};
  for (const [code, name] of [...found].sort(([a], [b]) => a - b)) {
    const file = `${hex(code >> NAMES_BITS, 3)}.json`;
    files[file] ??= {};
    files[file][hex(code & ((1 << NAMES_BITS) - 1), 3)] = name;
  }
  return files;
}

async function spans(name: string): Promise<Span[]> {
  return records(await file(name)).map((fields) => {
    const [start, end] = fields[0].split("..");
    return { start: Number.parseInt(start, 16), end: Number.parseInt(end ?? start, 16), value: fields[1] };
  });
}

async function aliases(kind: string): Promise<[number, string][]> {
  const found = new Map<number, string>();
  for (const fields of records(await file("NameAliases.txt"))) {
    const code = Number.parseInt(fields[0], 16);
    if (fields[2] === kind && !found.has(code)) found.set(code, fields[1]);
  }
  return [...found];
}

async function abbreviations(): Promise<Record<string, string>> {
  return Object.fromEntries((await aliases("abbreviation")).map(([code, name]) => [hex(code, 4), name]));
}

async function jamo(): Promise<Record<string, string[]>> {
  const short = new Map<number, string>();
  for (const fields of records(await file("Jamo.txt"))) short.set(Number.parseInt(fields[0], 16), fields[1] ?? "");

  const run = (start: number, count: number) => [...Array(count)].map((_, at) => short.get(start + at) ?? "");
  return { leading: run(0x1100, 19), vowel: run(0x1161, 21), trailing: ["", ...run(0x11A8, 27)] };
}

async function confusables(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const fields of records(await versionedFile("confusables.txt", "security", RELEASE))) {
    const source = fields[0].split(" ");
    const target = fields[1].split(" ").map((code) => Number.parseInt(code, 16));
    if (source.length !== 1 || !target.every((code) => code >= 0x20 && code < 0x7F)) continue;
    found[hex(Number.parseInt(source[0], 16), 4)] = String.fromCodePoint(...target);
  }
  return found;
}

async function emoji(): Promise<Record<string, [string, string][]>> {
  const groups: Record<string, [string, string][]> = {};
  let group = "";

  for (const line of (await versionedFile("emoji-test.txt", "emoji", EMOJI_RELEASE)).split("\n")) {
    const heading = /^#\s*group:\s*(.+)$/.exec(line);
    if (heading) group = heading[1].trim();

    const [body, comment] = [line.split("#")[0].trim(), line];
    if (body === "") continue;
    const [codes, status] = body.split(";").map((field) => field.trim());
    if (status !== "fully-qualified" && status !== "component") continue;

    const points = codes.split(" ").map((code) => Number.parseInt(code, 16));
    if (points.length > 1 && points.some((code) => code >= 0x1F3FB && code <= 0x1F3FF)) continue;
    const name = /#\s*\S+\s+E\d+(?:\.\d+)?\s+(.+)$/.exec(comment)?.[1]?.trim() ?? "";
    (groups[group] ??= []).push([String.fromCodePoint(...points), name]);
  }
  return groups;
}

function rangeTable(found: Span[], fallback: string): { values: string[]; runs: string } {
  const values: string[] = [];
  const indexes = new Map<string, number>();
  const runs: string[] = [];
  let start = 0;
  let carried = -1;
  let at = 0;

  const run = (from: number, value: string) => {
    let index = indexes.get(value);
    if (index === undefined) indexes.set(value, index = values.push(value) - 1);
    if (index === carried) return;
    runs.push(`${(from - start).toString(36)}.${index.toString(36)}`);
    start = from;
    carried = index;
  };

  for (const span of [...found].sort((a, b) => a.start - b.start)) {
    if (span.start > at) run(at, fallback);
    run(span.start, span.value);
    at = span.end + 1;
  }
  if (at <= 0x10FFFF) run(at, fallback);

  return { values, runs: runs.join(" ") };
}

function records(text: string): string[][] {
  return text.split("\n")
    .map((line) => line.split("#")[0].trim())
    .filter((line) => line !== "")
    .map((line) => line.split(";").map((field) => field.trim()));
}

function hex(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, "0");
}

async function file(name: string): Promise<string> {
  return download(name, `https://www.unicode.org/Public/${RELEASE}/ucd/${name}`);
}

async function versionedFile(name: string, directory: string, version: string): Promise<string> {
  const numbered = `https://www.unicode.org/Public/${directory}/${version}/${name}`;
  if (await answers(numbered)) return download(name, numbered);

  const text = await download(name, `https://www.unicode.org/Public/${directory}/latest/${name}`);
  const published = /^#\s*Version:\s*(\S+)/m.exec(text)?.[1];
  if (published !== version) {
    throw new Error(`unicode: ${directory}/latest/${name} is ${published}, not ${version}`);
  }
  return text;
}

async function answers(url: string): Promise<boolean> {
  return (await fetch(url, { method: "HEAD" })).ok;
}

async function download(name: string, url: string): Promise<string> {
  const held = join(cache, name);
  if (!existsSync(held)) {
    await mkdir(cache, { recursive: true });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`unicode: ${url} answered ${response.status}`);
    await writeFile(`${held}.part`, await response.text());
    await rename(`${held}.part`, held);
    console.log(`unicode: fetched ${name}`);
  }
  return readFile(held, "utf8");
}

async function readIfPresent(path: string): Promise<string | undefined> {
  return existsSync(path) ? readFile(path, "utf8") : undefined;
}

async function size(): Promise<string> {
  let bytes = 0;
  for (const directory of [tables, names]) {
    for (const name of await readdir(directory)) bytes += (await stat(join(directory, name))).size;
  }
  return (bytes / 1024 / 1024).toFixed(1);
}
