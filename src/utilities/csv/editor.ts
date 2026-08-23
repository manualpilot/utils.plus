import { StreamLanguage, type StringStream } from "@codemirror/language";
import type { Extension } from "@uiw/react-codemirror";
import { EDITOR_SURFACE } from "../../common/editor-theme";

function csvLanguage(delimiter: string) {
  return StreamLanguage.define<QuoteState>({
    name: "csv",
    startState: () => ({ inQuotes: false, atFieldStart: true }),

    token(stream, state) {
      if (state.inQuotes) return takeQuoted(stream, state);

      if (stream.sol()) state.atFieldStart = true;

      if (stream.eat(delimiter)) {
        state.atFieldStart = true;
        return "separator";
      }

      if (state.atFieldStart && stream.eat("\"")) {
        state.inQuotes = true;
        state.atFieldStart = false;
        return takeQuoted(stream, state);
      }

      state.atFieldStart = false;
      while (!stream.eol() && stream.peek() !== delimiter) stream.next();
      if (stream.current() === "") stream.next();

      return NUMBER.test(stream.current()) ? "number" : null;
    },
  });
}

interface QuoteState {
  inQuotes: boolean;
  atFieldStart: boolean;
}

function takeQuoted(stream: StringStream, state: QuoteState): string {
  while (!stream.eol()) {
    if (stream.next() !== "\"") continue;
    if (stream.peek() === "\"") {
      stream.next();
      continue;
    }
    state.inQuotes = false;
    break;
  }
  return "string";
}

const HELD = new Map<string, Extension[]>();

export function editorExtensions(delimiter: string): Extension[] {
  const held = HELD.get(delimiter);
  if (held) return held;

  const built = [csvLanguage(delimiter), ...EDITOR_SURFACE];
  HELD.set(delimiter, built);
  return built;
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
