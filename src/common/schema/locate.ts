import type { JsonValue } from "./ir";

export interface Span {
  from: number;
  to: number;
}

export interface ParsedJson {
  value: JsonValue;
  spans: Map<string, Span>;
  keys: Map<string, Span>;
}

export type ParseResult =
  | { ok: true; parsed: ParsedJson }
  | { ok: false; error: SyntaxProblem };

export interface SyntaxProblem extends Span {
  message: string;
  line: number;
  column: number;
}

export function pointerOf(path: (string | number)[]): string {
  if (path.length === 0) return "";
  return "/" + path.map((step) => String(step).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
}

export function parseJson(text: string): ParseResult {
  const spans = new Map<string, Span>();
  const keys = new Map<string, Span>();
  let at = 0;

  const fail = (message: string, from = at, to = from + 1): never => {
    throw new ParseFailure(message, from, Math.min(to, Math.max(text.length, from + 1)));
  };

  const skipSpace = () => {
    while (at < text.length && WHITESPACE.has(text[at])) at++;
  };

  const expect = (character: string) => {
    if (text[at] !== character) fail(`Expected ${JSON.stringify(character)}`);
    at++;
  };

  const parseString = (): string => {
    const start = at;
    expect("\"");
    let out = "";
    for (;;) {
      if (at >= text.length) fail("Unterminated string", start, at);
      const character = text[at];
      if (character === "\"") {
        at++;
        return out;
      }
      if (character === "\\") {
        at++;
        const escape = text[at];
        if (escape === undefined) fail("Unterminated string", start, at);
        if (escape === "u") {
          const digits = text.slice(at + 1, at + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail("Invalid unicode escape", at - 1, at + 5);
          out += String.fromCharCode(parseInt(digits, 16));
          at += 5;
          continue;
        }
        const literal = ESCAPES[escape];
        if (literal === undefined) fail(`Invalid escape ${JSON.stringify(`\\${escape}`)}`, at - 1, at + 1);
        out += literal;
        at++;
        continue;
      }
      if (character < " ") fail("A control character has to be escaped inside a string", at, at + 1);
      out += character;
      at++;
    }
  };

  const parseNumber = (): number => {
    const start = at;
    NUMBER.lastIndex = at;
    const match = NUMBER.exec(text);
    if (!match || match.index !== at) fail("Expected a number", start, start + 1);
    at += match![0].length;
    return Number(match![0]);
  };

  const parseValue = (pointer: string): JsonValue => {
    skipSpace();
    const start = at;
    const value = parseUnspanned(pointer);
    spans.set(pointer, { from: start, to: at });
    return value;
  };

  const parseUnspanned = (pointer: string): JsonValue => {
    if (at >= text.length) fail("Unexpected end of input", Math.max(0, text.length - 1), text.length);

    const character = text[at];
    if (character === "{") return parseObject(pointer);
    if (character === "[") return parseArray(pointer);
    if (character === "\"") return parseString();
    if (character === "-" || (character >= "0" && character <= "9")) return parseNumber();

    for (const [word, value] of LITERALS) {
      if (text.startsWith(word, at)) {
        at += word.length;
        return value;
      }
    }

    return fail("Expected a value", at, at + 1);
  };

  const parseObject = (pointer: string): JsonValue => {
    const out: { [key: string]: JsonValue } = {};
    expect("{");
    skipSpace();
    if (text[at] === "}") {
      at++;
      return out;
    }

    for (;;) {
      skipSpace();
      const keyStart = at;
      if (text[at] !== "\"") fail("Expected a property name in double quotes", at, at + 1);
      const key = parseString();
      const child = `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      keys.set(child, { from: keyStart, to: at });

      skipSpace();
      expect(":");
      out[key] = parseValue(child);

      skipSpace();
      if (text[at] === ",") {
        at++;
        continue;
      }
      if (text[at] === "}") {
        at++;
        return out;
      }
      fail("Expected \",\" or \"}\"", at, at + 1);
    }
  };

  const parseArray = (pointer: string): JsonValue => {
    const out: JsonValue[] = [];
    expect("[");
    skipSpace();
    if (text[at] === "]") {
      at++;
      return out;
    }

    for (;;) {
      out.push(parseValue(`${pointer}/${out.length}`));
      skipSpace();
      if (text[at] === ",") {
        at++;
        continue;
      }
      if (text[at] === "]") {
        at++;
        return out;
      }
      fail("Expected \",\" or \"]\"", at, at + 1);
    }
  };

  try {
    skipSpace();
    if (at >= text.length) fail("There is nothing to validate yet", 0, Math.max(1, text.length));
    const value = parseValue("");
    skipSpace();
    if (at < text.length) fail("Unexpected text after the end of the document", at, text.length);
    return { ok: true, parsed: { value, spans, keys } };
  } catch (problem) {
    if (!(problem instanceof ParseFailure)) throw problem;
    return { ok: false, error: { ...place(text, problem.from), message: problem.message, ...problem.span() } };
  }
}

class ParseFailure extends Error {
  constructor(message: string, readonly from: number, readonly to: number) {
    super(message);
  }

  span(): Span {
    return { from: this.from, to: this.to };
  }
}

function place(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  return { line, column: offset - (before.lastIndexOf("\n") + 1) + 1 };
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

const ESCAPES: Record<string, string> = {
  "\"": "\"",
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

const LITERALS: [string, JsonValue][] = [["true", true], ["false", false], ["null", null]];

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
