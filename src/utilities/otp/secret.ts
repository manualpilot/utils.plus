import { randomBytes } from "@noble/hashes/utils.js";
import { decodeBase32, encodeBase32 } from "../../common/base32";
import { randomBelow } from "../../common/random";

export type SecretFormat = "base32" | "hex" | "text";

export const SECRET_FORMATS = [
  { value: "base32", label: "Base32" },
  { value: "hex", label: "Hex" },
  { value: "text", label: "Text" },
];

export function pickSecretFormat(value: unknown): SecretFormat {
  return SECRET_FORMATS.some((format) => format.value === value) ? (value as SecretFormat) : "base32";
}

export function readSecret(text: string, format: SecretFormat): Uint8Array {
  if (format === "text") return new TextEncoder().encode(text);
  if (format === "base32") return decodeBase32(text);

  const hex = text.replace(/[\s:-]/g, "");
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error("Hex is 0-9 and A-F only");
  if (hex.length % 2 !== 0) throw new Error("Hex is truncated: it does not spell a whole number of bytes");
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

export function secretProblem(text: string, format: SecretFormat): string | null {
  if (!text) return null;
  try {
    readSecret(text, format);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "This is not a secret this format can read";
  }
}

export function generateSecret(format: SecretFormat, size: number): string {
  if (format === "text") return Array.from({ length: size }, () => PRINTABLE[randomBelow(PRINTABLE.length)]).join("");
  const bytes = randomBytes(size);
  return format === "hex"
    ? Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    : encodeBase32(bytes);
}

const PRINTABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
