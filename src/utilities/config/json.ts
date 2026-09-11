import { type ConfigValue, exactInteger, isRecord, type ReadResult, readValue, unreadable, type WriteOptions, type WriteResult, written } from "./value";

export function readJson(text: string): ReadResult {
  if (text.trim() === "") return readValue(null);

  try {
    JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const at = PLACE.exec(message);
    return unreadable(
      message.replace(POSITION_CLAUSE, "").trim(),
      at ? { line: Number(at[1]), column: Number(at[2]) } : undefined,
    );
  }

  return readValue(exactly(text));
}

export function writeJson(value: ConfigValue, { indent }: WriteOptions): WriteResult {
  return written(`${spell(value, " ".repeat(indent), "")}\n`);
}

function exactly(text: string): ConfigValue {
  let at = 0;

  const token = (pattern: RegExp): string => {
    pattern.lastIndex = at;
    const found = pattern.exec(text)![0];
    at += found.length;
    return found;
  };

  const skipSpace = () => {
    while (at < text.length && WHITESPACE.includes(text[at])) at++;
  };

  const value = (): ConfigValue => {
    skipSpace();
    const opening = text[at];

    if (opening === "{") {
      at++;
      const entries: [string, ConfigValue][] = [];
      skipSpace();
      if (text[at] === "}") {
        at++;
        return {};
      }
      do {
        skipSpace();
        const key = JSON.parse(token(STRING)) as string;
        skipSpace();
        at++;
        entries.push([key, value()]);
        skipSpace();
      } while (text[at++] === ",");
      return Object.fromEntries(entries);
    }

    if (opening === "[") {
      at++;
      const items: ConfigValue[] = [];
      skipSpace();
      if (text[at] === "]") {
        at++;
        return items;
      }
      do {
        items.push(value());
        skipSpace();
      } while (text[at++] === ",");
      return items;
    }

    if (opening === "\"") return JSON.parse(token(STRING)) as string;

    const scalar = token(SCALAR);
    if (scalar === "true") return true;
    if (scalar === "false") return false;
    if (scalar === "null") return null;
    return WHOLE.test(scalar) ? exactInteger(BigInt(scalar)) : Number(scalar);
  };

  return value();
}

function spell(value: ConfigValue, indent: string, margin: string): string {
  if (typeof value === "bigint") return value.toString();

  const inner = margin + indent;
  const breakLine = indent === "" ? "" : "\n";
  const close = `${breakLine}${margin}`;

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${inner}${spell(item, indent, inner)}`);
    return `[${breakLine}${items.join(`,${breakLine}`)}${close}]`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const colon = indent === "" ? ":" : ": ";
    const members = keys.map((key) => `${inner}${JSON.stringify(key)}${colon}${spell(value[key], indent, inner)}`);
    return `{${breakLine}${members.join(`,${breakLine}`)}${close}}`;
  }

  return JSON.stringify(value);
}

const PLACE = /\(line (\d+) column (\d+)\)/;

const POSITION_CLAUSE = /\s*at position \d+(?: \(line \d+ column \d+\))?/;

const WHITESPACE = " \t\n\r";

const STRING = /"(?:[^"\\]|\\.)*"/y;
const SCALAR = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

const WHOLE = /^-?\d+$/;
