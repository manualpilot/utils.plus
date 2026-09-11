import type { Entry, OptionEntry, UrlEntry } from "./entries";

export interface Note {
  subject: string;
  reason: string;
}

export type BodyPlan =
  | { kind: "text"; text: string }
  | { kind: "form"; fields: [string, string][] };

export interface Plan {
  url: string;
  method: string;
  headers: [string, string][];
  body: BodyPlan | null;
  redirect: RequestRedirect;
  timeout: number | null;
  notes: Note[];
  mixed: boolean;
  error: string | null;
}

export const NO_URL = "The command has no URL to send to";
export const BAD_URL = "That URL cannot be read as one";
export const NOT_HTTP = "A browser can only send this over http or https";
export const ONE_METHOD =
  "curl will not upload a file with -T and send data, a form or a HEAD besides, and runs nothing when asked to";

export function planRequest(entries: Entry[], protocol: string): Plan {
  const options = entries.filter((entry): entry is OptionEntry => entry.kind === "option");
  const notes: Note[] = [];
  const seen = new Set<string>();

  const note = (subject: string, key: string, reason: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    notes.push({ subject, reason });
  };

  for (const option of options) {
    const reason = UNSUPPORTED[option.name];
    if (reason) note(option.flag, option.name, reason);
  }

  for (const entry of entries) {
    if (entry.kind === "unknown") {
      note(entry.flag, entry.flag, "The page has no field for this, so it sends nothing of it");
    }
  }

  const last = (name: string) => options.filter((option) => option.name === name).at(-1);
  const has = (name: string) => options.some((option) => option.name === name);

  const pieces: { text: string; json: boolean }[] = [];
  for (const option of options) {
    if (!DATA.has(option.name)) continue;
    const piece = dataPiece(option);
    if (piece === null) {
      note(option.flag, option.name, UNREAD_FILE);
      continue;
    }
    pieces.push({ text: piece, json: option.name === "--json" });
  }

  const posted = options.some((option) => DATA.has(option.name));
  const data = posted ? pieces.map((piece, at) => (at === 0 ? "" : piece.json ? "" : "&") + piece.text).join("") : null;
  const json = options.some((option) => option.name === "--json");

  let form = false;
  const fields: [string, string][] = [];
  for (const option of options) {
    if (!FORM.has(option.name)) continue;
    const split = option.value.indexOf("=");
    if (split < 0) {
      note(option.flag, `${option.name}:name`, "A form field is written name=value");
      continue;
    }
    form = true;
    const value = option.value.slice(split + 1);
    if (option.name === "--form" && (value.startsWith("@") || value.startsWith("<"))) {
      note(option.flag, option.name, UNREAD_FILE);
      continue;
    }
    fields.push([option.value.slice(0, split), value]);
  }

  if (form && data !== null) {
    note("-F", "-F+-d", "curl sends a body or a form and not both, so the form is what goes");
  }

  const query = has("--get");

  const upload = options.find((option) => option.name === "--upload-file");
  if (upload) note(upload.flag, upload.name, STDIN.has(upload.value) ? UNREAD_STDIN : UNREAD_FILE);

  let method = "GET";
  if (data !== null || form) method = "POST";
  if (has("--head")) method = "HEAD";
  if (query) method = "GET";
  if (upload) method = "PUT";
  const requested = last("--request")?.value ?? "";
  if (requested !== "") method = requested;

  let body: BodyPlan | null = null;
  if (form) body = { kind: "form", fields };
  else if (data !== null && !query) body = { kind: "text", text: data };

  if (body !== null && NO_BODY.has(method.toUpperCase())) {
    note("-d", "-d:body", `A browser will not put a body on a ${method.toUpperCase()}`);
    body = null;
  }

  const defaults: [string, string][] = [];
  if (body?.kind === "text") {
    defaults.push(["Content-Type", json ? "application/json" : "application/x-www-form-urlencoded"]);
  }
  if (json) defaults.push(["Accept", "application/json"]);

  const user = last("--user")?.value;
  if (user) defaults.push(["Authorization", `Basic ${base64(user)}`]);

  const bearer = last("--oauth2-bearer")?.value;
  if (bearer) defaults.push(["Authorization", `Bearer ${bearer}`]);

  const agent = last("--user-agent")?.value;
  if (agent) defaults.push(["User-Agent", agent]);

  const range = last("--range")?.value;
  if (range) defaults.push(["Range", range.includes("=") ? range : `bytes=${range}`]);

  const given: [string, string][] = [];
  const refused: string[] = [];

  for (const option of options) {
    if (option.name !== "--header") continue;
    const header = readHeader(option.value);
    if (!header) {
      note(option.flag, "--header:shape", "A header is written Name: value");
      continue;
    }
    if (header.removes) {
      note(
        `${option.flag} ${header.name}`,
        `--header:off:${header.name}`,
        "curl takes a header off with this, and the page has none to take off",
      );
      continue;
    }
    if (isForbidden(header.name)) {
      if (!refused.includes(header.name)) refused.push(header.name);
      continue;
    }
    given.push([header.name, header.value]);
  }

  if (refused.length > 0) {
    notes.push({ subject: "-H", reason: `A browser sets these itself and will not take them: ${refused.join(", ")}` });
  }

  const overridden = new Set(given.map(([name]) => name.toLowerCase()));
  const headers = [...defaults.filter(([name]) => !overridden.has(name.toLowerCase())), ...given];

  const seconds = Number(last("--max-time")?.value);
  const timeout = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;

  const follows = has("--location") || has("--location-trusted");
  const redirect: RequestRedirect = follows ? "follow" : "manual";
  if (follows && has("--max-redirs")) {
    note("--max-redirs", "--max-redirs", "A browser follows up to twenty redirects and takes no other limit");
  }

  const urls = entries.filter((entry): entry is UrlEntry => entry.kind === "url")
    .map((entry) => entry.value)
    .filter((value) => value !== "");
  if (urls.length > 1) {
    notes.push({ subject: urls[1], reason: "Only the first URL is sent; curl would fetch each of them in turn" });
  }

  const plan: Plan = { url: "", method, headers, body, redirect, timeout, notes, mixed: false, error: null };

  if (upload && (data !== null || form || has("--head"))) return { ...plan, error: ONE_METHOD };
  if (urls.length === 0) return { ...plan, error: NO_URL };

  const written = SCHEME.test(urls[0]) ? urls[0] : `${guessScheme(urls[0])}://${urls[0]}`;

  let address: URL;
  try {
    address = new URL(written);
  } catch {
    return { ...plan, error: BAD_URL };
  }

  if (address.protocol !== "http:" && address.protocol !== "https:") return { ...plan, error: NOT_HTTP };

  if (query && data) address.search = address.search === "" ? data : `${address.search.slice(1)}&${data}`;

  const unnamed = address.pathname.endsWith("/") && !address.href.split("#")[0].includes("?");
  if (upload && unnamed && !STDIN.has(upload.value)) address.pathname += remoteName(upload.value);

  const mixed = protocol === "https:" && address.protocol === "http:" && !LOOPBACK.test(address.hostname);
  if (mixed) notes.push({ subject: urls[0], reason: MIXED_CONTENT });

  return { ...plan, url: address.href, mixed };
}

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

const GUESSED = ["dict", "ftp", "imap", "ldap", "pop3", "smtp"];

function guessScheme(written: string): string {
  let host: string;
  try {
    host = new URL(`http://${written}`).hostname;
  } catch {
    return "http";
  }
  return GUESSED.find((scheme) => host.startsWith(`${scheme}.`)) ?? "http";
}

const LOOPBACK = /^(localhost|.+\.localhost|127(\.\d{1,3}){3}|\[::1\])$/;

const MIXED_CONTENT = "A page served over https cannot fetch an http address: the browser blocks it as mixed content";

const DATA = new Set(["--data", "--data-ascii", "--data-raw", "--data-binary", "--data-urlencode", "--json"]);

const FORM = new Set(["--form", "--form-string"]);

const UNREAD_FILE = "The value names a file, and with no file here to read the request is sent without it";

const UNREAD_STDIN = "The upload is read from standard input, and with none here the request is sent without it";

const STDIN = new Set(["-", "."]);

function remoteName(file: string): string {
  const name = file.slice(Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\")) + 1);
  return escapeAll(name).replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase());
}

const NO_BODY = new Set(["GET", "HEAD"]);

function dataPiece(option: OptionEntry): string | null {
  const { name, value } = option;
  if (name === "--data-urlencode") return encodePiece(value);
  if (name !== "--data-raw" && value.startsWith("@")) return null;
  if (name === "--data" || name === "--data-ascii") return value.replace(/[\r\n]/g, "");
  return value;
}

function encodePiece(value: string): string | null {
  if (value.startsWith("@")) return null;
  const split = value.indexOf("=");
  const at = value.indexOf("@");
  if (at >= 0 && (split < 0 || at < split)) return null;
  if (split < 0) return escapeAll(value);
  if (split === 0) return escapeAll(value.slice(1));
  return `${value.slice(0, split)}=${escapeAll(value.slice(split + 1))}`;
}

function escapeAll(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function base64(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function readHeader(value: string): { name: string; value: string; removes: boolean } | null {
  const split = value.indexOf(":");
  if (split < 0) {
    const name = value.trim();
    if (!name.endsWith(";")) return null;
    return { name: name.slice(0, -1).trim(), value: "", removes: false };
  }
  const rest = value.slice(split + 1).trim();
  return { name: value.slice(0, split).trim(), value: rest, removes: rest === "" };
}

const FORBIDDEN = new Set([
  "accept-charset",
  "accept-encoding",
  "access-control-request-headers",
  "access-control-request-method",
  "connection",
  "content-length",
  "cookie",
  "cookie2",
  "date",
  "dnt",
  "expect",
  "host",
  "keep-alive",
  "origin",
  "permissions-policy",
  "referer",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "via",
]);

function isForbidden(name: string): boolean {
  const lower = name.toLowerCase();
  return FORBIDDEN.has(lower) || lower.startsWith("proxy-") || lower.startsWith("sec-");
}

const NO_FILES = "There is no filesystem here to read from or write to";
const THE_BROWSER_CONNECTS = "The browser makes the connection and takes no instructions about it";
const THE_BROWSER_TLS = "The browser makes the TLS connection and takes no instructions about it";
const SHOWN_BELOW = "The response is shown below rather than written anywhere";

const UNSUPPORTED: Record<string, string> = {
  "--referer": "A browser sets Referer itself and will not take one",
  "--cookie": "A page cannot hand a browser cookies to send, and it sends no cookies at all to another site",
  "--cookie-jar": NO_FILES,
  "--time-cond": "The page does not turn a date or a file into the condition header curl would work out",

  "--aws-sigv4": "Signing a request is not something the page does",
  "--netrc": NO_FILES,
  "--netrc-file": NO_FILES,
  "--digest": "Only credentials the page can work out itself are sent, which is Basic and Bearer",
  "--ntlm": "Only credentials the page can work out itself are sent, which is Basic and Bearer",
  "--negotiate": "Only credentials the page can work out itself are sent, which is Basic and Bearer",
  "--anyauth": "Only credentials the page can work out itself are sent, which is Basic and Bearer",

  "--insecure": "A browser will not skip its certificate checks for a page that asks",
  "--cacert": THE_BROWSER_TLS,
  "--capath": THE_BROWSER_TLS,
  "--cert": THE_BROWSER_TLS,
  "--cert-type": THE_BROWSER_TLS,
  "--key": THE_BROWSER_TLS,
  "--key-type": THE_BROWSER_TLS,
  "--ciphers": THE_BROWSER_TLS,
  "--pinnedpubkey": THE_BROWSER_TLS,
  "--tlsv1.2": THE_BROWSER_TLS,
  "--tlsv1.3": THE_BROWSER_TLS,

  "--connect-timeout": "Only a whole timeout can be set, which is --max-time",
  "--retry": "The request is made once and nothing here retries it",
  "--retry-delay": "The request is made once and nothing here retries it",
  "--retry-max-time": "The request is made once and nothing here retries it",
  "--limit-rate": THE_BROWSER_CONNECTS,
  "--interface": THE_BROWSER_CONNECTS,
  "--unix-socket": THE_BROWSER_CONNECTS,
  "--resolve": THE_BROWSER_CONNECTS,
  "--connect-to": THE_BROWSER_CONNECTS,
  "--ipv4": THE_BROWSER_CONNECTS,
  "--ipv6": THE_BROWSER_CONNECTS,
  "--http1.0": "The browser negotiates the version and takes no instructions about it",
  "--http1.1": "The browser negotiates the version and takes no instructions about it",
  "--http2": "The browser negotiates the version and takes no instructions about it",
  "--http3": "The browser negotiates the version and takes no instructions about it",

  "--proxy": "A browser uses whatever proxy the system gave it",
  "--proxy-user": "A browser uses whatever proxy the system gave it",
  "--proxy-header": "A browser uses whatever proxy the system gave it",
  "--noproxy": "A browser uses whatever proxy the system gave it",
  "--socks5": "A browser uses whatever proxy the system gave it",
  "--socks5-hostname": "A browser uses whatever proxy the system gave it",
  "--proxy-insecure": "A browser uses whatever proxy the system gave it",

  "--output": SHOWN_BELOW,
  "--remote-name": SHOWN_BELOW,
  "--remote-header-name": SHOWN_BELOW,
  "--output-dir": SHOWN_BELOW,
  "--create-dirs": NO_FILES,
  "--dump-header": SHOWN_BELOW,
  "--trace": SHOWN_BELOW,
  "--trace-ascii": SHOWN_BELOW,

  "--continue-at": "A request is made whole, there being nothing part-written here to resume",
};
