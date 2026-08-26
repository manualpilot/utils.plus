import { CONTEXT, TAG, UNIVERSAL } from "./der";

type Bytes = Uint8Array<ArrayBuffer>;

export function sequence(items: Uint8Array[]): Bytes {
  return element(UNIVERSAL, TAG.sequence, true, concat(items));
}

export function set(items: Uint8Array[]): Bytes {
  return element(UNIVERSAL, TAG.set, true, concat(items));
}

export function integer(value: Uint8Array | number): Bytes {
  const bytes = typeof value === "number" ? fromNumber(value) : value;
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  const trimmed = bytes.subarray(start);
  const body = (trimmed[0] & 0x80) === 0 ? trimmed : concat([new Uint8Array([0]), trimmed]);
  return element(UNIVERSAL, TAG.integer, false, body);
}

export function bitString(bytes: Uint8Array): Bytes {
  return element(UNIVERSAL, TAG.bitString, false, concat([new Uint8Array([0]), bytes]));
}

export function namedBits(indexes: number[]): Bytes {
  const highest = Math.max(...indexes);
  const size = Math.floor(highest / 8) + 1;
  const bytes = new Uint8Array(size + 1);
  bytes[0] = size * 8 - (highest + 1);
  for (const index of indexes) bytes[1 + (index >> 3)] |= 0x80 >> (index & 7);
  return element(UNIVERSAL, TAG.bitString, false, bytes);
}

export function octetString(bytes: Uint8Array): Bytes {
  return element(UNIVERSAL, TAG.octetString, false, bytes);
}

export function boolean(value: boolean): Bytes {
  return element(UNIVERSAL, TAG.boolean, false, new Uint8Array([value ? 0xff : 0x00]));
}

export function nul(): Bytes {
  return element(UNIVERSAL, 5, false, new Uint8Array());
}

export function oid(dotted: string): Bytes {
  const arcs = dotted.split(".").map((arc) => BigInt(arc));
  if (arcs.length < 2) throw new Error(`Not an object identifier: ${dotted}`);
  const parts = [arcs[0] * 40n + arcs[1], ...arcs.slice(2)];
  return element(UNIVERSAL, TAG.oid, false, concat(parts.map(base128)));
}

export function utf8String(text: string): Bytes {
  return element(UNIVERSAL, 12, false, new TextEncoder().encode(text));
}

export function printableString(text: string): Bytes {
  return element(UNIVERSAL, 19, false, new TextEncoder().encode(text));
}

export function explicit(tag: number, content: Uint8Array): Bytes {
  return element(CONTEXT, tag, true, content);
}

export function implicit(tag: number, content: Uint8Array, constructed = false): Bytes {
  return element(CONTEXT, tag, constructed, content);
}

export function time(date: Date): Bytes {
  const year = date.getUTCFullYear();
  const digits = [
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ].map(pad).join("");
  const generalized = year >= 2050;
  const text = `${generalized ? String(year) : pad(year % 100)}${digits}Z`;
  return element(UNIVERSAL, generalized ? TAG.generalizedTime : TAG.utcTime, false, new TextEncoder().encode(text));
}

function concat(parts: Uint8Array[]): Bytes {
  const total = parts.reduce((size, part) => size + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function element(cls: number, tag: number, constructed: boolean, content: Uint8Array): Bytes {
  if (tag > 30) throw new Error(`Tag ${tag} is past the one-byte form`);
  const first = (cls << 6) | (constructed ? 0x20 : 0) | tag;
  return concat([new Uint8Array([first]), length(content.length), content]);
}

function length(size: number): Uint8Array {
  if (size < 0x80) return new Uint8Array([size]);
  const bytes: number[] = [];
  for (let rest = size; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function base128(value: bigint): Uint8Array {
  const bytes: number[] = [Number(value % 128n)];
  for (let rest = value / 128n; rest > 0n; rest /= 128n) bytes.unshift(Number(rest % 128n) | 0x80);
  return new Uint8Array(bytes);
}

function fromNumber(value: number): Uint8Array {
  const bytes: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return new Uint8Array(bytes.length > 0 ? bytes : [0]);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
