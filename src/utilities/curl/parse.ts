import type { Command, Entry } from "./entries";
import { findLong, findShort, URL_FLAG } from "./options";
import { splitWords, type Word } from "./shell";

export const NOT_CURL = "The command has to start with curl";
export const MANY_COMMANDS = "One command at a time: take off the pipe, the redirect or the --next";

export function parseCurl(source: string): Command {
  const { words, error, shell } = splitWords(source);
  if (error) return { entries: [], error, shell };

  let at = 0;

  if (words[at] && !words[at].quoted && PROMPTS.has(words[at].text)) at += 1;

  if (at >= words.length) return { entries: [], error: null, shell };
  if (!CURL.test(words[at].text)) return { entries: [], error: NOT_CURL, shell };
  at += 1;

  const entries: Entry[] = [];

  const takeValue = (): Value => {
    const next = words[at];
    if (!next || isOperator(next)) return { value: "" };
    at += 1;
    return valueOf(next.text, next);
  };

  while (at < words.length) {
    const word = words[at];
    at += 1;

    if (isOperator(word)) return { entries: [], error: MANY_COMMANDS, shell };

    const { text } = word;

    if (text.startsWith("--")) {
      const split = text.indexOf("=");
      const flag = split < 0 ? text : text.slice(0, split);
      const inline = split < 0 ? null : valueOf(text.slice(split + 1), word);

      if (flag === URL_FLAG) {
        entries.push({ kind: "url", ...(inline ?? takeValue()), flag });
        continue;
      }

      const spec = findLong(flag);
      if (!spec) {
        entries.push({ kind: "unknown", flag });
        continue;
      }

      if (spec.value === "none") {
        entries.push({ kind: "option", name: spec.name, flag, value: "" });
        continue;
      }

      entries.push({ kind: "option", name: spec.name, flag, ...(inline ?? takeValue()) });
      continue;
    }

    if (text.startsWith("-") && text.length > 1) {
      let cursor = 1;

      while (cursor < text.length) {
        const letter = text[cursor];
        cursor += 1;

        const spec = findShort(letter);
        if (!spec) {
          entries.push({ kind: "unknown", flag: `-${letter}` });
          continue;
        }

        if (spec.value === "none") {
          entries.push({ kind: "option", name: spec.name, flag: `-${letter}`, value: "" });
          continue;
        }

        const rest = text.slice(cursor);
        const value = rest === "" ? takeValue() : valueOf(rest, word);
        entries.push({ kind: "option", name: spec.name, flag: `-${letter}`, ...value });
        cursor = text.length;
      }

      continue;
    }

    entries.push({ kind: "url", ...valueOf(text, word), flag: null });
  }

  return { entries, error: null, shell };
}

interface Value {
  value: string;
  variables?: string[];
}

function valueOf(value: string, word: Word): Value {
  return word.variables.length === 0 ? { value } : { value, variables: word.variables };
}

const CURL = /(^|[/\\])curl(\.exe)?$/i;

const PROMPTS = new Set(["$", "%"]);

const OPERATORS = new Set(["|", "||", "&&", ";", "&", "<", ">", ">>", "2>", "2>&1", "&>", "--next", "-:"]);

function isOperator(word: Word): boolean {
  return !word.quoted && OPERATORS.has(word.text);
}
