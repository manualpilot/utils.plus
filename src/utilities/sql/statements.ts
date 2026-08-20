import type { ModeId } from "./engine";

export interface Statement {
  sql: string;
  line: number;
}

export function splitStatements(text: string, dialect: ModeId): Statement[] {
  const statements: Statement[] = [];
  let start = 0;
  let line = 1;
  let startLine = 1;
  let content = false;
  let depth = 0;
  let trigger = false;
  let head = "";

  const mark = () => {
    if (content) return;
    content = true;
    startLine = line;
  };

  const cut = (end: number) => {
    const sql = text.slice(start, end).trim();
    if (content && sql) statements.push({ sql, line: startLine });
    start = end;
    content = false;
    depth = 0;
    trigger = false;
    head = "";
  };

  for (let i = 0; i < text.length;) {
    const char = text[i];

    if (char === "\n") {
      i++;
      line++;
      continue;
    }

    if (char === "-" && text[i + 1] === "-") {
      i = skipTo(text, i + 2, "\n");
      continue;
    }

    if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      line += countNewlines(text, i, stop);
      i = stop;
      continue;
    }

    const dollar = dialect === "postgres" ? DOLLAR_TAG.exec(text.slice(i)) : null;
    if (dollar) {
      mark();
      const tag = dollar[0];
      const end = text.indexOf(tag, i + tag.length);
      const stop = end === -1 ? text.length : end + tag.length;
      line += countNewlines(text, i, stop);
      i = stop;
      continue;
    }

    if (char === "'") {
      mark();
      const escapes = dialect === "postgres" && ESCAPE_STRING.test(text.slice(Math.max(0, i - 2), i));
      const stop = skipQuoted(text, i, "'", escapes);
      line += countNewlines(text, i, stop);
      i = stop;
      continue;
    }

    if (char === "\"" || (dialect === "sqlite" && char === "`")) {
      mark();
      const stop = skipQuoted(text, i, char, false);
      line += countNewlines(text, i, stop);
      i = stop;
      continue;
    }

    if (dialect === "sqlite" && char === "[") {
      mark();
      const end = text.indexOf("]", i + 1);
      const stop = end === -1 ? text.length : end + 1;
      line += countNewlines(text, i, stop);
      i = stop;
      continue;
    }

    if (char === ";") {
      i++;
      if (!(trigger && depth > 0)) cut(i);
      continue;
    }

    if (WORD_START.test(char)) {
      mark();
      let end = i + 1;
      while (end < text.length && WORD_PART.test(text[end])) end++;
      const word = text.slice(i, end).toLowerCase();
      i = end;

      if (trigger) {
        if (word === "begin" || word === "case") depth++;
        else if (word === "end") depth = Math.max(0, depth - 1);
      } else if (head.length < TRIGGER_HEAD) {
        head = head ? `${head} ${word}` : word;
        trigger = CREATE_TRIGGER.test(head);
      }
      continue;
    }

    if (!SPACE.test(char)) mark();
    i++;
  }

  cut(text.length);
  return statements;
}

export function oneLine(sql: string, limit = 140): string {
  const flat = sql.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

export function commandOf(sql: string): string | null {
  const word = COMMAND.exec(sql);
  return word ? word[1].toUpperCase() : null;
}

function skipTo(text: string, from: number, needle: string): number {
  const end = text.indexOf(needle, from);
  return end === -1 ? text.length : end;
}

function skipQuoted(text: string, from: number, quote: string, escapes: boolean): number {
  for (let i = from + 1; i < text.length; i++) {
    if (escapes && text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] !== quote) continue;
    if (text[i + 1] === quote) {
      i++;
      continue;
    }
    return i + 1;
  }
  return text.length;
}

function countNewlines(text: string, from: number, to: number): number {
  let count = 0;
  for (let i = from; i < to; i++) {
    if (text[i] === "\n") count++;
  }
  return count;
}

const DOLLAR_TAG = /^\$(?:[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/;
const SPACE = /\s/;
const WORD_START = /[A-Za-z_\u0080-\uffff]/;
const WORD_PART = /[A-Za-z0-9_$\u0080-\uffff]/;
const COMMAND = /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*([A-Za-z]+)/;

const ESCAPE_STRING = /(?:^|[^A-Za-z0-9_$])[Ee]$/;

const TRIGGER_HEAD = 40;
const CREATE_TRIGGER = /^create(?: or replace)?(?: temp| temporary)? trigger$/;
