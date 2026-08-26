import { type FlatEntry, flatten, nest } from "./flatten";
import { type ConfigValue, describe, isRecord, type ReadResult, readScalar, readValue, unwritable, type WriteResult, writeScalar, written } from "./value";

const SEPARATOR = ".";

export function readProperties(text: string): ReadResult {
  const entries: FlatEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    let line = lines[index].replace(/^[ \t\f]+/, "");
    if (line === "" || line.startsWith("#") || line.startsWith("!")) continue;

    while (continues(line) && index + 1 < lines.length) {
      index++;
      line = line.slice(0, -1) + lines[index].replace(/^[ \t\f]+/, "");
    }

    const { key, value } = divide(line);
    entries.push({ path: keyPath(unescape(key)), value: readScalar(unescape(value)) });
  }

  return readValue(nest(entries));
}

export function writeProperties(value: ConfigValue): WriteResult {
  if (!isRecord(value) && !Array.isArray(value)) {
    return unwritable(`A .properties file is a list of keys, and this document is ${describe(value)}.`);
  }

  const { entries, lost } = flatten(value);
  const lines = entries.map((entry) =>
    `${escapeKey(entry.path.join(SEPARATOR))}=${escapeValue(writeScalar(entry.value))}`
  );
  return written(lines.length === 0 ? "" : `${lines.join("\n")}\n`, lost);
}

function divide(line: string): { key: string; value: string } {
  let index = 0;
  for (; index < line.length; index++) {
    const char = line[index];
    if (char === "\\") index++;
    else if (char === "=" || char === ":" || char === " " || char === "\t" || char === "\f") break;
  }
  return { key: line.slice(0, index), value: line.slice(index).replace(SEPARATOR_RUN, "") };
}

function continues(line: string): boolean {
  let slashes = 0;
  for (let index = line.length - 1; index >= 0 && line[index] === "\\"; index--) slashes++;
  return slashes % 2 === 1;
}

function unescape(text: string): string {
  return text.replace(/\\(u[0-9a-fA-F]{4}|[\s\S])/g, (_, code: string) =>
    code.length === 5 && code[0] === "u"
      ? String.fromCharCode(parseInt(code.slice(1), 16))
      : ESCAPES[code] ?? code);
}

function keyPath(key: string): string[] {
  const path = key.split(SEPARATOR);
  return path.some((segment) => segment === "") ? [key] : path;
}

function escapeKey(text: string): string {
  return escapeControl(text).replace(/[ =:#!]/g, (char) => `\\${char}`);
}

function escapeValue(text: string): string {
  return escapeControl(text).replace(/^ +/, (spaces) => "\\ ".repeat(spaces.length));
}

function escapeControl(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(
    /\f/g,
    "\\f",
  );
}

const SEPARATOR_RUN = /^[ \t\f]*[=:]?[ \t\f]*/;

const ESCAPES: { [char: string]: string } = { t: "\t", n: "\n", r: "\r", f: "\f" };
