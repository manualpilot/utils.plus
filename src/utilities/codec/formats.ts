export type Mode = "encode" | "decode";

export type Format = "base64" | "base32" | "hex" | "decimal" | "binary" | "nato" | "morse";

export const FORMATS = [
  { value: "base64", label: "Base64" },
  { value: "base32", label: "Base32" },
  { value: "hex", label: "Hexadecimal" },
  { value: "decimal", label: "Decimal" },
  { value: "binary", label: "Binary" },
  { value: "nato", label: "NATO phonetic" },
  { value: "morse", label: "Morse code" },
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
};

export const VARIANT_HINTS: Record<Format, string> = {
  base64: "Decoding accepts either alphabet",
  base32: "Alphabet applies to decoding too",
  hex: "Decoding ignores case and separators",
  decimal: "Decoding ignores separators",
  binary: "Decoding ignores separators",
  nato: "Decoding accepts any spelling",
  morse: "Decoding accepts · and − as well",
};

export function defaultVariant(format: Format): string {
  return VARIANTS[format][0].value;
}

export function isFormat(value: string | undefined | null): value is Format {
  return FORMATS.some((format) => format.value === value);
}
