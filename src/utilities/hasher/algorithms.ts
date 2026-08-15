export interface Params {
  seed: number | string;
  salt: string;
  memory: number | string;
  iterations: number | string;
  parallelism: number | string;
  cost: number | string;
  blockSize: number | string;
}

export interface KdfSettings {
  salt: string;
  memory: number;
  iterations: number;
  parallelism: number;
  cost: number;
  blockSize: number;
}

export interface KdfResult {
  digest: Uint8Array;
  encoded: string;
}

export interface Derived {
  request: unknown;
  result: KdfResult | null;
  error: string;
}

export interface Algorithm {
  variants: { value: string; label: string }[];
  formats?: string[];
  seeded?: boolean;
  kdf?: boolean;
  params?: (keyof Params)[];
}

export function sharedParams(spec: Algorithm, params: Params): Record<string, unknown> {
  return Object.fromEntries((spec.params ?? []).map((key) => [key, params[key]]));
}

export const DIGEST_FORMATS = ["hex", "hex-upper", "base64", "base64url"];
export const CHECKSUM_FORMATS = ["hex", "hex-upper", "decimal", "base64"];

export const ALGORITHMS: Record<string, Algorithm> = {
  md5: { variants: [{ value: "md5", label: "MD5" }], formats: DIGEST_FORMATS },
  "sha-1": { variants: [{ value: "sha-1", label: "SHA-1" }], formats: DIGEST_FORMATS },
  "sha-256": {
    variants: [{ value: "sha-256", label: "SHA-256" }, { value: "sha-224", label: "SHA-224" }],
    formats: DIGEST_FORMATS,
  },
  "sha-512": {
    variants: [
      { value: "sha-512", label: "SHA-512" },
      { value: "sha-384", label: "SHA-384" },
      { value: "sha-512-256", label: "SHA-512/256" },
      { value: "sha-512-224", label: "SHA-512/224" },
    ],
    formats: DIGEST_FORMATS,
  },
  "sha-3": {
    variants: [
      { value: "sha3-256", label: "SHA3-256" },
      { value: "sha3-512", label: "SHA3-512" },
      { value: "sha3-384", label: "SHA3-384" },
      { value: "sha3-224", label: "SHA3-224" },
      { value: "keccak-256", label: "Keccak-256 (pre-standard)" },
    ],
    formats: DIGEST_FORMATS,
  },
  blake2: {
    variants: [
      { value: "blake2b-512", label: "BLAKE2b-512" },
      { value: "blake2b-256", label: "BLAKE2b-256" },
      { value: "blake2s-256", label: "BLAKE2s-256" },
      { value: "blake2s-128", label: "BLAKE2s-128" },
    ],
    formats: DIGEST_FORMATS,
  },
  blake3: {
    variants: [
      { value: "blake3-256", label: "BLAKE3 (256-bit)" },
      { value: "blake3-512", label: "BLAKE3 (512-bit)" },
      { value: "blake3-128", label: "BLAKE3 (128-bit)" },
    ],
    formats: DIGEST_FORMATS,
  },
  crc32: {
    variants: [
      { value: "crc32", label: "CRC-32 (IEEE 802.3)" },
      { value: "crc32c", label: "CRC-32C (Castagnoli)" },
    ],
    formats: CHECKSUM_FORMATS,
  },
  xxhash: {
    variants: [{ value: "xxh64", label: "XXH64" }, { value: "xxh32", label: "XXH32" }],
    formats: CHECKSUM_FORMATS,
    seeded: true,
    params: ["seed"],
  },
  murmur: {
    variants: [
      { value: "murmur3-32", label: "MurmurHash3 (32-bit)" },
      { value: "murmur3-128", label: "MurmurHash3 (128-bit, x64)" },
    ],
    formats: CHECKSUM_FORMATS,
    seeded: true,
    params: ["seed"],
  },
  argon2: {
    variants: [
      { value: "argon2id", label: "Argon2id" },
      { value: "argon2i", label: "Argon2i" },
      { value: "argon2d", label: "Argon2d" },
    ],
    kdf: true,
    params: ["salt", "memory", "iterations", "parallelism"],
  },
  bcrypt: { variants: [{ value: "bcrypt", label: "bcrypt" }], kdf: true, params: ["salt", "cost"] },
  scrypt: {
    variants: [{ value: "scrypt", label: "scrypt" }],
    kdf: true,
    params: ["salt", "cost", "blockSize", "parallelism"],
  },
  pbkdf2: {
    variants: [
      { value: "pbkdf2-sha256", label: "PBKDF2-HMAC-SHA256" },
      { value: "pbkdf2-sha512", label: "PBKDF2-HMAC-SHA512" },
      { value: "pbkdf2-sha1", label: "PBKDF2-HMAC-SHA1" },
    ],
    kdf: true,
    params: ["salt", "iterations"],
  },
};

export const ALGORITHM_OPTIONS = [
  {
    group: "Cryptographic",
    items: [
      { value: "md5", label: "MD5" },
      { value: "sha-1", label: "SHA-1" },
      { value: "sha-256", label: "SHA-256" },
      { value: "sha-512", label: "SHA-512" },
      { value: "sha-3", label: "SHA-3" },
      { value: "blake2", label: "BLAKE2" },
      { value: "blake3", label: "BLAKE3" },
    ],
  },
  {
    group: "Checksums and non-cryptographic",
    items: [
      { value: "crc32", label: "CRC32" },
      { value: "xxhash", label: "xxHash" },
      { value: "murmur", label: "MurmurHash" },
    ],
  },
  {
    group: "Password hashing",
    items: [
      { value: "argon2", label: "Argon2" },
      { value: "bcrypt", label: "bcrypt" },
      { value: "scrypt", label: "scrypt" },
      { value: "pbkdf2", label: "PBKDF2" },
    ],
  },
];

export const FORMAT_OPTIONS = [
  { value: "hex", label: "Hexadecimal" },
  { value: "hex-upper", label: "Hexadecimal (uppercase)" },
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64 (URL-safe)" },
  { value: "decimal", label: "Decimal" },
];

export const MAX_SEED = 0xffffffff;
export const BCRYPT_MAX_BYTES = 72;
export const ARGON2_MEMORY = { min: 8, max: 262144 };
export const ARGON2_ITERATIONS = { min: 1, max: 16 };
export const PBKDF2_ITERATIONS = { min: 1, max: 10000000 };
export const PBKDF2_DEFAULT_ITERATIONS = 600000;
export const PARALLELISM = { min: 1, max: 16 };
export const SCRYPT_COST = { min: 1, max: 20 };
export const SCRYPT_BLOCK = { min: 1, max: 32 };
export const BCRYPT_COST = { min: 4, max: 14 };
export const MAX_KDF_MEMORY = 512 * 1024 * 1024;
export const ARGON2_SALT_MIN = 8;
export const BCRYPT_SALT_PATTERN = /^[./A-Za-z0-9]{22}$/;

export const EMPTY_OUTPUT = { output: "", error: "", bits: 0 };
