import type { SyntaxNode } from "@lezer/common";
import { parser as xmlParser } from "@lezer/xml";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const RELEASE = "v9.0.38";

const LOCALE = "en";

const KINDS = [
  "shortCode",
  "emergency",
  "tollFree",
  "standardRate",
  "premiumRate",
  "carrierSpecific",
  "smsServices",
] as const;

type Kind = (typeof KINDS)[number];

type ShortNumbers = Partial<Record<Kind, string>>;

const SHAPE = 3;

const cache = join(import.meta.dirname, "../.build");
const archive = join(cache, `libphonenumber-${RELEASE}.tar.gz`);
const source = join(cache, `libphonenumber-${RELEASE}`);
const out = join(import.meta.dirname, "../src/utilities/phone-number/maps");
const shortFile = join(import.meta.dirname, "../src/utilities/phone-number/short-numbers.json");
const stampFile = join(out, "stamp.txt");
const stamp = `${RELEASE} ${SHAPE}\n`;

if (import.meta.filename === process.argv[1]) {
  if (await readIfPresent(stampFile) === stamp) console.log("phone-geo: maps are current");
  else await writeMaps();
}

async function writeMaps(): Promise<void> {
  await release();

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const codes = [...new Set([...await callingCodes("geocoding"), ...await callingCodes("carrier")])].sort();
  for (const code of codes) {
    const geo = await prefixes("geocoding", code);
    const carrier = await prefixes("carrier", code);
    await writeFile(join(out, `${code}.json`), JSON.stringify({ geo, carrier }));
  }

  await writeFile(join(out, "zones.json"), JSON.stringify(await zones()));

  const short = await shortNumbers();
  await writeFile(shortFile, JSON.stringify(short));

  await writeFile(stampFile, stamp);
  const regions = Object.keys(short).length;
  console.log(
    `phone-geo: ${RELEASE}, ${codes.length} calling codes, ${regions} regions of short codes, ${await size()} MB`,
  );
}

async function release(): Promise<void> {
  if (!existsSync(archive)) {
    await mkdir(cache, { recursive: true });
    const url = `https://codeload.github.com/google/libphonenumber/tar.gz/refs/tags/${RELEASE}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`phone-geo: ${url} answered ${response.status}`);
    await writeFile(`${archive}.part`, Buffer.from(await response.arrayBuffer()));
    await rename(`${archive}.part`, archive);
    console.log(`phone-geo: fetched ${RELEASE}`);
  }

  await rm(source, { recursive: true, force: true });
  await mkdir(source, { recursive: true });
  const inside = `libphonenumber-${RELEASE.replace(/^v/, "")}/resources`;
  await run("tar", [
    "-xzf",
    archive,
    "--strip-components=1",
    "-C",
    source,
    `${inside}/geocoding/${LOCALE}`,
    `${inside}/carrier/${LOCALE}`,
    `${inside}/timezones/map_data.txt`,
    `${inside}/ShortNumberMetadata.xml`,
  ]);
}

async function callingCodes(kind: string): Promise<string[]> {
  const names = await readdir(join(source, "resources", kind, LOCALE));
  return names.filter((name) => name.endsWith(".txt")).map((name) => name.slice(0, -".txt".length));
}

async function prefixes(kind: string, code: string): Promise<Record<string, string>> {
  const file = join(source, "resources", kind, LOCALE, `${code}.txt`);
  return existsSync(file) ? prefixMap(await readFile(file, "utf8")) : {};
}

async function zones(): Promise<Record<string, string[]>> {
  const map = prefixMap(await readFile(join(source, "resources", "timezones", "map_data.txt"), "utf8"));
  return Object.fromEntries(Object.entries(map).map(([prefix, joined]) => [prefix, joined.split("&")]));
}

async function shortNumbers(): Promise<Record<string, ShortNumbers>> {
  const xml = await readFile(join(source, "resources", "ShortNumberMetadata.xml"), "utf8");
  const found: Record<string, ShortNumbers> = {};

  for (const territory of elements(xmlParser.parse(xml).topNode, xml)) {
    if (tagName(territory, xml) !== "territory") continue;
    const region = attribute(territory, "id", xml);
    const patterns: ShortNumbers = {};
    for (const kind of KINDS) {
      const pattern = childOf(childOf(territory, kind, xml), "nationalNumberPattern", xml);
      if (pattern) patterns[kind] = text(pattern, xml).replace(/\s+/g, "");
    }
    if (region && patterns.shortCode) found[region] = patterns;
  }
  return found;
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

function childOf(element: SyntaxNode | undefined, name: string, xml: string): SyntaxNode | undefined {
  if (!element) return undefined;
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.name === "Element" && tagName(child, xml) === name) return child;
  }
  return undefined;
}

function attribute(element: SyntaxNode, name: string, xml: string): string | undefined {
  for (const found of element.getChild("OpenTag")?.getChildren("Attribute") ?? []) {
    const key = found.getChild("AttributeName");
    const value = found.getChild("AttributeValue");
    if (key && value && xml.slice(key.from, key.to) === name) return xml.slice(value.from + 1, value.to - 1);
  }
  return undefined;
}

function text(element: SyntaxNode, xml: string): string {
  let found = "";
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.name === "Text") found += xml.slice(child.from, child.to);
  }
  return found;
}

function prefixMap(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const at = trimmed.indexOf("|");
    if (at === -1 || trimmed.startsWith("#")) continue;
    map[trimmed.slice(0, at)] = trimmed.slice(at + 1);
  }
  return map;
}

async function readIfPresent(file: string): Promise<string | undefined> {
  return existsSync(file) ? await readFile(file, "utf8") : undefined;
}

async function size(): Promise<string> {
  const names = await readdir(out);
  const bytes = await Promise.all(names.map(async (name) => (await readFile(join(out, name))).length));
  return (bytes.reduce((total, length) => total + length, 0) / 1e6).toFixed(1);
}
