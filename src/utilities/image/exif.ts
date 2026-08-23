export interface Rational {
  n: number;
  d: number;
}

export type ExifValue = string | number[] | Rational[] | Uint8Array;

export interface ExifEntry {
  tag: number;
  type: number;
  value: ExifValue;
}

export type IfdName = "image" | "exif" | "gps" | "interop" | "thumbnail";

export const IFD_NAMES: IfdName[] = ["image", "exif", "gps", "interop", "thumbnail"];

export interface Exif {
  little: boolean;
  ifds: Record<IfdName, ExifEntry[]>;
}

export const EXIF_POINTER = 0x8769;
export const GPS_POINTER = 0x8825;
export const INTEROP_POINTER = 0xa005;

export function emptyExif(little = true): Exif {
  return { little, ifds: { image: [], exif: [], gps: [], interop: [], thumbnail: [] } };
}

export function readExif(block: Uint8Array): Exif | null {
  if (block.length < 8) return null;
  const order = (block[0] << 8) | block[1];
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
  if (view.getUint16(2, little) !== 42) return null;

  const exif = emptyExif(little);
  const seen = new Set<number>();

  const first = view.getUint32(4, little);
  const next = readIfd(view, block, first, little, exif.ifds.image, seen);
  follow(view, block, exif.ifds.image, EXIF_POINTER, little, exif.ifds.exif, seen);
  follow(view, block, exif.ifds.exif, INTEROP_POINTER, little, exif.ifds.interop, seen);
  follow(view, block, exif.ifds.image, GPS_POINTER, little, exif.ifds.gps, seen);
  if (next > 0) readIfd(view, block, next, little, exif.ifds.thumbnail, seen);
  return exif;
}

export function writeExif(exif: Exif): Uint8Array {
  const image = withPointers(exif);
  const parts = [
    plan(image),
    plan(sorted(exif.ifds.exif.filter((entry) => entry.tag !== INTEROP_POINTER))),
    plan(sorted(exif.ifds.gps)),
  ];

  let offset = HEADER_SIZE;
  const bases: number[] = [];
  for (const part of parts) {
    bases.push(offset);
    offset += part.size;
  }

  const out = new Uint8Array(offset);
  const view = new DataView(out.buffer);
  out[0] = out[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, HEADER_SIZE, true);

  for (const [at, part] of parts.entries()) emit(view, out, part, bases[at]);
  patch(view, parts[0], bases[0], EXIF_POINTER, parts[1].entries.length > 0 ? bases[1] : null);
  patch(view, parts[0], bases[0], GPS_POINTER, parts[2].entries.length > 0 ? bases[2] : null);
  return out;
}

export function findEntry(entries: ExifEntry[], tag: number): ExifEntry | undefined {
  return entries.find((entry) => entry.tag === tag);
}

export function setEntry(entries: ExifEntry[], tag: number, entry: ExifEntry | null): ExifEntry[] {
  const rest = entries.filter((existing) => existing.tag !== tag);
  return entry ? sorted([...rest, entry]) : rest;
}

export function countEntries(exif: Exif): number {
  return IFD_NAMES.reduce((total, name) => total + exif.ifds[name].length, 0);
}

function follow(
  view: DataView,
  block: Uint8Array,
  from: ExifEntry[],
  tag: number,
  little: boolean,
  into: ExifEntry[],
  seen: Set<number>,
) {
  const pointer = findEntry(from, tag);
  const at = Array.isArray(pointer?.value) ? Number(pointer.value[0]) : NaN;
  if (Number.isFinite(at) && at > 0) readIfd(view, block, at, little, into, seen);
}

function readIfd(
  view: DataView,
  block: Uint8Array,
  at: number,
  little: boolean,
  into: ExifEntry[],
  seen: Set<number>,
): number {
  if (seen.has(at) || at < 8 || at + 2 > block.length) return 0;
  seen.add(at);
  const count = view.getUint16(at, little);
  if (at + 2 + count * 12 + 4 > block.length) return 0;

  for (let index = 0; index < count; index++) {
    const entry = at + 2 + index * 12;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const length = view.getUint32(entry + 4, little);
    const size = TYPE_SIZES[type];
    if (!size || length > MAX_VALUES) continue;
    const bytes = size * length;
    const from = bytes <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
    if (bytes > 4 && from + bytes > block.length) continue;
    into.push({ tag, type, value: readValue(view, block, from, type, length, little) });
  }
  return view.getUint32(at + 2 + count * 12, little);
}

function readValue(
  view: DataView,
  block: Uint8Array,
  at: number,
  type: number,
  length: number,
  little: boolean,
): ExifValue {
  if (type === 2) {
    const raw = block.subarray(at, at + length);
    const end = raw.indexOf(0);
    return LATIN1.decode(end < 0 ? raw : raw.subarray(0, end));
  }
  if (type === 7 || type === 1 || type === 6) return block.slice(at, at + length);

  const values: number[] = [];
  const rationals: Rational[] = [];
  for (let index = 0; index < length; index++) {
    const from = at + index * TYPE_SIZES[type];
    switch (type) {
      case 3:
        values.push(view.getUint16(from, little));
        break;
      case 4:
        values.push(view.getUint32(from, little));
        break;
      case 5:
        rationals.push({ n: view.getUint32(from, little), d: view.getUint32(from + 4, little) });
        break;
      case 8:
        values.push(view.getInt16(from, little));
        break;
      case 9:
        values.push(view.getInt32(from, little));
        break;
      case 10:
        rationals.push({ n: view.getInt32(from, little), d: view.getInt32(from + 4, little) });
        break;
      case 11:
        values.push(view.getFloat32(from, little));
        break;
      case 12:
        values.push(view.getFloat64(from, little));
        break;
    }
  }
  return type === 5 || type === 10 ? rationals : values;
}

function withPointers(exif: Exif): ExifEntry[] {
  const entries = exif.ifds.image.filter((entry) => entry.tag !== EXIF_POINTER && entry.tag !== GPS_POINTER);
  if (exif.ifds.exif.length > 0) entries.push({ tag: EXIF_POINTER, type: 4, value: [0] });
  if (exif.ifds.gps.length > 0) entries.push({ tag: GPS_POINTER, type: 4, value: [0] });
  return sorted(entries);
}

function sorted(entries: ExifEntry[]): ExifEntry[] {
  return [...entries].sort((left, right) => left.tag - right.tag);
}

interface Planned {
  entries: ExifEntry[];
  bytes: Uint8Array[];
  size: number;
}

function plan(entries: ExifEntry[]): Planned {
  const bytes = entries.map((entry) => encodeValue(entry));
  let size = 2 + entries.length * 12 + 4;
  for (const value of bytes) if (value.length > 4) size += value.length + (value.length % 2);
  return { entries, bytes, size };
}

function emit(view: DataView, out: Uint8Array, part: Planned, base: number) {
  view.setUint16(base, part.entries.length, true);
  let data = base + 2 + part.entries.length * 12 + 4;
  for (const [index, entry] of part.entries.entries()) {
    const at = base + 2 + index * 12;
    const value = part.bytes[index];
    view.setUint16(at, entry.tag, true);
    view.setUint16(at + 2, entry.type, true);
    view.setUint32(at + 4, countOf(entry), true);
    if (value.length <= 4) {
      out.set(value, at + 8);
    } else {
      view.setUint32(at + 8, data, true);
      out.set(value, data);
      data += value.length + (value.length % 2);
    }
  }
}

function patch(view: DataView, part: Planned, base: number, tag: number, target: number | null) {
  const index = part.entries.findIndex((entry) => entry.tag === tag);
  if (index < 0 || target === null) return;
  view.setUint32(base + 2 + index * 12 + 8, target, true);
}

function countOf(entry: ExifEntry): number {
  if (typeof entry.value === "string") return entry.value.length + 1;
  return entry.value.length;
}

function encodeValue(entry: ExifEntry): Uint8Array {
  const { type, value } = entry;
  if (typeof value === "string") {
    const out = new Uint8Array(value.length + 1);
    for (let index = 0; index < value.length; index++) out[index] = value.charCodeAt(index) & 0xff;
    return out;
  }
  if (value instanceof Uint8Array) return value;

  const out = new Uint8Array(value.length * TYPE_SIZES[type]);
  const view = new DataView(out.buffer);
  for (const [index, item] of value.entries()) {
    const at = index * TYPE_SIZES[type];
    if (typeof item === "number") {
      if (type === 3) view.setUint16(at, item, true);
      else if (type === 8) view.setInt16(at, item, true);
      else if (type === 9) view.setInt32(at, item, true);
      else if (type === 11) view.setFloat32(at, item, true);
      else if (type === 12) view.setFloat64(at, item, true);
      else view.setUint32(at, item, true);
    } else {
      const signed = type === 10;
      if (signed) view.setInt32(at, item.n, true);
      else view.setUint32(at, item.n, true);
      if (signed) view.setInt32(at + 4, item.d, true);
      else view.setUint32(at + 4, item.d, true);
    }
  }
  return out;
}

const LATIN1 = new TextDecoder("latin1");

const HEADER_SIZE = 8;

const TYPE_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

const MAX_VALUES = 1 << 20;
