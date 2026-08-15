import { blake2b, blake2s } from "@noble/hashes/blake2.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512, sha512_224, sha512_256 } from "@noble/hashes/sha2.js";
import { keccak_256, sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js";
import { crc, CRC32_TABLE, CRC32C_TABLE, murmur3x64128, murmur3x8632, xxh32, xxh64 } from "./checksums";

export const HASHES: Record<string, (bytes: Uint8Array, seed: number) => Uint8Array> = {
  md5: (bytes) => md5(bytes),
  "sha-1": (bytes) => sha1(bytes),
  "sha-256": (bytes) => sha256(bytes),
  "sha-224": (bytes) => sha224(bytes),
  "sha-512": (bytes) => sha512(bytes),
  "sha-384": (bytes) => sha384(bytes),
  "sha-512-256": (bytes) => sha512_256(bytes),
  "sha-512-224": (bytes) => sha512_224(bytes),
  "sha3-224": (bytes) => sha3_224(bytes),
  "sha3-256": (bytes) => sha3_256(bytes),
  "sha3-384": (bytes) => sha3_384(bytes),
  "sha3-512": (bytes) => sha3_512(bytes),
  "keccak-256": (bytes) => keccak_256(bytes),
  "blake2b-512": (bytes) => blake2b(bytes, { dkLen: 64 }),
  "blake2b-256": (bytes) => blake2b(bytes, { dkLen: 32 }),
  "blake2s-256": (bytes) => blake2s(bytes, { dkLen: 32 }),
  "blake2s-128": (bytes) => blake2s(bytes, { dkLen: 16 }),
  "blake3-256": (bytes) => blake3(bytes, { dkLen: 32 }),
  "blake3-512": (bytes) => blake3(bytes, { dkLen: 64 }),
  "blake3-128": (bytes) => blake3(bytes, { dkLen: 16 }),
  crc32: (bytes) => bigIntToBytes(BigInt(crc(bytes, CRC32_TABLE)), 4),
  crc32c: (bytes) => bigIntToBytes(BigInt(crc(bytes, CRC32C_TABLE)), 4),
  xxh32: (bytes, seed) => bigIntToBytes(BigInt(xxh32(bytes, seed)), 4),
  xxh64: (bytes, seed) => bigIntToBytes(xxh64(bytes, seed), 8),
  "murmur3-32": (bytes, seed) => bigIntToBytes(BigInt(murmur3x8632(bytes, seed)), 4),
  "murmur3-128": (bytes, seed) => bigIntToBytes(murmur3x64128(bytes, seed), 16),
};

export function hashBytes(variant: string, bytes: Uint8Array, seed = 0): Uint8Array {
  const hash = HASHES[variant];
  if (!hash) throw new Error(`"${variant}" is not an algorithm this page knows`);
  return hash(bytes, seed);
}

export function formatDigest(digest: Uint8Array, format: string): string {
  switch (format) {
    case "hex-upper":
      return toHex(digest).toUpperCase();
    case "base64":
      return toBase64(digest);
    case "base64url":
      return toBase64(digest).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "decimal":
      return bytesToBigInt(digest).toString();
    default:
      return toHex(digest);
  }
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function phcBase64(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/=+$/, "");
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}
