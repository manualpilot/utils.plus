import { describe, expect, it } from "vitest";
import { readEnv, writeEnv } from "../src/utilities/config/env";
import { displayPath, flatten, nest } from "../src/utilities/config/flatten";
import { FORMAT_IDS, type FormatId, FORMATS } from "../src/utilities/config/formats";
import { readProperties, writeProperties } from "../src/utilities/config/properties";
import { SAMPLES } from "../src/utilities/config/samples";
import { readToml, writeToml } from "../src/utilities/config/toml";
import { type ConfigValue, readScalar } from "../src/utilities/config/value";

function read(format: FormatId, text: string): ConfigValue {
  const result = FORMATS[format].read(text);
  if (!result.ok) throw new Error(`unreadable ${format}: ${result.error.message}`);
  return result.value;
}

function write(format: FormatId, value: ConfigValue, indent = 2): { text: string; lost: string[] } {
  const result = FORMATS[format].write(value, { indent });
  if (!result.ok) throw new Error(`unwritable ${format}: ${result.message}`);
  return { text: result.text, lost: result.lost };
}

const convert = (from: FormatId, to: FormatId, text: string) => write(to, read(from, text)).text;

describe("the samples", () => {
  it("say the same thing in every format", () => {
    const expected = read("json", SAMPLES.json);
    for (const format of FORMAT_IDS) expect(read(format, SAMPLES[format])).toEqual(expected);
  });

  it("are what each format writes for that document", () => {
    const value = read("json", SAMPLES.json);
    for (const format of FORMAT_IDS) expect(write(format, value).text).toBe(SAMPLES[format]);
  });
});

describe("every pairing", () => {
  const value = read("json", SAMPLES.json);

  it.each(FORMAT_IDS.flatMap((from) => FORMAT_IDS.map((to) => ({ from, to }))))(
    "carries the document from $from to $to",
    ({ from, to }) => {
      expect(read(to, convert(from, to, SAMPLES[from]))).toEqual(value);
    },
  );

  it("leaves nothing behind on the way through any of them", () => {
    for (const format of FORMAT_IDS) expect(write(format, value).lost).toEqual([]);
  });
});

describe("reading a scalar out of a flat format", () => {
  it("gives back the three words and a number that spells itself exactly", () => {
    expect(readScalar("true")).toBe(true);
    expect(readScalar("false")).toBe(false);
    expect(readScalar("null")).toBe(null);
    expect(readScalar("5432")).toBe(5432);
    expect(readScalar("-1.5")).toBe(-1.5);
    expect(readScalar("0")).toBe(0);
  });

  it("leaves a number that would not round trip as the text it was", () => {
    expect(readScalar("1.0")).toBe("1.0");
    expect(readScalar("007")).toBe("007");
    expect(readScalar("1e3")).toBe("1e3");
    expect(readScalar("+1")).toBe("+1");
    expect(readScalar("")).toBe("");
  });

  it("is not fooled by what Number would take", () => {
    expect(readScalar(" ")).toBe(" ");
    expect(readScalar("Infinity")).toBe("Infinity");
    expect(readScalar("0x10")).toBe("0x10");
  });
});

describe("flattening", () => {
  it("names an array element by its index and rebuilds the array from it", () => {
    const value = { a: [{ b: 1 }, { b: 2 }] };
    const { entries } = flatten(value);
    expect(entries.map((entry) => displayPath(entry.path))).toEqual(["a.0.b", "a.1.b"]);
    expect(nest(entries)).toEqual(value);
  });

  it("reports a container it has no scalar for", () => {
    expect(flatten({ a: {}, b: [], c: 1 }).lost).toEqual(["a", "b"]);
    expect(flatten({}).lost).toEqual(["(root)"]);
  });

  it("only reads a run of indices counting from zero back as an array", () => {
    expect(nest([{ path: ["a", "0"], value: 1 }, { path: ["a", "2"], value: 2 }])).toEqual({ a: { 0: 1, 2: 2 } });
    expect(nest([{ path: ["a", "1"], value: 2 }, { path: ["a", "0"], value: 1 }])).toEqual({ a: [1, 2] });
  });
});

describe(".env", () => {
  it("takes a comment, a blank line and an export off the front", () => {
    expect(read("env", "# a note\n\nexport PORT=8080\n")).toEqual({ PORT: 8080 });
  });

  it("leaves a single underscore alone and nests on a double one", () => {
    expect(read("env", "DATABASE_URL=x\ndatabase__host=y\n")).toEqual({ DATABASE_URL: "x", database: { host: "y" } });
  });

  it("reads a quoted value as the string it is and never as a type", () => {
    expect(read("env", "A=\"5432\"\nB='true'\nC=5432\n")).toEqual({ A: "5432", B: "true", C: 5432 });
  });

  it("stops a bare value at a comment and keeps a hash that is part of it", () => {
    expect(read("env", "A=red # the colour\nB=\"red # the colour\"\n")).toEqual({ A: "red", B: "red # the colour" });
  });

  it("runs a quoted value on over the lines it covers", () => {
    expect(read("env", "KEY=\"line one\nline two\"\nAFTER=1\n")).toEqual({ KEY: "line one\nline two", AFTER: 1 });
  });

  it("quotes what would otherwise come back as something else", () => {
    const { text } = write("env", { a: "5432", b: "true", c: "", d: "two words", e: 5432 });
    expect(text).toBe("a=\"5432\"\nb=\"true\"\nc=\"\"\nd=\"two words\"\ne=5432\n");
    expect(read("env", text)).toEqual({ a: "5432", b: "true", c: "", d: "two words", e: 5432 });
  });

  it("carries a newline and a backslash through its own escaping", () => {
    const value = { key: "-----BEGIN-----\nline\\two\n-----END-----" };
    expect(read("env", write("env", value).text)).toEqual(value);
  });

  it("says which line is not an assignment", () => {
    const result = readEnv("A=1\nthis is not one\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.line).toBe(2);
  });

  it("has nowhere to put a document that is a single value", () => {
    expect(writeEnv(5)).toEqual({
      ok: false,
      message: "A .env file is a list of keys, and this document is a single number.",
    });
  });
});

describe(".properties", () => {
  it("takes both comment marks and either separator", () => {
    expect(read("properties", "# one\n! two\na:1\nb = 2\nc 3\n")).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("joins a line ending in a backslash to the one under it", () => {
    expect(read("properties", "a = one \\\n    two\n")).toEqual({ a: "one two" });
  });

  it("reads the escapes a key needs to hold a separator", () => {
    expect(read("properties", "a\\:b\\=c\\ d=1\n")).toEqual({ "a:b=c d": 1 });
  });

  it("reads a unicode escape", () => {
    expect(read("properties", "a=caf\\u00e9\n")).toEqual({ a: "café" });
  });

  it("writes a key back with those same escapes", () => {
    const value = { "a:b=c d": 1, "e#f": 2 };
    const { text } = write("properties", value);
    expect(text).toBe("a\\:b\\=c\\ d=1\ne\\#f=2\n");
    expect(read("properties", text)).toEqual(value);
  });

  it("cannot tell a number from the string that spells it", () => {
    expect(read("properties", write("properties", { a: "5432" }).text)).toEqual({ a: 5432 });
  });

  it("keeps a leading space by escaping it", () => {
    const value = { a: "  padded" };
    expect(read("properties", write("properties", value).text)).toEqual(value);
  });

  it("reads an empty value as an empty string", () => {
    expect(readProperties("a=\n")).toEqual({ ok: true, value: { a: "" } });
  });
});

describe("TOML", () => {
  it("reports the keys it had no null to write", () => {
    expect(writeToml({ a: 1, b: null, c: { d: null, e: 2 } })).toEqual({
      ok: true,
      text: "a = 1\n\n[c]\ne = 2\n",
      lost: ["b", "c.d"],
    });
  });

  it("drops an array holding a null whole, and says so at the array", () => {
    expect(writeToml({ a: [1, null, 3], b: 2 })).toEqual({ ok: true, text: "b = 2\n", lost: ["a"] });
    expect(writeToml({ a: [[1, null]] })).toEqual({ ok: true, text: "\n", lost: ["a"] });
  });

  it("has nowhere to put a document that is not a table", () => {
    expect(writeToml([1, 2])).toEqual({
      ok: false,
      message: "A TOML document is a table of keys, and this one is a list.",
    });
  });

  it("reads its four kinds of date as the text they were written as", () => {
    expect(read("toml", "a = 1979-05-27T07:32:00Z\nb = 1979-05-27\nc = 07:32:00\n")).toEqual({
      a: "1979-05-27T07:32:00.000Z",
      b: "1979-05-27",
      c: "07:32:00.000",
    });
  });

  it("says where the document stopped making sense", () => {
    const result = readToml("a = 1\nb = = 2\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.line).toBe(2);
  });
});

describe("an integer too large for a double", () => {
  const BIG = 12345678901234567890n;
  const LONG = 9007199254740993n;

  it("keeps every digit on the way in from the three formats that nest", () => {
    expect(read("json", "{\"id\": 12345678901234567890, \"small\": 3, \"negative\": -12345678901234567890}")).toEqual({
      id: BIG,
      small: 3,
      negative: -BIG,
    });
    expect(read("yaml", "id: 12345678901234567890\nsmall: 3\n")).toEqual({ id: BIG, small: 3 });
    expect(read("toml", "id = 9007199254740993\nsmall = 3\n")).toEqual({ id: LONG, small: 3 });
  });

  it("keeps every digit on the way in from a flat format, where it spells itself exactly", () => {
    expect(readScalar("12345678901234567890")).toBe(BIG);
    expect(readScalar("-9007199254740993")).toBe(-LONG);
    expect(readScalar("012345678901234567890")).toBe("012345678901234567890");
  });

  it("writes every digit back out of every format that can hold it", () => {
    const value = { id: BIG, list: [LONG] };
    expect(write("json", value).text).toBe(
      "{\n  \"id\": 12345678901234567890,\n  \"list\": [\n    9007199254740993\n  ]\n}\n",
    );
    expect(write("yaml", value).text).toBe("id: 12345678901234567890\nlist:\n  - 9007199254740993\n");
    expect(write("env", value).text).toBe("id=12345678901234567890\nlist__0=9007199254740993\n");
    expect(write("properties", value).text).toBe("id=12345678901234567890\nlist.0=9007199254740993\n");
    expect(write("toml", { id: LONG }).text).toBe("id = 9007199254740993\n");
  });

  it.each(FORMAT_IDS.flatMap((from) => FORMAT_IDS.map((to) => ({ from, to }))))(
    "carries one from $from to $to without rounding it",
    ({ from, to }) => {
      const text = write(from, { id: LONG, name: "api" }).text;
      expect(read(to, convert(from, to, text))).toEqual({ id: LONG, name: "api" });
    },
  );

  it("names one TOML cannot hold rather than writing it as something else", () => {
    expect(write("toml", { id: BIG, name: "api", ids: [1n, BIG] })).toEqual({
      text: "name = \"api\"\n",
      lost: ["id", "ids"],
    });
  });

  it("quotes a string of digits a flat format would otherwise read back as one", () => {
    expect(write("env", { id: "12345678901234567890" }).text).toBe("id=\"12345678901234567890\"\n");
  });

  it("still calls a single one a number when there is nowhere to put it", () => {
    expect(writeToml(BIG)).toEqual({
      ok: false,
      message: "A TOML document is a table of keys, and this one is a single number.",
    });
  });
});

describe("a string a YAML 1.1 reader would take for something else", () => {
  const STRINGS = [
    "no",
    "Yes",
    "on",
    "OFF",
    "y",
    "n",
    "01234",
    "12:30",
    "1:20:30",
    "0x1F",
    "+12",
    "1_000",
    "2001-12-14",
    "~",
    "<<",
  ];

  it("is quoted wherever it lands, as a value or as a key", () => {
    const value = Object.fromEntries(STRINGS.map((text) => [text, text]));
    const { text } = write("yaml", value);
    for (const line of text.trimEnd().split("\n")) expect(line).toMatch(/^"[^"]+": "[^"]+"$/);
    expect(read("yaml", text)).toEqual(value);
  });

  it("leaves everything that means the same in both alone", () => {
    expect(write("yaml", { name: "api", port: 8080, debug: false, ratio: 1.5, none: null }).text).toBe(
      "name: api\nport: 8080\ndebug: false\nratio: 1.5\nnone: null\n",
    );
  });
});

describe("YAML and JSON", () => {
  it("read an empty document as the same nothing", () => {
    expect(read("yaml", "")).toBe(null);
    expect(read("json", "   ")).toBe(null);
  });

  it("indent what they are asked to", () => {
    expect(write("yaml", { a: { b: 1 } }, 4).text).toBe("a:\n    b: 1\n");
    expect(write("json", { a: { b: 1 } }, 4).text).toBe("{\n    \"a\": {\n        \"b\": 1\n    }\n}\n");
  });

  it("say where a document stopped making sense", () => {
    const yaml = FORMATS.yaml.read("a: 1\na: 2\n");
    expect(yaml.ok).toBe(false);
    if (!yaml.ok) expect(yaml.error.line).toBe(2);
  });
});
