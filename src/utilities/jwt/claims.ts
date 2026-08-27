import type { ParameterRow } from "./types";

export const HEADER_NAMES: Record<string, string> = {
  alg: "Algorithm",
  enc: "Encryption",
  typ: "Type",
  cty: "Content type",
  kid: "Key ID",
  jku: "JWK set URL",
  jwk: "Public key",
  x5u: "X.509 URL",
  x5c: "X.509 chain",
  x5t: "X.509 thumbprint",
  "x5t#S256": "X.509 thumbprint",
  crit: "Critical",
  zip: "Compression",
  epk: "Ephemeral public key",
  apu: "Agreement party (sender)",
  apv: "Agreement party (recipient)",
  iv: "Initialisation vector",
  tag: "Authentication tag",
};

export const CLAIM_NAMES: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not before",
  iat: "Issued at",
  jti: "JWT ID",
  azp: "Authorised party",
  scope: "Scope",
  nonce: "Nonce",
  auth_time: "Authenticated at",
  client_id: "Client ID",
  sid: "Session ID",
};

export const HEADER_SUGGESTIONS = Object.keys(HEADER_NAMES).filter((name) => name !== "alg" && name !== "enc");
export const CLAIM_SUGGESTIONS = Object.keys(CLAIM_NAMES);

export const TIME_CLAIMS = new Set(["exp", "nbf", "iat", "auth_time"]);

export function parameterRows(
  source: Record<string, unknown>,
  names: Record<string, string>,
  nowMs: number,
): ParameterRow[] {
  return Object.entries(source).map(([name, value]) => {
    const row: ParameterRow = {
      name,
      meaning: names[name] ?? "",
      value: JSON.stringify(value) ?? "undefined",
      note: "",
      warn: false,
    };
    if (!TIME_CLAIMS.has(name) || typeof value !== "number" || !Number.isFinite(value)) return row;
    const ms = value * 1000;
    row.note = `${TIME_FORMATTER.format(ms)} · ${agoOrIn(ms, nowMs)}`;
    row.warn = name === "exp" ? ms <= nowMs : ms > nowMs;
    return row;
  });
}

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31556952],
  ["month", 2629746],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

export function agoOrIn(ms: number, nowMs: number): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const size = Math.abs(seconds);
  const unit = RELATIVE_UNITS.find(([, span]) => size >= span) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return RELATIVE_FORMATTER.format(Math.trunc(seconds / unit[1]), unit[0]);
}
