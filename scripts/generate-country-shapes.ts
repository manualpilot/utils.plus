import mapshaper from "mapshaper";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import countries from "world-countries";

export const RELEASE = "v5.1.2";

const VIEWS: Record<string, string> = {
  arg: "AR",
  bdg: "BD",
  bra: "BR",
  chn: "CN",
  deu: "DE",
  egy: "EG",
  esp: "ES",
  fra: "FR",
  gbr: "GB",
  grc: "GR",
  idn: "ID",
  ind: "IN",
  isr: "IL",
  ita: "IT",
  jpn: "JP",
  kor: "KR",
  mar: "MA",
  nep: "NP",
  nld: "NL",
  pak: "PK",
  pol: "PL",
  prt: "PT",
  pse: "PS",
  rus: "RU",
  sau: "SA",
  swe: "SE",
  tur: "TR",
  twn: "TW",
  ukr: "UA",
  usa: "US",
  vnm: "VN",
};

const DETAIL = 100;

const PRECISION = 0.001;

const NO_CODE = "-99";

const SHAPE = 3;

type Ring = number[];
type Polygon = Ring[];
type Shape = Polygon[];
type World = Record<string, Shape>;

type Point = [number, number];

interface View {
  absent: Record<string, string>;
  shapes: World;
}

type Geometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

interface Collection {
  features: { geometry: Geometry | null; properties: { ISO_A2_EH: string } }[];
}

const cache = join(import.meta.dirname, "../.build");
const source = join(cache, `natural-earth-${RELEASE}`);
const out = join(import.meta.dirname, "../src/utilities/countries");
const views = join(out, "views");
const worldFile = join(out, "world.json");
const stampFile = join(views, "stamp.txt");
const stamp = `${RELEASE} ${SHAPE} ${DETAIL} ${PRECISION}\n`;

if (import.meta.filename === process.argv[1]) {
  if (await readIfPresent(stampFile) === stamp) console.log("country-shapes: boundaries are current");
  else await writeShapes();
}

async function writeShapes(): Promise<void> {
  await mkdir(source, { recursive: true });

  const world = await boundaries();
  await writeFile(worldFile, JSON.stringify({ absent: unmapped(world), shapes: world }));

  await rm(views, { recursive: true, force: true });
  await mkdir(views, { recursive: true });

  for (const [suffix, code] of Object.entries(VIEWS)) {
    await writeFile(join(views, `${code}.json`), JSON.stringify(patch(world, await boundaries(suffix))));
  }

  await writeFile(stampFile, stamp);
  console.log(
    `country-shapes: ${RELEASE}, ${Object.keys(world).length} countries, `
      + `${Object.keys(VIEWS).length} points of view, ${await size()} MB`,
  );
}

function unmapped(world: World): Record<string, string> {
  const absent: Record<string, string> = {};
  for (const country of countries) {
    if (country.cca2 in world) continue;
    const [latitude, longitude] = country.latlng;
    absent[country.cca2] = containing(world, [longitude, latitude]) ?? "";
  }
  return absent;
}

function patch(world: World, view: World): View {
  const shapes: World = {};
  const absent: Record<string, string> = {};

  for (const [code, country] of Object.entries(world)) {
    if (!(code in view)) absent[code] = containing(view, somewhereInside(country)) ?? "";
    else if (JSON.stringify(view[code]) !== JSON.stringify(country)) shapes[code] = view[code];
  }
  for (const [code, country] of Object.entries(view)) {
    if (!(code in world)) shapes[code] = country;
  }

  return { absent, shapes };
}

function containing(view: World, point: Point | undefined): string | undefined {
  if (!point) return undefined;

  for (const [code, country] of Object.entries(view)) {
    for (const polygon of country) {
      if (encloses(polygon[0], point) && !polygon.slice(1).some((hole) => encloses(hole, point))) return code;
    }
  }
  return undefined;
}

function somewhereInside(country: Shape): Point | undefined {
  const polygon = [...country].sort((a, b) => span(b[0]) - span(a[0]))[0];
  if (!polygon) return undefined;

  const ring = polygon[0];
  const holes = polygon.slice(1);
  const y = (least(ring, 1) + most(ring, 1)) / 2;

  const crossings: number[] = [];
  for (let at = 0; at < ring.length - 2; at += 2) {
    const [x1, y1, x2, y2] = ring.slice(at, at + 4);
    if ((y1 > y) !== (y2 > y)) crossings.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
  }
  crossings.sort((a, b) => a - b);

  const runs: [number, number][] = [];
  for (let at = 0; at + 1 < crossings.length; at += 2) runs.push([crossings[at], crossings[at + 1]]);

  for (const [from, to] of runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))) {
    const point: Point = [(from + to) / 2, y];
    if (!holes.some((hole) => encloses(hole, point))) return point;
  }
  return undefined;
}

function encloses(ring: Ring, [x, y]: Point): boolean {
  let inside = false;
  for (let at = 0; at < ring.length - 2; at += 2) {
    const [x1, y1, x2, y2] = ring.slice(at, at + 4);
    if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) / (y2 - y1) * (x2 - x1)) inside = !inside;
  }
  return inside;
}

function span(ring: Ring): number {
  return (most(ring, 0) - least(ring, 0)) * (most(ring, 1) - least(ring, 1));
}

function least(ring: Ring, axis: number): number {
  let found = Infinity;
  for (let at = axis; at < ring.length; at += 2) found = Math.min(found, ring[at]);
  return found;
}

function most(ring: Ring, axis: number): number {
  let found = -Infinity;
  for (let at = axis; at < ring.length; at += 2) found = Math.max(found, ring[at]);
  return found;
}

async function boundaries(suffix = ""): Promise<World> {
  const file = await published(suffix);
  const packed = join(source, `packed-${suffix || "world"}.json`);

  await mapshaper.runCommands([
    "-i",
    file,
    "-filter",
    `ISO_A2_EH !== "${NO_CODE}"`,
    "-dissolve2",
    "ISO_A2_EH",
    "-simplify",
    "variable",
    `interval=Math.sqrt(this.area)/${DETAIL}`,
    "keep-shapes",
    "-o",
    packed,
    "format=geojson",
    `precision=${PRECISION}`,
  ]);

  const collection = JSON.parse(await readFile(packed, "utf8")) as Collection;
  const world: World = {};
  for (const feature of collection.features) {
    if (feature.geometry) world[feature.properties.ISO_A2_EH] = rings(feature.geometry);
  }
  return sorted(world);
}

function rings(geometry: Geometry): Shape {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => polygon.map((ring) => ring.flat()));
}

function sorted(world: World): World {
  return Object.fromEntries(Object.entries(world).sort(([a], [b]) => a.localeCompare(b)));
}

async function published(suffix: string): Promise<string> {
  const name = `ne_10m_admin_0_countries${suffix && `_${suffix}`}.geojson`;
  const file = join(source, name);
  if (existsSync(file)) return file;

  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${RELEASE}/geojson/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`country-shapes: ${url} answered ${response.status}`);
  await writeFile(`${file}.part`, Buffer.from(await response.arrayBuffer()));
  await rename(`${file}.part`, file);
  console.log(`country-shapes: fetched ${name}`);
  return file;
}

async function readIfPresent(file: string): Promise<string | undefined> {
  return existsSync(file) ? await readFile(file, "utf8") : undefined;
}

async function size(): Promise<string> {
  const names = await readdir(views);
  const files = [worldFile, ...names.map((name) => join(views, name))];
  const bytes = await Promise.all(files.map(async (file) => (await readFile(file)).length));
  return (bytes.reduce((total, length) => total + length, 0) / 1e6).toFixed(1);
}
