export interface UrlParts {
  scheme: string;
  slashes: boolean;
  username: string;
  password: string;
  host: string;
  port: string;
  path: string;
  query: string | null;
  fragment: string | null;
}

export type PartKey = "scheme" | "username" | "password" | "host" | "port" | "path" | "query" | "fragment";

export interface Pair {
  name: string;
  value: string;
  bare: boolean;
  raw: string;
  nameError: string | null;
  valueError: string | null;
}

export interface UrlReading {
  parts: UrlParts;
  pairs: Pair[];
  partErrors: Record<PartKey, string | null>;
}

export interface PartSpec {
  key: PartKey;
  label: string;
  placeholder: string;
  hint?: string;
}

export const PART_ROWS: PartSpec[][] = [
  [
    { key: "scheme", label: "Scheme", placeholder: "https" },
    { key: "host", label: "Host", placeholder: "example.com" },
    { key: "port", label: "Port", placeholder: "443" },
  ],
  [
    { key: "username", label: "Username", placeholder: "user" },
    { key: "password", label: "Password", placeholder: "secret" },
  ],
  [
    { key: "path", label: "Path", placeholder: "/path/to/page" },
    { key: "fragment", label: "Fragment", placeholder: "section" },
  ],
];

export const QUERY_PART: PartSpec = {
  key: "query",
  label: "Query",
  placeholder: "a=1&b=2",
  hint: "The parameters below are this same query, unescaped",
};

export const AUTHORITY_PARTS = new Set<PartKey>(["username", "password", "host", "port"]);

export const DEFAULT_URL = "https://example.com:8443/api/v2/search?q=caf%C3%A9+latte&limit=20&tags=hot,fast#results";

export function partText(parts: UrlParts, key: PartKey): string {
  return parts[key] ?? "";
}
