import type { Exchange, Pair } from "./parse";

export type FieldKind = "text" | "number";

const REQUEST = "Request";
const RESPONSE = "Response";
const TIMINGS = "Timings";
const ENTRY = "Entry";

export interface Field {
  id: string;
  label: string;
  group: string;
  kind: FieldKind;
  unit?: "bytes" | "ms";
  read(exchange: Exchange): readonly (string | number | null)[];
}

export const FIELDS: Field[] = [
  { id: "url", label: "URL", group: REQUEST, kind: "text", read: (x) => [x.url] },
  { id: "method", label: "Method", group: REQUEST, kind: "text", read: (x) => [x.method] },
  { id: "host", label: "Host", group: REQUEST, kind: "text", read: (x) => [x.host] },
  { id: "path", label: "Path", group: REQUEST, kind: "text", read: (x) => [x.path] },
  { id: "query", label: "Query string", group: REQUEST, kind: "text", read: (x) => [x.query] },
  { id: "query-param", label: "Query parameter", group: REQUEST, kind: "text", read: (x) => lines(x.queryParams) },
  { id: "request-header", label: "Request header", group: REQUEST, kind: "text", read: (x) => lines(x.requestHeaders) },
  { id: "request-cookie", label: "Request cookie", group: REQUEST, kind: "text", read: (x) => lines(x.requestCookies) },
  { id: "request-body", label: "Request body", group: REQUEST, kind: "text", read: (x) => [x.requestBody?.text ?? ""] },
  { id: "http-version", label: "HTTP version", group: REQUEST, kind: "text", read: (x) => [x.httpVersion] },
  {
    id: "request-size",
    label: "Request size",
    group: REQUEST,
    kind: "number",
    unit: "bytes",
    read: (x) => [x.requestSize],
  },

  { id: "status", label: "Status", group: RESPONSE, kind: "number", read: (x) => [x.status] },
  { id: "status-text", label: "Status text", group: RESPONSE, kind: "text", read: (x) => [x.statusText] },
  { id: "mime-type", label: "MIME type", group: RESPONSE, kind: "text", read: (x) => [x.mimeType] },
  { id: "resource-type", label: "Resource type", group: RESPONSE, kind: "text", read: (x) => [x.resourceType] },
  {
    id: "response-header",
    label: "Response header",
    group: RESPONSE,
    kind: "text",
    read: (x) => lines(x.responseHeaders),
  },
  {
    id: "response-cookie",
    label: "Response cookie",
    group: RESPONSE,
    kind: "text",
    read: (x) => lines(x.responseCookies),
  },
  {
    id: "response-body",
    label: "Response body",
    group: RESPONSE,
    kind: "text",
    read: (x) => [x.responseBody?.text ?? ""],
  },
  { id: "redirect", label: "Redirect to", group: RESPONSE, kind: "text", read: (x) => [x.redirect] },
  {
    id: "transferred",
    label: "Transferred",
    group: RESPONSE,
    kind: "number",
    unit: "bytes",
    read: (x) => [x.transferSize],
  },
  {
    id: "content-size",
    label: "Content size",
    group: RESPONSE,
    kind: "number",
    unit: "bytes",
    read: (x) => [x.contentSize],
  },

  { id: "time", label: "Total time", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.time] },
  { id: "blocked", label: "Blocked", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.blocked] },
  { id: "dns", label: "DNS", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.dns] },
  { id: "connect", label: "Connect", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.connect] },
  { id: "ssl", label: "TLS", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.ssl] },
  { id: "send", label: "Send", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.send] },
  { id: "wait", label: "Wait", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.wait] },
  { id: "receive", label: "Receive", group: TIMINGS, kind: "number", unit: "ms", read: (x) => [x.timings.receive] },

  { id: "started", label: "Started", group: ENTRY, kind: "text", read: (x) => [x.started] },
  { id: "server-ip", label: "Server IP", group: ENTRY, kind: "text", read: (x) => [x.serverIp] },
  { id: "connection", label: "Connection", group: ENTRY, kind: "text", read: (x) => [x.connection] },
  { id: "page", label: "Page", group: ENTRY, kind: "text", read: (x) => [x.page] },
  { id: "error", label: "Error", group: ENTRY, kind: "text", read: (x) => [x.error] },
];

export const DEFAULT_FIELD = "url";

export function fieldOf(id: string | undefined): Field {
  return BY_ID.get(id ?? "") ?? BY_ID.get(DEFAULT_FIELD)!;
}

export const FIELD_OPTIONS = [REQUEST, RESPONSE, TIMINGS, ENTRY].map((group) => ({
  group,
  items: FIELDS.filter((field) => field.group === group).map((field) => ({ value: field.id, label: field.label })),
}));

function lines(pairs: Pair[]): string[] {
  return pairs.map((pair) => `${pair.name}: ${pair.value}`);
}

const BY_ID = new Map(FIELDS.map((field) => [field.id, field]));
