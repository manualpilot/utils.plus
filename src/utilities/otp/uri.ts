import { encodeBase32 } from "../../common/base32";
import type { Algorithm } from "./hotp";
import { readSecret, type SecretFormat } from "./secret";
import { COUNTER_RANGE, DIGIT_RANGE, type Mode, parseWhole, PERIOD_RANGE, pickAlgorithm, type Range } from "./settings";

export type UriMode = Exclude<Mode, "ocra">;

export interface UriFields {
  mode: UriMode;
  issuer: string;
  label: string;
  secret: string;
  format: SecretFormat;
  algorithm: Algorithm;
  digits: number | null;
  period: number | null;
  counter: number | null;
}

export const DEFAULT_ISSUER = "utils.plus";
export const DEFAULT_LABEL = "local";

export function writeUri(fields: UriFields): string {
  const { mode, issuer, label, algorithm, digits, period, counter } = fields;
  const path = issuer ? `${encodePart(issuer)}:${encodePart(label)}` : encodePart(label);
  const query = [];

  const secret = base32Secret(fields.secret, fields.format);
  if (secret) query.push(param("secret", secret));
  if (issuer) query.push(param("issuer", issuer));
  query.push(param("algorithm", algorithm));
  if (digits !== null) query.push(param("digits", String(digits)));
  if (mode === "hotp") {
    if (counter !== null) query.push(param("counter", String(counter)));
  } else if (period !== null) query.push(param("period", String(period)));

  return `otpauth://${mode}/${path}?${query.join("&")}`;
}

export function readUri(text: string, current: UriFields): UriFields | null {
  const match = URI.exec(text.trim());
  if (!match) return null;
  const mode = match[1].toLowerCase() as UriMode;
  const params = readQuery(match[3] ?? "");
  const { issuer: prefix, label } = splitLabel(match[2] ?? "");
  const secret = params.get("secret") ?? "";
  const kept = base32Secret(secret, "base32") === base32Secret(current.secret, current.format);

  return {
    mode,
    issuer: readIssuer(prefix, params.get("issuer"), current.issuer),
    label,
    secret: kept ? current.secret : secret,
    format: kept ? current.format : "base32",
    algorithm: pickAlgorithm(params.get("algorithm")?.toUpperCase().replace(/-/g, "")),
    digits: whole(params.get("digits"), DIGIT_RANGE) ?? 6,
    period: mode === "totp" ? whole(params.get("period"), PERIOD_RANGE) ?? 30 : current.period,
    counter: mode === "hotp" ? whole(params.get("counter"), COUNTER_RANGE) ?? 0 : current.counter,
  };
}

export function uriKeyless(text: string): boolean {
  return !readQuery(URI.exec(text.trim())?.[3] ?? "").get("secret");
}

function readIssuer(prefix: string | null, param: string | undefined, current: string): string {
  if (prefix === null) return param ?? "";
  if (prefix !== current) return prefix;
  return param ?? prefix;
}

function splitLabel(path: string): { issuer: string | null; label: string } {
  const separator = /:|%3A/i.exec(path);
  if (!separator) return { issuer: null, label: decodePart(path) };
  return {
    issuer: decodePart(path.slice(0, separator.index)),
    label: decodePart(path.slice(separator.index + separator[0].length)),
  };
}

function readQuery(query: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const split = pair.indexOf("=");
    const name = split === -1 ? pair : pair.slice(0, split);
    params.set(decodePart(name).toLowerCase(), split === -1 ? "" : decodePart(pair.slice(split + 1)));
  }
  return params;
}

function param(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}`;
}

function encodePart(text: string): string {
  return encodeURIComponent(text).replace(/%40/g, "@");
}

function decodePart(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function whole(text: string | undefined, range: Range): number | null {
  return text === undefined || text === "" ? null : parseWhole(text, range);
}

function base32Secret(secret: string, format: SecretFormat): string {
  if (!secret) return "";
  try {
    return encodeBase32(readSecret(secret, format));
  } catch {
    return "";
  }
}

const URI = /^otpauth:\/\/(totp|hotp)(?:\/([^?#]*))?(?:\?([^#]*))?(?:#.*)?$/i;
