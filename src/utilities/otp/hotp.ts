import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

export type Algorithm = "SHA1" | "SHA256" | "SHA512";

export const HASHES = { SHA1: sha1, SHA256: sha256, SHA512: sha512 };

export const ALGORITHMS = Object.keys(HASHES) as Algorithm[];

export function hotp(key: Uint8Array, counter: bigint, algorithm: Algorithm, digits: number): string {
  return truncate(hmac(HASHES[algorithm], key, counterBytes(counter)), digits);
}

export function timeStep(seconds: number, period: number): bigint {
  return BigInt(Math.floor(seconds / period));
}

export function counterBytes(counter: bigint): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8);
  let value = BigInt.asUintN(64, counter);
  for (let index = 7; index >= 0; index--) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

export function truncate(mac: Uint8Array, digits: number): string {
  if (digits === 0) return Array.from(mac, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24)
    | (mac[offset + 1] << 16)
    | (mac[offset + 2] << 8)
    | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}
