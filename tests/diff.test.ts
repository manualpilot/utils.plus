import { describe, expect, it } from "vitest";
import { diffText, type LineMark } from "../src/utilities/diff";

function covered(text: string, marks: LineMark[]): string[] {
  const lines = text.split("\n");
  return marks.map((mark) => lines[mark.line - 1]);
}

function highlighted(text: string, marks: LineMark[]): string[] {
  const lines = text.split("\n");
  return marks.flatMap((mark) => mark.spans.map((span) => lines[mark.line - 1].slice(span.from, span.to)));
}

describe("whole lines", () => {
  it("marks nothing in documents that match", () => {
    const result = diffText("one\ntwo\nthree\n", "one\ntwo\nthree\n");
    expect(result).toEqual({ left: [], right: [], truncated: false });
  });

  it("marks nothing in two empty documents", () => {
    expect(diffText("", "")).toEqual({ left: [], right: [], truncated: false });
  });

  it("marks an inserted line on the right alone", () => {
    const left = "one\ntwo\n";
    const right = "one\ninserted\ntwo\n";
    const result = diffText(left, right);

    expect(covered(left, result.left)).toEqual([]);
    expect(covered(right, result.right)).toEqual(["inserted"]);
    expect(result.right[0].line).toBe(2);
  });

  it("marks a deleted line on the left alone", () => {
    const left = "one\ndropped\ntwo\n";
    const right = "one\ntwo\n";
    const result = diffText(left, right);

    expect(covered(left, result.left)).toEqual(["dropped"]);
    expect(covered(right, result.right)).toEqual([]);
    expect(result.left[0].line).toBe(2);
  });

  it("marks both sides of a changed line", () => {
    const left = "one\ntwo\nthree\n";
    const right = "one\nTWO\nthree\n";
    const result = diffText(left, right);

    expect(result.left.map((mark) => mark.line)).toEqual([2]);
    expect(result.right.map((mark) => mark.line)).toEqual([2]);
  });

  it("finds changes at either end without the matching middle in between", () => {
    const left = "head\nsame\nsame\ntail\n";
    const right = "HEAD\nsame\nsame\nTAIL\n";
    const result = diffText(left, right);

    expect(result.left.map((mark) => mark.line)).toEqual([1, 4]);
    expect(result.right.map((mark) => mark.line)).toEqual([1, 4]);
  });

  it("counts the empty line a trailing newline leaves behind", () => {
    const result = diffText("one", "one\n");
    expect(result.left).toEqual([]);
    expect(result.right.map((mark) => mark.line)).toEqual([2]);
  });

  it("marks every line when the documents share nothing", () => {
    const left = "a\nb\nc\n";
    const right = "x\ny\nz\n";
    const result = diffText(left, right);

    expect(result.left.map((mark) => mark.line)).toEqual([1, 2, 3]);
    expect(result.right.map((mark) => mark.line)).toEqual([1, 2, 3]);
  });

  it("keeps a moved line as one deletion and one insertion rather than marking what sits between", () => {
    const left = "moved\na\nb\nc\n";
    const right = "a\nb\nc\nmoved\n";
    const result = diffText(left, right);

    expect(covered(left, result.left)).toEqual(["moved"]);
    expect(covered(right, result.right)).toEqual(["moved"]);
  });

  it("reports line numbers in ascending order", () => {
    const left = "1\nx\n3\ny\n5\nz\n";
    const right = "1\n2\n3\n4\n5\n6\n";
    const result = diffText(left, right);

    const lines = result.left.map((mark) => mark.line);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
    expect(lines).toEqual([2, 4, 6]);
  });
});

describe("words within a changed line", () => {
  it("points at the word that changed and leaves the rest of the line alone", () => {
    const left = "jumps over the lazy dog\n";
    const right = "leaps over the lazy dog\n";
    const result = diffText(left, right);

    expect(highlighted(left, result.left)).toEqual(["jumps"]);
    expect(highlighted(right, result.right)).toEqual(["leaps"]);
  });

  it("draws touching tokens as a single run", () => {
    const left = "const total = 1;\n";
    const right = "const total = 42;\n";

    expect(highlighted(left, diffText(left, right).left)).toEqual(["1"]);
    expect(highlighted(right, diffText(left, right).right)).toEqual(["42"]);
  });

  it("marks an added word with nothing removed opposite it", () => {
    const left = "the lazy dog\n";
    const right = "the very lazy dog\n";
    const result = diffText(left, right);

    expect(highlighted(left, result.left)).toEqual([]);
    expect(highlighted(right, result.right)).toEqual(["very "]);
  });

  it("marks trailing whitespace, which is otherwise a change with nothing to see", () => {
    const left = "value\n";
    const right = "value   \n";
    const result = diffText(left, right);

    expect(highlighted(right, result.right)).toEqual(["   "]);
  });

  it("leaves unrelated lines unmarked within, since position is all that paired them", () => {
    const left = "alpha beta gamma\n";
    const right = "1234567890 !!\n";
    const result = diffText(left, right);

    expect(result.left.map((mark) => mark.line)).toEqual([1]);
    expect(result.left[0].spans).toEqual([]);
    expect(result.right[0].spans).toEqual([]);
  });

  it("pairs the nth removed line with the nth added line inside one hunk", () => {
    const left = "keep\nfirst old\nsecond old\nkeep\n";
    const right = "keep\nfirst new\nsecond new\nkeep\n";
    const result = diffText(left, right);

    expect(highlighted(left, result.left)).toEqual(["old", "old"]);
    expect(highlighted(right, result.right)).toEqual(["new", "new"]);
  });

  it("leaves an added line with no counterpart to point at unmarked within", () => {
    const left = "keep\nchanged old\nkeep\n";
    const right = "keep\nchanged new\nextra\nkeep\n";
    const result = diffText(left, right);

    expect(result.right.map((mark) => mark.spans.length > 0)).toEqual([true, false]);
  });

  it("says nothing about words in a line long enough to be a minified document", () => {
    const long = "x".repeat(3000);
    const result = diffText(`${long}a\n`, `${long}b\n`);

    expect(result.left[0].spans).toEqual([]);
    expect(result.right[0].spans).toEqual([]);
  });
});

describe("documents too far apart to align", () => {
  it("marks the middle wholesale and says so", () => {
    const left = Array.from({ length: 3000 }, (_, i) => `left ${i}`).join("\n");
    const right = Array.from({ length: 3000 }, (_, i) => `right ${i}`).join("\n");
    const result = diffText(left, right);

    expect(result.truncated).toBe(true);
    expect(result.left).toHaveLength(3000);
    expect(result.right).toHaveLength(3000);
  });

  it("still trims the ends the documents agree on", () => {
    const middleLeft = Array.from({ length: 3000 }, (_, i) => `left ${i}`);
    const middleRight = Array.from({ length: 3000 }, (_, i) => `right ${i}`);
    const result = diffText(
      ["head", ...middleLeft, "tail"].join("\n"),
      ["head", ...middleRight, "tail"].join("\n"),
    );

    expect(result.truncated).toBe(true);
    expect(result.left[0].line).toBe(2);
    expect(result.left[result.left.length - 1].line).toBe(3001);
  });

  it("aligns documents that are long but close without giving up", () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
    const changed = [...lines];
    changed[2500] = "line 2500 changed";
    const result = diffText(lines.join("\n"), changed.join("\n"));

    expect(result.truncated).toBe(false);
    expect(result.left.map((mark) => mark.line)).toEqual([2501]);
  });
});
