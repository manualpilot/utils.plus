import { decodePart } from "./escape";
import type { Pair, PartKey, UrlParts, UrlReading } from "./parts";

export function readUrl(text: string): UrlReading {
  const parts = readParts(text);
  return { parts, pairs: readPairs(parts.query), partErrors: checkParts(parts) };
}

export function readParts(text: string): UrlParts {
  let rest = text;

  const hash = rest.indexOf("#");
  const fragment = hash === -1 ? null : rest.slice(hash + 1);
  if (hash !== -1) rest = rest.slice(0, hash);

  const mark = rest.indexOf("?");
  const query = mark === -1 ? null : rest.slice(mark + 1);
  if (mark !== -1) rest = rest.slice(0, mark);

  const colon = rest.indexOf(":");
  const slash = rest.indexOf("/");
  const scheme = colon !== -1 && (slash === -1 || colon < slash) ? rest.slice(0, colon) : "";
  if (scheme) rest = rest.slice(colon + 1);

  const slashes = rest.startsWith("//");
  const blank = { username: "", password: "", host: "", port: "" };
  if (!slashes) return { scheme, slashes, ...blank, path: rest, query, fragment };

  rest = rest.slice(2);
  const end = rest.indexOf("/");
  const authority = end === -1 ? rest : rest.slice(0, end);
  return { scheme, slashes, ...readAuthority(authority), path: end === -1 ? "" : rest.slice(end), query, fragment };
}

export function readPairs(query: string | null): Pair[] {
  return query ? query.split("&").map(readPair) : [];
}

function readAuthority(text: string): Pick<UrlParts, "username" | "password" | "host" | "port"> {
  const at = text.lastIndexOf("@");
  const userinfo = at === -1 ? "" : text.slice(0, at);
  const colon = userinfo.indexOf(":");

  return {
    username: colon === -1 ? userinfo : userinfo.slice(0, colon),
    password: colon === -1 ? "" : userinfo.slice(colon + 1),
    ...readHost(at === -1 ? text : text.slice(at + 1)),
  };
}

function readHost(text: string): Pick<UrlParts, "host" | "port"> {
  const bracket = text.startsWith("[") ? text.indexOf("]") : -1;
  const colon = text.indexOf(":", bracket + 1);
  if (colon === -1) return { host: text, port: "" };
  return { host: text.slice(0, colon), port: text.slice(colon + 1) };
}

function readPair(raw: string): Pair {
  const eq = raw.indexOf("=");
  const name = decodePart(eq === -1 ? raw : raw.slice(0, eq));
  const value = decodePart(eq === -1 ? "" : raw.slice(eq + 1));
  return { name: name.text, value: value.text, bare: eq === -1, raw, nameError: name.error, valueError: value.error };
}

function checkParts(parts: UrlParts): Record<PartKey, string | null> {
  return {
    scheme: !parts.scheme || SCHEME.test(parts.scheme) ? null : "A scheme is a letter, then letters, digits, + - or .",
    username: null,
    password: null,
    host: /\s/.test(parts.host) ? "A host holds no spaces" : null,
    port: portError(parts.port),
    path: null,
    query: null,
    fragment: null,
  };
}

function portError(port: string): string | null {
  if (!port) return null;
  return /^\d+$/.test(port) && Number(port) <= MAX_PORT ? null : `A port is a number from 0 to ${MAX_PORT}`;
}

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/;

const MAX_PORT = 65535;
