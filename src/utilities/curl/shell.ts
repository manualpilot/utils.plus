export interface Word {
  text: string;
  quoted: boolean;
}

export interface Split {
  words: Word[];
  error: string | null;
}

export const UNTERMINATED_QUOTE = "A quote in the command is never closed";

export function splitWords(source: string): Split {
  const words: Word[] = [];
  let text = "";
  let started = false;
  let quoted = false;
  let at = 0;

  const finish = () => {
    if (!started) return;
    words.push({ text, quoted });
    text = "";
    started = false;
    quoted = false;
  };

  while (at < source.length) {
    const char = source[at];

    if (SPACE.test(char)) {
      finish();
      at += 1;
      continue;
    }

    if (char === "#" && !started) {
      while (at < source.length && source[at] !== "\n") at += 1;
      continue;
    }

    if (char === "\\") {
      const next = source[at + 1];
      if (next === undefined) break;
      if (next === "\n") {
        at += 2;
        continue;
      }
      if (next === "\r") {
        at += source[at + 2] === "\n" ? 3 : 2;
        continue;
      }
      started = true;
      text += next;
      at += 2;
      continue;
    }

    if (char === "'") {
      const end = source.indexOf("'", at + 1);
      if (end < 0) return { words, error: UNTERMINATED_QUOTE };
      started = true;
      quoted = true;
      text += source.slice(at + 1, end);
      at = end + 1;
      continue;
    }

    if (char === "\"") {
      const read = readDouble(source, at + 1);
      if (!read) return { words, error: UNTERMINATED_QUOTE };
      started = true;
      quoted = true;
      text += read.text;
      at = read.at;
      continue;
    }

    if (char === "$" && source[at + 1] === "'") {
      const read = readAnsi(source, at + 2);
      if (!read) return { words, error: UNTERMINATED_QUOTE };
      started = true;
      quoted = true;
      text += read.text;
      at = read.at;
      continue;
    }

    if (char === "$" && source[at + 1] === "\"") {
      const read = readDouble(source, at + 2);
      if (!read) return { words, error: UNTERMINATED_QUOTE };
      started = true;
      quoted = true;
      text += read.text;
      at = read.at;
      continue;
    }

    started = true;
    text += char;
    at += 1;
  }

  finish();
  return { words, error: null };
}

export function quoteWord(value: string): string {
  if (value === "") return "''";
  if (PLAIN.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const PLAIN = /^[A-Za-z0-9_@%+=:,./-]+$/;

const SPACE = /\s/;

const DOUBLE_ESCAPES = "\"\\$`";

function readDouble(source: string, from: number): Read | null {
  let text = "";
  let at = from;

  while (at < source.length) {
    const char = source[at];
    if (char === "\"") return { text, at: at + 1 };

    if (char === "\\") {
      const next = source[at + 1];
      if (next === undefined) break;
      if (next === "\n") {
        at += 2;
        continue;
      }
      if (DOUBLE_ESCAPES.includes(next)) {
        text += next;
        at += 2;
        continue;
      }
    }

    text += char;
    at += 1;
  }

  return null;
}

function readAnsi(source: string, from: number): Read | null {
  let text = "";
  let at = from;

  while (at < source.length) {
    const char = source[at];
    if (char === "'") return { text, at: at + 1 };

    if (char !== "\\") {
      text += char;
      at += 1;
      continue;
    }

    const next = source[at + 1];
    if (next === undefined) break;

    const simple = ANSI_ESCAPES[next];
    if (simple !== undefined) {
      text += simple;
      at += 2;
      continue;
    }

    const numeric = NUMERIC.exec(source.slice(at + 1));
    if (numeric) {
      const [whole] = numeric;
      const radix = whole[0] === "x" || whole[0] === "u" || whole[0] === "U" ? 16 : 8;
      const digits = radix === 16 ? whole.slice(1) : whole;
      text += String.fromCodePoint(parseInt(digits, radix));
      at += 1 + whole.length;
      continue;
    }

    text += next;
    at += 2;
  }

  return null;
}

interface Read {
  text: string;
  at: number;
}

const ANSI_ESCAPES: Record<string, string> = {
  a: "\x07",
  b: "\b",
  e: "\x1b",
  E: "\x1b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "\\": "\\",
  "'": "'",
  "\"": "\"",
  "?": "?",
};

const NUMERIC = /^(?:x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|[0-7]{1,3})/;
