import { hexToBytes } from "./base";

export function xorBytes(bytes: Uint8Array, key: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return out;
}

export function xorKeyBytes(key: string, variant: string): Uint8Array {
  const bytes = variant.startsWith("hex") ? hexToBytes(key, "The XOR key") : new TextEncoder().encode(key);
  if (bytes.length === 0) throw new Error("The XOR key must not be empty");
  return bytes;
}
