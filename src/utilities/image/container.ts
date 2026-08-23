import type { Fact } from "../../common/fact-table";
import { type Container, CONTAINER_LABELS, pngText, readExifBlock, sniff, webpCanvas, webpHasAlpha } from "./embed";

export interface ContainerInfo {
  container: Container;
  label: string;
  width: number;
  height: number;
  facts: Fact[];
  text: { key: string; value: string }[];
  exif: Uint8Array | null;
  animated: boolean;
  hasAlpha: boolean;
  hasProfile: boolean;
  xmp: string | null;
  comments: string[];
}

export async function readContainer(bytes: Uint8Array): Promise<ContainerInfo> {
  const container = sniff(bytes);
  const info: ContainerInfo = {
    container,
    label: CONTAINER_LABELS[container],
    width: 0,
    height: 0,
    facts: [],
    text: [],
    exif: readExifBlock(bytes, container),
    animated: false,
    hasAlpha: false,
    hasProfile: false,
    xmp: null,
    comments: [],
  };

  if (container === "png") readPng(bytes, info);
  if (container === "jpeg") readJpeg(bytes, info);
  if (container === "gif") readGif(bytes, info);
  if (container === "webp") readWebp(bytes, info);
  if (container === "bmp") readBmp(bytes, info);
  if (container === "svg") readSvg(bytes, info);
  if (container === "png") info.text = await pngText(bytes);
  return info;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ["kB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(2) : value.toFixed(1)} ${units[unit]} (${size.toLocaleString()} bytes)`;
}

export function aspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "";
  const factor = gcd(width, height);
  const [left, right] = [width / factor, height / factor];
  if (left <= 40 && right <= 40) return `${left}:${right}`;
  return `${(width / height).toFixed(2)}:1`;
}

function gcd(left: number, right: number): number {
  return right === 0 ? left : gcd(right, left % right);
}

function readPng(bytes: Uint8Array, info: ContainerInfo) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8;
  let palette = 0;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    if (at + 12 + length > bytes.length) break;
    const type = LATIN1.decode(bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);

    if (type === "IHDR" && length >= 13) {
      info.width = view.getUint32(at + 8);
      info.height = view.getUint32(at + 12);
      const depth = data[8];
      const colour = data[9];
      info.hasAlpha = colour === 4 || colour === 6;
      info.facts.push({ label: "Colour type", value: PNG_COLOURS[colour] ?? String(colour) });
      info.facts.push({ label: "Bit depth", value: `${depth} per channel` });
      info.facts.push({ label: "Interlacing", value: data[12] === 1 ? "Adam7" : "None" });
    }
    if (type === "PLTE") palette = length / 3;
    if (type === "tRNS") info.hasAlpha = true;
    if (type === "acTL" && length >= 8) {
      info.animated = true;
      const plays = view.getUint32(at + 12);
      info.facts.push({ label: "Frames", value: String(view.getUint32(at + 8)) });
      info.facts.push({ label: "Plays", value: plays === 0 ? "Forever" : String(plays) });
    }
    if (type === "iCCP") {
      info.hasProfile = true;
      const end = data.indexOf(0);
      info.facts.push({ label: "Colour profile", value: end > 0 ? LATIN1.decode(data.subarray(0, end)) : "Embedded" });
    }
    if (type === "sRGB" && length >= 1) {
      info.facts.push({ label: "Rendering intent", value: PNG_INTENTS[data[0]] ?? String(data[0]) });
    }
    if (type === "gAMA" && length >= 4) {
      info.facts.push({ label: "Gamma", value: (100000 / view.getUint32(at + 8)).toFixed(4) });
    }
    if (type === "pHYs" && length >= 9) {
      const x = view.getUint32(at + 8);
      const y = view.getUint32(at + 12);
      const value = data[8] === 1
        ? `${Math.round(x * 0.0254)} × ${Math.round(y * 0.0254)} dpi`
        : `${x} × ${y} per unit`;
      info.facts.push({ label: "Pixel density", value });
    }
    if (type === "tIME" && length >= 7) {
      const stamp = `${view.getUint16(at + 8)}-${pad(data[2])}-${pad(data[3])} ${pad(data[4])}:${pad(data[5])}:${
        pad(data[6])
      }`;
      info.facts.push({ label: "Last modified", value: `${stamp} UTC` });
    }
    at += 12 + length;
    if (type === "IEND") break;
  }
  if (palette > 0) info.facts.push({ label: "Palette", value: `${palette} colours` });
}

function readJpeg(bytes: Uint8Array, info: ContainerInfo) {
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    if (marker === 0xda) break;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (length < 2 || at + 2 + length > bytes.length) break;
    const data = bytes.subarray(at + 4, at + 2 + length);

    if (SOF_MARKERS.has(marker) && data.length >= 6) {
      info.height = (data[1] << 8) | data[2];
      info.width = (data[3] << 8) | data[4];
      info.facts.push({ label: "Coding", value: SOF_MARKERS.get(marker)! });
      info.facts.push({ label: "Precision", value: `${data[0]} bits` });
      info.facts.push({ label: "Components", value: `${data[5]} (${data[5] === 1 ? "greyscale" : "colour"})` });
      if (data.length >= 6 + data[5] * 3) info.facts.push({ label: "Sub-sampling", value: sampling(data) });
    }
    if (marker === 0xe0 && data.length >= 12 && LATIN1.decode(data.subarray(0, 4)) === "JFIF") {
      info.facts.push({ label: "JFIF version", value: `${data[5]}.${String(data[6]).padStart(2, "0")}` });
      const x = (data[8] << 8) | data[9];
      const y = (data[10] << 8) | data[11];
      const label = data[7] === 0 ? "Pixel aspect" : "Pixel density";
      const unit = data[7] === 1 ? " dpi" : data[7] === 2 ? " dpcm" : "";
      info.facts.push({ label, value: data[7] === 0 ? `${x} : ${y}` : `${x} × ${y}${unit}` });
    }
    if (marker === 0xe2 && LATIN1.decode(data.subarray(0, 11)) === "ICC_PROFILE") {
      info.hasProfile = true;
    }
    if (marker === 0xe1 && LATIN1.decode(data.subarray(0, 28)) === XMP_NAMESPACE) {
      info.xmp = UTF8.decode(data.subarray(29));
    }
    if (marker === 0xed) info.facts.push({ label: "Photoshop", value: "IPTC or Photoshop resources present" });
    if (marker === 0xfe) info.comments.push(LATIN1.decode(data).replace(/\0+$/, ""));
    at += 2 + length;
  }
  if (info.hasProfile) info.facts.push({ label: "Colour profile", value: "Embedded ICC profile" });
}

function readGif(bytes: Uint8Array, info: ContainerInfo) {
  if (bytes.length < 13) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  info.facts.push({ label: "Version", value: LATIN1.decode(bytes.subarray(3, 6)) });
  info.width = view.getUint16(6, true);
  info.height = view.getUint16(8, true);
  const packed = bytes[10];
  if ((packed & 0x80) !== 0) info.facts.push({ label: "Palette", value: `${2 << (packed & 0x07)} colours` });
  info.facts.push({ label: "Colour resolution", value: `${((packed >> 4) & 0x07) + 1} bits per channel` });

  let frames = 0;
  let at = 13 + ((packed & 0x80) !== 0 ? 3 * (2 << (packed & 0x07)) : 0);
  while (at < bytes.length) {
    const block = bytes[at];
    if (block === 0x3b) break;
    if (block === 0x2c) {
      frames++;
      const local = bytes[at + 9];
      at += 10 + ((local & 0x80) !== 0 ? 3 * (2 << (local & 0x07)) : 0) + 1;
      at = skipBlocks(bytes, at);
      continue;
    }
    if (block === 0x21) {
      if (bytes[at + 1] === 0xf9 && bytes[at + 3] !== undefined) info.hasAlpha ||= (bytes[at + 3] & 0x01) !== 0;
      if (bytes[at + 1] === 0xfe) info.comments.push(LATIN1.decode(readBlocks(bytes, at + 2)));
      at = skipBlocks(bytes, at + 2);
      continue;
    }
    break;
  }
  info.animated = frames > 1;
  info.facts.push({ label: "Frames", value: String(frames) });
}

function readWebp(bytes: Uint8Array, info: ContainerInfo) {
  const size = webpCanvas(bytes);
  if (size) {
    info.width = size.width;
    info.height = size.height;
  }
  info.hasAlpha = webpHasAlpha(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kinds: string[] = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at + 4, true);
    if (at + 8 + length > bytes.length) break;
    const type = LATIN1.decode(bytes.subarray(at, at + 4));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === "VP8 ") kinds.push("Lossy");
    if (type === "VP8L") kinds.push("Lossless");
    if (type === "ALPH") kinds.push("Alpha channel");
    if (type === "ICCP") info.hasProfile = true;
    if (type === "XMP ") info.xmp = UTF8.decode(data);
    if (type === "ANIM" && length >= 6) {
      info.animated = true;
      const plays = view.getUint16(at + 12, true);
      info.facts.push({ label: "Plays", value: plays === 0 ? "Forever" : String(plays) });
    }
    if (type === "ANMF") info.animated = true;
    at += 8 + length + (length % 2);
  }
  if (kinds.length > 0) info.facts.push({ label: "Compression", value: kinds.join(", ") });
  if (info.hasProfile) info.facts.push({ label: "Colour profile", value: "Embedded ICC profile" });
}

function readBmp(bytes: Uint8Array, info: ContainerInfo) {
  if (bytes.length < 30) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = view.getUint32(14, true);
  info.width = view.getInt32(18, true);
  info.height = Math.abs(view.getInt32(22, true));
  const depth = view.getUint16(28, true);
  info.hasAlpha = depth === 32;
  info.facts.push({ label: "Header", value: BMP_HEADERS[header] ?? `${header}-byte header` });
  info.facts.push({ label: "Bit depth", value: `${depth} per pixel` });
  info.facts.push({ label: "Compression", value: BMP_COMPRESSION[view.getUint32(30, true)] ?? "Unknown" });
  info.facts.push({ label: "Row order", value: view.getInt32(22, true) < 0 ? "Top down" : "Bottom up" });
}

function readSvg(bytes: Uint8Array, info: ContainerInfo) {
  const text = UTF8.decode(bytes.subarray(0, 4096));
  const element = /<svg\b[^>]*>/i.exec(text)?.[0] ?? "";
  const attribute = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(element)?.[1] ?? "";
  const box = attribute("viewBox");
  if (box) info.facts.push({ label: "View box", value: box });
  for (const name of ["width", "height"]) {
    const value = attribute(name);
    if (value) info.facts.push({ label: name === "width" ? "Declared width" : "Declared height", value });
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(text)?.[1];
  if (title) info.comments.push(title.trim());
}

function sampling(frame: Uint8Array): string {
  const factors: string[] = [];
  for (let index = 0; index < frame[5]; index++) {
    const packed = frame[7 + index * 3];
    factors.push(`${packed >> 4}x${packed & 0x0f}`);
  }
  const key = factors.join(" ");
  return JPEG_SAMPLING[key] ?? key;
}

function skipBlocks(bytes: Uint8Array, at: number): number {
  while (at < bytes.length && bytes[at] !== 0) at += bytes[at] + 1;
  return at + 1;
}

function readBlocks(bytes: Uint8Array, at: number): Uint8Array {
  const parts: number[] = [];
  while (at < bytes.length && bytes[at] !== 0) {
    for (let index = 1; index <= bytes[at]; index++) parts.push(bytes[at + index]);
    at += bytes[at] + 1;
  }
  return Uint8Array.from(parts);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const LATIN1 = new TextDecoder("latin1");
const UTF8 = new TextDecoder();

const XMP_NAMESPACE = "http://ns.adobe.com/xap/1.0/";

const PNG_COLOURS: Record<number, string> = {
  0: "Greyscale",
  2: "Truecolour",
  3: "Indexed",
  4: "Greyscale with alpha",
  6: "Truecolour with alpha",
};

const PNG_INTENTS: Record<number, string> = {
  0: "Perceptual",
  1: "Relative colorimetric",
  2: "Saturation",
  3: "Absolute colorimetric",
};

const SOF_MARKERS = new Map<number, string>([
  [0xc0, "Baseline"],
  [0xc1, "Extended sequential"],
  [0xc2, "Progressive"],
  [0xc3, "Lossless"],
  [0xc5, "Differential sequential"],
  [0xc6, "Differential progressive"],
  [0xc7, "Differential lossless"],
  [0xc9, "Arithmetic sequential"],
  [0xca, "Arithmetic progressive"],
  [0xcb, "Arithmetic lossless"],
  [0xcd, "Differential arithmetic sequential"],
  [0xce, "Differential arithmetic progressive"],
  [0xcf, "Differential arithmetic lossless"],
]);

const JPEG_SAMPLING: Record<string, string> = {
  "2x2 1x1 1x1": "4:2:0",
  "2x1 1x1 1x1": "4:2:2",
  "1x1 1x1 1x1": "4:4:4",
  "1x2 1x1 1x1": "4:4:0",
  "4x1 1x1 1x1": "4:1:1",
};

const BMP_HEADERS: Record<number, string> = {
  12: "BITMAPCOREHEADER",
  40: "BITMAPINFOHEADER",
  52: "BITMAPV2INFOHEADER",
  56: "BITMAPV3INFOHEADER",
  108: "BITMAPV4HEADER",
  124: "BITMAPV5HEADER",
};

const BMP_COMPRESSION: Record<number, string> = {
  0: "None",
  1: "8-bit run length",
  2: "4-bit run length",
  3: "Bit fields",
  4: "JPEG",
  5: "PNG",
};
