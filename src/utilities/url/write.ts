import { encodePart } from "./escape";
import { AUTHORITY_PARTS, type Pair, type PartKey, type UrlParts } from "./parts";

export function writeUrl(parts: UrlParts): string {
  const authority = parts.slashes ? `//${writeUserinfo(parts)}${writeHost(parts)}` : "";
  const path = authority && parts.path && !parts.path.startsWith("/") ? `/${parts.path}` : parts.path;
  const scheme = parts.scheme ? `${parts.scheme}:` : "";
  const query = parts.query === null ? "" : `?${parts.query}`;
  const fragment = parts.fragment === null ? "" : `#${parts.fragment}`;
  return `${scheme}${authority}${path}${query}${fragment}`;
}

export function withPart(parts: UrlParts, key: PartKey, value: string): UrlParts {
  if (key === "query" || key === "fragment") return { ...parts, [key]: value === "" ? null : value };
  return { ...parts, [key]: value, slashes: parts.slashes || (AUTHORITY_PARTS.has(key) && value !== "") };
}

export function withPairs(parts: UrlParts, pairs: Pair[]): UrlParts {
  return { ...parts, query: pairs.length === 0 ? null : pairs.map((pair) => pair.raw).join("&") };
}

export function editPair(pair: Pair, patch: { name?: string; value?: string }): Pair {
  const name = patch.name ?? pair.name;
  const value = patch.value ?? pair.value;
  const bare = pair.bare && value === "" && name !== "";
  const raw = bare ? encodePart(name) : `${encodePart(name)}=${encodePart(value)}`;
  return { name, value, bare, raw, nameError: null, valueError: null };
}

export function newPair(): Pair {
  return { name: "", value: "", bare: false, raw: "=", nameError: null, valueError: null };
}

function writeUserinfo({ username, password }: UrlParts): string {
  if (!username && !password) return "";
  return `${username}${password ? `:${password}` : ""}@`;
}

function writeHost({ host, port }: UrlParts): string {
  return port ? `${host}:${port}` : host;
}
