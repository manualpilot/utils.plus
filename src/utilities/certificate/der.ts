export interface Node {
  cls: number;
  tag: number;
  constructed: boolean;
  content: Uint8Array;
  raw: Uint8Array;
  items: Node[];
}

export const UNIVERSAL = 0;
export const CONTEXT = 2;

export const TAG = {
  boolean: 1,
  integer: 2,
  bitString: 3,
  octetString: 4,
  oid: 6,
  sequence: 16,
  set: 17,
  utcTime: 23,
  generalizedTime: 24,
} as const;

const MAX_DEPTH = 40;

export function readDer(bytes: Uint8Array): Node {
  return readNode(bytes, 0, 0).node;
}

function readItems(bytes: Uint8Array, depth: number): Node[] {
  const items: Node[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const { node, end } = readNode(bytes, offset, depth);
    items.push(node);
    offset = end;
  }
  return items;
}

function readNode(bytes: Uint8Array, offset: number, depth: number): { node: Node; end: number } {
  if (depth > MAX_DEPTH) throw new Error("Nested too deeply to be a certificate");
  if (offset + 2 > bytes.length) throw new Error("Ends in the middle of a value");

  const first = bytes[offset];
  const cls = first >> 6;
  const constructed = (first & 0x20) !== 0;
  let tag = first & 0x1f;
  let cursor = offset + 1;

  if (tag === 0x1f) {
    tag = 0;
    for (;;) {
      if (cursor >= bytes.length) throw new Error("Ends in the middle of a tag");
      const byte = bytes[cursor];
      cursor += 1;
      tag = tag * 128 + (byte & 0x7f);
      if (tag > 0xffffff) throw new Error("Tag number is out of range");
      if ((byte & 0x80) === 0) break;
    }
  }

  if (cursor >= bytes.length) throw new Error("Ends where a length should be");
  let length = bytes[cursor];
  cursor += 1;
  if (length === 0x80) throw new Error("Indefinite lengths are BER, and a certificate is DER");
  if (length > 0x80) {
    const count = length & 0x7f;
    if (count > 4) throw new Error("Length is out of range");
    length = 0;
    for (let index = 0; index < count; index += 1) {
      if (cursor >= bytes.length) throw new Error("Ends in the middle of a length");
      length = length * 256 + bytes[cursor];
      cursor += 1;
    }
  }

  const end = cursor + length;
  if (end > bytes.length) throw new Error("Claims more bytes than it carries");

  const content = bytes.subarray(cursor, end);
  const node: Node = { cls, tag, constructed, content, raw: bytes.subarray(offset, end), items: [] };
  if (constructed) {
    try {
      node.items = readItems(content, depth + 1);
    } catch {
      node.items = [];
    }
  }
  return { node, end };
}

export function derOf(bytes: Uint8Array): Node | null {
  try {
    return readDer(bytes);
  } catch {
    return null;
  }
}

export function inner(node: Node): Node | null {
  try {
    return readDer(node.content);
  } catch {
    return null;
  }
}

export function tagged(items: Node[], tag: number): Node | undefined {
  return items.find((item) => item.cls === CONTEXT && item.tag === tag);
}

export function oidOf(node: Node): string {
  const parts = subidentifiers(node.content);
  if (parts === null || parts.length === 0) return "";
  const first = parts[0];
  const lead = first < 80n ? [first / 40n, first % 40n] : [2n, first - 80n];
  return [...lead, ...parts.slice(1)].join(".");
}

function subidentifiers(bytes: Uint8Array): bigint[] | null {
  const parts: bigint[] = [];
  let value = 0n;
  let started = false;
  for (const byte of bytes) {
    value = value * 128n + BigInt(byte & 0x7f);
    started = true;
    if ((byte & 0x80) === 0) {
      parts.push(value);
      value = 0n;
      started = false;
    }
  }
  return started ? null : parts;
}

export function intOf(node: Node): bigint {
  const bytes = node.content;
  if (bytes.length === 0) return 0n;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  if ((bytes[0] & 0x80) !== 0) value -= 1n << BigInt(bytes.length * 8);
  return value;
}

export function numberOf(node: Node): number {
  return Number(intOf(node));
}

export function bitsOf(node: Node): Uint8Array {
  return node.content.length === 0 ? node.content : node.content.subarray(1);
}

const DECODERS: Record<number, (bytes: Uint8Array) => string> = {
  12: utf8,
  18: latin1,
  19: latin1,
  20: latin1,
  22: latin1,
  26: latin1,
  27: utf8,
  28: utf32be,
  30: utf16be,
};

export function textOf(node: Node): string {
  const decode = DECODERS[node.cls === UNIVERSAL ? node.tag : 12] ?? utf8;
  return decode(node.content).replace(/\0+$/, "");
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function latin1(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

function utf16be(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    text += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  }
  return text;
}

function utf32be(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index + 3 < bytes.length; index += 4) {
    const point = (bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3];
    text += String.fromCodePoint(point >>> 0);
  }
  return text;
}

export function timeOf(node: Node): Date | null {
  const text = latin1(node.content);
  const generalized = node.cls === UNIVERSAL
    ? node.tag === TAG.generalizedTime
    : text.replace(/\D/g, "").length >= 14;
  const pattern = generalized
    ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?(Z|[+-]\d{4})?$/
    : /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{4})?$/;
  const parts = pattern.exec(text);
  if (!parts) return null;

  const year = generalized ? Number(parts[1]) : Number(parts[1]) + (Number(parts[1]) >= 50 ? 1900 : 2000);
  const stamp = Date.UTC(
    year,
    Number(parts[2]) - 1,
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6] ?? "0"),
  );
  const zone = parts[7];
  const offset = zone && zone !== "Z"
    ? (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5))) * 60000
    : 0;
  const date = new Date(stamp - offset);
  return Number.isNaN(date.getTime()) ? null : date;
}
