export type Container =
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "bmp"
  | "avif"
  | "heic"
  | "tiff"
  | "ico"
  | "svg"
  | "unknown";

export const CONTAINER_LABELS: Record<Container, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  bmp: "BMP",
  avif: "AVIF",
  heic: "HEIC",
  tiff: "TIFF",
  ico: "ICO",
  svg: "SVG",
  unknown: "Unknown",
};

export function carriesExif(container: Container): boolean {
  return container === "jpeg" || container === "png" || container === "webp";
}

export function sniff(bytes: Uint8Array): Container {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (starts(bytes, PNG_SIGNATURE)) return "png";
  if (starts(bytes, ascii("GIF8"))) return "gif";
  if (starts(bytes, ascii("RIFF")) && starts(bytes.subarray(8), ascii("WEBP"))) return "webp";
  if (starts(bytes, ascii("BM"))) return "bmp";
  if (starts(bytes, [0x49, 0x49, 0x2a, 0x00]) || starts(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff";
  if (starts(bytes, [0x00, 0x00, 0x01, 0x00])) return "ico";
  if (starts(bytes.subarray(4), ascii("ftyp"))) {
    const brand = LATIN1.decode(bytes.subarray(8, 12));
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
    return "heic";
  }
  const head = LATIN1.decode(bytes.subarray(0, 256));
  if (/<svg[\s>]/i.test(head) || (/^\s*<\?xml/.test(head) && /svg/i.test(head))) return "svg";
  return "unknown";
}

export function readExifBlock(bytes: Uint8Array, container: Container): Uint8Array | null {
  if (container === "jpeg") return jpegExif(bytes);
  if (container === "png") return pngChunk(bytes, "eXIf");
  if (container === "webp") return webpChunk(bytes, "EXIF");
  if (container === "tiff") return bytes;
  return null;
}

export function writeExifBlock(bytes: Uint8Array, container: Container, block: Uint8Array | null): Uint8Array | null {
  if (container === "jpeg") return setJpegExif(bytes, block);
  if (container === "png") return setPngChunk(bytes, "eXIf", block);
  if (container === "webp") return setWebpChunk(bytes, "EXIF", block);
  return null;
}

export function stripMetadata(bytes: Uint8Array, container: Container): Uint8Array | null {
  if (container === "jpeg") return rebuildJpeg(bytes, (marker, data) => keepJpegSegment(marker, data), null);
  if (container === "png") {
    const kept = pngChunks(bytes)?.filter((chunk) => !PNG_METADATA.has(chunk.type));
    return kept ? buildPng(kept) : null;
  }
  if (container === "webp") {
    const chunks = webpChunks(bytes);
    return chunks ? buildWebp(bytes, chunks.filter((chunk) => chunk.type !== "EXIF" && chunk.type !== "XMP ")) : null;
  }
  return null;
}

function jpegExif(bytes: Uint8Array): Uint8Array | null {
  for (const segment of jpegSegments(bytes) ?? []) {
    if (segment.marker !== 0xe1) continue;
    if (starts(segment.data, EXIF_HEADER)) return segment.data.subarray(EXIF_HEADER.length);
  }
  return null;
}

function setJpegExif(bytes: Uint8Array, block: Uint8Array | null): Uint8Array | null {
  if (block && block.length + EXIF_HEADER.length + 2 > 0xffff) return null;
  const app1 = block ? concat(EXIF_HEADER, block) : null;
  return rebuildJpeg(bytes, (marker, data) => !(marker === 0xe1 && starts(data, EXIF_HEADER)), app1);
}

function rebuildJpeg(
  bytes: Uint8Array,
  keep: (marker: number, data: Uint8Array) => boolean,
  insert: Uint8Array | null,
): Uint8Array | null {
  const segments = jpegSegments(bytes);
  if (!segments) return null;

  const parts: Uint8Array[] = [SOI];
  let placed = insert === null;
  for (const segment of segments) {
    if (!placed && segment.marker !== 0xe0) {
      parts.push(marked(0xe1, insert!));
      placed = true;
    }
    if (!keep(segment.marker, segment.data)) continue;
    parts.push(marked(segment.marker, segment.data));
  }
  if (!placed) parts.push(marked(0xe1, insert!));
  parts.push(bytes.subarray(scanStart(bytes)));
  return concat(...parts);
}

function jpegSegments(bytes: Uint8Array): Segment[] | null {
  if (!starts(bytes, [0xff, 0xd8])) return null;
  const segments: Segment[] = [];
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return segments;
    const marker = bytes[at + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    if (marker === 0xda) break;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (length < 2 || at + 2 + length > bytes.length) return segments;
    segments.push({ marker, data: bytes.subarray(at + 4, at + 2 + length) });
    at += 2 + length;
  }
  return segments;
}

function scanStart(bytes: Uint8Array): number {
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return at;
    const marker = bytes[at + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    if (marker === 0xda) return at;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (length < 2 || at + 2 + length > bytes.length) return at;
    at += 2 + length;
  }
  return at;
}

function keepJpegSegment(marker: number, data: Uint8Array): boolean {
  if (marker === 0xfe) return false;
  if (marker === 0xe0) return true;
  if (marker === 0xe2 && starts(data, ascii("ICC_PROFILE"))) return true;
  return marker < 0xe0 || marker > 0xef;
}

function marked(marker: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (data.length + 2) >> 8;
  out[3] = (data.length + 2) & 0xff;
  out.set(data, 4);
  return out;
}

interface Segment {
  marker: number;
  data: Uint8Array;
}

interface Chunk {
  type: string;
  data: Uint8Array;
}

function pngChunks(bytes: Uint8Array): Chunk[] | null {
  if (!starts(bytes, PNG_SIGNATURE)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    if (at + 12 + length > bytes.length) break;
    const type = LATIN1.decode(bytes.subarray(at + 4, at + 8));
    chunks.push({ type, data: bytes.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function pngChunk(bytes: Uint8Array, type: string): Uint8Array | null {
  return pngChunks(bytes)?.find((chunk) => chunk.type === type)?.data ?? null;
}

function setPngChunk(bytes: Uint8Array, type: string, data: Uint8Array | null): Uint8Array | null {
  const chunks = pngChunks(bytes);
  if (!chunks) return null;
  const kept = chunks.filter((chunk) => chunk.type !== type);
  if (data) {
    const at = kept.findIndex((chunk) => chunk.type === "IDAT");
    kept.splice(at < 0 ? Math.max(kept.length - 1, 0) : at, 0, { type, data });
  }
  return buildPng(kept);
}

function buildPng(chunks: Chunk[]): Uint8Array {
  const parts: Uint8Array[] = [PNG_SIGNATURE];
  for (const chunk of chunks) {
    const out = new Uint8Array(12 + chunk.data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, chunk.data.length);
    out.set(ascii(chunk.type), 4);
    out.set(chunk.data, 8);
    view.setUint32(8 + chunk.data.length, crc32(out.subarray(4, 8 + chunk.data.length)));
    parts.push(out);
  }
  return concat(...parts);
}

function webpChunks(bytes: Uint8Array): Chunk[] | null {
  if (!starts(bytes, ascii("RIFF")) || !starts(bytes.subarray(8), ascii("WEBP"))) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at + 4, true);
    if (at + 8 + length > bytes.length) break;
    chunks.push({ type: LATIN1.decode(bytes.subarray(at, at + 4)), data: bytes.subarray(at + 8, at + 8 + length) });
    at += 8 + length + (length % 2);
  }
  return chunks;
}

function webpChunk(bytes: Uint8Array, type: string): Uint8Array | null {
  return webpChunks(bytes)?.find((chunk) => chunk.type === type)?.data ?? null;
}

function setWebpChunk(bytes: Uint8Array, type: string, data: Uint8Array | null): Uint8Array | null {
  const chunks = webpChunks(bytes);
  if (!chunks) return null;
  const kept = chunks.filter((chunk) => chunk.type !== type);
  if (data) {
    const at = kept.findIndex((chunk) => chunk.type === "XMP ");
    kept.splice(at < 0 ? kept.length : at, 0, { type, data });
  }
  return buildWebp(bytes, kept);
}

function buildWebp(bytes: Uint8Array, chunks: Chunk[]): Uint8Array | null {
  const size = webpCanvas(bytes, chunks);
  if (!size) return null;

  const body = chunks.filter((chunk) => chunk.type !== "VP8X");
  const flags = (body.some((chunk) => chunk.type === "ICCP") ? 0x20 : 0)
    | (webpHasAlpha(bytes, chunks) ? 0x10 : 0)
    | (body.some((chunk) => chunk.type === "EXIF") ? 0x08 : 0)
    | (body.some((chunk) => chunk.type === "XMP ") ? 0x04 : 0)
    | (body.some((chunk) => chunk.type === "ANIM") ? 0x02 : 0);

  const extended = flags !== 0;
  const header = new Uint8Array(10);
  header[0] = flags;
  writeUint24(header, 4, size.width - 1);
  writeUint24(header, 7, size.height - 1);

  const parts: Uint8Array[] = [];
  if (extended) parts.push(webpBlock("VP8X", header));
  for (const chunk of body) parts.push(webpBlock(chunk.type, chunk.data));

  const payload = concat(...parts);
  const out = new Uint8Array(12 + payload.length);
  out.set(ascii("RIFF"));
  new DataView(out.buffer).setUint32(4, 4 + payload.length, true);
  out.set(ascii("WEBP"), 8);
  out.set(payload, 12);
  return out;
}

function webpBlock(type: string, data: Uint8Array): Uint8Array {
  const padded = data.length % 2;
  const out = new Uint8Array(8 + data.length + padded);
  out.set(ascii(type));
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

export function webpCanvas(bytes: Uint8Array, chunks?: Chunk[]): { width: number; height: number } | null {
  const found = chunks ?? webpChunks(bytes);
  if (!found) return null;

  const lossy = found.find((chunk) => chunk.type === "VP8 ");
  if (lossy && lossy.data.length >= 10 && lossy.data[3] === 0x9d && lossy.data[4] === 0x01 && lossy.data[5] === 0x2a) {
    const view = new DataView(lossy.data.buffer, lossy.data.byteOffset, lossy.data.byteLength);
    return { width: view.getUint16(6, true) & 0x3fff, height: view.getUint16(8, true) & 0x3fff };
  }

  const lossless = found.find((chunk) => chunk.type === "VP8L");
  if (lossless && lossless.data.length >= 5 && lossless.data[0] === 0x2f) {
    const bits = lossless.data[1] | (lossless.data[2] << 8) | (lossless.data[3] << 16) | (lossless.data[4] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }

  const extended = found.find((chunk) => chunk.type === "VP8X");
  if (extended && extended.data.length >= 10) {
    return { width: readUint24(extended.data, 4) + 1, height: readUint24(extended.data, 7) + 1 };
  }
  return null;
}

export function webpHasAlpha(bytes: Uint8Array, chunks?: Chunk[]): boolean {
  const found = chunks ?? webpChunks(bytes);
  if (!found) return false;
  if (found.some((chunk) => chunk.type === "ALPH")) return true;
  const lossless = found.find((chunk) => chunk.type === "VP8L");
  if (lossless && lossless.data.length >= 5 && lossless.data[0] === 0x2f) return (lossless.data[4] & 0x10) !== 0;
  const extended = found.find((chunk) => chunk.type === "VP8X");
  return Boolean(extended && extended.data.length >= 1 && (extended.data[0] & 0x10) !== 0);
}

export function pngText(bytes: Uint8Array): Promise<{ key: string; value: string }[]> {
  const chunks = pngChunks(bytes);
  if (!chunks) return Promise.resolve([]);
  return Promise.all(chunks.filter((chunk) => PNG_TEXT.has(chunk.type)).map((chunk) => readPngText(chunk)))
    .then((entries) => entries.filter((entry): entry is { key: string; value: string } => entry !== null));
}

async function readPngText(chunk: Chunk): Promise<{ key: string; value: string } | null> {
  const end = chunk.data.indexOf(0);
  if (end < 0) return null;
  const key = LATIN1.decode(chunk.data.subarray(0, end));
  if (chunk.type === "tEXt") return { key, value: LATIN1.decode(chunk.data.subarray(end + 1)) };
  if (chunk.type === "zTXt") {
    const value = await inflate(chunk.data.subarray(end + 2));
    return value === null ? null : { key, value: LATIN1.decode(value) };
  }
  const compressed = chunk.data[end + 1] === 1;
  const language = chunk.data.indexOf(0, end + 3);
  const translated = chunk.data.indexOf(0, language + 1);
  if (language < 0 || translated < 0) return null;
  const body = chunk.data.subarray(translated + 1);
  const text = compressed ? await inflate(body) : body;
  return text === null ? null : { key, value: UTF8.decode(text) };
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream !== "function") return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function starts(bytes: Uint8Array, prefix: ArrayLike<number>): boolean {
  if (bytes.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index++) if (bytes[index] !== prefix[index]) return false;
  return true;
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function readUint24(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
}

function writeUint24(bytes: Uint8Array, at: number, value: number) {
  bytes[at] = value & 0xff;
  bytes[at + 1] = (value >> 8) & 0xff;
  bytes[at + 2] = (value >> 16) & 0xff;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

const LATIN1 = new TextDecoder("latin1");
const UTF8 = new TextDecoder();

const SOI = Uint8Array.from([0xff, 0xd8]);
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const EXIF_HEADER = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);

const PNG_TEXT = new Set(["tEXt", "zTXt", "iTXt"]);

const PNG_METADATA = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME", "pHYs", "sPLT", "hIST"]);
