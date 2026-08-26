import { type FlatEntry, flatten, nest } from "./flatten";
import { ambiguousAsText, type ConfigValue, describe, isRecord, type ReadResult, readScalar, readValue, unreadable, unwritable, type WriteResult, writeScalar, written } from "./value";

const SEPARATOR = "__";

export function readEnv(text: string): ReadResult {
  const entries: FlatEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const assignment = ASSIGNMENT.exec(lines[index].replace(/^\s+/, ""));
    if (!assignment) return unreadable("This line is not a KEY=value assignment.", { line: index + 1, column: 1 });

    const [, key, rest] = assignment;
    const quote = rest[0];

    if (quote !== "\"" && quote !== "'") {
      entries.push({ path: keyPath(key), value: readScalar(rest.replace(COMMENT, "").trim()) });
      continue;
    }

    let body = rest.slice(1);
    let closing = closingQuote(body, quote);
    while (closing < 0 && index + 1 < lines.length) {
      index++;
      body += `\n${lines[index]}`;
      closing = closingQuote(body, quote);
    }
    if (closing < 0) {
      return unreadable(`The value of ${key} never closes its ${quote} quote.`, { line: index + 1, column: 1 });
    }

    const raw = body.slice(0, closing);
    entries.push({ path: keyPath(key), value: quote === "\"" ? unescape(raw) : raw });
  }

  return readValue(nest(entries));
}

export function writeEnv(value: ConfigValue): WriteResult {
  if (!isRecord(value) && !Array.isArray(value)) {
    return unwritable(`A .env file is a list of keys, and this document is ${describe(value)}.`);
  }

  const { entries, lost } = flatten(value);
  const lines = entries.map((entry) => `${entry.path.join(SEPARATOR)}=${envValue(entry.value)}`);
  return written(lines.length === 0 ? "" : `${lines.join("\n")}\n`, lost);
}

function envValue(value: ConfigValue): string {
  const text = writeScalar(value);
  if (typeof value !== "string") return text;
  if (text !== "" && !ambiguousAsText(text) && !NEEDS_QUOTING.test(text)) return text;

  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n").replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function keyPath(key: string): string[] {
  const path = key.split(SEPARATOR);
  return path.some((segment) => segment === "") ? [key] : path;
}

function closingQuote(body: string, quote: string): number {
  if (quote === "'") return body.indexOf("'");
  for (let index = 0; index < body.length; index++) {
    if (body[index] === "\\") index++;
    else if (body[index] === "\"") return index;
  }
  return -1;
}

function unescape(text: string): string {
  return text.replace(/\\(.)/gs, (whole, char: string) => ESCAPES[char] ?? whole);
}

const ASSIGNMENT = /^(?:export\s+)?([^=\s]+)\s*=\s*([\s\S]*)$/;

const COMMENT = /\s+#.*$/;

const NEEDS_QUOTING = /[\s#"'\\]/;

const ESCAPES: { [char: string]: string } = {
  n: "\n",
  r: "\r",
  t: "\t",
  f: "\f",
  b: "\b",
  "\\": "\\",
  "\"": "\"",
  "'": "'",
};
