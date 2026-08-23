export type Mode = "encode" | "decode";

export type Format =
  | "base64"
  | "base32"
  | "hex"
  | "decimal"
  | "binary"
  | "deflate"
  | "nato"
  | "morse"
  | "rot13"
  | "caesar"
  | "vigenere"
  | "xor";

export type ByteFormat = Exclude<Format, "deflate">;

export const FORMATS = [
  { value: "base64", label: "Base64" },
  { value: "base32", label: "Base32" },
  { value: "hex", label: "Hexadecimal" },
  { value: "decimal", label: "Decimal" },
  { value: "binary", label: "Binary" },
  { value: "deflate", label: "Deflate (Base64)" },
  { value: "nato", label: "NATO phonetic" },
  { value: "morse", label: "Morse code" },
  { value: "rot13", label: "ROT13" },
  { value: "caesar", label: "Caesar cipher" },
  { value: "vigenere", label: "Vigenère cipher" },
  { value: "xor", label: "XOR" },
];

export const VARIANTS: Record<Format, { value: string; label: string }[]> = {
  base64: [
    { value: "standard", label: "Standard (RFC 4648)" },
    { value: "standard-nopad", label: "Standard, no padding" },
    { value: "url", label: "URL-safe" },
    { value: "url-nopad", label: "URL-safe, no padding" },
  ],
  base32: [
    { value: "rfc4648", label: "Standard (RFC 4648)" },
    { value: "rfc4648-nopad", label: "Standard, no padding" },
    { value: "base32hex", label: "Extended hex (RFC 4648)" },
    { value: "crockford", label: "Crockford's Base32" },
  ],
  hex: [
    { value: "lower", label: "Lowercase" },
    { value: "upper", label: "Uppercase" },
    { value: "lower-spaced", label: "Lowercase, spaced" },
    { value: "upper-spaced", label: "Uppercase, spaced" },
  ],
  decimal: [
    { value: "space", label: "Space separated" },
    { value: "comma", label: "Comma separated" },
    { value: "padded", label: "Zero padded, spaced" },
  ],
  binary: [
    { value: "spaced", label: "Space separated bytes" },
    { value: "continuous", label: "Continuous" },
  ],
  deflate: [
    { value: "zlib", label: "Zlib wrapper (RFC 1950)" },
    { value: "raw", label: "Raw deflate (RFC 1951)" },
    { value: "gzip", label: "Gzip wrapper (RFC 1952)" },
  ],
  nato: [
    { value: "standard", label: "NATO/ICAO (Alfa, Juliett)" },
    { value: "alternate", label: "Common spellings (Alpha, Juliet)" },
    { value: "aviation", label: "Aviation digits (Tree, Fower, Niner)" },
  ],
  morse: [
    { value: "slash", label: "Slash between words" },
    { value: "spaces", label: "Three spaces between words" },
    { value: "symbols", label: "Interpunct and minus (·−)" },
  ],
  rot13: [
    { value: "rot13", label: "ROT13 (letters)" },
    { value: "rot18", label: "ROT18 (letters and digits)" },
    { value: "rot47", label: "ROT47 (printable ASCII)" },
  ],
  caesar: [
    { value: "letters", label: "Letters, the rest unchanged" },
    { value: "alphanumeric", label: "Letters and digits" },
    { value: "ascii", label: "Printable ASCII (! to ~)" },
  ],
  vigenere: [
    { value: "standard", label: "Standard (repeating key)" },
    { value: "autokey", label: "Autokey (key extended by the text)" },
    { value: "beaufort", label: "Beaufort (key minus text)" },
  ],
  xor: [
    { value: "text-hex", label: "Text key, hex output" },
    { value: "text-base64", label: "Text key, Base64 output" },
    { value: "hex-hex", label: "Hex key, hex output" },
    { value: "hex-base64", label: "Hex key, Base64 output" },
  ],
};

export const VARIANT_HINTS: Record<Format, string> = {
  base64: "Decoding accepts either alphabet",
  base32: "Alphabet applies to decoding too",
  hex: "Decoding ignores case and separators",
  decimal: "Decoding ignores separators",
  binary: "Decoding ignores separators",
  deflate: "Decoding accepts any of the three",
  nato: "Decoding accepts any spelling",
  morse: "Decoding accepts · and − as well",
  rot13: "Each ROT is its own inverse",
  caesar: "Which characters the shift turns",
  vigenere: "Beaufort is its own inverse",
  xor: "How the key and the output are written",
};

export function defaultVariant(format: Format): string {
  return VARIANTS[format][0].value;
}

export type KeyField = { label: string; description: string; placeholder: string; numeric: boolean };

export function keyField(format: Format, variant: string): KeyField | undefined {
  switch (format) {
    case "caesar":
      return { label: "Shift", description: "Positions along the alphabet", placeholder: "3", numeric: true };
    case "vigenere":
      return { label: "Key", description: "Letters only; the rest is ignored", placeholder: "LEMON", numeric: false };
    case "xor":
      return variant.startsWith("hex")
        ? { label: "Key", description: "Hexadecimal bytes", placeholder: "2f", numeric: false }
        : { label: "Key", description: "Read as UTF-8 text", placeholder: "secret", numeric: false };
    default:
      return undefined;
  }
}

export function defaultKey(format: Format): string {
  return format === "caesar" ? "3" : "";
}

export function isFormat(value: string | undefined | null): value is Format {
  return FORMATS.some((format) => format.value === value);
}
