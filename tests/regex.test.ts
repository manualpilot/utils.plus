import { describe, expect, it } from "vitest";
import { type ExplainNode, explainPattern } from "../src/utilities/regex/explain";
import { chooseFlags, normaliseFlags } from "../src/utilities/regex/flags";
import { findMatches, summarise } from "../src/utilities/regex/match";

function found(source: string, flags: string, text: string): string[] {
  const result = findMatches(source, flags, text);
  expect(result.error).toBeNull();

  return result.matches.map((match) => {
    const groups = match.groups.map((group) => `${group.index}=${text.slice(group.from, group.to)}`);
    return [text.slice(match.from, match.to), ...groups].join(" ");
  });
}

describe("finding matches", () => {
  it("finds every one of them with the global flag, and the first alone without it", () => {
    expect(found("an", "g", "banana")).toEqual(["an", "an"]);
    expect(found("an", "", "banana")).toEqual(["an"]);
  });

  it("reports where each capturing group landed", () => {
    expect(found("(\\w+)@(\\w+)", "g", "a@b c@d")).toEqual(["a@b 1=a 2=b", "c@d 1=c 2=d"]);
  });

  it("leaves out a group that took no part in the match", () => {
    expect(found("(a)|(b)", "g", "ab")).toEqual(["a 1=a", "b 2=b"]);
  });

  it("steps past a match that consumed nothing rather than finding it forever", () => {
    expect(found("a*", "g", "bab")).toEqual(["", "a", "", ""]);
  });

  it("keeps matching from where the last one ended with the sticky flag", () => {
    expect(found("ab", "y", "ababc")).toEqual(["ab", "ab"]);
    expect(found("ab", "y", "cabab")).toEqual([]);
  });

  it("obeys the flags it is given", () => {
    expect(found("HELLO", "gi", "hello Hello")).toEqual(["hello", "Hello"]);
    expect(found("^b", "gm", "a\nb")).toEqual(["b"]);
    expect(found("^b", "g", "a\nb")).toEqual([]);
  });

  it("hands back what RegExp said rather than throwing", () => {
    const result = findMatches("(unclosed", "", "text");
    expect(result.error).toBeTruthy();
    expect(result.matches).toEqual([]);
  });

  it("searches for nothing until there is a pattern", () => {
    const result = findMatches("", "g", "text");
    expect(result).toEqual({ matches: [], error: null, truncated: false });
  });

  it("stops at the cap and says so", () => {
    const result = findMatches("a", "g", "a".repeat(6000));
    expect(result.matches).toHaveLength(5000);
    expect(summarise(result)).toBe("5000 matches, and the search stopped there");
  });

  it("counts what it found", () => {
    expect(summarise(findMatches("z", "g", "abc"))).toBe("No matches");
    expect(summarise(findMatches("a", "g", "abc"))).toBe("1 match");
    expect(summarise(findMatches("[ab]", "g", "abc"))).toBe("2 matches");
  });
});

describe("flags", () => {
  it("keeps the letters it knows, once each and in the order a literal writes them", () => {
    expect(normaliseFlags("mig")).toBe("gim");
    expect(normaliseFlags("ggi")).toBe("gi");
    expect(normaliseFlags("gQ!")).toBe("g");
  });

  it("lets the one just turned on take the other of u and v off", () => {
    expect(chooseFlags("gu", ["g", "u", "v"])).toBe("gv");
    expect(chooseFlags("gv", ["g", "v", "u"])).toBe("gu");
    expect(chooseFlags("gu", ["g"])).toBe("g");
  });
});

function outline(source: string, flags = ""): string[] {
  const explanation = explainPattern(source, flags);
  expect(explanation.error).toBeNull();

  const lines: string[] = [];
  const walk = (nodes: ExplainNode[], depth: number) => {
    for (const node of nodes) {
      lines.push(`${"  ".repeat(depth)}${node.raw} — ${node.label}`);
      walk(node.children, depth + 1);
    }
  };
  walk(explanation.nodes, 0);

  return lines;
}

describe("explaining a pattern", () => {
  it("runs neighbouring literals together", () => {
    expect(outline("abc")).toEqual(["abc — Literal text"]);
    expect(outline("a.b")).toEqual(["a — Literal character", ". — Any character", "b — Literal character"]);
  });

  it("says what an escape stands for", () => {
    const [node] = explainPattern("\\x41", "").nodes;
    expect(node.raw).toBe("\\x41");
    expect(node.detail).toBe("U+0041");
  });

  it("puts what is repeated under the repetition", () => {
    expect(outline("a+")).toEqual(["a+ — Repeat one or more times", "  a — Literal character"]);
    expect(outline("a{2,4}")).toEqual(["a{2,4} — Repeat between 2 and 4 times", "  a — Literal character"]);
    expect(outline("a?")).toEqual(["a? — Repeat once or not at all", "  a — Literal character"]);
    expect(outline("a*")).toEqual(["a* — Repeat any number of times, including none", "  a — Literal character"]);
    expect(outline("a{3}")).toEqual(["a{3} — Repeat exactly 3 times", "  a — Literal character"]);
  });

  it("tells a greedy repetition from a lazy one", () => {
    expect(explainPattern("a+", "").nodes[0].detail).toContain("greedy");
    expect(explainPattern("a+?", "").nodes[0].detail).toContain("lazy");
  });

  it("numbers capturing groups by where their bracket opens", () => {
    expect(outline("(a)(?:b)(c)")).toEqual([
      "(a) — Capturing group 1",
      "  a — Literal character",
      "(?:b) — Non-capturing group",
      "  b — Literal character",
      "(c) — Capturing group 2",
      "  c — Literal character",
    ]);
  });

  it("counts a group nested inside another one before the group after it", () => {
    const { captures } = explainPattern("((a))(b)", "");
    expect(captures).toEqual([{ index: 1, name: null }, { index: 2, name: null }, { index: 3, name: null }]);
  });

  it("carries a group's name through to the legend", () => {
    expect(explainPattern("(?<year>\\d{4})", "").captures).toEqual([{ index: 1, name: "year" }]);
    expect(outline("(?<year>a)")).toEqual([
      "(?<year>a) — Capturing group 1, named year",
      "  a — Literal character",
    ]);
  });

  it("breaks the top-level alternation into its options", () => {
    expect(outline("ab|c")).toEqual([
      "ab|c — Alternation",
      "  ab — Option 1",
      "    ab — Literal text",
      "  c — Option 2",
      "    c — Literal character",
    ]);
  });

  it("takes a character class apart into what it will accept", () => {
    expect(outline("[a-z_]")).toEqual([
      "[a-z_] — Any one character of",
      "  a-z — A character in the range",
      "  _ — The character",
    ]);
    expect(explainPattern("[^0-9]", "").nodes[0].label).toBe("Any one character except");
  });

  it("names the assertions", () => {
    expect(outline("^a$")).toEqual([
      "^ — Start of the text",
      "a — Literal character",
      "$ — End of the text",
    ]);
    expect(outline("\\bx")).toEqual(["\\b — Word boundary", "x — Literal character"]);
    expect(outline("(?!x)")).toEqual(["(?!x) — Negative lookahead", "  x — Literal character"]);
    expect(outline("(?<=x)")).toEqual(["(?<=x) — Lookbehind", "  x — Literal character"]);
  });

  it("names the escape sets and what they exclude", () => {
    expect(outline("\\d\\S")).toEqual(["\\d — A digit", "\\S — Anything but whitespace"]);
  });

  it("points a backreference at the group it repeats", () => {
    expect(outline("(a)\\1")).toEqual([
      "(a) — Capturing group 1",
      "  a — Literal character",
      "\\1 — Backreference to group 1",
    ]);
  });

  it("reads the unicode modes the flags ask for", () => {
    expect(outline("\\p{Letter}", "u")).toEqual(["\\p{Letter} — A character whose General_Category is Letter"]);
    expect(outline("\\P{ASCII}", "u")).toEqual(["\\P{ASCII} — Any character without the unicode property ASCII"]);
    expect(outline("[\\p{L}--[a-f]]", "v")).toEqual([
      "[\\p{L}--[a-f]] — Any one character of",
      "  \\p{L}--[a-f] — In the first of these and not the second",
      "    \\p{L} — A character whose General_Category is L",
      "    [a-f] — Any one character of",
      "      a-f — A character in the range",
    ]);
  });

  it("hands back what the parser said rather than throwing", () => {
    const explanation = explainPattern("(unclosed", "");
    expect(explanation.error).toBeTruthy();
    expect(explanation.nodes).toEqual([]);
  });

  it("has nothing to take apart until there is a pattern", () => {
    expect(explainPattern("", "")).toEqual({ nodes: [], captures: [], error: null });
  });
});
