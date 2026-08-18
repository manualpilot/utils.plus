import { describe, expect, it } from "vitest";
import { formatEdit, type FormatKind } from "../src/utilities/markdown/format";
import { renderMarkdown } from "../src/utilities/markdown/render";

function format(kind: FormatKind, marked: string): string {
  const caret = marked.indexOf("‸");
  const doc = marked.replace(/[«»‸]/g, "");
  const from = caret === -1 ? marked.indexOf("«") : caret;
  const to = caret === -1 ? marked.indexOf("»") - 1 : caret;

  const edit = formatEdit(kind, doc, from, to);
  const next = doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to);
  const [start, end] = edit.selection;

  return start === end
    ? `${next.slice(0, start)}‸${next.slice(start)}`
    : `${next.slice(0, start)}«${next.slice(start, end)}»${next.slice(end)}`;
}

describe("marks around a run of text", () => {
  it("wraps what is selected", () => {
    expect(format("bold", "hello «world»")).toBe("hello **«world»**");
    expect(format("strike", "hello «world»")).toBe("hello ~~«world»~~");
  });

  it("wraps the word under a caret, since that is the word being written", () => {
    expect(format("italic", "hello wor‸ld")).toBe("hello *«world»*");
  });

  it("leaves the caret between the markers when there is no word to take", () => {
    expect(format("code", "hello ‸")).toBe("hello `‸`");
  });

  it("takes the markers off again when they are inside the selection", () => {
    expect(format("bold", "hello «**world**»")).toBe("hello «world»");
  });

  it("takes the markers off again when they are outside the selection", () => {
    expect(format("bold", "hello **«world»**")).toBe("hello «world»");
  });
});

describe("markers a line carries", () => {
  it("marks the line the caret is on and keeps the caret on it", () => {
    expect(format("h2", "Title‸")).toBe("## Title‸");
    expect(format("quote", "Title‸")).toBe("> Title‸");
  });

  it("changes the level of a heading rather than clearing it", () => {
    expect(format("h2", "# Title‸")).toBe("## Title‸");
  });

  it("clears a heading that is already at the level asked for", () => {
    expect(format("h2", "## Title‸")).toBe("Title‸");
  });

  it("marks every line the selection touches", () => {
    expect(format("bullet", "«one\ntwo»")).toBe("«- one\n- two»");
  });

  it("numbers an ordered list as it goes", () => {
    expect(format("ordered", "«one\ntwo\nthree»")).toBe("«1. one\n2. two\n3. three»");
  });

  it("takes the marker off when every line already carries it", () => {
    expect(format("bullet", "«- one\n- two»")).toBe("«one\ntwo»");
  });

  it("replaces one list marker with another", () => {
    expect(format("task", "- one‸")).toBe("- [ ] one‸");
    expect(format("bullet", "«1. one\n2. two»")).toBe("«- one\n- two»");
  });

  it("leaves a blank line between two marked ones alone", () => {
    expect(format("quote", "«one\n\ntwo»")).toBe("«> one\n\n> two»");
  });

  it("keeps the indentation a line was written with", () => {
    expect(format("bullet", "  one‸")).toBe("  - one‸");
  });
});

describe("links", () => {
  it("wraps the selection as the text and leaves the address to type over", () => {
    expect(format("link", "«docs»")).toBe("[docs](«https://»)");
  });

  it("takes a selected address as the address", () => {
    expect(format("link", "«https://utils.plus»")).toBe("[«link text»](https://utils.plus)");
  });

  it("writes an image with an alt text to replace", () => {
    expect(format("image", "‸")).toBe("![«alt text»](https://)");
  });
});

describe("blocks", () => {
  it("fences the lines the selection touches, with the caret where the language goes", () => {
    expect(format("fence", "code‸")).toBe("```‸\ncode\n```");
  });

  it("unfences a block that is already fenced", () => {
    expect(format("fence", "«```js\ncode\n```»")).toBe("«code»");
  });

  it("puts a table on an empty line with the first heading selected", () => {
    expect(format("table", "‸")).toBe("| «Column» | Column |\n| --- | --- |\n| Cell | Cell |");
  });

  it("puts a rule below the line it was asked for", () => {
    expect(format("rule", "text‸")).toBe("text\n\n---‸");
  });
});

describe("renderMarkdown", () => {
  it("reads GitHub's own additions in its flavour and not in the others", () => {
    expect(renderMarkdown("~~gone~~", "gfm")).toContain("<del>gone</del>");
    expect(renderMarkdown("~~gone~~", "commonmark")).not.toContain("<del>");
    expect(renderMarkdown(TABLE, "gfm")).toContain("<table>");
    expect(renderMarkdown(TABLE, "commonmark")).not.toContain("<table>");
  });

  it("breaks a line where the newline is, in the flavour that asks for it", () => {
    expect(renderMarkdown("one\ntwo", "gfm-breaks")).toContain("<br>");
    expect(renderMarkdown("one\ntwo", "gfm")).not.toContain("<br>");
  });

  it("reads the original flavour as markdown.pl did", () => {
    expect(renderMarkdown("```\ncode\n```", "commonmark")).toContain("<pre>");
    expect(renderMarkdown("```\ncode\n```", "original")).not.toContain("<pre>");
  });

  it("takes the script out of a document that carries one", () => {
    const html = renderMarkdown("hello <script>alert(1)</script>", "gfm");
    expect(html).toContain("hello");
    expect(html).not.toContain("<script");
  });

  it("takes the handlers off a tag that carries them", () => {
    expect(renderMarkdown("<img src=x onerror=alert(1)>", "gfm")).not.toContain("onerror");
  });

  it("opens a link beside the document rather than over it", () => {
    const html = renderMarkdown("[utils+](https://utils.plus)", "gfm");
    expect(html).toContain("target=\"_blank\"");
    expect(html).toContain("rel=\"noopener noreferrer\"");
  });
});

const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |";
