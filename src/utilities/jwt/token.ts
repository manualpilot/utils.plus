import type { TokenReading } from "./types";

const NOTHING: TokenReading = { header: null, payload: null, signature: "", encrypted: false, error: null };

export function readToken(token: string): TokenReading {
  const text = token.trim();
  if (!text) return NOTHING;

  const parts = text.split(".");
  if (parts.length === 5) {
    const header = readSegment(parts[0], "header");
    if (typeof header === "string") return { ...NOTHING, error: header };
    return { ...NOTHING, header, encrypted: true };
  }
  if (parts.length !== 3) {
    return {
      ...NOTHING,
      error: `A JWT is three parts separated by dots, or five when encrypted; this has ${parts.length}`,
    };
  }

  const header = readSegment(parts[0], "header");
  if (typeof header === "string") return { ...NOTHING, error: header };
  const payload = readSegment(parts[1], "payload");
  if (typeof payload === "string") return { ...NOTHING, header, error: payload };

  return { ...NOTHING, header, payload, signature: parts[2] };
}

export function readSegment(segment: string, name: string): Record<string, unknown> | string {
  let text: string;
  try {
    text = fromBase64Url(segment);
  } catch {
    return `The ${name} is not base64url`;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return `The ${name} is not JSON`;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return `The ${name} is not a JSON object`;
  return value as Record<string, unknown>;
}

export function readObject(text: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bytesFromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function fromBase64Url(text: string): string {
  return new TextDecoder().decode(bytesFromBase64Url(text));
}
