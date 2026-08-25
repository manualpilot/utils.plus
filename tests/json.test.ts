import { json as jsonLanguage } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { countPills } from "../src/utilities/json/counts";

function annotate(doc: string): string {
  const state = EditorState.create({ doc, extensions: [jsonLanguage()] });
  let out = "";
  let read = 0;

  for (const { at, label } of countPills(state, 0, state.doc.length)) {
    out += state.doc.sliceString(read, at) + `«${label}»`;
    read = at;
  }

  return out + state.doc.sliceString(read);
}

describe("counting what a container holds", () => {
  it("labels a container that runs past its line at the end of that line", () => {
    expect(annotate("{\n  \"a\": 1,\n  \"b\": 2\n}")).toBe("{«2 keys»\n  \"a\": 1,\n  \"b\": 2\n}");
    expect(annotate("[\n  1,\n  2,\n  3\n]")).toBe("[«3 elements»\n  1,\n  2,\n  3\n]");
  });

  it("labels one at the end of its line whatever else that line carries in front of the brace", () => {
    expect(annotate("{\n  \"tags\": [\n    1\n  ]\n}")).toBe("{«1 key»\n  \"tags\": [«1 element»\n    1\n  ]\n}");
  });

  it("labels a container closed on the line it opened on at its closing brace", () => {
    expect(annotate("{ \"a\": 1, \"b\": 2 }")).toBe("{ \"a\": 1, \"b\": 2 }«2 keys»");
  });

  it("puts that label in front of the comma the closing brace is followed by", () => {
    expect(annotate("{\n  \"a\": [1, 2],\n  \"b\": 3\n}")).toBe(
      "{«2 keys»\n  \"a\": [1, 2]«2 elements»,\n  \"b\": 3\n}",
    );
  });

  it("labels each of two containers closed on one line at its own brace", () => {
    expect(annotate("[[1, 2], {\"a\": 1}]")).toBe("[[1, 2]«2 elements», {\"a\": 1}«1 key»]«2 elements»");
  });

  it("gives the place to the container that opened nearest it when two want the same one", () => {
    expect(annotate("{ \"a\": [1, 2]\n}")).toBe("{ \"a\": [1, 2]«2 elements»\n}");
    expect(annotate("{ \"a\": [\n  1\n] }")).toBe("{ \"a\": [«1 element»\n  1\n] }");
  });

  it("counts an element of every shape once, and the comma between them not at all", () => {
    expect(annotate("[\n  1,\n  \"a\",\n  true,\n  false,\n  null,\n  {},\n  []\n]")).toContain("[«7 elements»");
  });

  it("says a container holding one thing in the singular", () => {
    expect(annotate("[\n  1\n]")).toBe("[«1 element»\n  1\n]");
    expect(annotate("{\n  \"a\": 1\n}")).toBe("{«1 key»\n  \"a\": 1\n}");
  });

  it("counts an empty container as nothing rather than passing it over", () => {
    expect(annotate("{}")).toBe("{}«0 keys»");
    expect(annotate("[]")).toBe("[]«0 elements»");
  });

  it("keeps whatever it can read of a document that does not parse", () => {
    expect(annotate("{\n  \"a\": 1,\n  \"b\":\n}")).toContain("{«2 keys»");
  });

  it("counts a nested container whose opener stands alone", () => {
    expect(annotate("[\n  {\n    \"a\": 1,\n    \"b\": 2\n  }\n]")).toBe(
      "[«1 element»\n  {«2 keys»\n    \"a\": 1,\n    \"b\": 2\n  }\n]",
    );
  });

  it("reads an opener indented to any depth", () => {
    expect(annotate("[\n        [\n                1\n        ]\n]")).toBe(
      "[«1 element»\n        [«1 element»\n                1\n        ]\n]",
    );
  });
});
