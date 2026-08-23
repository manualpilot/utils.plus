import type { Command, Entry } from "./entries";
import { findLong, findShort, URL_FLAG } from "./options";
import { splitWords, type Word } from "./shell";

export const NOT_CURL = "The command has to start with curl";
export const MANY_COMMANDS = "One command at a time: take off the pipe, the redirect or the --next";

export function parseCurl(source: string): Command {
  const { words, error } = splitWords(source);
  if (error) return { entries: [], error };

  let at = 0;

  if (words[at] && !words[at].quoted && PROMPTS.has(words[at].text)) at += 1;

  if (at >= words.length) return { entries: [], error: null };
  if (!CURL.test(words[at].text)) return { entries: [], error: NOT_CURL };
  at += 1;

  const entries: Entry[] = [];

  const takeValue = (): string => {
    const next = words[at];
    if (!next || isOperator(next)) return "";
    at += 1;
    return next.text;
  };

  while (at < words.length) {
    const word = words[at];
    at += 1;

    if (isOperator(word)) return { entries: [], error: MANY_COMMANDS };

    const { text } = word;

    if (text.startsWith("--")) {
      const split = text.indexOf("=");
      const flag = split < 0 ? text : text.slice(0, split);
      const inline = split < 0 ? null : text.slice(split + 1);

      if (flag === URL_FLAG) {
        entries.push({ kind: "url", value: inline ?? takeValue(), flag });
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

      entries.push({ kind: "option", name: spec.name, flag, value: inline ?? takeValue() });
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
        entries.push({ kind: "option", name: spec.name, flag: `-${letter}`, value: rest === "" ? takeValue() : rest });
        cursor = text.length;
      }

      continue;
    }

    entries.push({ kind: "url", value: text, flag: null });
  }

  return { entries, error: null };
}

const CURL = /(^|[/\\])curl(\.exe)?$/i;

const PROMPTS = new Set(["$", "%"]);

const OPERATORS = new Set(["|", "||", "&&", ";", "&", "<", ">", ">>", "2>", "2>&1", "&>", "--next", "-:"]);

function isOperator(word: Word): boolean {
  return !word.quoted && OPERATORS.has(word.text);
}
