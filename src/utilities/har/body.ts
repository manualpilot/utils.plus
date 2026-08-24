import type { Body } from "./parse";

export interface Shown {
  text: string;
  note: string;
  image: string | null;
  truncated: boolean;
  pretty: boolean;
}

export const MAX_BODY_CHARS = 20000;

export function readShown(body: Body | null): Shown | null {
  if (!body) return null;

  if (isImage(body)) {
    return {
      text: "",
      note: `${body.mimeType} — shown rather than spelled out`,
      image: dataUri(body),
      truncated: false,
      pretty: false,
    };
  }

  const decoded = decode(body);
  if (decoded === null) {
    return {
      text: "",
      note: `${body.mimeType || "Binary"} — not text, so it is not shown`,
      image: null,
      truncated: false,
      pretty: false,
    };
  }

  const pretty = prettyJson(decoded, body.mimeType);
  const text = pretty ?? decoded;
  return {
    text: text.slice(0, MAX_BODY_CHARS),
    note: "",
    image: null,
    truncated: text.length > MAX_BODY_CHARS,
    pretty: pretty !== null,
  };
}

export function isImage(body: Body): boolean {
  return body.mimeType.startsWith("image/") && !body.mimeType.includes("svg") && body.encoding === "base64"
    && body.text !== "";
}

function dataUri(body: Body): string {
  return `data:${body.mimeType};base64,${body.text}`;
}

function decode(body: Body): string | null {
  if (body.encoding !== "base64") return body.text;
  if (!looksTextual(body.mimeType)) return null;
  try {
    const binary = atob(body.text);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function looksTextual(mimeType: string): boolean {
  if (!mimeType) return true;
  return /^text\/|json|xml|javascript|ecmascript|urlencoded|graphql|x-www-form/.test(mimeType);
}

function prettyJson(text: string, mimeType: string): string | null {
  const trimmed = text.trim();
  const looksJson = /json/.test(mimeType) || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksJson || trimmed === "") return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object") return null;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}
