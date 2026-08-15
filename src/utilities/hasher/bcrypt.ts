export const BCRYPT_ALPHABET = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function bcryptBase64Encode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const remaining = bytes.length - i;
    out += BCRYPT_ALPHABET[bytes[i] >> 2];
    if (remaining === 1) {
      out += BCRYPT_ALPHABET[(bytes[i] & 0x03) << 4];
      break;
    }
    out += BCRYPT_ALPHABET[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
    if (remaining === 2) {
      out += BCRYPT_ALPHABET[(bytes[i + 1] & 0x0f) << 2];
      break;
    }
    out += BCRYPT_ALPHABET[((bytes[i + 1] & 0x0f) << 2) | (bytes[i + 2] >> 6)];
    out += BCRYPT_ALPHABET[bytes[i + 2] & 0x3f];
  }
  return out;
}

export function bcryptBase64Decode(text: string, length: number): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const value = BCRYPT_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`"${char}" is not part of bcrypt's alphabet`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8 && out.length < length) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}
