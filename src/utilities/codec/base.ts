export const BASE64_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export const BASE64_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const BASE32_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_HEX = "0123456789ABCDEFGHIJKLMNOPQRSTUV";
const BASE32_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const BASE32_ALPHABETS: Record<string, string> = {
  rfc4648: BASE32_STANDARD,
  "rfc4648-nopad": BASE32_STANDARD,
  base32hex: BASE32_HEX,
  crockford: BASE32_CROCKFORD,
};

function buildLookup(alphabet: string, aliases: Record<string, number> = {}): Map<string, number> {
  const lookup = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) {
    lookup.set(alphabet[i], i);
  }
  for (const [char, value] of Object.entries(aliases)) {
    lookup.set(char, value);
  }
  return lookup;
}

export const BASE64_LOOKUP = buildLookup(BASE64_STANDARD, { "-": 62, _: 63 });

export function base32Lookup(variant: string): Map<string, number> {
  const alphabet = BASE32_ALPHABETS[variant] ?? BASE32_STANDARD;
  if (variant !== "crockford") return buildLookup(alphabet);
  return buildLookup(alphabet, { I: 1, L: 1, O: 0 });
}

export function encodeWithAlphabet(bytes: Uint8Array, alphabet: string, bitsPerChar: number): string {
  const mask = alphabet.length - 1;
  let out = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[(buffer >> bits) & mask];
    }
  }
  if (bits > 0) {
    out += alphabet[(buffer << (bitsPerChar - bits)) & mask];
  }
  return out;
}

export function decodeWithAlphabet(
  chars: string,
  lookup: Map<string, number>,
  bitsPerChar: number,
): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of chars) {
    const value = lookup.get(char);
    if (value === undefined) {
      throw new Error(`"${char}" is not valid for the selected format`);
    }
    buffer = (buffer << bitsPerChar) | value;
    bits += bitsPerChar;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  if (bits >= bitsPerChar) {
    throw new Error("Input is truncated: it does not contain a whole number of bytes");
  }
  return new Uint8Array(out);
}

export function pad(encoded: string, blockSize: number): string {
  const remainder = encoded.length % blockSize;
  return remainder === 0 ? encoded : encoded + "=".repeat(blockSize - remainder);
}
