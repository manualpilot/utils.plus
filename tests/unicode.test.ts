import { describe, expect, it } from "vitest";
import { categoryName, isInvisible, placeholder, readCharacters } from "../src/utilities/unicode/characters";
import { encodings, escapes, utf16, utf8 } from "../src/utilities/unicode/encode";
import { BLOCKS, EMOJI_GROUPS, filterSections, isGroup, type Key, keyLabel, keysLabel, keysOf, MAX_KEYS, readSearch, SECTIONS, typed } from "../src/utilities/unicode/keys";
import { nameOf } from "../src/utilities/unicode/names";
import { normalisations } from "../src/utilities/unicode/normalise";
import { readPoints, writePoints } from "../src/utilities/unicode/points";
import { findings } from "../src/utilities/unicode/risks";
import { valueAt } from "../src/utilities/unicode/table";
import categories from "../src/utilities/unicode/tables/categories.json";

function character(text: string) {
  return readCharacters(text)[0];
}

function fact(rows: { label: string; value: string }[], label: string): string {
  return rows.find((row) => row.label === label)?.value ?? "";
}

function kinds(text: string): string[] {
  return findings(readCharacters(text), text).map((finding) => finding.kind);
}

describe("readCharacters", () => {
  it("reads a text as its code points and not as the units it is stored in", () => {
    const found = readCharacters("a\u00E9\u{1F600}");
    expect(found.map(({ code }) => code)).toEqual([0x61, 0xE9, 0x1F600]);
    expect(found.map(({ at }) => at)).toEqual([0, 1, 2]);
  });

  it("answers the four properties Unicode publishes as ranges", () => {
    expect(character("A")).toMatchObject({ category: "Lu", script: "Latin", block: "Basic Latin", age: "1.1" });
    expect(character("\u0430")).toMatchObject({ category: "Ll", script: "Cyrillic", block: "Cyrillic" });
    expect(character("\u{1F600}")).toMatchObject({ category: "So", script: "Common", block: "Emoticons", age: "6.1" });
    expect(character("\u0378")).toMatchObject({ category: "Cn", script: "Unknown", block: "Greek and Coptic" });
  });

  it("carries the abbreviation and the ASCII a character can be taken for", () => {
    expect(character("\u200B").abbreviation).toBe("ZWSP");
    expect(character("\u00A0").abbreviation).toBe("NBSP");
    expect(character("\u0430").looksLike).toBe("a");
    expect(character("a").looksLike).toBe("");
  });

  it("says which characters have nothing to draw, and what to draw instead", () => {
    expect(isInvisible(character("\u200B"))).toBe(true);
    expect(isInvisible(character("\u00A0"))).toBe(true);
    expect(placeholder(character(" "))).toBe("SP");
    expect(isInvisible(character("a"))).toBe(false);
    expect(placeholder(character("\u200B"))).toBe("ZWSP");
    expect(placeholder(character("\uE000"))).toBe("\u25AF");
  });

  it("spells out every category the table actually uses", () => {
    for (const category of categories.values) expect(categoryName(category)).not.toBe(category);
  });
});

describe("the range tables", () => {
  it("agrees with the engine's own reading of the categories", () => {
    for (let code = 0; code <= 0x4FF; code++) {
      const text = String.fromCodePoint(code);
      const expected = CATEGORIES.find((name) => new RegExp(`\\p{General_Category=${name}}`, "u").test(text));
      expect([code, valueAt(categories, code)]).toEqual([code, expected ?? "Cn"]);
    }
  });
});

const CATEGORIES = [
  "Lu",
  "Ll",
  "Lt",
  "Lm",
  "Lo",
  "Mn",
  "Mc",
  "Me",
  "Nd",
  "Nl",
  "No",
  "Pc",
  "Pd",
  "Ps",
  "Pe",
  "Pi",
  "Pf",
  "Po",
  "Sm",
  "Sc",
  "Sk",
  "So",
  "Zs",
  "Zl",
  "Zp",
  "Cc",
  "Cf",
  "Cs",
  "Co",
];

describe("nameOf", () => {
  it("computes the names nobody wrote down", () => {
    expect(nameOf(0x4E00)).toBe("CJK UNIFIED IDEOGRAPH-4E00");
    expect(nameOf(0x20000)).toBe("CJK UNIFIED IDEOGRAPH-20000");
    expect(nameOf(0x17000)).toBe("TANGUT IDEOGRAPH-17000");
  });

  it("spells a Hangul syllable from the three jamo it is composed of", () => {
    expect(nameOf(0xAC00)).toBe("HANGUL SYLLABLE GA");
    expect(nameOf(0xC544)).toBe("HANGUL SYLLABLE A");
    expect(nameOf(0xD7A3)).toBe("HANGUL SYLLABLE HIH");
  });

  it("has nothing to say about a code point whose file has not been read", () => {
    expect(nameOf(0x41)).toBe("");
  });
});

describe("readPoints", () => {
  it("reads a code point however it was written", () => {
    expect(readPoints("U+0041 0042 0x43 \\u0044 \\u{45} &#x46;").text).toBe("ABCDEF");
  });

  it("reads the one decimal spelling as decimal and everything else as hex", () => {
    expect(readPoints("&#233;").text).toBe("\u00E9");
    expect(readPoints("233").text).toBe("\u0233");
  });

  it("takes a separator to be anything that is not a code point", () => {
    expect(readPoints("0041,0042\n0043").text).toBe("ABC");
    expect(readPoints("").text).toBe("");
  });

  it("says which token it could not read rather than dropping it", () => {
    expect(readPoints("0041 zzz").error).toMatch(/zzz is not a code point/);
    expect(readPoints("110000").error).toMatch(/past U\+10FFFF/);
    expect(readPoints("0041 zzz").text).toBe("");
  });

  it("writes the same text back out as the numbers it is stored under", () => {
    expect(writePoints("A\u00E9\u{1F600}")).toBe("U+0041 U+00E9 U+1F600");
    expect(readPoints(writePoints("Caf\u00E9")).text).toBe("Caf\u00E9");
  });
});

describe("encodings", () => {
  it("encodes a code point into each of the three encodings that hold one", () => {
    expect(utf8(0xE9)).toEqual([0xC3, 0xA9]);
    expect(utf16(0x1F600)).toEqual([0xD83D, 0xDE00]);
    expect(utf16(0xE9)).toEqual([0xE9]);

    const rows = encodings(character("\u{1F600}"));
    expect(fact(rows, "Code point")).toBe("U+1F600");
    expect(fact(rows, "UTF-8")).toBe("F0 9F 98 80");
    expect(fact(rows, "UTF-16")).toBe("D83D DE00");
    expect(fact(rows, "UTF-32")).toBe("0001F600");
  });

  it("leaves the rows a surrogate cannot fill empty rather than filling them with the replacement character", () => {
    const alone = character("\uD800");
    expect(fact(encodings(alone), "UTF-8")).toBe("");
    expect(fact(encodings(alone), "UTF-16")).toBe("D800");
    expect(fact(escapes(alone, ""), "URL")).toBe("");
  });
});

describe("escapes", () => {
  it("spells one code point every way a language asks for it", () => {
    const rows = escapes(character("\u00E9"), "LATIN SMALL LETTER E WITH ACUTE");
    expect(fact(rows, "JavaScript, Rust")).toBe("\\u{E9}");
    expect(fact(rows, "JSON, Java, C#")).toBe("\\u00E9");
    expect(fact(rows, "C, Python")).toBe("\\U000000E9");
    expect(fact(rows, "Python name")).toBe("\\N{LATIN SMALL LETTER E WITH ACUTE}");
    expect(fact(rows, "CSS")).toBe("\\0000E9");
    expect(fact(rows, "HTML, XML")).toBe("&#x00E9;");
    expect(fact(rows, "HTML decimal")).toBe("&#233;");
    expect(fact(rows, "URL")).toBe("%C3%A9");
  });

  it("writes the pair for anything above the basic plane, which is the form those three take", () => {
    const rows = escapes(character("\u{1F600}"), "GRINNING FACE");
    expect(fact(rows, "JSON, Java, C#")).toBe("\\uD83D\\uDE00");
    expect(fact(rows, "JavaScript, Rust")).toBe("\\u{1F600}");
  });

  it("has no name to write where the name has not arrived", () => {
    expect(fact(escapes(character("A"), ""), "Python name")).toBe("");
  });
});

describe("normalisations", () => {
  it("says which of the four the text is already in", () => {
    const forms = normalisations("Caf\u00E9");
    expect(forms.map(({ form }) => form)).toEqual(["NFC", "NFD", "NFKC", "NFKD"]);
    expect(forms[0]).toMatchObject({ same: true, characters: 4 });
    expect(forms[1]).toMatchObject({ same: false, text: "Cafe\u0301", characters: 5 });
  });

  it("replaces a compatibility character in the two forms that are for it and in neither of the others", () => {
    const forms = normalisations("\uFB01");
    expect(forms[0].text).toBe("\uFB01");
    expect(forms[2].text).toBe("fi");
  });
});

describe("the keyboard", () => {
  it("is Unicode's own blocks and its own emoji groups, in the order it puts them", () => {
    expect(BLOCKS[0]).toBe("Basic Latin");
    expect(BLOCKS).toContain("General Punctuation");
    expect(BLOCKS).not.toContain("No Block");
    expect(EMOJI_GROUPS).toContain("Smileys & Emotion");
    expect(EMOJI_GROUPS).toContain("Flags");
    expect(isGroup("Arrows")).toBe(true);
    expect(isGroup("Food & Drink")).toBe(true);
    expect(isGroup("Nonsense")).toBe(false);
    expect(isGroup(undefined)).toBe(false);
  });

  it("offers every character of a block, controls included", () => {
    const { keys, total } = keysOf("Basic Latin");
    expect(total).toBe(128);
    expect(keys).toHaveLength(128);
    expect(keys[0]).toMatchObject({ code: 0, text: "\u0000", label: "NUL", invisible: true });
    expect(keys.map(({ code }) => code)).toContain(0x41);
  });

  it("offers the emoji no block could, which is the sequences", () => {
    const flags = keysOf("Flags");
    const australia = flags.keys.find(({ text }) => text === "\u{1F1E6}\u{1F1FA}");
    expect(australia).toMatchObject({ name: "flag: Australia", code: null });

    const people = keysOf("People & Body");
    const family = people.keys.find(({ name }) => name === "family: man, woman, girl");
    expect([...(family?.text ?? "")].length).toBeGreaterThan(2);
  });

  it("takes the name from the emoji list, since a sequence has none of the standard's own", () => {
    const smileys = keysOf("Smileys & Emotion");
    expect(smileys.keys[0]).toMatchObject({ text: "\u{1F600}", name: "grinning face" });
    expect(keysOf("Basic Latin").keys[0].name).toBe("");
  });

  it("leaves out the two thousand skin-tone sequences and keeps the tones themselves", () => {
    const people = keysOf("People & Body");
    expect(people.keys.every(({ text }) => ![...text].some((one) => one >= "\u{1F3FB}" && one <= "\u{1F3FF}")))
      .toBe(true);
    expect(keysOf("Component").keys.map(({ name }) => name)).toContain("medium skin tone");
  });

  it("draws every emoji of a group, none of them being longer than the cap", () => {
    for (const group of EMOJI_GROUPS) {
      const { keys, total } = keysOf(group);
      expect([group, keys.length]).toEqual([group, total]);
      expect(total).toBeLessThanOrEqual(MAX_KEYS);
    }
  });

  it("leaves out the code points that are not characters at all", () => {
    expect(keysOf("High Surrogates")).toEqual({ keys: [], total: 0, sifted: false });
    const greek = keysOf("Greek and Coptic");
    expect(greek.total).toBeLessThan(0x400 - 0x370 + 1);
    expect(greek.keys.some(({ code }) => code === 0x378)).toBe(false);
  });

  it("caps a block nobody could read at once, and says how many there were", () => {
    const { keys, total } = keysOf("CJK Unified Ideographs");
    expect(keys).toHaveLength(MAX_KEYS);
    expect(total).toBe(0x9FFF - 0x4E00 + 1);
  });

  it("has nothing to offer for a block this version has never heard of", () => {
    expect(keysOf("Tengwar")).toEqual({ keys: [], total: 0, sifted: false });
  });

  it("is two sections, the emoji above the blocks, until a search leaves less of them", () => {
    expect(SECTIONS.map(({ name }) => name)).toEqual(["Emoji", "Blocks"]);
    expect(SECTIONS[1].groups).toEqual(BLOCKS);

    const found = filterSections(readSearch("arrow"));
    expect(found.map(({ name }) => name)).toEqual(["Emoji", "Blocks"]);
    expect(found[1].groups).toContain("Arrows");
    expect(found[1].groups).not.toContain("Basic Latin");

    expect(filterSections(readSearch("punctuation")).map(({ name }) => name)).toEqual(["Blocks"]);
    expect(filterSections(readSearch("Nonsense"))).toEqual([]);
  });

  it("looks inside the groups as well, by what it can read there without fetching anything", () => {
    expect(filterSections(readSearch("australia"))[0].groups).toContain("Flags");
    expect(filterSections(readSearch("grinning"))[0].groups).toContain("Smileys & Emotion");

    expect(filterSections(readSearch("2192")).flatMap(({ groups }) => groups)).toContain("Arrows");
    expect(filterSections(readSearch("\u2192")).flatMap(({ groups }) => groups)).toContain("Arrows");
    expect(filterSections(readSearch("rightwards")).flatMap(({ groups }) => groups)).not.toContain("Arrows");
  });

  it("narrows a group to what matched, unless the group is itself what matched", () => {
    const flags = keysOf("Flags", readSearch("australia"));
    expect(flags.keys.map(({ name }) => name)).toEqual(["flag: Australia"]);
    expect(flags).toMatchObject({ total: 1, sifted: true });

    const arrows = keysOf("Arrows", readSearch("2192"));
    expect(arrows.keys.map(({ code }) => code)).toEqual([0x2192]);

    const whole = keysOf("Arrows", readSearch("arrows"));
    expect(whole.sifted).toBe(false);
    expect(whole.total).toBe(112);
  });

  it("says what is drawn against what there was, in the words of whichever took the rest out", () => {
    expect(keysLabel(keysOf("Basic Latin"))).toBe("128 characters");
    expect(keysLabel(keysOf("CJK Unified Ideographs"))).toBe("512 of the 20992 in it");
    expect(keysLabel(keysOf("Flags", readSearch("australia")))).toBe("1 match");
    expect(keysLabel(keysOf("Smileys & Emotion", readSearch("face")))).toMatch(/^\d+ matches$/);
  });

  it("writes on a key whatever tells it from the one beside it", () => {
    expect(keyLabel(character("A"))).toBe("A");
    expect(keyLabel(character("\u200B"))).toBe("ZWSP");
    expect(keyLabel(character("\u2002"))).toBe("2002");
    expect(keyLabel(character("\u2003"))).toBe("2003");
  });

  it("types the characters into a text and the code points under them into a list of those", () => {
    const dash = key("\u2014");
    expect(typed(dash, "text", "abc")).toBe("\u2014");
    expect(typed(dash, "points", "")).toBe("U+2014 ");
    expect(typed(dash, "points", "U+0041 ")).toBe("U+2014 ");
    expect(typed(dash, "points", "U+0041")).toBe(" U+2014 ");
    expect(typed(key("\u{1F1E6}\u{1F1FA}"), "points", "")).toBe("U+1F1E6 U+1F1FA ");
  });
});

function key(text: string): Key {
  return { text, label: text, name: "", code: null, invisible: false };
}

describe("findings", () => {
  it("finds an override that is never closed, which is the whole of the Trojan Source trick", () => {
    const attack = "if (x) {\u202E return";
    const open = findings(readCharacters(attack), attack);
    expect(open[0]).toMatchObject({ kind: "bidi", serious: true });
    expect(open[0].label).toMatch(/left open/);

    const balanced = "a\u202Eb\u202C";
    const closed = findings(readCharacters(balanced), balanced);
    expect(closed[0]).toMatchObject({ kind: "bidi", serious: false });
  });

  it("finds a letter that is read as an ASCII one it is not", () => {
    const spoofed = "\u0430pple.com";
    const found = findings(readCharacters(spoofed), spoofed);
    expect(found.map(({ kind }) => kind)).toContain("homoglyph");
    expect(found.find(({ kind }) => kind === "homoglyph")?.codes).toEqual([0x430]);
  });

  it("finds the characters that take no space and the controls that are not line endings", () => {
    expect(kinds("in\u200Bvisible")).toContain("invisible");
    expect(kinds("hard\u00A0space")).toContain("invisible");
    expect(kinds("bell")).toContain("control");
    expect(kinds("one\ttwo\r\nthree four")).toEqual([]);
  });

  it("counts the scripts a text is written in, and does not count the ones every text is written in", () => {
    expect(kinds("\u0430pple")).toContain("mixed");
    expect(kinds("hello, world 123!")).not.toContain("mixed");
    expect(kinds("Cafe\u0301 (99%)")).not.toContain("mixed");
  });

  it("says when the text is not in NFC, which is what makes two texts that read alike compare as different", () => {
    expect(kinds("Cafe\u0301")).toContain("normalisation");
    expect(kinds("Caf\u00E9")).not.toContain("normalisation");
  });

  it("has nothing to say about a plain ASCII text", () => {
    expect(kinds("apple.com")).toEqual([]);
  });
});
