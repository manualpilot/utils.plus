import { identityRecipients } from "./age";
import { ALGORITHMS, keyLength } from "./algorithms";
import { boxKeypair, boxPublicKey } from "./box";
import { decodeBytes, encodeBytes, type Encoding } from "./encoding";
import type { Mode } from "./run";

export function pickAlgorithm(value: unknown): string {
  return typeof value === "string" && value in ALGORITHMS ? value : "aes-gcm";
}

export function pickMode(value: unknown): Mode {
  return value === "decrypt" ? "decrypt" : "encrypt";
}

export function pickEncoding(value: unknown, fallback: Encoding): Encoding {
  return value === "hex" || value === "base64" ? value : fallback;
}

export function pickKeySize(algorithm: string, value: unknown): number {
  const sizes = ALGORITHMS[algorithm].keySizes;
  if (!sizes) return 32;
  return typeof value === "number" && sizes.includes(value) ? value : sizes[sizes.length - 1];
}

export function pickRecipient(value: unknown): "key" | "password" {
  return value === "password" ? "password" : "key";
}

export function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function randomKey(algorithm: string, keySize: number, encoding: Encoding): string {
  const family = ALGORITHMS[algorithm].family;
  const bytes = family === "box" ? boxKeypair().secretKey : randomBytes(keyLength(algorithm, keySize));
  return encodeBytes(bytes, encoding);
}

export function randomNonce(algorithm: string, encoding: Encoding): string {
  return encodeBytes(randomBytes(ALGORITHMS[algorithm].nonceBytes), encoding);
}

export function derivedPublicKey(secret: string, encoding: Encoding): string {
  try {
    return encodeBytes(boxPublicKey(decodeBytes(secret, encoding)), encoding);
  } catch {
    return "";
  }
}

export async function derivedRecipients(identities: string): Promise<string[]> {
  try {
    return await identityRecipients(identities);
  } catch {
    return [];
  }
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function readField(text: string, encoding: Encoding, expected: number): Field {
  if (!text.trim()) return { bytes: null, error: null };
  let bytes: Uint8Array;
  try {
    bytes = decodeBytes(text, encoding);
  } catch (e) {
    return { bytes: null, error: e instanceof Error ? e.message : "Cannot be read" };
  }
  if (expected > 0 && bytes.length !== expected) {
    return { bytes: null, error: `Needs ${expected} bytes, and this is ${bytes.length}` };
  }
  return { bytes, error: null };
}

export interface Field {
  bytes: Uint8Array | null;
  error: string | null;
}

export function message(e: unknown, mode: Mode): string {
  if (e instanceof DOMException) {
    if (e.name !== "OperationError") return e.message || "That did not work";
    return mode === "decrypt" ? UNSEALED : "That did not encrypt — check the key and the nonce";
  }
  if (e instanceof Error) {
    return TAG_FAILURE.test(e.message) && mode === "decrypt" ? UNSEALED : e.message || "That did not work";
  }
  return "That did not work";
}

const UNSEALED = "That did not decrypt — the key, the nonce or the ciphertext is not the one it was sealed with";

const TAG_FAILURE = /invalid tag|poly1305|wrong tag|decryption failed/i;
