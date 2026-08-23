import type { Plan } from "./request";

export interface Outcome {
  status: number;
  statusText: string;
  opaque: boolean;
  redirected: boolean;
  url: string;
  headers: [string, string][];
  body: string;
  bytes: number;
  truncated: boolean;
  binary: boolean;
  seconds: number;
}

export const MAX_BODY = 256 * 1024;

export const STOPPED = "Stopped";

export const BLOCKED = "The request never left the browser. That is almost always CORS: a page may only read a "
  + "response from another site where that site sends an Access-Control-Allow-Origin header, and curl in a terminal "
  + "is under no such rule. A host that is down and a name that does not resolve look the same from here.";

export async function send(plan: Plan, signal: AbortSignal): Promise<Outcome> {
  const started = performance.now();

  const response = await fetch(plan.url, {
    method: plan.method,
    headers: plan.headers,
    body: bodyOf(plan),
    redirect: plan.redirect,
    signal,
  });

  const seconds = () => (performance.now() - started) / 1000;

  if (response.type === "opaqueredirect") {
    return {
      status: 0,
      statusText: "",
      opaque: true,
      redirected: true,
      url: plan.url,
      headers: [],
      body: "",
      bytes: 0,
      truncated: false,
      binary: false,
      seconds: seconds(),
    };
  }

  const buffer = await response.arrayBuffer();
  const type = response.headers.get("content-type") ?? "";
  const body = new TextDecoder().decode(buffer.slice(0, MAX_BODY));

  return {
    status: response.status,
    statusText: response.statusText,
    opaque: false,
    redirected: response.redirected,
    url: response.url || plan.url,
    headers: [...response.headers.entries()],
    body,
    bytes: buffer.byteLength,
    truncated: buffer.byteLength > MAX_BODY,
    binary: isBinary(type, body),
    seconds: seconds(),
  };
}

export function explain(error: unknown, plan: Plan, stopped: boolean): string {
  if (stopped) return STOPPED;

  if (error instanceof DOMException) {
    if (error.name === "TimeoutError") return `Nothing came back within ${(plan.timeout ?? 0) / 1000}s`;
    if (error.name === "AbortError") return STOPPED;
  }

  if (error instanceof TypeError) return BLOCKED;
  return error instanceof Error ? error.message : String(error);
}

function bodyOf(plan: Plan): BodyInit | null {
  if (plan.body === null) return null;
  if (plan.body.kind === "text") return plan.body.text;

  const form = new FormData();
  for (const [name, value] of plan.body.fields) form.append(name, value);
  return form;
}

function isBinary(type: string, body: string): boolean {
  if (type === "") return body.includes("\u0000");
  return !TEXTUAL.test(type);
}

const TEXTUAL = /^\s*(text\/|application\/(json|xml|javascript|ecmascript|x-www-form-urlencoded|[\w.-]+\+(json|xml)))/i;
