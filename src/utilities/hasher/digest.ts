import { blake2b, blake2s } from "@noble/hashes/blake2.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512, sha512_224, sha512_256 } from "@noble/hashes/sha2.js";
import { keccak_256, sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js";
import { crc, CRC32_TABLE, CRC32C_TABLE, CRC_INITIAL, crcFinish, crcUpdate, murmur3x64128, murmur3x8632, xxh32, xxh64 } from "./checksums";

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

export interface Streaming {
  update(chunk: Uint8Array): void;
  digest(): Uint8Array;
}

const STREAMS: Record<string, () => Streaming> = {
  md5: () => md5.create(),
  "sha-1": () => sha1.create(),
  "sha-256": () => sha256.create(),
  "sha-224": () => sha224.create(),
  "sha-512": () => sha512.create(),
  "sha-384": () => sha384.create(),
  "sha-512-256": () => sha512_256.create(),
  "sha-512-224": () => sha512_224.create(),
  "sha3-224": () => sha3_224.create(),
  "sha3-256": () => sha3_256.create(),
  "sha3-384": () => sha3_384.create(),
  "sha3-512": () => sha3_512.create(),
  "keccak-256": () => keccak_256.create(),
  "blake2b-512": () => blake2b.create({ dkLen: 64 }),
  "blake2b-256": () => blake2b.create({ dkLen: 32 }),
  "blake2s-256": () => blake2s.create({ dkLen: 32 }),
  "blake2s-128": () => blake2s.create({ dkLen: 16 }),
  "blake3-256": () => blake3.create({ dkLen: 32 }),
  "blake3-512": () => blake3.create({ dkLen: 64 }),
  "blake3-128": () => blake3.create({ dkLen: 16 }),
  crc32: () => crcStream(CRC32_TABLE),
  crc32c: () => crcStream(CRC32C_TABLE),
};

export function hashBytes(variant: string, bytes: Uint8Array, seed = 0): Uint8Array {
  const hash = HASHES[variant];
  if (!hash) throw new Error(`"${variant}" is not an algorithm this page knows`);
  return hash(bytes, seed);
}

export function hashStream(variant: string, seed = 0): Streaming {
  const create = STREAMS[variant];
  if (create) return create();
  const hash = HASHES[variant];
  if (!hash) throw new Error(`"${variant}" is not an algorithm this page knows`);
  return buffered((bytes) => hash(bytes, seed));
}

export function streams(variant: string): boolean {
  return variant in STREAMS;
}

function crcStream(table: Uint32Array): Streaming {
  let register = CRC_INITIAL;
  return {
    update: (chunk) => {
      register = crcUpdate(register, chunk, table);
    },
    digest: () => bigIntToBytes(BigInt(crcFinish(register)), 4),
  };
}

function buffered(hash: (bytes: Uint8Array) => Uint8Array): Streaming {
  const chunks: Uint8Array[] = [];
  let length = 0;
  return {
    update: (chunk) => {
      chunks.push(chunk);
      length += chunk.length;
    },
    digest: () => {
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return hash(bytes);
    },
  };
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
