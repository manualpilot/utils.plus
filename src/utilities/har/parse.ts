export interface Pair {
  name: string;
  value: string;
}

export interface Body {
  mimeType: string;
  text: string;
  encoding: string;
  size: number | null;
  params: Pair[];
}

export interface Phase {
  name: string;
  ms: number;
}

export interface Exchange {
  index: number;
  method: string;
  url: string;
  host: string;
  path: string;
  query: string;
  httpVersion: string;
  status: number | null;
  statusText: string;
  mimeType: string;
  resourceType: string;
  serverIp: string;
  connection: string;
  page: string;
  started: string;
  startedAt: number | null;
  time: number | null;
  timings: Record<string, number | null>;
  phases: Phase[];
  requestHeaders: Pair[];
  responseHeaders: Pair[];
  queryParams: Pair[];
  requestCookies: Pair[];
  responseCookies: Pair[];
  requestBody: Body | null;
  responseBody: Body | null;
  requestSize: number | null;
  transferSize: number | null;
  contentSize: number | null;
  redirect: string;
  error: string;
}

export interface Archive {
  version: string;
  creator: string;
  browser: string;
  pages: number;
  exchanges: Exchange[];
  transferred: number;
  startedAt: number | null;
  endedAt: number | null;
}

export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export function readArchive(text: string): Archive {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not JSON, so it is not a HAR.");
  }

  const log = record(record(parsed).log);
  const rawEntries = log.entries;
  if (!Array.isArray(rawEntries)) throw new Error("That JSON has no log.entries, so it is not a HAR.");

  const titles = pageTitles(log.pages);
  const exchanges = rawEntries.map((entry, index) => readExchange(entry, index, titles));

  const starts = exchanges.map((exchange) => exchange.startedAt).filter((at): at is number => at !== null);
  const ends = exchanges
    .map((exchange) => exchange.startedAt === null ? null : exchange.startedAt + (exchange.time ?? 0))
    .filter((at): at is number => at !== null);

  return {
    version: str(log.version) || "1.2",
    creator: named(log.creator),
    browser: named(log.browser),
    pages: Array.isArray(log.pages) ? log.pages.length : 0,
    exchanges,
    transferred: exchanges.reduce((total, exchange) => total + (exchange.transferSize ?? 0), 0),
    startedAt: starts.length > 0 ? Math.min(...starts) : null,
    endedAt: ends.length > 0 ? Math.max(...ends) : null,
  };
}

function readExchange(raw: unknown, index: number, titles: Map<string, string>): Exchange {
  const entry = record(raw);
  const request = record(entry.request);
  const response = record(entry.response);
  const content = record(response.content);
  const timings = readTimings(entry.timings);

  const url = str(request.url);
  const place = split(url);
  const started = str(entry.startedDateTime);
  const startedAt = Date.parse(started);
  const mimeType = cleanMime(str(content.mimeType));
  const responseHeaders = readPairs(response.headers);

  const resourceType = str(entry._resourceType) || inferType(mimeType, str(request.url));

  const time = num(entry.time);
  const requestBody = readBody(request.postData);
  const contentSize = num(content.size);

  return {
    index,
    method: str(request.method).toUpperCase(),
    url,
    host: place.host,
    path: place.path,
    query: place.query,
    httpVersion: str(request.httpVersion),
    status: readStatus(response.status),
    statusText: str(response.statusText),
    mimeType,
    resourceType,
    serverIp: str(entry.serverIPAddress),
    connection: str(entry.connection),
    page: titles.get(str(entry.pageref)) ?? str(entry.pageref),
    started,
    startedAt: Number.isNaN(startedAt) ? null : startedAt,
    time: time ?? (timings.total > 0 ? timings.total : null),
    timings: timings.recorded,
    phases: timings.phases,
    requestHeaders: readPairs(request.headers),
    responseHeaders,
    queryParams: readPairs(request.queryString),
    requestCookies: readPairs(request.cookies),
    responseCookies: readPairs(response.cookies),
    requestBody,
    responseBody: readContent(content),
    requestSize: total(num(request.headersSize), num(request.bodySize) ?? bodyLength(requestBody)),
    transferSize: num(response._transferSize) ?? total(num(response.headersSize), num(response.bodySize)),
    contentSize,
    redirect: str(response.redirectURL),
    error: str(entry._error) || str(response._error),
  };
}

function readStatus(raw: unknown): number | null {
  const status = num(raw);
  return status === 0 ? null : status;
}

function readTimings(raw: unknown): { recorded: Record<string, number | null>; phases: Phase[]; total: number } {
  const timings = record(raw);
  const recorded: Record<string, number | null> = {};
  for (const name of TIMING_NAMES) recorded[name] = num(timings[name]);

  const ssl = recorded.ssl;
  const connect = recorded.connect;
  const bare = connect !== null && ssl !== null ? Math.max(connect - ssl, 0) : connect;

  const drawn: Phase[] = [
    { name: "Blocked", ms: recorded.blocked ?? 0 },
    { name: "DNS", ms: recorded.dns ?? 0 },
    { name: "Connect", ms: bare ?? 0 },
    { name: "TLS", ms: ssl ?? 0 },
    { name: "Send", ms: recorded.send ?? 0 },
    { name: "Wait", ms: recorded.wait ?? 0 },
    { name: "Receive", ms: recorded.receive ?? 0 },
  ];

  const phases = drawn.filter((phase) => phase.ms > 0);
  return { recorded, phases, total: phases.reduce((sum, phase) => sum + phase.ms, 0) };
}

export const TIMING_NAMES = ["blocked", "dns", "connect", "ssl", "send", "wait", "receive"] as const;

function readContent(content: Record<string, unknown>): Body | null {
  const text = str(content.text);
  const size = num(content.size);
  if (!text && !size) return null;
  return {
    mimeType: cleanMime(str(content.mimeType)),
    text,
    encoding: str(content.encoding),
    size,
    params: [],
  };
}

function readBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== "object") return null;
  const post = record(raw);
  const text = str(post.text);
  const params = readPairs(post.params);
  if (!text && params.length === 0) return null;
  return {
    mimeType: cleanMime(str(post.mimeType)),
    text,
    encoding: str(post.encoding),
    size: text ? new TextEncoder().encode(text).length : null,
    params,
  };
}

function readPairs(raw: unknown): Pair[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const pair = record(item);
    return { name: str(pair.name), value: str(pair.value) };
  });
}

function pageTitles(raw: unknown): Map<string, string> {
  const titles = new Map<string, string>();
  if (!Array.isArray(raw)) return titles;
  for (const item of raw) {
    const page = record(item);
    const id = str(page.id);
    if (id) titles.set(id, str(page.title) || id);
  }
  return titles;
}

function split(url: string): { host: string; path: string; query: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.host, path: parsed.pathname, query: parsed.search.replace(/^\?/, "") };
  } catch {
    const [before, ...rest] = url.split("?");
    return { host: "", path: before, query: rest.join("?") };
  }
}

function cleanMime(value: string): string {
  return value.split(";")[0].trim().toLowerCase();
}

function inferType(mimeType: string, url: string): string {
  for (const [pattern, type] of TYPE_BY_MIME) {
    if (pattern.test(mimeType)) return type;
  }
  const extension = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? "other";
}

const TYPE_BY_MIME: [RegExp, string][] = [
  [/^text\/html$|^application\/xhtml/, "document"],
  [/^text\/css$/, "stylesheet"],
  [/javascript|ecmascript/, "script"],
  [/^application\/(json|.*\+json)$/, "json"],
  [/xml/, "xml"],
  [/^image\//, "image"],
  [/^font\/|font-woff|^application\/vnd\.ms-fontobject$|^application\/x-font/, "font"],
  [/^audio\/|^video\//, "media"],
  [/^text\//, "text"],
];

const TYPE_BY_EXTENSION: Record<string, string> = {
  css: "stylesheet",
  js: "script",
  mjs: "script",
  json: "json",
  html: "document",
  htm: "document",
  svg: "image",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  ico: "image",
  woff: "font",
  woff2: "font",
  ttf: "font",
  otf: "font",
};

function named(raw: unknown): string {
  const source = record(raw);
  const name = str(source.name);
  const version = str(source.version);
  return name && version ? `${name} ${version}` : name;
}

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function str(raw: unknown): string {
  return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
}

function num(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

function total(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function bodyLength(body: Body | null): number | null {
  return body?.size ?? null;
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
