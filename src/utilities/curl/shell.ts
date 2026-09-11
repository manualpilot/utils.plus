export type Shell = "bash" | "cmd";

export interface Word {
  text: string;
  quoted: boolean;
  variables: string[];
}

export interface Split {
  words: Word[];
  error: string | null;
  shell: Shell;
}

export const UNTERMINATED_QUOTE = "A quote in the command is never closed";
export const POWERSHELL =
  "A line ending in a backtick is PowerShell's, which the page does not read: write the command for bash or cmd";

export function splitWords(source: string): Split {
  const words: Word[] = [];
  let text = "";
  let started = false;
  let quoted = false;
  let variables: string[] = [];
  let at = 0;

  const finish = () => {
    if (!started) return;
    words.push({ text, quoted, variables });
    text = "";
    started = false;
    quoted = false;
    variables = [];
  };

  const unterminated = (): Split => ({ words, error: UNTERMINATED_QUOTE, shell: "bash" });

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
      if (end < 0) return unterminated();
      started = true;
      quoted = true;
      text += source.slice(at + 1, end);
      at = end + 1;
      continue;
    }

    if (char === "\"") {
      const read = readDouble(source, at + 1);
      if (!read) return unterminated();
      started = true;
      quoted = true;
      text += read.text;
      variables.push(...read.variables);
      at = read.at;
      continue;
    }

    if (char === "$" && source[at + 1] === "'") {
      const read = readAnsi(source, at + 2);
      if (!read) return unterminated();
      started = true;
      quoted = true;
      text += read.text;
      at = read.at;
      continue;
    }

    if (char === "$" && source[at + 1] === "\"") {
      const read = readDouble(source, at + 2);
      if (!read) return unterminated();
      started = true;
      quoted = true;
      text += read.text;
      variables.push(...read.variables);
      at = read.at;
      continue;
    }

    const reference = char === "$" ? referenceAt(source, at) : null;
    if (reference) {
      started = true;
      text += reference;
      variables.push(reference);
      at += reference.length;
      continue;
    }

    if (char === "^" && isOneOf(source[at + 1], "\"\r\n")) return splitCmd(source);

    if (char === "`" && isOneOf(source[at + 1], "\r\n")) return { words, error: POWERSHELL, shell: "bash" };

    started = true;
    text += char;
    at += 1;
  }

  finish();
  return { words, error: null, shell: "bash" };
}

export function quoteWord(value: string, variables: readonly string[] = []): string {
  if (value === "") return "''";
  if (PLAIN.test(value)) return value;
  if (holdsVariable(value, variables)) return quoteDouble(value, variables);
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function quoteCmd(value: string, variables: readonly string[] = []): string {
  let out = "";

  for (let at = 0; at < value.length;) {
    const reference = liveAt(value, at, variables);
    if (reference) {
      out += reference;
      at += reference.length;
      continue;
    }

    const char = value[at];

    if (char === "\\") {
      let end = at;
      while (value[end] === "\\") end += 1;
      out += "\\".repeat(end === value.length || value[end] === "\"" ? (end - at) * 2 : end - at);
      at = end;
      continue;
    }

    if (char === "\r" || char === "\n") {
      out += "^\n\n";
      at += char === "\r" && value[at + 1] === "\n" ? 2 : 1;
      continue;
    }

    if (char === "%") out += /\w/.test(value[at + 1] ?? "") ? "%^" : "%";
    else if (char === "\"") out += "^\\^\"";
    else out += CMD_SPECIAL.includes(char) ? `^${char}` : char;
    at += 1;
  }

  return `^"${out}^"`;
}

const PLAIN = /^[A-Za-z0-9_@%+=:,./-]+$/;

const SPACE = /\s/;

const DOUBLE_ESCAPES = "\"\\$`";

const REFERENCE = /\$(?:[A-Za-z_]\w*|\{[^}]+\})/y;

const PERCENT = /%[A-Za-z_]\w*%/g;

const CMD_SPECIAL = "^&|<>!";

const CMD_OPERATORS = "&|<>";

function isOneOf(char: string | undefined, chars: string): boolean {
  return char !== undefined && chars.includes(char);
}

function referenceAt(source: string, at: number): string | null {
  REFERENCE.lastIndex = at;
  return REFERENCE.exec(source)?.[0] ?? null;
}

function liveAt(value: string, at: number, variables: readonly string[]): string | null {
  for (const reference of variables) {
    if (!value.startsWith(reference, at)) continue;
    if (/\w$/.test(reference) && /\w/.test(value[at + reference.length] ?? "")) continue;
    return reference;
  }
  return null;
}

function holdsVariable(value: string, variables: readonly string[]): boolean {
  for (let at = 0; at < value.length; at += 1) {
    if (liveAt(value, at, variables)) return true;
  }
  return false;
}

function quoteDouble(value: string, variables: readonly string[]): string {
  let out = "";

  for (let at = 0; at < value.length;) {
    const reference = liveAt(value, at, variables);
    if (reference) {
      out += reference;
      at += reference.length;
      continue;
    }

    const char = value[at];
    if (char === "!") out += "\"\\!\"";
    else out += DOUBLE_ESCAPES.includes(char) ? `\\${char}` : char;
    at += 1;
  }

  return `"${out}"`;
}

function readDouble(source: string, from: number): Read | null {
  let text = "";
  const variables: string[] = [];
  let at = from;

  while (at < source.length) {
    const char = source[at];
    if (char === "\"") return { text, at: at + 1, variables };

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

    const reference = char === "$" ? referenceAt(source, at) : null;
    if (reference) {
      text += reference;
      variables.push(reference);
      at += reference.length;
      continue;
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
    if (char === "'") return { text, at: at + 1, variables: [] };

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
  variables: string[];
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

function splitCmd(source: string): Split {
  const line = source.replace(/\r/g, "");
  const references = new Map<number, string>();
  for (const match of line.matchAll(PERCENT)) references.set(match.index, match[0]);

  let handed = "";
  const live = new Map<number, string>();
  const escaped = new Set<number>();
  let quoting = false;
  let operator: string | null = null;
  let at = 0;

  const take = (index: number, escape: boolean): number => {
    const reference = references.get(index);
    if (reference) {
      live.set(handed.length, reference);
      handed += reference;
      return reference.length;
    }
    if (escape) escaped.add(handed.length);
    handed += line[index];
    return 1;
  };

  while (at < line.length) {
    const char = line[at];

    if (char === "\n") {
      if (line.slice(at).trim() !== "") operator = "&";
      break;
    }

    if (references.has(at)) {
      at += take(at, false);
      continue;
    }

    if (quoting) {
      if (char === "\"") quoting = false;
      handed += char;
      at += 1;
      continue;
    }

    if (char === "^") {
      let next = at + 1;
      if (line[next] === "\n") next += 1;
      if (next >= line.length) break;
      at = next + take(next, true);
      continue;
    }

    if (CMD_OPERATORS.includes(char)) {
      operator = char;
      break;
    }

    if (char === "\"") quoting = true;
    handed += char;
    at += 1;
  }

  const words = splitArguments(handed, live, escaped);
  if (operator) words.push({ text: operator, quoted: false, variables: [] });
  return { words, error: null, shell: "cmd" };
}

function splitArguments(handed: string, live: Map<number, string>, escaped: Set<number>): Word[] {
  const words: Word[] = [];
  let text = "";
  let started = false;
  let quoted = false;
  let variables: string[] = [];
  let inside = false;
  let at = 0;

  const finish = () => {
    if (!started) return;
    words.push({ text, quoted, variables });
    text = "";
    started = false;
    quoted = false;
    variables = [];
  };

  while (at < handed.length) {
    const reference = live.get(at);
    if (reference) {
      started = true;
      text += reference;
      variables.push(reference);
      at += reference.length;
      continue;
    }

    const char = handed[at];

    if (!inside && (char === " " || char === "\t")) {
      finish();
      at += 1;
      continue;
    }

    started = true;
    if (escaped.has(at)) quoted = true;

    if (char === "\\") {
      let end = at;
      while (handed[end] === "\\") end += 1;
      const count = end - at;
      if (handed[end] !== "\"") {
        text += "\\".repeat(count);
        at = end;
        continue;
      }
      text += "\\".repeat(count >> 1);
      if (count % 2 === 1) {
        text += "\"";
        at = end + 1;
        continue;
      }
      at = end;
      continue;
    }

    if (char === "\"") {
      quoted = true;
      if (inside && handed[at + 1] === "\"") {
        text += "\"";
        at += 2;
        continue;
      }
      inside = !inside;
      at += 1;
      continue;
    }

    text += char;
    at += 1;
  }

  finish();
  return words;
}
