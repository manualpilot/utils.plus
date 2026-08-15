import { ALGORITHMS, ARGON2_ITERATIONS, ARGON2_MEMORY, ARGON2_SALT_MIN, BCRYPT_COST, BCRYPT_SALT_PATTERN, DIGEST_FORMATS, MAX_KDF_MEMORY, MAX_SEED, PARALLELISM, type Params, PBKDF2_DEFAULT_ITERATIONS, PBKDF2_ITERATIONS, SCRYPT_BLOCK, SCRYPT_COST } from "./algorithms";
import { bcryptBase64Encode } from "./bcrypt";
import { toHex } from "./digest";

export function defaultParams(algorithm: string): Params {
  return {
    seed: 0,
    salt: ALGORITHMS[algorithm].kdf ? randomSalt(algorithm) : "",
    memory: 19456,
    iterations: algorithm === "pbkdf2" ? PBKDF2_DEFAULT_ITERATIONS : 2,
    parallelism: 1,
    cost: algorithm === "bcrypt" ? 10 : 15,
    blockSize: 8,
  };
}

export function initialParams(algorithm: string, state: Record<string, unknown> | null): Params {
  const defaults = defaultParams(algorithm);
  return {
    seed: clamp(state?.seed, 0, MAX_SEED, defaults.seed),
    salt: typeof state?.salt === "string" ? state.salt : defaults.salt,
    memory: clamp(state?.memory, ARGON2_MEMORY.min, ARGON2_MEMORY.max, defaults.memory),
    iterations: clamp(state?.iterations, ARGON2_ITERATIONS.min, PBKDF2_ITERATIONS.max, defaults.iterations),
    parallelism: clamp(state?.parallelism, PARALLELISM.min, PARALLELISM.max, defaults.parallelism),
    cost: clamp(state?.cost, BCRYPT_COST.min, SCRYPT_COST.max, defaults.cost),
    blockSize: clamp(state?.blockSize, SCRYPT_BLOCK.min, SCRYPT_BLOCK.max, defaults.blockSize),
  };
}

export function clamp(value: unknown, min: number, max: number, fallback: number | string): number | string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function pickAlgorithm(value: unknown): string {
  return typeof value === "string" && value in ALGORITHMS ? value : "sha-256";
}

export function pickVariant(algorithm: string, value: unknown): string {
  const variants = ALGORITHMS[algorithm].variants;
  return variants.some((item) => item.value === value) ? value as string : variants[0].value;
}

export function pickFormat(algorithm: string, value: unknown): string {
  const formats = ALGORITHMS[algorithm].formats ?? DIGEST_FORMATS;
  return formats.includes(value as string) ? value as string : formats[0];
}

export function parseInteger(value: number | string, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

export function range(min: number, max: number): string {
  return `Enter a value between ${min} and ${max}`;
}

export function saltProblem(algorithm: string, salt: string): string | null {
  if (algorithm === "bcrypt") {
    return BCRYPT_SALT_PATTERN.test(salt) ? null : "Enter 22 characters of bcrypt's base64 (./A-Za-z0-9)";
  }
  const length = new TextEncoder().encode(salt).length;
  if (algorithm === "argon2" && length < ARGON2_SALT_MIN) return `Argon2 needs at least ${ARGON2_SALT_MIN} bytes`;
  return length > 0 ? null : "Required";
}

export function memoryProblem(memory: number | null, parallelism: number | null): string | null {
  if (memory === null) return range(ARGON2_MEMORY.min, ARGON2_MEMORY.max);
  if (parallelism !== null && memory < parallelism * 8) return `At least ${parallelism * 8} for ${parallelism} lanes`;
  return null;
}

export function scryptMemoryProblem(cost: number, blockSize: number | null, parallelism: number | null): string | null {
  if (blockSize === null || parallelism === null) return null;
  const bytes = 128 * 2 ** cost * blockSize * parallelism;
  if (bytes <= MAX_KDF_MEMORY) return null;
  return `These settings need ${Math.round(bytes / 1024 / 1024)} MiB, past the 512 MiB cap`;
}

export function randomSalt(algorithm: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return algorithm === "bcrypt" ? bcryptBase64Encode(bytes) : toHex(bytes);
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : "Hashing failed";
}
