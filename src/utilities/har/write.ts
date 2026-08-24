import { byteSize } from "../../common/byte-size";
import type { Fact } from "../../common/fact-table";
import type { Archive, Exchange } from "./parse";

export function writeSize(bytes: number | null): string {
  return bytes === null ? "" : byteSize(bytes);
}

export function writeMs(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function writeStatus(exchange: Exchange): string {
  return exchange.status === null ? "—" : String(exchange.status);
}

export function statusColour(status: number | null): string {
  if (status === null) return "gray";
  if (status < 200) return "cyan";
  if (status < 300) return "teal";
  if (status < 400) return "blue";
  if (status < 500) return "yellow";
  return "red";
}

export function writeTarget(exchange: Exchange): string {
  if (!exchange.host) return exchange.url || "(no URL)";
  const query = exchange.query ? `?${exchange.query}` : "";
  return `${exchange.path || "/"}${query}`;
}

export function writeStarted(exchange: Exchange): string {
  if (exchange.startedAt === null) return exchange.started;
  return new Date(exchange.startedAt).toLocaleString();
}

export function writeOffset(exchange: Exchange, from: number | null): string {
  if (from === null || exchange.startedAt === null) return "";
  return `+${writeStretch(Math.max(exchange.startedAt - from, 0))}`;
}

export function writeSpan(from: number | null, to: number | null): string {
  if (from === null || to === null) return "";
  return writeStretch(Math.max(to - from, 0));
}

function writeStretch(ms: number): string {
  if (ms < 60_000) return writeMs(ms);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export const PHASE_COLOUR: Record<string, string> = {
  Blocked: "gray",
  DNS: "grape",
  Connect: "orange",
  TLS: "violet",
  Send: "cyan",
  Wait: "yellow",
  Receive: "teal",
};

export function exchangeFacts(exchange: Exchange, from: number | null): Fact[] {
  return [
    { label: "URL", value: exchange.url },
    { label: "Method", value: exchange.method },
    { label: "Status", value: statusLine(exchange) },
    { label: "HTTP version", value: exchange.httpVersion },
    { label: "Resource type", value: exchange.resourceType },
    { label: "MIME type", value: exchange.mimeType },
    { label: "Redirect to", value: exchange.redirect },
    { label: "Error", value: exchange.error },
    { label: "Server IP", value: exchange.serverIp },
    { label: "Connection", value: exchange.connection },
    { label: "Page", value: exchange.page },
    { label: "Started", value: writeStarted(exchange) },
    { label: "Offset", value: writeOffset(exchange, from) },
    { label: "Duration", value: writeMs(exchange.time) },
    { label: "Request size", value: writeSize(exchange.requestSize) },
    { label: "Transferred", value: writeSize(exchange.transferSize) },
    { label: "Content size", value: writeSize(exchange.contentSize) },
  ];
}

export function fileFacts(archive: Archive, name: string): Fact[] {
  return [
    { label: "Name", value: name },
    { label: "Requests", value: String(archive.exchanges.length) },
    { label: "Transferred", value: writeSize(archive.transferred || null) },
    { label: "Recording", value: writeSpan(archive.startedAt, archive.endedAt) },
  ];
}

export function recorderFacts(archive: Archive): Fact[] {
  return [
    { label: "First request", value: archive.startedAt === null ? "" : new Date(archive.startedAt).toLocaleString() },
    { label: "Pages", value: archive.pages > 0 ? String(archive.pages) : "" },
    { label: "Recorded by", value: archive.creator },
    { label: "Browser", value: archive.browser },
    { label: "HAR version", value: archive.version },
  ];
}

function statusLine(exchange: Exchange): string {
  const status = writeStatus(exchange);
  if (status === "—") return exchange.error ? "No response" : "";
  return exchange.statusText ? `${status} ${exchange.statusText}` : status;
}
