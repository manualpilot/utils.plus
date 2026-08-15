import type { TokenReading } from "./types";

export function readToken(token: string): TokenReading {
  const text = token.trim();
  if (!text) return { header: null, payload: null, signature: "", error: null };

  const parts = text.split(".");
  if (parts.length === 5) {
    return {
      header: null,
      payload: null,
      signature: "",
      error: "That is an encrypted JWE; this page reads signed tokens",
    };
  }
  if (parts.length !== 3) {
    return {
      header: null,
      payload: null,
      signature: "",
      error: `A JWT is three parts separated by dots; this has ${parts.length}`,
    };
  }

  const header = readSegment(parts[0], "header");
  if (typeof header === "string") return { header: null, payload: null, signature: "", error: header };
  const payload = readSegment(parts[1], "payload");
  if (typeof payload === "string") return { header, payload: null, signature: "", error: payload };

  return { header, payload, signature: parts[2], error: null };
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

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): string {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}
