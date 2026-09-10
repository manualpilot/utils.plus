import { json as jsonLanguage } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { countPills } from "../src/utilities/json/counts";
import { printDocument, readDocument, sortKeys as sortNode } from "../src/utilities/json/document";
import { expandEmbedded } from "../src/utilities/json/expand";
import { foldRangesAt } from "../src/utilities/json/fold";
import { isJsonLines } from "../src/utilities/json/lines";
import { caretPath, normalizedPath, spellPath } from "../src/utilities/json/path";
import { answerQuery, describeAnswer, runQuery } from "../src/utilities/json/query";
import { repairDocument } from "../src/utilities/json/repair";
import { expand, format, minify, repair, sortKeys, toArray, toLines, unescape } from "../src/utilities/json/transforms";

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

function printed(text: string, indent = 2): string {
  const read = readDocument(text);
  if (!read.ok) throw new Error(read.error);
  return printDocument(read.node, indent);
}

describe("reading and printing a document without losing any of it", () => {
  it("keeps a number JavaScript cannot hold, a trailing zero, and both entries under one key", () => {
    expect(printed("{\"id\": 12345678901234567890, \"rate\": 1.0, \"a\": 1, \"a\": 2}")).toBe(
      "{\n  \"id\": 12345678901234567890,\n  \"rate\": 1.0,\n  \"a\": 1,\n  \"a\": 2\n}",
    );
  });

  it("keeps the order keys were written in, where JSON.stringify puts integer-like keys first", () => {
    expect(printed("{\"b\": 1, \"1\": 2}", 0)).toBe("{\"b\":1,\"1\":2}");
  });

  it("keeps a string's escapes as they were written", () => {
    expect(printed("[\"a\\/b\"]", 0)).toBe("[\"a\\/b\"]");
  });

  it("lays a plain document out exactly as JSON.stringify would at every width", () => {
    const sample = JSON.stringify({ a: [1, { b: null, c: [true, false] }], d: "x", e: {}, f: [] });
    for (const indent of [0, 2, 4, 8]) {
      expect(printed(sample, indent)).toBe(JSON.stringify(JSON.parse(sample), null, indent));
    }
  });

  it("says where a document stops being JSON, and calls an empty one a fault too", () => {
    const broken = readDocument("{\n  \"a\": 1,\n}");
    expect(broken.ok).toBe(false);
    expect(!broken.ok && broken.error).toMatch(/^Not valid JSON at line \d+, column \d+$/);
    expect(readDocument("  ").ok).toBe(false);
  });

  it("sorts keys by code unit and stably, leaving arrays in the order they were written", () => {
    const read = readDocument("{\"b\": 1, \"a\": [{\"z\": 1, \"y\": 2}, 0], \"b\": 2, \"B\": 3}");
    if (!read.ok) throw new Error(read.error);
    expect(printDocument(sortNode(read.node), 0)).toBe("{\"B\":3,\"a\":[{\"y\":2,\"z\":1},0],\"b\":1,\"b\":2}");
  });
});

describe("the toolbar's transforms", () => {
  it("formats the lossless way, where the old round trip through JSON.parse rounded the number", () => {
    expect(format("{\"n\":12345678901234567890}", 2).text).toBe("{\n  \"n\": 12345678901234567890\n}");
  });

  it("will not format JSON Lines in place, and says so", () => {
    const outcome = format("{\"a\": 1}\n{\"b\": 2}\n", 2);
    expect(outcome.text).toBeUndefined();
    expect(outcome.notice).toMatchObject({ tone: "error", message: expect.stringContaining("JSON Lines") });
  });

  it("minifies and sorts JSON Lines a line at a time, so it stays JSON Lines", () => {
    expect(minify("{\"a\": 1}\n\n{\"b\": [ 2 ]}\n", 2).text).toBe("{\"a\":1}\n{\"b\":[2]}\n");
    expect(sortKeys("{\"b\":1,\"a\":2}\n{\"d\":1,\"c\":2}", 2).text).toBe("{\"a\":2,\"b\":1}\n{\"c\":2,\"d\":1}\n");
  });

  it("says why a transform did nothing to a document that does not parse", () => {
    expect(minify("{\"a\": ", 2).notice?.message).toMatch(/^Not valid JSON at line 1/);
    expect(unescape("{\"a\": 1}", 2).notice?.tone).toBe("error");
  });

  it("turns an array into JSON Lines and back", () => {
    const lines = toLines("[{\"a\": 1}, [2], \"x\"]", 2).text!;
    expect(lines).toBe("{\"a\":1}\n[2]\n\"x\"\n");
    expect(toArray(lines, 2).text).toBe("[\n  {\n    \"a\": 1\n  },\n  [\n    2\n  ],\n  \"x\"\n]");
  });

  it("turns only a non-empty array into JSON Lines, and only JSON Lines into an array", () => {
    expect(toLines("{\"a\": 1}", 2).notice?.tone).toBe("error");
    expect(toLines("[]", 2).notice?.tone).toBe("error");
    expect(toArray("[\n  1\n]", 2).notice?.message).toMatch(/^Line 1 is not a JSON value/);
  });

  it("tells JSON Lines from a document with one value on it", () => {
    expect(isJsonLines("{\"a\": 1}")).toBe(false);
    expect(isJsonLines("{\"a\": 1}\n\n[2]\n")).toBe(true);
    expect(isJsonLines("{\"a\": 1}\n{\"b\":")).toBe(false);
  });
});

describe("opening up JSON held in a string", () => {
  it("expands a string holding an object or array, and whatever is embedded inside that", () => {
    const text = JSON.stringify({ body: JSON.stringify({ a: [1, "[2]"] }), n: "42", s: "[not json" });
    const outcome = expand(text, 2);
    expect(outcome.text).toBe(
      "{\n  \"body\": {\n    \"a\": [\n      1,\n      [\n        2\n      ]\n    ]\n  },\n  \"n\": \"42\",\n  \"s\": \"[not json\"\n}",
    );
    expect(outcome.notice?.message).toBe("Expanded 2 embedded documents");
  });

  it("leaves a document with nothing embedded alone, and says so", () => {
    const outcome = expand("{\"n\": \"42\"}", 2);
    expect(outcome.text).toBeUndefined();
    expect(outcome.notice?.message).toBe("No string here holds a JSON object or array");
  });

  it("counts every document it opened, however deep", () => {
    const read = readDocument(JSON.stringify([JSON.stringify([JSON.stringify({ deep: true })])]));
    if (!read.ok) throw new Error(read.error);
    expect(expandEmbedded(read.node).expanded).toBe(2);
  });
});

describe("repairing a document that is nearly JSON", () => {
  it("reads what JSON5, JSONC, a JavaScript literal and a Python repr write, and names each fix", () => {
    const text = [
      "{",
      "  // comment",
      "  name: 'O\\'Brien',",
      "  list: [1, 2, 3,],",
      "  /* block */ hex: 0x1F,",
      "  half: .5,",
      "  plus: +1,",
      "  flag: True,",
      "  none: None,",
      "  missing: undefined,",
      "  inf: Infinity,",
      "  \"ok\": \"fine\"",
      "}",
    ].join("\n");

    const repaired = repairDocument(text);
    if (!repaired.ok) throw new Error(repaired.error);
    expect(printDocument(repaired.node, 2)).toBe(JSON.stringify(
      {
        name: "O'Brien",
        list: [1, 2, 3],
        hex: 31,
        half: 0.5,
        plus: 1,
        flag: true,
        none: null,
        missing: null,
        inf: null,
        ok: "fine",
      },
      null,
      2,
    ));
    expect(repaired.fixes).toEqual([
      "2 comments removed",
      "1 trailing comma removed",
      "1 single-quoted string requoted",
      "9 bare keys quoted",
      "3 numbers rewritten",
      "3 Python or JavaScript literals replaced",
      "1 non-finite number made null",
    ]);
  });

  it("puts back commas that were left out between entries", () => {
    const repaired = repairDocument("{\"a\": [1 2 3]\n\"b\": 2}");
    if (!repaired.ok) throw new Error(repaired.error);
    expect(printDocument(repaired.node, 0)).toBe("{\"a\":[1,2,3],\"b\":2}");
    expect(repaired.fixes).toEqual(["3 missing commas added"]);
  });

  it("re-escapes a raw control character and drops whitespace JSON does not allow", () => {
    const newline = repairDocument("\"a\nb\"");
    expect(newline.ok && printDocument(newline.node, 0)).toBe("\"a\\nb\"");
    expect(newline.ok && newline.fixes).toEqual(["1 string re-escaped"]);

    const marked = repairDocument(String.fromCharCode(0xfeff) + "{\"a\": 1}");
    expect(marked.ok && marked.fixes).toEqual(["1 stray whitespace character removed"]);
  });

  it("finds nothing to fix in a document that is JSON already", () => {
    expect(repair("{\"a\": [1, 2]}", 2)).toEqual({ notice: { tone: "done", message: "Nothing needed repairing" } });
  });

  it("keeps a big number and a duplicate key through a repair as a format would", () => {
    const repaired = repairDocument("{a: 12345678901234567890, a: 2,}");
    expect(repaired.ok && printDocument(repaired.node, 0)).toBe("{\"a\":12345678901234567890,\"a\":2}");
  });

  it("says where it gave up", () => {
    expect(repairDocument("{\"a\": }")).toEqual({
      ok: false,
      error: "Could not repair: unexpected \"}\" at line 1, column 7",
    });
    expect(repairDocument("[1, /* open").ok).toBe(false);
    expect(repairDocument("[1, 2").ok).toBe(false);
    expect(repairDocument("'never closed").ok).toBe(false);
    expect(repairDocument("\"\\u{110000}\"").ok).toBe(false);
  });
});

function pathAt(marked: string): string {
  const at = marked.indexOf("|");
  const state = EditorState.create({ doc: marked.replace("|", ""), extensions: [jsonLanguage()] });
  return spellPath(caretPath(state, at));
}

describe("the path at the caret", () => {
  it("names every key and index down to the value the caret is in", () => {
    expect(pathAt("{\"users\": [{\"name\": \"x\"}, {\"name\": \"y|\"}]}")).toBe("$.users[1].name");
    expect(pathAt("{\"a\": {\"b c\": [true, |null]}}")).toBe("$.a['b c'][1]");
  });

  it("takes the value either side of a comma, whichever the caret is against", () => {
    expect(pathAt("[1,|2]")).toBe("$[1]");
    expect(pathAt("[1|,2]")).toBe("$[0]");
  });

  it("is the property a line holds when the caret is at its start, and the root outside every value", () => {
    expect(pathAt("{\n  |\"key\": 1\n}")).toBe("$.key");
    expect(pathAt("|{\"a\": 1}")).toBe("$");
    expect(pathAt("{\"a\": 1}|")).toBe("$");
  });

  it("brackets a name a dot cannot introduce, and escapes its quote", () => {
    expect(spellPath(["_ok", "9lives", "it's", "名前"])).toBe("$._ok['9lives']['it\\'s'].名前");
    expect(normalizedPath(["a", 0])).toBe("$['a'][0]");
  });

  it("is a query that finds the value it names", () => {
    const text = "{\"a\": {\"b c\": [true, {\"d\": 7}]}}";
    const read = readDocument(text);
    if (!read.ok) throw new Error(read.error);
    const path = pathAt(text.replace("7", "|7"));
    const result = runQuery(read.node, path);
    expect(result.ok && result.matches.map(({ node }) => printDocument(node, 0))).toEqual(["7"]);
  });
});

describe("folding to a level", () => {
  const doc = "{\n  \"a\": {\n    \"b\": [\n      1\n    ]\n  },\n  \"c\": [1, 2],\n  \"d\": [\n    3\n  ]\n}";
  const state = EditorState.create({ doc, extensions: [jsonLanguage()] });
  const linesAt = (depth: number) => foldRangesAt(state, depth).map(({ from }) => state.doc.lineAt(from).number);

  it("folds the containers that many levels in, and passes over one written on a single line", () => {
    expect(linesAt(0)).toEqual([1]);
    expect(linesAt(1)).toEqual([2, 8]);
    expect(linesAt(2)).toEqual([3]);
    expect(linesAt(3)).toEqual([]);
  });

  it("folds a container to its inside, so the braces and the count beside the opener stay showing", () => {
    const [root] = foldRangesAt(state, 0);
    expect(doc.slice(root.from - 1, root.from)).toBe("{");
    expect(doc.slice(root.to, root.to + 1)).toBe("}");
  });
});

function found(document: unknown, query: string): string[] {
  const read = readDocument(typeof document === "string" ? document : JSON.stringify(document));
  if (!read.ok) throw new Error(read.error);
  const result = runQuery(read.node, query);
  if (!result.ok) throw new Error(result.error);
  return result.matches.map(({ node }) => printDocument(node, 0));
}

const faultOf = (query: string) => {
  const result = runQuery({ kind: "array", items: [] }, query);
  return result.ok ? null : result.error;
};

const STORE = {
  store: {
    book: [
      { category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
      { category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
      { category: "fiction", author: "Herman Melville", title: "Moby Dick", isbn: "0-553-21311-3", price: 8.99 },
      {
        category: "fiction",
        author: "J. R. R. Tolkien",
        title: "The Lord of the Rings",
        isbn: "0-395-19395-8",
        price: 22.99,
      },
    ],
    bicycle: { color: "red", price: 399 },
  },
};

const AUTHORS = ["\"Nigel Rees\"", "\"Evelyn Waugh\"", "\"Herman Melville\"", "\"J. R. R. Tolkien\""];

describe("querying with JSONPath", () => {
  it("answers RFC 9535's examples", () => {
    expect(found(STORE, "$.store.book[*].author")).toEqual(AUTHORS);
    expect(found(STORE, "$..author")).toEqual(AUTHORS);
    expect(found(STORE, "$.store.*")).toHaveLength(2);
    expect(found(STORE, "$.store..price")).toEqual(["8.95", "12.99", "8.99", "22.99", "399"]);
    expect(found(STORE, "$..book[2].title")).toEqual(["\"Moby Dick\""]);
    expect(found(STORE, "$..book[-1].title")).toEqual(["\"The Lord of the Rings\""]);
    expect(found(STORE, "$..book[0,1].title")).toEqual(["\"Sayings of the Century\"", "\"Sword of Honour\""]);
    expect(found(STORE, "$..book[:2].title")).toEqual(["\"Sayings of the Century\"", "\"Sword of Honour\""]);
    expect(found(STORE, "$..book[?@.isbn].title")).toEqual(["\"Moby Dick\"", "\"The Lord of the Rings\""]);
    expect(found(STORE, "$..book[?@.price<10].title")).toEqual(["\"Sayings of the Century\"", "\"Moby Dick\""]);
  });

  it("reads a filter in the older parenthesised spelling, with && and ||", () => {
    expect(found(STORE, "$..book[?(@.price < 10 && @.category == 'fiction')].title")).toEqual(["\"Moby Dick\""]);
    expect(found(STORE, "$..book[?(@.price > 20 || !@.isbn)].title")).toEqual([
      "\"Sayings of the Century\"",
      "\"Sword of Honour\"",
      "\"The Lord of the Rings\"",
    ]);
  });

  it("slices the way Python does, forwards, backwards and not at all", () => {
    const digits = [0, 1, 2, 3, 4, 5, 6];
    expect(found(digits, "$[1:5:2]")).toEqual(["1", "3"]);
    expect(found(digits, "$[5:1:-2]")).toEqual(["5", "3"]);
    expect(found(digits, "$[::-1]")).toEqual(["6", "5", "4", "3", "2", "1", "0"]);
    expect(found(digits, "$[-2:]")).toEqual(["5", "6"]);
    expect(found(digits, "$[::0]")).toEqual([]);
  });

  it("runs the five functions", () => {
    expect(found(STORE, "$..book[?length(@.title) > 15].title")).toEqual([
      "\"Sayings of the Century\"",
      "\"The Lord of the Rings\"",
    ]);
    expect(found([[1, 2], [3]], "$[?count(@.*) > 1]")).toEqual(["[1,2]"]);
    expect(found(STORE, "$..book[?match(@.author, '.*Tolkien')].title")).toEqual(["\"The Lord of the Rings\""]);
    expect(found(STORE, "$..book[?search(@.title, 'of')]")).toHaveLength(3);
    expect(found(STORE, "$.store[?value(@..color) == \"red\"].price")).toEqual(["399"]);
  });

  it("compares numbers by value and holds Nothing apart from null", () => {
    expect(found("[1, 1.0, \"1\", 2]", "$[?@ == 1]")).toEqual(["1", "1.0"]);
    expect(found([{}, { a: 1 }, { a: 1, b: 1 }, { a: null }], "$[?@.a == @.b]")).toEqual(["{}", "{\"a\":1,\"b\":1}"]);
  });

  it("prints a match as it was written, however big the number", () => {
    expect(found("{\"id\": 12345678901234567890}", "$.id")).toEqual(["12345678901234567890"]);
  });

  it("takes a name in any script, bracketed or dotted", () => {
    expect(found({ 名前: 1, "a b": 2 }, "$.名前")).toEqual(["1"]);
    expect(found({ 名前: 1, "a b": 2 }, "$['a b']")).toEqual(["2"]);
  });

  it("says what is wrong with a query and where", () => {
    expect(faultOf("store")).toBe("a query starts with $ at column 1");
    expect(faultOf("$.a[")).toMatch(/at column 5$/);
    expect(faultOf("$[?@.* == 1]")).toMatch(/^a comparison needs a query naming one place/);
    expect(faultOf("$[?length(@)]")).toMatch(/^length\(\) gives a value/);
    expect(faultOf("$[?foo(@)]")).toMatch(/^there is no function called foo\(\)/);
    expect(faultOf("$[?1]")).toMatch(/^a literal on its own is not a test/);
    expect(faultOf("$[?match(@)]")).toMatch(/^match\(\) takes 2 arguments/);
    expect(faultOf("$..book[?@.price<10].title")).toBeNull();
  });
});

describe("the answer the result pane shows", () => {
  it("prints the matches as one array, or their normalized paths", () => {
    const text = JSON.stringify({ a: [{ p: 1 }, { p: 2 }] });
    expect(answerQuery(text, "$..p", false)).toEqual({ ok: true, matches: 2, text: "[\n  1,\n  2\n]" });
    expect(answerQuery(text, "$..p", true)).toEqual({
      ok: true,
      matches: 2,
      text: "[\n  \"$['a'][0]['p']\",\n  \"$['a'][1]['p']\"\n]",
    });
  });

  it("tells a document that does not parse from a query that does not", () => {
    expect(answerQuery("{", "$", false)).toMatchObject({ ok: false, in: "document" });
    expect(answerQuery("{}", "$.", false)).toMatchObject({ ok: false, in: "query" });
    expect(describeAnswer(answerQuery("[1]", "$[0]", false))).toBe("1 match");
    expect(describeAnswer(null)).toBe("Type a JSONPath to query the document");
  });
});
