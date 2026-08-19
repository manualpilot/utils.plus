export function crcTable(polynomial: number): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ polynomial : value >>> 1;
    table[i] = value;
  }
  return table;
}

export const CRC32_TABLE = crcTable(0xedb88320);
export const CRC32C_TABLE = crcTable(0x82f63b78);

export function crc(bytes: Uint8Array, table: Uint32Array): number {
  return crcFinish(crcUpdate(CRC_INITIAL, bytes, table));
}

export const CRC_INITIAL = 0xffffffff;

export function crcUpdate(register: number, bytes: Uint8Array, table: Uint32Array): number {
  for (const byte of bytes) register = (register >>> 8) ^ table[(register ^ byte) & 0xff];
  return register;
}

export function crcFinish(register: number): number {
  return (register ^ 0xffffffff) >>> 0;
}

export function rotl32(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

export function readU32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

const XXH32_P1 = 0x9e3779b1;
const XXH32_P2 = 0x85ebca77;
const XXH32_P3 = 0xc2b2ae3d;
const XXH32_P4 = 0x27d4eb2f;
const XXH32_P5 = 0x165667b1;

export function xxh32(bytes: Uint8Array, seed: number): number {
  const length = bytes.length;
  let offset = 0;
  let hash: number;

  if (length >= 16) {
    let v1 = (seed + XXH32_P1 + XXH32_P2) | 0;
    let v2 = (seed + XXH32_P2) | 0;
    let v3 = seed | 0;
    let v4 = (seed - XXH32_P1) | 0;
    const limit = length - 16;
    do {
      v1 = xxh32Round(v1, readU32LE(bytes, offset));
      v2 = xxh32Round(v2, readU32LE(bytes, offset + 4));
      v3 = xxh32Round(v3, readU32LE(bytes, offset + 8));
      v4 = xxh32Round(v4, readU32LE(bytes, offset + 12));
      offset += 16;
    } while (offset <= limit);
    hash = (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) | 0;
  } else {
    hash = (seed + XXH32_P5) | 0;
  }

  hash = (hash + length) | 0;
  for (; offset + 4 <= length; offset += 4) {
    hash = Math.imul(rotl32((hash + Math.imul(readU32LE(bytes, offset), XXH32_P3)) | 0, 17), XXH32_P4);
  }
  for (; offset < length; offset++) {
    hash = Math.imul(rotl32((hash + Math.imul(bytes[offset], XXH32_P5)) | 0, 11), XXH32_P1);
  }

  hash = Math.imul(hash ^ (hash >>> 15), XXH32_P2);
  hash = Math.imul(hash ^ (hash >>> 13), XXH32_P3);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function xxh32Round(accumulator: number, value: number): number {
  return Math.imul(rotl32((accumulator + Math.imul(value, XXH32_P2)) | 0, 13), XXH32_P1);
}

const U64 = (1n << 64n) - 1n;
const XXH64_P1 = 11400714785074694791n;
const XXH64_P2 = 14029467366897019727n;
const XXH64_P3 = 1609587929392839161n;
const XXH64_P4 = 9650029242287828579n;
const XXH64_P5 = 2870177450012600261n;

export function rotl64(value: bigint, bits: bigint): bigint {
  return ((value << bits) | (value >> (64n - bits))) & U64;
}

export function mul64(a: bigint, b: bigint): bigint {
  return (a * b) & U64;
}

export function readU64LE(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[offset + i]);
  return value;
}

export function xxh64(bytes: Uint8Array, seed: number): bigint {
  const length = bytes.length;
  const seed64 = BigInt(seed) & U64;
  let offset = 0;
  let hash: bigint;

  if (length >= 32) {
    let v1 = (seed64 + XXH64_P1 + XXH64_P2) & U64;
    let v2 = (seed64 + XXH64_P2) & U64;
    let v3 = seed64;
    let v4 = (seed64 - XXH64_P1) & U64;
    const limit = length - 32;
    do {
      v1 = xxh64Round(v1, readU64LE(bytes, offset));
      v2 = xxh64Round(v2, readU64LE(bytes, offset + 8));
      v3 = xxh64Round(v3, readU64LE(bytes, offset + 16));
      v4 = xxh64Round(v4, readU64LE(bytes, offset + 24));
      offset += 32;
    } while (offset <= limit);
    hash = (rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n)) & U64;
    for (const accumulator of [v1, v2, v3, v4]) {
      hash = (mul64(hash ^ xxh64Round(0n, accumulator), XXH64_P1) + XXH64_P4) & U64;
    }
  } else {
    hash = (seed64 + XXH64_P5) & U64;
  }

  hash = (hash + BigInt(length)) & U64;
  for (; offset + 8 <= length; offset += 8) {
    hash = (mul64(rotl64(hash ^ xxh64Round(0n, readU64LE(bytes, offset)), 27n), XXH64_P1) + XXH64_P4) & U64;
  }
  for (; offset + 4 <= length; offset += 4) {
    const lane = mul64(BigInt(readU32LE(bytes, offset)), XXH64_P1);
    hash = (mul64(rotl64(hash ^ lane, 23n), XXH64_P2) + XXH64_P3) & U64;
  }
  for (; offset < length; offset++) {
    hash = mul64(rotl64(hash ^ mul64(BigInt(bytes[offset]), XXH64_P5), 11n), XXH64_P1);
  }

  hash = mul64(hash ^ (hash >> 33n), XXH64_P2);
  hash = mul64(hash ^ (hash >> 29n), XXH64_P3);
  return hash ^ (hash >> 32n);
}

export function xxh64Round(accumulator: bigint, value: bigint): bigint {
  return mul64(rotl64((accumulator + mul64(value, XXH64_P2)) & U64, 31n), XXH64_P1);
}

const MURMUR32_C1 = 0xcc9e2d51;
const MURMUR32_C2 = 0x1b873593;

export function murmur3x8632(bytes: Uint8Array, seed: number): number {
  const length = bytes.length;
  const blocks = length >>> 2;
  let hash = seed | 0;

  for (let i = 0; i < blocks; i++) {
    const block = Math.imul(rotl32(Math.imul(readU32LE(bytes, i * 4), MURMUR32_C1), 15), MURMUR32_C2);
    hash = rotl32(hash ^ block, 13);
    hash = (Math.imul(hash, 5) + 0xe6546b64) | 0;
  }

  const tail = blocks * 4;
  const remainder = length & 3;
  let last = 0;
  if (remainder === 3) last ^= bytes[tail + 2] << 16;
  if (remainder >= 2) last ^= bytes[tail + 1] << 8;
  if (remainder >= 1) {
    last ^= bytes[tail];
    hash ^= Math.imul(rotl32(Math.imul(last, MURMUR32_C1), 15), MURMUR32_C2);
  }

  return fmix32(hash ^ length) >>> 0;
}

export function fmix32(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return value ^ (value >>> 16);
}

const MURMUR128_C1 = 0x87c37b91114253d5n;
const MURMUR128_C2 = 0x4cf5ad432745937fn;

export function murmur3x64128(bytes: Uint8Array, seed: number): bigint {
  const length = bytes.length;
  const blocks = Math.floor(length / 16);
  const seed64 = BigInt(seed >>> 0);
  let h1 = seed64;
  let h2 = seed64;

  for (let i = 0; i < blocks; i++) {
    const k1 = mul64(rotl64(mul64(readU64LE(bytes, i * 16), MURMUR128_C1), 31n), MURMUR128_C2);
    h1 = rotl64(h1 ^ k1, 27n);
    h1 = (mul64((h1 + h2) & U64, 5n) + 0x52dce729n) & U64;

    const k2 = mul64(rotl64(mul64(readU64LE(bytes, i * 16 + 8), MURMUR128_C2), 33n), MURMUR128_C1);
    h2 = rotl64(h2 ^ k2, 31n);
    h2 = (mul64((h2 + h1) & U64, 5n) + 0x38495ab5n) & U64;
  }

  const tail = blocks * 16;
  const remainder = length & 15;
  let k1 = 0n;
  let k2 = 0n;
  for (let i = remainder; i > 0; i--) {
    const byte = BigInt(bytes[tail + i - 1]);
    if (i > 8) k2 = (k2 << 8n) | byte;
    else k1 = (k1 << 8n) | byte;
  }
  if (remainder > 8) h2 ^= mul64(rotl64(mul64(k2, MURMUR128_C2), 33n), MURMUR128_C1);
  if (remainder > 0) h1 ^= mul64(rotl64(mul64(k1, MURMUR128_C1), 31n), MURMUR128_C2);

  h1 ^= BigInt(length);
  h2 ^= BigInt(length);
  h1 = (h1 + h2) & U64;
  h2 = (h2 + h1) & U64;
  h1 = fmix64(h1);
  h2 = fmix64(h2);
  h1 = (h1 + h2) & U64;
  h2 = (h2 + h1) & U64;

  return (h1 << 64n) | h2;
}

export function fmix64(value: bigint): bigint {
  value = mul64(value ^ (value >> 33n), 0xff51afd7ed558ccdn);
  value = mul64(value ^ (value >> 33n), 0xc4ceb9fe1a85ec53n);
  return value ^ (value >> 33n);
}
