import { sha1 } from "@noble/hashes/legacy.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import type { CHash } from "@noble/hashes/utils.js";
import type { KdfResult, KdfSettings } from "./algorithms";
import { bcryptBase64Decode } from "./bcrypt";
import { phcBase64 } from "./digest";

export async function deriveKdf(variant: string, password: string, settings: KdfSettings): Promise<KdfResult> {
  if (variant === "bcrypt") {
    const { default: bcrypt } = await import("bcryptjs");
    const encoded = await bcrypt.hash(password, `$2b$${String(settings.cost).padStart(2, "0")}$${settings.salt}`);
    return { digest: bcryptBase64Decode(encoded.slice(BCRYPT_PREFIX_LENGTH), 23), encoded };
  }

  const saltBytes = new TextEncoder().encode(settings.salt);
  const passwordBytes = new TextEncoder().encode(password);

  if (variant === "scrypt") {
    const { scryptAsync } = await import("@noble/hashes/scrypt.js");
    const { cost, blockSize, parallelism } = settings;
    const digest = await scryptAsync(passwordBytes, saltBytes, {
      N: 2 ** cost,
      r: blockSize,
      p: parallelism,
      dkLen: KDF_LENGTH,
      asyncTick: ASYNC_TICK,
    });
    const suffix = `${phcBase64(saltBytes)}$${phcBase64(digest)}`;
    return { digest, encoded: `$scrypt$ln=${cost},r=${blockSize},p=${parallelism}$${suffix}` };
  }

  const prf = PBKDF2_HASHES[variant];
  if (prf) {
    const { pbkdf2Async } = await import("@noble/hashes/pbkdf2.js");
    const { iterations } = settings;
    const digest = await pbkdf2Async(prf, passwordBytes, saltBytes, {
      c: iterations,
      dkLen: KDF_LENGTH,
      asyncTick: ASYNC_TICK,
    });
    return { digest, encoded: `$${variant}$i=${iterations}$${phcBase64(saltBytes)}$${phcBase64(digest)}` };
  }

  const argon2 = await import("@noble/hashes/argon2.js");
  const derivers: Record<string, typeof argon2.argon2idAsync> = {
    argon2id: argon2.argon2idAsync,
    argon2i: argon2.argon2iAsync,
    argon2d: argon2.argon2dAsync,
  };
  const derive = derivers[variant];
  if (!derive) throw new Error(`"${variant}" is not an algorithm this page knows`);
  const { memory, iterations, parallelism } = settings;
  const digest = await derive(passwordBytes, saltBytes, {
    t: iterations,
    m: memory,
    p: parallelism,
    dkLen: KDF_LENGTH,
    asyncTick: ASYNC_TICK,
  });
  const header = `$${variant}$v=${ARGON2_VERSION}$m=${memory},t=${iterations},p=${parallelism}`;
  return { digest, encoded: `${header}$${phcBase64(saltBytes)}$${phcBase64(digest)}` };
}

const PBKDF2_HASHES: Record<string, CHash> = {
  "pbkdf2-sha1": sha1,
  "pbkdf2-sha256": sha256,
  "pbkdf2-sha512": sha512,
};

const KDF_LENGTH = 32;
const ARGON2_VERSION = 19;
const ASYNC_TICK = 20;
const BCRYPT_PREFIX_LENGTH = 29;
