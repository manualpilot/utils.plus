import { describe, expect, it } from "vitest";
import { toIdentifierCase, toSentenceCase, toTitleCase } from "../src/utilities/string/case";
import { counts } from "../src/utilities/string/count";
import { CODES, decodeEntities, encodeEntities } from "../src/utilities/string/entities";
import { escapeC, escapeJs, escapeShell, escapeSql, unescapeC, unescapeJs, unquoteShell, unquoteSql } from "../src/utilities/string/escape";
import { dedupeLines, reverseLines, shuffleLines, sortLines } from "../src/utilities/string/lines";
import { slugify } from "../src/utilities/string/slug";
import { transform } from "../src/utilities/string/transform";
import { collapse, trimLines, wrapText } from "../src/utilities/string/whitespace";

const count = (text: string, label: string) => counts(text).find((row) => row.label === label)?.value;

describe("case", () => {
  it("reads the words out of every spelling a name is written in", () => {
    expect(toIdentifierCase("hello world", "camel")).toBe("helloWorld");
    expect(toIdentifierCase("hello_world", "camel")).toBe("helloWorld");
    expect(toIdentifierCase("hello-world", "pascal")).toBe("HelloWorld");
    expect(toIdentifierCase("helloWorld", "snake")).toBe("hello_world");
    expect(toIdentifierCase("Hello World", "constant")).toBe("HELLO_WORLD");
    expect(toIdentifierCase("hello world", "kebab")).toBe("hello-world");
  });

  it("keeps an acronym together", () => {
    expect(toIdentifierCase("XMLHttpRequest", "snake")).toBe("xml_http_request");
    expect(toIdentifierCase("parseJSONResponse", "kebab")).toBe("parse-json-response");
    expect(toIdentifierCase("getHTTPResponse", "camel")).toBe("getHttpResponse");
  });

  it("counts a run of digits as a word of its own", () => {
    expect(toIdentifierCase("utf8 decoder", "snake")).toBe("utf_8_decoder");
    expect(toIdentifierCase("foo_bar-baz 2", "camel")).toBe("fooBarBaz2");
  });

  it("converts each line on its own, and leaves an empty one empty", () => {
    expect(toIdentifierCase("first name\nlast name", "camel")).toBe("firstName\nlastName");
    expect(toIdentifierCase("one\n\ntwo", "kebab")).toBe("one\n\ntwo");
  });

  it("capitalises every word, or leaves a headline's short ones alone", () => {
    expect(toTitleCase("the lord of the rings", "every")).toBe("The Lord Of The Rings");
    expect(toTitleCase("the lord of the rings", "headline")).toBe("The Lord of the Rings");
    expect(toTitleCase("something to write home for", "headline")).toBe("Something to Write Home For");
  });

  it("capitalises a sentence after whatever ended the one before it", () => {
    expect(toSentenceCase("hello world. THIS is a test! ok")).toBe("Hello world. This is a test! Ok");
    expect(toSentenceCase("  \"quoted\" text")).toBe("  \"Quoted\" text");
  });
});

describe("lines", () => {
  it("sorts by the comparison the variant names", () => {
    expect(sortLines("cherry\napple\nbanana", "ascending")).toBe("apple\nbanana\ncherry");
    expect(sortLines("cherry\napple\nbanana", "descending")).toBe("cherry\nbanana\napple");
    expect(sortLines("item10\nitem9\nitem1", "natural")).toBe("item1\nitem9\nitem10");
    expect(sortLines("item10\nitem9\nitem1", "ascending")).toBe("item1\nitem10\nitem9");
    expect(sortLines("ccc\na\nbb", "length")).toBe("a\nbb\nccc");
  });

  it("drops the repeats, or keeps only what never repeated", () => {
    expect(dedupeLines("a\nb\na\nc\nb", "first")).toBe("a\nb\nc");
    expect(dedupeLines("Apple\napple\nBanana", "first")).toBe("Apple\napple\nBanana");
    expect(dedupeLines("Apple\napple\nBanana", "insensitive")).toBe("Apple\nBanana");
    expect(dedupeLines("a\nb\na\nc", "unique")).toBe("b\nc");
  });

  it("reverses either the order of the lines or what is in each of them", () => {
    expect(reverseLines("one\ntwo\nthree", "lines")).toBe("three\ntwo\none");
    expect(reverseLines("abc\ndef", "characters")).toBe("cba\nfed");
  });

  it("reverses by what a reader calls a character", () => {
    expect(reverseLines("cafe\u0301", "characters")).toBe("\u0065\u0301fac");
  });

  it("keeps every line and moves them all when it shuffles", () => {
    const shuffled = shuffleLines("a\nb\nc\nd\ne");
    expect(shuffled.split("\n").sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("leaves a trailing newline where it was", () => {
    expect(sortLines("b\na\n", "ascending")).toBe("a\nb\n");
    expect(dedupeLines("a\na\n", "first")).toBe("a\n");
    expect(reverseLines("a\nb\n", "lines")).toBe("b\na\n");
  });

  it("reads a line ending written either way", () => {
    expect(sortLines("b\r\na", "ascending")).toBe("a\nb");
  });
});

describe("whitespace", () => {
  it("trims whichever end the variant names, line by line", () => {
    expect(trimLines("  a  \n  b  ", "both")).toBe("a\nb");
    expect(trimLines("  a  \n  b  ", "start")).toBe("a  \nb  ");
    expect(trimLines("  a  \n  b  ", "end")).toBe("  a\n  b");
  });

  it("collapses runs of whitespace, blank lines, or runs of blank lines", () => {
    expect(collapse("a   b\t\tc", "spaces")).toBe("a b c");
    expect(collapse("a\n\n\nb\n", "blank")).toBe("a\nb\n");
    expect(collapse("a\n\n\n\nb", "blank-one")).toBe("a\n\nb");
  });

  it("wraps at the column without breaking a word", () => {
    expect(wrapText("the quick brown fox jumps", 10, "words")).toBe("the quick\nbrown fox\njumps");
    expect(wrapText("a javascript keyword", 4, "words")).toBe("a\njavascript\nkeyword");
    expect(wrapText("a javascript keyword", 4, "anywhere")).toBe("a\njava\nscri\npt\nkeyw\nord");
  });

  it("keeps each line's own indent on what it wraps", () => {
    expect(wrapText("    hello world", 10, "words")).toBe("    hello\n    world");
    expect(wrapText("", 10, "words")).toBe("");
  });

  it("says so when the column is not a column", () => {
    expect(transform("some text", "wrap", "words", "").error).toMatch(/whole number/);
    expect(transform("some text", "wrap", "words", "0").error).toMatch(/whole number/);
    expect(transform("some text", "wrap", "words", "2.5").error).toMatch(/whole number/);
  });
});

describe("slug", () => {
  it("strips the accents and joins what is left", () => {
    expect(slugify("Héllo, Wörld!", "hyphen")).toBe("hello-world");
    expect(slugify("  Trailing punctuation --  ", "hyphen")).toBe("trailing-punctuation");
    expect(slugify("Hello World", "underscore")).toBe("hello_world");
    expect(slugify("Version 2.0 released", "hyphen")).toBe("version-2-0-released");
  });

  it("spells out a letter that has no accent to strip", () => {
    expect(slugify("Straße", "hyphen")).toBe("strasse");
    expect(slugify("Encyclopædia", "hyphen")).toBe("encyclopaedia");
  });

  it("never leaves the separator at either end, whichever it is", () => {
    expect(slugify("__weird__", "underscore")).toBe("weird");
    expect(slugify("a - b", "hyphen")).toBe("a-b");
  });
});

describe("entities", () => {
  it("escapes the five that markup reads, and nothing else", () => {
    expect(encodeEntities("<b>Tom & \"Jerry's\"</b>", "markup")).toBe(
      "&lt;b&gt;Tom &amp; &quot;Jerry&#39;s&quot;&lt;/b&gt;",
    );
    expect(encodeEntities("café", "markup")).toBe("café");
  });

  it("names what it can above ASCII and spells the rest as a code point", () => {
    expect(encodeEntities("café & ©", "all")).toBe("caf&eacute; &amp; &copy;");
    expect(encodeEntities("👍", "all")).toBe("&#x1F44D;");
  });

  it("reads back a name, a decimal and a hexadecimal reference", () => {
    expect(decodeEntities("&lt;b&gt; &amp;amp; &#233; &#x1F44D;")).toBe("<b> &amp; é 👍");
    expect(decodeEntities("caf&eacute; &nbsp;&hellip;")).toBe("café \u00a0…");
  });

  it("reads 128 to 159 as the Windows-1252 they were written in", () => {
    expect(decodeEntities("&#151;&#147;&#148;")).toBe("\u2014\u201c\u201d");
  });

  it("leaves alone what it cannot read", () => {
    expect(decodeEntities("a & b &nosuchname; &#xD800; 100&percnt")).toBe("a & b &nosuchname; &#xD800; 100&percnt");
  });

  it("agrees with the browser about every name it carries", () => {
    const parser = new DOMParser();
    for (const [name, code] of CODES) {
      const reference = `&${name};`;
      const inBrowser = parser.parseFromString(reference, "text/html").documentElement.textContent;
      expect(`${name} ${decodeEntities(reference)}`).toBe(`${name} ${inBrowser}`);
      expect(String.fromCodePoint(code)).toBe(inBrowser);
    }
  });
});

describe("escape", () => {
  it("escapes a JavaScript string and reads it back", () => {
    expect(escapeJs("line\n\"quoted\"\ttab\\", "escape")).toBe("line\\n\\\"quoted\\\"\\ttab\\\\");
    expect(escapeJs("it's `here`", "escape")).toBe("it\\'s \\`here\\`");
    expect(escapeJs("\u0001", "escape")).toBe("\\x01");
    expect(unescapeJs("line\\n\\\"quoted\\\"\\ttab\\\\")).toBe("line\n\"quoted\"\ttab\\");
    expect(unescapeJs("\\x41\\u0042\\u{1F44D}\\q")).toBe("AB👍q");
  });

  it("leaves a character above ASCII as itself unless it is asked not to", () => {
    expect(escapeJs("café 👍", "escape")).toBe("café 👍");
    expect(escapeJs("café 👍", "ascii")).toBe("caf\\u00E9 \\uD83D\\uDC4D");
    expect(unescapeJs("caf\\u00E9 \\uD83D\\uDC4D")).toBe("café 👍");
  });

  it("says which escape it could not read", () => {
    expect(() => unescapeJs("\\u12")).toThrow(/four hexadecimal/);
    expect(() => unescapeJs("\\xZZ")).toThrow(/two hexadecimal/);
    expect(() => unescapeJs("trailing \\")).toThrow(/escapes nothing/);
  });

  it("escapes a C string in octal and reads the bytes back as text", () => {
    expect(escapeC("a\nb\u0007", "escape")).toBe("a\\nb\\a");
    expect(escapeC("\u0001", "escape")).toBe("\\001");
    expect(escapeC("é", "ascii")).toBe("\\303\\251");
    expect(unescapeC("\\303\\251")).toBe("é");
    expect(unescapeC("caf\\xC3\\xA9\\n")).toBe("café\n");
    expect(unescapeC("\\u00E9 \\U0001F44D")).toBe("é 👍");
  });

  it("says when the escaped bytes spell nothing", () => {
    expect(() => unescapeC("\\377")).toThrow(/valid UTF-8/);
    expect(() => unescapeC("\\x1FF")).toThrow(/wider than the byte/);
  });

  it("quotes a shell word, which is the whole of escaping one", () => {
    expect(escapeShell("plain", "single")).toBe("'plain'");
    expect(escapeShell("it's", "single")).toBe("'it'\\''s'");
    expect(escapeShell("$HOME `id`", "double")).toBe("\"\\$HOME \\`id\\`\"");
    expect(escapeShell("", "single")).toBe("''");
  });

  it("takes one level of shell quoting back off", () => {
    expect(unquoteShell("'it'\\''s'")).toBe("it's");
    expect(unquoteShell("\"\\$HOME\" is $HOME")).toBe("$HOME is $HOME");
    expect(unquoteShell("one\\ word")).toBe("one word");
    expect(unquoteShell("\"a\\nb\"")).toBe("a\\nb");
    expect(() => unquoteShell("'unclosed")).toThrow(/never closed/);
  });

  it("doubles a quote for SQL, or escapes it the way MySQL reads one", () => {
    expect(escapeSql("O'Brien", "standard")).toBe("'O''Brien'");
    expect(escapeSql("a\nb\\c'd", "mysql")).toBe("'a\\nb\\\\c\\'d'");
    expect(unquoteSql("'O''Brien'")).toBe("O'Brien");
    expect(() => unquoteSql("O'Brien")).toThrow(/between single quotes/);
  });
});

describe("counts", () => {
  it("counts what the text is made of", () => {
    expect(count("hello world", "Characters")).toBe("11");
    expect(count("hello world", "Without spaces")).toBe("10");
    expect(count("hello world", "Words")).toBe("2");
    expect(count("one\ntwo\nthree", "Lines")).toBe("3");
    expect(count("café", "Bytes (UTF-8)")).toBe("5");
  });

  it("counts nothing for an empty text rather than one of anything", () => {
    expect(count("", "Characters")).toBe("0");
    expect(count("", "Words")).toBe("0");
    expect(count("", "Lines")).toBe("0");
    expect(count("   ", "Words")).toBe("0");
  });

  it("counts graphemes only where they differ from code points", () => {
    expect(count("hello", "Graphemes")).toBe("");
    expect(count("🇦🇺", "Characters")).toBe("2");
    expect(count("🇦🇺", "Graphemes")).toBe("1");
  });
});

describe("transform", () => {
  it("answers with nothing at all for an empty text", () => {
    expect(transform("", "camel", "", "80")).toEqual({ output: "", error: "" });
  });

  it("hands back the message rather than an output quietly missing", () => {
    expect(transform("nope", "sql", "unquote", "80")).toEqual({
      output: "",
      error: "A SQL string literal is written between single quotes",
    });
  });

  it("runs the operation the page names", () => {
    expect(transform("hello world", "constant", "", "80").output).toBe("HELLO_WORLD");
    expect(transform("b\na", "sort", "ascending", "80").output).toBe("a\nb");
    expect(transform("a b c", "wrap", "words", "3").output).toBe("a b\nc");
  });
});
