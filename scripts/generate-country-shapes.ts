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

const DETAIL = 80;

const PLACES = 3;

const RADIUS = 6378137;

const RADIANS = Math.PI / 180;

const NO_CODE = "-99";

const SHAPE = 4;

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
const stamp = `${RELEASE} ${SHAPE} ${DETAIL} ${PLACES}\n`;

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
  const collection = JSON.parse(await readFile(await published(suffix), "utf8")) as Collection;

  const filed = new Map<string, Shape>();
  const split = new Set<string>();

  for (const feature of collection.features) {
    const code = feature.properties.ISO_A2_EH;
    if (code === NO_CODE || !feature.geometry) continue;

    const held = filed.get(code);
    if (held) split.add(code);
    const shape = held ?? [];
    const geometry = feature.geometry;
    for (const polygon of geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) {
      shape.push(polygon.map((ring) => ring.flat()));
    }
    filed.set(code, shape);
  }

  const world: World = {};
  for (const [code, shape] of filed) world[code] = rounded(simplified(split.has(code) ? dissolved(shape) : shape));
  return sorted(world);
}

function dissolved(shape: Shape): Shape {
  const edges = new Map<string, Edge>();
  let cancelled = 0;

  for (const polygon of shape) {
    for (const ring of polygon) {
      for (let at = 0; at + 3 < ring.length; at += 2) {
        const edge: Edge = [ring[at], ring[at + 1], ring[at + 2], ring[at + 3]];
        const drawn = `${edge[0]},${edge[1]},${edge[2]},${edge[3]}`;
        if (edges.delete(`${edge[2]},${edge[3]},${edge[0]},${edge[1]}`)) cancelled++;
        else if (edges.has(drawn)) throw new Error(`country-shapes: ${drawn} is drawn twice the same way`);
        else edges.set(drawn, edge);
      }
    }
  }

  return cancelled ? assembled(stitched([...edges.values()])) : shape;
}

type Edge = [number, number, number, number];

function stitched(edges: Edge[]): Polygon {
  const onward = new Map<string, Edge[]>();
  for (const edge of edges) {
    const from = `${edge[0]},${edge[1]}`;
    const leaving = onward.get(from) ?? [];
    leaving.push(edge);
    onward.set(from, leaving);
  }

  const rings: Polygon = [];
  for (const leaving of onward.values()) {
    while (leaving.length) {
      const opened = leaving.pop() as Edge;
      const ring: Ring = [opened[0], opened[1], opened[2], opened[3]];
      for (let here = `${opened[2]},${opened[3]}`; here !== `${opened[0]},${opened[1]}`;) {
        const next = onward.get(here)?.pop();
        if (!next) throw new Error("country-shapes: a dissolved boundary does not close");
        ring.push(next[2], next[3]);
        here = `${next[2]},${next[3]}`;
      }
      rings.push(ring);
    }
  }
  return rings;
}

function assembled(rings: Polygon): Shape {
  const inside = rings.map((ring) => rings.filter((other) => other !== ring && encloses(other, [ring[0], ring[1]])));
  const outlines = rings.filter((_, at) => inside[at].length % 2 === 0);
  const shape: Shape = outlines.map((outline) => [outline]);

  rings.forEach((ring, at) => {
    if (inside[at].length % 2 === 0) return;
    const cut = [...inside[at]].filter((other) => outlines.includes(other)).sort((a, b) => ringArea(a) - ringArea(b));
    const polygon = shape.find((held) => held[0] === cut[0]);
    if (polygon) polygon.push(ring);
    else shape.push([ring]);
  });

  return shape;
}

function simplified(shape: Shape): Shape {
  const worth = areaOf(shape) / (DETAIL * DETAIL);
  const kept = reworked(shape, (ring) => winnowed(ring, worth));
  if (kept.length) return kept;

  const largest = shape.map((polygon) => polygon[0]).sort((a, b) => ringArea(b) - ringArea(a))[0];
  return largest ? [[largest]] : [];
}

function rounded(shape: Shape): Shape {
  return reworked(shape, nearest);
}

function reworked(shape: Shape, cut: (ring: Ring) => Ring | undefined): Shape {
  const kept: Shape = [];
  for (const polygon of shape) {
    const rings: Polygon = [];
    for (const ring of polygon) {
      const left = cut(ring);
      if (left) rings.push(left);
      else if (!rings.length) break;
    }
    if (rings.length) kept.push(rings);
  }
  return kept;
}

function winnowed(ring: Ring, worth: number): Ring | undefined {
  const points = ring.length / 2 - 1;
  if (points < 3) return undefined;

  const before = new Int32Array(points);
  const after = new Int32Array(points);
  const gone = new Uint8Array(points);
  const carried = new Float64Array(points);
  for (let at = 0; at < points; at++) {
    before[at] = (at + points - 1) % points;
    after[at] = (at + 1) % points;
  }
  for (let at = 0; at < points; at++) carried[at] = triangle(ring, before[at], at, after[at]);

  const heap = heaped(carried);
  let alive = points;
  for (;;) {
    const at = lightest(heap);
    if (at < 0 || carried[at] >= worth || alive <= 3) break;

    taken(heap, at);
    gone[at] = 1;
    alive--;
    after[before[at]] = after[at];
    before[after[at]] = before[at];

    for (const side of [before[at], after[at]]) {
      remeasured(heap, side, Math.max(carried[at], triangle(ring, before[side], side, after[side])));
    }
  }

  const last = lightest(heap);
  if (last >= 0 && carried[last] < worth) return undefined;

  const left: Ring = [];
  for (let at = 0; at < points; at++) if (!gone[at]) left.push(ring[at * 2], ring[at * 2 + 1]);
  left.push(left[0], left[1]);
  return left;
}

function triangle(ring: Ring, before: number, at: number, after: number): number {
  const narrowing = Math.cos((ring[before * 2 + 1] + ring[at * 2 + 1] + ring[after * 2 + 1]) / 3 * RADIANS);
  const east = eastward(ring[before * 2], ring[at * 2]) * narrowing;
  const north = ring[at * 2 + 1] - ring[before * 2 + 1];
  const far = eastward(ring[before * 2], ring[after * 2]) * narrowing;
  const up = ring[after * 2 + 1] - ring[before * 2 + 1];
  return Math.abs(east * up - far * north) * (RADIANS * RADIUS) ** 2 / 2;
}

function areaOf(shape: Shape): number {
  let ground = 0;
  for (const polygon of shape) {
    for (let at = 0; at < polygon.length; at++) ground += (at === 0 ? 1 : -1) * ringArea(polygon[at]);
  }
  return ground;
}

function ringArea(ring: Ring): number {
  let swept = 0;
  for (let at = 0; at + 3 < ring.length; at += 2) {
    swept += eastward(ring[at], ring[at + 2]) * (Math.sin(ring[at + 1] * RADIANS) + Math.sin(ring[at + 3] * RADIANS));
  }
  return Math.abs(swept * RADIANS) * RADIUS * RADIUS / 2;
}

function eastward(from: number, to: number): number {
  const apart = to - from;
  return apart > 180 ? apart - 360 : apart < -180 ? apart + 360 : apart;
}

function nearest(ring: Ring): Ring | undefined {
  const near: Ring = [];
  for (let at = 0; at + 3 < ring.length; at += 2) {
    const east = Number(ring[at].toFixed(PLACES));
    const north = Number(ring[at + 1].toFixed(PLACES));
    if (near.length && near[near.length - 2] === east && near[near.length - 1] === north) continue;
    near.push(east, north);
  }
  while (near.length > 2 && near[near.length - 2] === near[0] && near[near.length - 1] === near[1]) near.length -= 2;
  if (near.length < 6) return undefined;

  near.push(near[0], near[1]);
  return near;
}

interface Heap {
  order: number[];
  place: Int32Array;
  carried: Float64Array;
}

function heaped(carried: Float64Array): Heap {
  const heap: Heap = { order: [...carried.keys()], place: new Int32Array(carried.length), carried };
  for (let at = 0; at < heap.order.length; at++) heap.place[at] = at;
  for (let hole = (heap.order.length >> 1) - 1; hole >= 0; hole--) sink(heap, hole);
  return heap;
}

function lightest(heap: Heap): number {
  return heap.order.length ? heap.order[0] : -1;
}

function taken(heap: Heap, at: number): void {
  const hole = heap.place[at];
  const last = heap.order.pop() as number;
  heap.place[at] = -1;
  if (hole >= heap.order.length) return;

  heap.order[hole] = last;
  heap.place[last] = hole;
  sink(heap, hole);
  rise(heap, hole);
}

function remeasured(heap: Heap, at: number, carried: number): void {
  heap.carried[at] = carried;
  rise(heap, heap.place[at]);
  sink(heap, heap.place[at]);
}

function sink(heap: Heap, from: number): void {
  const { order, place, carried } = heap;
  for (let hole = from;;) {
    const left = hole * 2 + 1;
    if (left >= order.length) return;

    const lighter = left + 1 < order.length && carried[order[left + 1]] < carried[order[left]] ? left + 1 : left;
    if (carried[order[lighter]] >= carried[order[hole]]) return;

    [order[hole], order[lighter]] = [order[lighter], order[hole]];
    place[order[hole]] = hole;
    place[order[lighter]] = lighter;
    hole = lighter;
  }
}

function rise(heap: Heap, from: number): void {
  const { order, place, carried } = heap;
  for (let hole = from; hole > 0;) {
    const up = (hole - 1) >> 1;
    if (carried[order[up]] <= carried[order[hole]]) return;

    [order[hole], order[up]] = [order[up], order[hole]];
    place[order[hole]] = hole;
    place[order[up]] = up;
    hole = up;
  }
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
