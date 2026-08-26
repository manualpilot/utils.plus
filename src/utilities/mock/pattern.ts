import type { Rng } from "./seed";

export function stringFromPattern(rng: Rng, source: string): string | null {
  try {
    const reader = new Reader(source);
    const node = reader.readAlternation();
    if (!reader.done) return null;
    const value = render(rng, node);
    return new RegExp(`^(?:${source})$`).test(value) ? value : null;
  } catch {
    return null;
  }
}

type Node =
  | { type: "alt"; options: Node[] }
  | { type: "seq"; items: Node[] }
  | { type: "repeat"; node: Node; min: number; max: number }
  | { type: "chars"; set: string }
  | { type: "literal"; text: string };

class Reader {
  private at = 0;

  constructor(private readonly source: string) {}

  get done(): boolean {
    return this.at >= this.source.length;
  }

  readAlternation(): Node {
    const options: Node[] = [this.readSequence()];
    while (this.peek() === "|") {
      this.at++;
      options.push(this.readSequence());
    }
    return options.length === 1 ? options[0] : { type: "alt", options };
  }

  private readSequence(): Node {
    const items: Node[] = [];
    while (!this.done && this.peek() !== "|" && this.peek() !== ")") items.push(this.readQuantified());
    return { type: "seq", items };
  }

  private readQuantified(): Node {
    const node = this.readAtom();
    const quantifier = this.readQuantifier();
    if (!quantifier) return node;
    if (this.peek() === "?" || this.peek() === "+") this.at++;
    return { type: "repeat", node, min: quantifier.min, max: quantifier.max };
  }

  private readQuantifier(): { min: number; max: number } | null {
    const character = this.peek();
    if (character === "?") return (this.at++, { min: 0, max: 1 });
    if (character === "*") return (this.at++, { min: 0, max: OPEN_REPEAT });
    if (character === "+") return (this.at++, { min: 1, max: OPEN_REPEAT });
    if (character !== "{") return null;

    const counted = /^\{(\d+)(,(\d*)?)?\}/.exec(this.source.slice(this.at));
    if (!counted) return null;
    this.at += counted[0].length;

    const min = Number(counted[1]);
    const max = counted[2] === undefined ? min : counted[3] ? Number(counted[3]) : min + OPEN_REPEAT;
    if (min > max || max > MAX_REPEAT) throw new Error("unreasonable quantifier");
    return { min, max };
  }

  private readAtom(): Node {
    const character = this.source[this.at];

    if (character === "^" || character === "$") return (this.at++, { type: "seq", items: [] });

    if (character === "(") {
      this.at++;
      if (this.source.startsWith("?", this.at)) {
        const named = /^\?<[A-Za-z_$][\w$]*>/.exec(this.source.slice(this.at));
        if (this.source.startsWith("?:", this.at)) this.at += 2;
        else if (named) this.at += named[0].length;
        else throw new Error("lookaround");
      }
      const inner = this.readAlternation();
      if (this.source[this.at] !== ")") throw new Error("unclosed group");
      this.at++;
      return inner;
    }

    if (character === "[") return this.readClass();
    if (character === ".") return (this.at++, { type: "chars", set: ANY });
    if (character === ")" || character === "*" || character === "+" || character === "?") {
      throw new Error("nothing to repeat");
    }
    if (character === "\\") return this.readEscape();

    this.at++;
    return { type: "literal", text: character };
  }

  private readClass(): Node {
    this.at++;
    const negated = this.peek() === "^";
    if (negated) this.at++;

    let set = "";
    while (!this.done && this.peek() !== "]") {
      if (this.peek() === "\\") {
        const escape = this.readEscape();
        set += escape.type === "chars" ? escape.set : escape.text;
        continue;
      }

      const from = this.source[this.at++];
      if (this.peek() === "-" && this.source[this.at + 1] !== "]" && this.at + 1 < this.source.length) {
        this.at++;
        const to = this.source[this.at] === "\\" ? this.source[++this.at] : this.source[this.at];
        this.at++;
        for (let code = from.charCodeAt(0); code <= to.charCodeAt(0); code++) set += String.fromCharCode(code);
      } else {
        set += from;
      }
    }

    if (this.done) throw new Error("unclosed class");
    this.at++;
    const chosen = negated ? [...ANY].filter((character) => !set.includes(character)).join("") : set;
    if (!chosen) throw new Error("empty class");
    return { type: "chars", set: chosen };
  }

  private readEscape(): { type: "chars"; set: string } | { type: "literal"; text: string } {
    this.at++;
    const character = this.source[this.at++];
    if (character === undefined) throw new Error("trailing backslash");

    if (/[1-9kbB]/.test(character)) throw new Error("backreference or boundary");

    const named = CLASS_ESCAPES[character];
    if (named) return { type: "chars", set: named };
    return { type: "literal", text: LITERAL_ESCAPES[character] ?? character };
  }

  private peek(): string | undefined {
    return this.source[this.at];
  }
}

function render(rng: Rng, node: Node): string {
  switch (node.type) {
    case "literal":
      return node.text;
    case "chars":
      return node.set[rng.below(node.set.length)];
    case "seq":
      return node.items.map((item) => render(rng, item)).join("");
    case "alt":
      return render(rng, rng.pick(node.options));
    case "repeat": {
      const count = rng.between(node.min, Math.min(node.max, node.min + OPEN_REPEAT));
      return Array.from({ length: count }, () => render(rng, node.node)).join("");
    }
  }
}

const DIGITS = "0123456789";

const WORD = `${DIGITS}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_`;

const ANY = Array.from({ length: 94 }, (_unused, index) => String.fromCharCode(33 + index)).join("");

const CLASS_ESCAPES: Record<string, string> = {
  d: DIGITS,
  D: [...ANY].filter((character) => !DIGITS.includes(character)).join(""),
  w: WORD,
  W: [...ANY].filter((character) => !WORD.includes(character)).join(""),
  s: " ",
  S: ANY,
};

const LITERAL_ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", f: "\f", v: "\v", "0": "\0" };

const OPEN_REPEAT = 4;

const MAX_REPEAT = 512;
