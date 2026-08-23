export function escapeJs(text: string, variant: string): string {
  let escaped = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const named = JS_NAMED[character];
    if (named !== undefined) escaped += named;
    else if (code < 0x20 || code === 0x7f) escaped += "\\x" + hex(code, 2);
    else if (code === 0x2028 || code === 0x2029) escaped += "\\u" + hex(code, 4);
    else if (code < 0x80 || variant !== "ascii") escaped += character;
    else for (let unit = 0; unit < character.length; unit++) escaped += "\\u" + hex(character.charCodeAt(unit), 4);
  }
  return escaped;
}

export function unescapeJs(text: string): string {
  let unescaped = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== "\\") {
      unescaped += character;
      index++;
      continue;
    }
    const escape = text[index + 1];
    if (escape === undefined) throw new Error("A backslash at the end of the text escapes nothing");
    index += 2;
    if (escape === "x") {
      const digits = text.slice(index, index + 2);
      if (!/^[0-9a-fA-F]{2}$/.test(digits)) throw new Error("\\x takes two hexadecimal digits");
      unescaped += String.fromCharCode(Number.parseInt(digits, 16));
      index += 2;
    } else if (escape === "u" && text[index] === "{") {
      const close = text.indexOf("}", index);
      const digits = close === -1 ? "" : text.slice(index + 1, close);
      if (!/^[0-9a-fA-F]{1,6}$/.test(digits) || Number.parseInt(digits, 16) > 0x10ffff) {
        throw new Error("\\u{…} takes up to six hexadecimal digits");
      }
      unescaped += String.fromCodePoint(Number.parseInt(digits, 16));
      index = close + 1;
    } else if (escape === "u") {
      const digits = text.slice(index, index + 4);
      if (!/^[0-9a-fA-F]{4}$/.test(digits)) throw new Error("\\u takes four hexadecimal digits");
      unescaped += String.fromCharCode(Number.parseInt(digits, 16));
      index += 4;
    } else if (escape === "\n") {
    } else {
      unescaped += JS_UNNAMED[escape] ?? escape;
    }
  }
  return unescaped;
}

export function escapeC(text: string, variant: string): string {
  let escaped = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const named = C_NAMED[character];
    if (named !== undefined) escaped += named;
    else if (code < 0x20 || code === 0x7f) escaped += "\\" + code.toString(8).padStart(3, "0");
    else if (code < 0x80 || variant !== "ascii") escaped += character;
    else for (const byte of ENCODER.encode(character)) escaped += "\\" + byte.toString(8).padStart(3, "0");
  }
  return escaped;
}

export function unescapeC(text: string): string {
  const bytes: number[] = [];
  const push = (chunk: string) => {
    for (const byte of ENCODER.encode(chunk)) bytes.push(byte);
  };
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== "\\") {
      push(character);
      index++;
      continue;
    }
    const escape = text[index + 1];
    if (escape === undefined) throw new Error("A backslash at the end of the text escapes nothing");
    index += 2;
    if (escape >= "0" && escape <= "7") {
      let digits = escape;
      while (digits.length < 3 && text[index] >= "0" && text[index] <= "7") digits += text[index++];
      bytes.push(Number.parseInt(digits, 8) & 0xff);
    } else if (escape === "x") {
      let digits = "";
      while (/[0-9a-fA-F]/.test(text[index] ?? "")) digits += text[index++];
      if (digits === "") throw new Error("\\x takes at least one hexadecimal digit");
      const value = Number.parseInt(digits, 16);
      if (value > 0xff) throw new Error("\\x is wider than the byte it stands for");
      bytes.push(value);
    } else if (escape === "u" || escape === "U") {
      const width = escape === "u" ? 4 : 8;
      const digits = text.slice(index, index + width);
      if (!new RegExp(`^[0-9a-fA-F]{${width}}$`).test(digits) || Number.parseInt(digits, 16) > 0x10ffff) {
        throw new Error(`\\${escape} takes ${width} hexadecimal digits`);
      }
      push(String.fromCodePoint(Number.parseInt(digits, 16)));
      index += width;
    } else {
      push(C_UNNAMED[escape] ?? escape);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    throw new Error("The escaped bytes are not valid UTF-8 text");
  }
}

export function escapeShell(text: string, variant: string): string {
  if (variant !== "double") return `'${text.replaceAll("'", "'\\''")}'`;
  return `"${text.replace(/[\\"$`]/g, (character) => "\\" + character)}"`;
}

export function unquoteShell(text: string): string {
  let unquoted = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === "'") {
      const close = text.indexOf("'", index + 1);
      if (close === -1) throw new Error("A single quote is never closed");
      unquoted += text.slice(index + 1, close);
      index = close + 1;
    } else if (character === "\"") {
      index++;
      for (;;) {
        const quoted = text[index];
        if (quoted === undefined) throw new Error("A double quote is never closed");
        if (quoted === "\"") {
          index++;
          break;
        }
        if (quoted === "\\" && SHELL_ESCAPABLE.includes(text[index + 1] ?? "")) {
          unquoted += text[index + 1];
          index += 2;
        } else if (quoted === "\\" && text[index + 1] === "\n") index += 2;
        else {
          unquoted += quoted;
          index++;
        }
      }
    } else if (character === "\\") {
      const escaped = text[index + 1];
      if (escaped === undefined) throw new Error("A backslash at the end of the text escapes nothing");
      if (escaped !== "\n") unquoted += escaped;
      index += 2;
    } else {
      unquoted += character;
      index++;
    }
  }
  return unquoted;
}

export function escapeSql(text: string, variant: string): string {
  if (variant !== "mysql") return `'${text.replaceAll("'", "''")}'`;
  return `'${text.replace(/[\0\b\n\r\t\x1a\\'"]/g, (character) => MYSQL[character])}'`;
}

export function unquoteSql(text: string): string {
  const literal = text.trim();
  if (literal.length < 2 || !literal.startsWith("'") || !literal.endsWith("'")) {
    throw new Error("A SQL string literal is written between single quotes");
  }
  return literal.slice(1, -1).replaceAll("''", "'");
}

const ENCODER = new TextEncoder();

function hex(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, "0");
}

const JS_NAMED: Record<string, string> = {
  "\\": "\\\\",
  "\"": "\\\"",
  "'": "\\'",
  "`": "\\`",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\v": "\\v",
  "\f": "\\f",
  "\r": "\\r",
};

const JS_UNNAMED: Record<string, string> = { b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r", "0": "\0" };

const C_NAMED: Record<string, string> = {
  "\\": "\\\\",
  "\"": "\\\"",
  "'": "\\'",
  "\x07": "\\a",
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\v": "\\v",
  "\f": "\\f",
  "\r": "\\r",
};

const C_UNNAMED: Record<string, string> = { a: "\x07", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r" };

const SHELL_ESCAPABLE = "\\\"$`";

const MYSQL: Record<string, string> = {
  "\0": "\\0",
  "\b": "\\b",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\x1a": "\\Z",
  "\\": "\\\\",
  "'": "\\'",
  "\"": "\\\"",
};
