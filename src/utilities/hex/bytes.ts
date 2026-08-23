export interface Doc {
  bytes: Uint8Array;
  original: Uint8Array;
  changed: ReadonlySet<number>;
}

export function openDoc(bytes: Uint8Array): Doc {
  return { bytes, original: bytes, changed: new Set() };
}

export function revert(doc: Doc): Doc {
  return openDoc(doc.original);
}

export function isDirty(doc: Doc): boolean {
  return doc.bytes !== doc.original;
}

export function overwrite(doc: Doc, offset: number, values: Uint8Array): Doc {
  if (offset < 0 || values.length === 0 || offset + values.length > doc.bytes.length) return doc;
  if (values.every((value, at) => doc.bytes[offset + at] === value)) return doc;

  const bytes = writable(doc);
  bytes.set(values, offset);
  const changed = new Set(doc.changed);
  for (let at = 0; at < values.length; at++) changed.add(offset + at);
  return { bytes, original: doc.original, changed };
}

export function insert(doc: Doc, offset: number, values: Uint8Array): Doc {
  if (offset < 0 || offset > doc.bytes.length || values.length === 0) return doc;

  const bytes = new Uint8Array(doc.bytes.length + values.length);
  bytes.set(doc.bytes.subarray(0, offset), 0);
  bytes.set(values, offset);
  bytes.set(doc.bytes.subarray(offset), offset + values.length);

  const changed = shift(doc.changed, offset, values.length);
  for (let at = 0; at < values.length; at++) changed.add(offset + at);
  return { bytes, original: doc.original, changed };
}

export function remove(doc: Doc, offset: number, count: number): Doc {
  if (offset < 0 || count <= 0 || offset + count > doc.bytes.length) return doc;

  const bytes = new Uint8Array(doc.bytes.length - count);
  bytes.set(doc.bytes.subarray(0, offset), 0);
  bytes.set(doc.bytes.subarray(offset + count), offset);
  const changed = shift(doc.changed, offset + count, -count, offset);
  return { bytes, original: doc.original, changed };
}

function shift(changed: ReadonlySet<number>, from: number, by: number, dropFrom = from): Set<number> {
  const next = new Set<number>();
  for (const offset of changed) {
    if (offset >= dropFrom && offset < from) continue;
    next.add(offset >= from ? offset + by : offset);
  }
  return next;
}

function writable(doc: Doc): Uint8Array {
  return doc.bytes === doc.original ? doc.bytes.slice() : doc.bytes;
}

export function parseHex(text: string): Uint8Array | null {
  const clean = text.replace(/\\x|0x|[\s,;:]+/gi, "");
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let at = 0; at < bytes.length; at++) bytes[at] = Number.parseInt(clean.slice(at * 2, at * 2 + 2), 16);
  return bytes;
}

export function formatHex(bytes: Uint8Array, upper = false, separator = ""): string {
  const digits: string[] = [];
  for (const byte of bytes) digits.push(byte.toString(16).padStart(2, "0"));
  const joined = digits.join(separator);
  return upper ? joined.toUpperCase() : joined;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  }
  return btoa(binary);
}

const CHUNK = 0x8000;
