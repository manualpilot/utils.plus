export type Encoding = "hex" | "base64";

export const ENCODING_OPTIONS = [{ value: "hex", label: "Hex" }, { value: "base64", label: "Base64" }];

export function encodeBytes(bytes: Uint8Array, encoding: Encoding): string {
  return encoding === "hex" ? toHex(bytes) : toBase64(bytes);
}

export function decodeBytes(text: string, encoding: Encoding): Uint8Array {
  return encoding === "hex" ? fromHex(text) : fromBase64(text);
}

export function respell(text: string, from: Encoding, to: Encoding): string {
  if (from === to || !text.trim()) return text;
  try {
    return encodeBytes(decodeBytes(text, from), to);
  } catch {
    return text;
  }
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/[\s:_-]/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex needs an even number of digits");
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error("Hex takes 0-9 and a-f only");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error("That is not Base64");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("That is not Base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function fromUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const CHUNK = 0x8000;
