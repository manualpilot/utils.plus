const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const VALUES = new Map(Array.from(ALPHABET, (char, index) => [char, index] as const));

export function encodeBase32(bytes: Uint8Array, padded = false): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  if (padded) { while (out.length % 8 !== 0) out += "="; }
  return out;
}

export function decodeBase32(text: string): Uint8Array<ArrayBuffer> {
  const chars = text.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of chars) {
    const value = VALUES.get(char);
    if (value === undefined) throw new Error(`"${char}" is not a Base32 character`);
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  if (bits >= 5) throw new Error("Base32 is truncated: it does not spell a whole number of bytes");
  return new Uint8Array(out);
}
