export function sniff(bytes: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    if (matches(bytes, signature)) return signature.label;
  }
  return textKind(bytes);
}

interface Signature {
  label: string;
  at: number;
  magic: number[];
  also?: { at: number; magic: number[] };
}

function matches(bytes: Uint8Array, signature: Signature): boolean {
  return run(bytes, signature.at, signature.magic)
    && (!signature.also || run(bytes, signature.also.at, signature.also.magic));
}

function run(bytes: Uint8Array, at: number, magic: number[]): boolean {
  if (at + magic.length > bytes.length) return false;
  for (let index = 0; index < magic.length; index++) {
    if (bytes[at + index] !== magic[index]) return false;
  }
  return true;
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function textKind(bytes: Uint8Array): string | null {
  const cut = bytes.length > TEXT_SAMPLE;
  const sample = bytes.subarray(0, TEXT_SAMPLE);
  if (sample.length === 0) return null;
  for (const byte of sample) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    if (byte < 0x20 || byte === 0x7f) return null;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(cut ? sample.subarray(0, sample.length - TRIM) : sample);
    return "Text (UTF-8)";
  } catch {
    return "Text (single-byte)";
  }
}

const TRIM = 4;

const TEXT_SAMPLE = 4096;

const SIGNATURES: Signature[] = [
  { label: "PNG image", at: 0, magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { label: "JPEG image", at: 0, magic: [0xff, 0xd8, 0xff] },
  { label: "GIF image", at: 0, magic: ascii("GIF8") },
  { label: "WebP image", at: 0, magic: ascii("RIFF"), also: { at: 8, magic: ascii("WEBP") } },
  { label: "WAVE audio", at: 0, magic: ascii("RIFF"), also: { at: 8, magic: ascii("WAVE") } },
  { label: "AVI video", at: 0, magic: ascii("RIFF"), also: { at: 8, magic: ascii("AVI ") } },
  { label: "BMP image", at: 0, magic: ascii("BM") },
  { label: "TIFF image (little-endian)", at: 0, magic: [0x49, 0x49, 0x2a, 0x00] },
  { label: "TIFF image (big-endian)", at: 0, magic: [0x4d, 0x4d, 0x00, 0x2a] },
  { label: "Icon", at: 0, magic: [0x00, 0x00, 0x01, 0x00] },
  { label: "AVIF or HEIF image", at: 4, magic: ascii("ftypavif") },
  { label: "MP4 video", at: 4, magic: ascii("ftyp") },
  { label: "Matroska or WebM", at: 0, magic: [0x1a, 0x45, 0xdf, 0xa3] },
  { label: "Ogg container", at: 0, magic: ascii("OggS") },
  { label: "FLAC audio", at: 0, magic: ascii("fLaC") },
  { label: "MP3 audio (ID3)", at: 0, magic: ascii("ID3") },
  { label: "PDF document", at: 0, magic: ascii("%PDF-") },
  { label: "PostScript", at: 0, magic: ascii("%!PS") },
  { label: "RTF document", at: 0, magic: ascii("{\\rtf") },
  { label: "Zip archive (or a format built on one)", at: 0, magic: [0x50, 0x4b, 0x03, 0x04] },
  { label: "Zip archive (empty)", at: 0, magic: [0x50, 0x4b, 0x05, 0x06] },
  { label: "Gzip stream", at: 0, magic: [0x1f, 0x8b] },
  { label: "Bzip2 archive", at: 0, magic: ascii("BZh") },
  { label: "XZ archive", at: 0, magic: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
  { label: "Zstandard stream", at: 0, magic: [0x28, 0xb5, 0x2f, 0xfd] },
  { label: "7-Zip archive", at: 0, magic: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { label: "RAR archive", at: 0, magic: ascii("Rar!") },
  { label: "Tar archive", at: 257, magic: ascii("ustar") },
  { label: "SQLite database", at: 0, magic: ascii("SQLite format 3\0") },
  { label: "ELF executable", at: 0, magic: [0x7f, 0x45, 0x4c, 0x46] },
  { label: "DOS or Windows executable", at: 0, magic: ascii("MZ") },
  { label: "Mach-O executable (64-bit)", at: 0, magic: [0xcf, 0xfa, 0xed, 0xfe] },
  { label: "Mach-O executable (32-bit)", at: 0, magic: [0xce, 0xfa, 0xed, 0xfe] },
  { label: "Java class file or Mach-O universal binary", at: 0, magic: [0xca, 0xfe, 0xba, 0xbe] },
  { label: "WebAssembly module", at: 0, magic: [0x00, 0x61, 0x73, 0x6d] },
  { label: "OpenType font", at: 0, magic: ascii("OTTO") },
  { label: "TrueType font", at: 0, magic: [0x00, 0x01, 0x00, 0x00] },
  { label: "WOFF font", at: 0, magic: ascii("wOFF") },
  { label: "WOFF2 font", at: 0, magic: ascii("wOF2") },
  { label: "Text (UTF-8, with a byte order mark)", at: 0, magic: [0xef, 0xbb, 0xbf] },
  { label: "Text (UTF-16, little-endian)", at: 0, magic: [0xff, 0xfe] },
  { label: "Text (UTF-16, big-endian)", at: 0, magic: [0xfe, 0xff] },
];
