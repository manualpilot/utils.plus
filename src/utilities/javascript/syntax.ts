export function unfinished(source: string): boolean {
  const brackets: string[] = [];
  const templates: number[] = [];
  let value = false;

  for (let at = 0; at < source.length; at++) {
    const char = source[at];
    const next = source[at + 1];

    if (char === "/" && next === "/") {
      at = end(source, at, "\n");
      value = false;
    } else if (char === "/" && next === "*") {
      const closed = source.indexOf("*/", at + 2);
      if (closed === -1) return true;
      at = closed + 1;
      value = false;
    } else if (char === "\"" || char === "'") {
      const closed = quoted(source, at, char);
      if (closed === -1) return true;
      at = closed;
      value = true;
    } else if (char === "`") {
      templates.push(brackets.length);
      const closed = template(source, at);
      if (closed === -1) return true;
      if (source[closed] === "{") {
        brackets.push("{");
        at = closed;
        value = false;
        continue;
      }
      templates.pop();
      at = closed;
      value = true;
    } else if (char === "/" && !value) {
      const closed = regex(source, at);
      if (closed === -1) return true;
      at = closed;
      value = true;
    } else if (char === "(" || char === "[" || char === "{") {
      brackets.push(char);
      value = false;
    } else if (char === ")" || char === "]" || char === "}") {
      if (brackets.length > 0) brackets.pop();
      if (char === "}" && templates.length > 0 && templates[templates.length - 1] === brackets.length) {
        templates.pop();
        const closed = resume(source, at);
        if (closed === -1) return true;
        if (source[closed] === "{") {
          templates.push(brackets.length);
          brackets.push("{");
          at = closed;
          value = false;
          continue;
        }
        at = closed;
      }
      value = true;
    } else if (WORD.test(char)) {
      value = !KEYWORD_END.test(source.slice(0, at + 1));
    } else if (!WHITESPACE.test(char)) {
      value = false;
    }
  }

  return brackets.length > 0 || templates.length > 0;
}

function quoted(source: string, from: number, quote: string): number {
  for (let at = from + 1; at < source.length; at++) {
    if (source[at] === "\\") at++;
    else if (source[at] === quote) return at;
    else if (source[at] === "\n") return -1;
  }
  return -1;
}

function template(source: string, from: number): number {
  return resume(source, from);
}

function resume(source: string, from: number): number {
  for (let at = from + 1; at < source.length; at++) {
    if (source[at] === "\\") at++;
    else if (source[at] === "`") return at;
    else if (source[at] === "$" && source[at + 1] === "{") return at + 1;
  }
  return -1;
}

function regex(source: string, from: number): number {
  let inClass = false;
  for (let at = from + 1; at < source.length; at++) {
    const char = source[at];
    if (char === "\\") at++;
    else if (char === "\n") return -1;
    else if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) return at;
  }
  return -1;
}

function end(source: string, from: number, mark: string): number {
  const at = source.indexOf(mark, from);
  return at === -1 ? source.length : at;
}

const WHITESPACE = /\s/;

const WORD = /[\w$]/;

const KEYWORD_END = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await|throw)$/;
