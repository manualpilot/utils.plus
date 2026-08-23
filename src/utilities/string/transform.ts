import { toIdentifierCase, toSentenceCase, toTitleCase } from "./case";
import { decodeEntities, encodeEntities } from "./entities";
import { escapeC, escapeJs, escapeShell, escapeSql, unescapeC, unescapeJs, unquoteShell, unquoteSql } from "./escape";
import { dedupeLines, reverseLines, shuffleLines, sortLines } from "./lines";
import type { Operation } from "./operations";
import { slugify } from "./slug";
import { collapse, parseWidth, trimLines, wrapText } from "./whitespace";

export interface Transformed {
  output: string;
  error: string;
}

export const NOTHING: Transformed = { output: "", error: "" };

export function transform(input: string, operation: Operation, variant: string, width: string): Transformed {
  if (input === "") return NOTHING;
  try {
    return { output: apply(input, operation, variant, width), error: "" };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : "The text could not be transformed" };
  }
}

function apply(input: string, operation: Operation, variant: string, width: string): string {
  switch (operation) {
    case "camel":
    case "pascal":
    case "snake":
    case "constant":
    case "kebab":
      return toIdentifierCase(input, operation);
    case "title":
      return toTitleCase(input, variant);
    case "sentence":
      return toSentenceCase(input);
    case "upper":
      return input.toUpperCase();
    case "lower":
      return input.toLowerCase();
    case "slug":
      return slugify(input, variant);
    case "sort":
      return sortLines(input, variant);
    case "dedupe":
      return dedupeLines(input, variant);
    case "reverse":
      return reverseLines(input, variant);
    case "shuffle":
      return shuffleLines(input);
    case "trim":
      return trimLines(input, variant);
    case "collapse":
      return collapse(input, variant);
    case "wrap":
      return wrapText(input, parseWidth(width), variant);
    case "html":
      return variant === "decode" ? decodeEntities(input) : encodeEntities(input, variant);
    case "javascript":
      return variant === "unescape" ? unescapeJs(input) : escapeJs(input, variant);
    case "c":
      return variant === "unescape" ? unescapeC(input) : escapeC(input, variant);
    case "shell":
      return variant === "unquote" ? unquoteShell(input) : escapeShell(input, variant);
    case "sql":
      return variant === "unquote" ? unquoteSql(input) : escapeSql(input, variant);
  }
}
