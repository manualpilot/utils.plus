import { type JsonEntry, type JsonNode, placeOf } from "./document";

export type Repair = { ok: true; node: JsonNode; fixes: string[] } | { ok: false; error: string };

export function repairDocument(text: string): Repair {
  const reader = new Reader(text);
  try {
    reader.skip();
    if (reader.done()) reader.fail("the document is empty");
    const node = reader.value();
    reader.skip();
    if (!reader.done()) reader.fail(`unexpected ${JSON.stringify(reader.peek())} after the document`);
    return { ok: true, node, fixes: reader.describe() };
  } catch (fault) {
    if (!(fault instanceof Fault)) throw fault;
    return { ok: false, error: `Could not repair: ${fault.message} at ${placeOf(text, fault.at)}` };
  }
}

type Fix =
  | "whitespace"
  | "comment"
  | "trailingComma"
  | "missingComma"
  | "singleQuote"
  | "unquotedKey"
  | "escape"
  | "number"
  | "literal"
  | "nonFinite";

const PHRASES: Record<Fix, [string, string]> = {
  whitespace: ["stray whitespace character removed", "stray whitespace characters removed"],
  comment: ["comment removed", "comments removed"],
  trailingComma: ["trailing comma removed", "trailing commas removed"],
  missingComma: ["missing comma added", "missing commas added"],
  singleQuote: ["single-quoted string requoted", "single-quoted strings requoted"],
  unquotedKey: ["bare key quoted", "bare keys quoted"],
  escape: ["string re-escaped", "strings re-escaped"],
  number: ["number rewritten", "numbers rewritten"],
  literal: ["Python or JavaScript literal replaced", "Python or JavaScript literals replaced"],
  nonFinite: ["non-finite number made null", "non-finite numbers made null"],
};

class Fault extends Error {
  constructor(message: string, readonly at: number) {
    super(message);
  }
}

class Reader {
  at = 0;
  private readonly fixes = new Map<Fix, number>();

  constructor(private readonly text: string) {}

  done = () => this.at >= this.text.length;
  peek = () => this.text[this.at];

  fail(message: string): never {
    throw new Fault(message, this.at);
  }

  describe(): string[] {
    return (Object.keys(PHRASES) as Fix[]).flatMap((fix) => {
      const count = this.fixes.get(fix);
      return count ? [`${count} ${PHRASES[fix][count === 1 ? 0 : 1]}`] : [];
    });
  }

  private fix(kind: Fix) {
    this.fixes.set(kind, (this.fixes.get(kind) ?? 0) + 1);
  }

  skip() {
    while (!this.done()) {
      if (/[\s\uFEFF]/.test(this.peek())) {
        if (!JSON_BLANK.has(this.peek())) this.fix("whitespace");
        this.at++;
      } else if (this.text.startsWith("//", this.at)) {
        const end = this.text.indexOf("\n", this.at);
        this.at = end === -1 ? this.text.length : end;
        this.fix("comment");
      } else if (this.text.startsWith("/*", this.at)) {
        const end = this.text.indexOf("*/", this.at + 2);
        if (end === -1) this.fail("a comment is never closed");
        this.at = end + 2;
        this.fix("comment");
      } else {
        return;
      }
    }
  }

  value(): JsonNode {
    const next = this.peek();
    if (next === "{") return this.object();
    if (next === "[") return this.array();
    if (next === "\"" || next === "'") return this.string();
    if (NUMBER_START.test(next)) return this.number();
    if (WORD_START.test(next)) return this.word();
    if (next === undefined) return this.fail("the document ends where a value should be");
    return this.fail(`unexpected ${JSON.stringify(next)}`);
  }

  private object(): JsonNode {
    const entries: JsonEntry[] = [];
    this.at++;
    this.skip();
    if (this.peek() === "}") {
      this.at++;
      return { kind: "object", entries };
    }

    for (;;) {
      entries.push(this.member());
      if (this.close("}", KEY_START)) return { kind: "object", entries };
    }
  }

  private array(): JsonNode {
    const items: JsonNode[] = [];
    this.at++;
    this.skip();
    if (this.peek() === "]") {
      this.at++;
      return { kind: "array", items };
    }

    for (;;) {
      items.push(this.value());
      if (this.close("]", VALUE_START)) return { kind: "array", items };
    }
  }

  private close(closer: string, starts: RegExp): boolean {
    this.skip();
    if (this.peek() === closer) {
      this.at++;
      return true;
    }
    if (this.peek() === ",") {
      this.at++;
      this.skip();
      if (this.peek() !== closer) return false;
      this.fix("trailingComma");
      this.at++;
      return true;
    }
    if (this.done()) this.fail(`the document ends before its ${JSON.stringify(closer)}`);
    if (!starts.test(this.peek())) this.fail(`expected "," or ${JSON.stringify(closer)}`);
    this.fix("missingComma");
    return false;
  }

  private member(): JsonEntry {
    let key: string;
    let name: string;

    const next = this.peek();
    if (next === "\"" || next === "'") {
      const read = this.string();
      key = (read as { text: string }).text;
      name = JSON.parse(key) as string;
    } else if (KEY_START.test(next ?? "")) {
      name = this.take(BARE_KEY) ?? this.fail("expected a key");
      key = JSON.stringify(name);
      this.fix("unquotedKey");
    } else {
      return this.fail("expected a key");
    }

    this.skip();
    if (this.peek() !== ":") this.fail("expected \":\" after a key");
    this.at++;
    this.skip();
    return { key, name, value: this.value() };
  }

  private string(): JsonNode & { text: string } {
    const start = this.at;
    const quote = this.text[this.at++];
    let spelled = "";
    let clean = quote === "\"";

    for (;;) {
      const character = this.text[this.at];
      if (character === undefined) {
        this.at = start;
        this.fail("a string is never closed");
      }
      this.at++;
      if (character === quote) break;
      if (character !== "\\") {
        if (character < " ") clean = false;
        spelled += character;
        continue;
      }

      const escape = this.text[this.at++];
      if (escape === "u" && this.text[this.at] === "{") {
        const end = this.text.indexOf("}", this.at);
        const hex = end === -1 ? "" : this.text.slice(this.at + 1, end);
        const code = /^[0-9a-fA-F]{1,6}$/.test(hex) ? parseInt(hex, 16) : NaN;
        if (!(code <= MAX_CODE_POINT)) this.fail("a \\u{} escape names no character");
        spelled += String.fromCodePoint(code);
        this.at = end + 1;
        clean = false;
      } else if (escape === "u" || escape === "x") {
        const width = escape === "u" ? 4 : 2;
        const hex = this.text.slice(this.at, this.at + width);
        if (!new RegExp(`^[0-9a-fA-F]{${width}}$`).test(hex)) {
          this.fail(`a \\${escape} escape needs ${width} hex digits`);
        }
        spelled += String.fromCharCode(parseInt(hex, 16));
        this.at += width;
        if (escape === "x") clean = false;
      } else if (escape === "\n" || escape === "\r") {
        if (escape === "\r" && this.text[this.at] === "\n") this.at++;
        clean = false;
      } else if (escape !== undefined) {
        spelled += JS_ESCAPES[escape] ?? escape;
        if (!JSON_ESCAPES.has(escape)) clean = false;
      }
    }

    if (quote === "'") this.fix("singleQuote");
    else if (!clean) this.fix("escape");
    const text = clean ? this.text.slice(start, this.at) : JSON.stringify(spelled);
    return { kind: "scalar", type: "string", text };
  }

  private number(): JsonNode {
    const written = this.take(LOOSE_NUMBER);
    if (written === null) return this.fail(`unexpected ${JSON.stringify(this.peek())}`);
    if (STRICT_NUMBER.test(written)) return { kind: "scalar", type: "number", text: written };

    if (/(?:Infinity|NaN)$/.test(written)) {
      this.fix("nonFinite");
      return { kind: "scalar", type: "null", text: "null" };
    }

    this.fix("number");
    const negative = written.startsWith("-");
    const unsigned = written.replace(/^[+-]/, "");
    if (/^0[xX]/.test(unsigned)) return numberScalar(`${negative ? "-" : ""}${BigInt(unsigned).toString()}`);

    const [, whole, fraction, exponent] = /^(\d*)\.?(\d*)(.*)$/.exec(unsigned)!;
    const integer = whole.replace(/^0+(?=\d)/, "") || "0";
    return numberScalar(`${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}${exponent}`);
  }

  private word(): JsonNode {
    const start = this.at;
    const word = this.take(WORD)!;
    if (word === "true" || word === "false" || word === "null") return { kind: "scalar", type: word, text: word };

    const literal = LITERALS[word];
    if (literal) {
      this.fix("literal");
      return { kind: "scalar", type: literal, text: literal };
    }
    if (word === "Infinity" || word === "NaN") {
      this.fix("nonFinite");
      return { kind: "scalar", type: "null", text: "null" };
    }

    this.at = start;
    return this.fail(`unexpected ${JSON.stringify(word)}`);
  }

  private take(pattern: RegExp): string | null {
    pattern.lastIndex = this.at;
    const match = pattern.exec(this.text);
    if (!match) return null;
    this.at += match[0].length;
    return match[0];
  }
}

const MAX_CODE_POINT = 0x10ffff;

const JSON_BLANK = new Set([" ", "\t", "\n", "\r"]);

const numberScalar = (text: string): JsonNode => ({ kind: "scalar", type: "number", text });

const STRICT_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const LOOSE_NUMBER = /[+-]?(?:Infinity|NaN|0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
const NUMBER_START = /^[-+.\d]$/;
const WORD = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const WORD_START = /^[\p{L}_$]$/u;
const BARE_KEY = /[\p{L}\p{N}_$]+/uy;
const KEY_START = /^["'\p{L}\p{N}_$]$/u;
const VALUE_START = /^["'{[\-+.\d\p{L}_$]$/u;

const LITERALS: Record<string, "true" | "false" | "null"> = {
  True: "true",
  False: "false",
  None: "null",
  undefined: "null",
};

const JSON_ESCAPES = new Set(["\"", "\\", "/", "b", "f", "n", "r", "t", "u"]);

const JS_ESCAPES: Record<string, string> = {
  "\"": "\"",
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  0: "\0",
};
