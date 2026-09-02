import type { Polygon, Shape, World } from "./shapes";

export const ASPECT = 2;

export const VIEW_BOX = "0 0 1000 500";

const WIDTH = 1000;

export interface Land {
  code: string;
  path: string;
}

export interface CountryMap {
  own: string | undefined;
  borders: readonly Land[];
  rest: readonly Land[];
}

export interface Part {
  polygon: Polygon;
  west: number;
  east: number;
  north: number;
  south: number;
}

export type Prepared = ReadonlyMap<string, readonly Part[]>;

export interface Place {
  longitude: number;
  latitude: number;
  across: number;
}

export function prepare(world: World): Prepared {
  return new Map(Object.entries(world).map(([code, shape]) => [code, boxesOf(shape)]));
}

const BOXED = new WeakMap<Shape, readonly Part[]>();

function boxesOf(shape: Shape): readonly Part[] {
  let parts = BOXED.get(shape);
  if (!parts) BOXED.set(shape, parts = shape.map(boxed));
  return parts;
}

export function mapOf(
  shapes: Prepared,
  world: Prepared,
  code: string,
  borders: readonly string[],
  place: Place,
): CountryMap | undefined {
  const framing = world.get(code) ?? shapes.get(code);
  const middle = framing && widest(framing);
  const meridian = middle ? (middle.west + middle.east) / 2 : place.longitude;
  const parallel = middle ? (middle.north + middle.south) / 2 : place.latitude;
  const frame = fitted(framing ? framed(framing, meridian, parallel) : over(place, parallel));

  const drawn = (found: string): Land | undefined => {
    const path = pathOf(shapes.get(found), meridian, parallel, frame);
    return path ? { code: found, path } : undefined;
  };

  const named = new Set([code, ...borders]);
  const own = pathOf(shapes.get(code), meridian, parallel, frame) || undefined;
  const neighbours = borders.flatMap((border) => drawn(border) ?? []);
  const rest = [...shapes.keys()].filter((found) => !named.has(found)).flatMap((found) => drawn(found) ?? []);

  if (!own && neighbours.length === 0 && rest.length === 0) return undefined;

  return { own, borders: neighbours, rest };
}

function over(place: Place, parallel: number): Box {
  const half = place.across / 2;
  const across = half * Math.cos(parallel * Math.PI / 180);
  return { left: -across, right: across, top: y(place.latitude) - half, bottom: y(place.latitude) + half };
}

function x(longitude: number, meridian: number, parallel: number): number {
  return (longitude - meridian) * Math.cos(parallel * Math.PI / 180);
}

function y(latitude: number): number {
  return -latitude;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function framed(parts: readonly Part[], meridian: number, parallel: number): Box {
  const boxes = parts.map((part) => boxAt(part, meridian, parallel));
  const sizes = boxes.map(area);
  const biggest = sizes.indexOf(Math.max(...sizes));
  const largest = sizes[biggest];
  const taken = boxes.map((_, at) => at === biggest);

  let frame = boxes[biggest];

  for (let growing = true; growing;) {
    growing = false;
    boxes.forEach((box, at) => {
      if (taken[at] || sizes[at] < SIGNIFICANT * largest || gap(frame, box) > REACH * diagonal(frame)) return;
      frame = union(frame, box);
      taken[at] = true;
      growing = true;
    });
  }

  boxes.forEach((box, at) => {
    if (!taken[at] && gap(frame, box) <= NEARBY * diagonal(frame)) frame = union(frame, box);
  });

  return frame;
}

const SIGNIFICANT = 0.05;

const REACH = 1;

const NEARBY = 0.1;

function fitted(frame: Box): Box {
  const margin = MARGIN * Math.max(frame.right - frame.left, frame.bottom - frame.top) || SMALLEST;
  const grown = {
    left: frame.left - margin,
    top: frame.top - margin,
    right: frame.right + margin,
    bottom: frame.bottom + margin,
  };

  const width = grown.right - grown.left;
  const height = grown.bottom - grown.top;
  const short = width / height < ASPECT;
  const wanted = short ? height * ASPECT : width / ASPECT;
  const half = (wanted - (short ? width : height)) / 2;

  return short
    ? { ...grown, left: grown.left - half, right: grown.right + half }
    : { ...grown, top: grown.top - half, bottom: grown.bottom + half };
}

const MARGIN = 0.08;

const SMALLEST = 0.01;

function pathOf(parts: readonly Part[] | undefined, meridian: number, parallel: number, frame: Box): string {
  const scale = WIDTH / (frame.right - frame.left);
  let path = "";

  for (const part of parts ?? []) {
    const shift = around(part, meridian);
    if (!overlaps(boxAt(part, meridian, parallel, shift), frame)) continue;
    for (const ring of part.polygon) {
      for (let at = 0; at < ring.length; at += 2) {
        const across = (x(ring[at] + shift, meridian, parallel) - frame.left) * scale;
        const down = (y(ring[at + 1]) - frame.top) * scale;
        path += `${at === 0 ? "M" : "L"}${round(across)} ${round(down)}`;
      }
      path += "Z";
    }
  }
  return path;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function around(part: Part, meridian: number): number {
  return -360 * Math.round(((part.west + part.east) / 2 - meridian) / 360);
}

function boxed(polygon: Polygon): Part {
  const ring = polygon[0];
  let west = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let south = Infinity;

  for (let at = 0; at < ring.length; at += 2) {
    west = Math.min(west, ring[at]);
    east = Math.max(east, ring[at]);
    south = Math.min(south, ring[at + 1]);
    north = Math.max(north, ring[at + 1]);
  }

  return { polygon, west, east, north, south };
}

function boxAt(part: Part, meridian: number, parallel: number, shift = around(part, meridian)): Box {
  return {
    left: x(part.west + shift, meridian, parallel),
    right: x(part.east + shift, meridian, parallel),
    top: y(part.north),
    bottom: y(part.south),
  };
}

function widest(parts: readonly Part[]): Part {
  return parts.reduce((found, part) => extent(part) > extent(found) ? part : found);
}

function extent(part: Part): number {
  return (part.east - part.west) * Math.cos((part.north + part.south) / 2 * Math.PI / 180) * (part.north - part.south);
}

function area(box: Box): number {
  return (box.right - box.left) * (box.bottom - box.top);
}

function diagonal(box: Box): number {
  return Math.hypot(box.right - box.left, box.bottom - box.top);
}

function gap(a: Box, b: Box): number {
  return Math.hypot(
    Math.max(0, a.left - b.right, b.left - a.right),
    Math.max(0, a.top - b.bottom, b.top - a.bottom),
  );
}

function overlaps(a: Box, b: Box): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

function union(a: Box, b: Box): Box {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}
