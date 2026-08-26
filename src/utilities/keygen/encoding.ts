import { encodeBase32 } from "../../common/base32";

export function formatSecret(bytes: Uint8Array, format: string): string {
  switch (format) {
    case "hex-upper":
      return toHex(bytes).toUpperCase();
    case "base64":
      return toBase64(bytes);
    case "base64url":
      return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "base32":
      return encodeBase32(bytes, true);
    case "decimal":
      return bytesToBigInt(bytes).toString();
    default:
      return toHex(bytes);
  }
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(toBinary(bytes));
}

export function toBinary(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}
