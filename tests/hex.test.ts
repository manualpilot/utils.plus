import { describe, expect, it } from "vitest";
import { formatHex, insert, isDirty, openDoc, overwrite, parseHex, remove, revert, toBase64 } from "../src/utilities/hex/bytes";
import { columnOf, dumpLines, formatByte, formatOffset, lineWidth, offsetDigits, rowCount, rowGlyphs, rowText, spotAt } from "../src/utilities/hex/dump";
import { encodeText, pickEncoding, TEXT_ENCODINGS, textLine } from "../src/utilities/hex/encodings";
import { textReadings, valueReadings } from "../src/utilities/hex/inspect";
import { countMatches, findNext, findPrevious, MATCH_CAP, needleFor, parseOffset } from "../src/utilities/hex/search";
import { sniff } from "../src/utilities/hex/signatures";

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => new TextEncoder().encode(text);
const reading = (rows: { label: string; value: string }[], label: string) =>
  rows.find((row) => row.label === label)?.value;
const found = (needle: { bytes: Uint8Array } | { error: string } | null) =>
  needle && "bytes" in needle ? Array.from(needle.bytes) : null;

describe("the document", () => {
  it("holds one copy of a file nothing has been written to", () => {
    const doc = openDoc(bytes(1, 2, 3));
    expect(doc.bytes).toBe(doc.original);
    expect(isDirty(doc)).toBe(false);
    expect(doc.changed.size).toBe(0);
  });

  it("leaves the bytes it arrived with alone once one is overwritten", () => {
    const original = bytes(1, 2, 3);
    const doc = overwrite(openDoc(original), 1, bytes(0xff));

    expect(Array.from(doc.bytes)).toEqual([1, 0xff, 3]);
    expect(Array.from(original)).toEqual([1, 2, 3]);
    expect(Array.from(doc.changed)).toEqual([1]);
    expect(isDirty(doc)).toBe(true);
  });

  it("counts nothing as written when the byte was already that byte", () => {
    const doc = overwrite(openDoc(bytes(1, 2, 3)), 1, bytes(2));
    expect(isDirty(doc)).toBe(false);
  });

  it("refuses to write past the end rather than growing the file", () => {
    const doc = openDoc(bytes(1, 2, 3));
    expect(overwrite(doc, 2, bytes(9, 9))).toBe(doc);
    expect(overwrite(doc, -1, bytes(9))).toBe(doc);
  });

  it("moves the marks an insertion pushed along", () => {
    const written = overwrite(openDoc(bytes(1, 2, 3, 4)), 3, bytes(0xff));
    const doc = insert(written, 1, bytes(0xaa, 0xbb));

    expect(Array.from(doc.bytes)).toEqual([1, 0xaa, 0xbb, 2, 3, 0xff]);
    expect(Array.from(doc.changed).sort((a, b) => a - b)).toEqual([1, 2, 5]);
  });

  it("takes the marks inside a deleted run away with the run", () => {
    let doc = openDoc(bytes(1, 2, 3, 4, 5));
    doc = overwrite(doc, 1, bytes(0xff));
    doc = overwrite(doc, 4, bytes(0xee));
    doc = remove(doc, 1, 2);

    expect(Array.from(doc.bytes)).toEqual([1, 4, 0xee]);
    expect(Array.from(doc.changed)).toEqual([2]);
  });

  it("gives the file back exactly as it arrived", () => {
    const original = bytes(1, 2, 3);
    const doc = revert(insert(overwrite(openDoc(original), 0, bytes(9)), 0, bytes(7)));

    expect(Array.from(doc.bytes)).toEqual([1, 2, 3]);
    expect(doc.bytes).toBe(original);
    expect(isDirty(doc)).toBe(false);
  });

  it("reads a run of bytes however somebody had it written down", () => {
    expect(Array.from(parseHex("ff d8 ff")!)).toEqual([0xff, 0xd8, 0xff]);
    expect(Array.from(parseHex("FFD8FF")!)).toEqual([0xff, 0xd8, 0xff]);
    expect(Array.from(parseHex("0xff,0xd8")!)).toEqual([0xff, 0xd8]);
    expect(Array.from(parseHex("\\xff\\xd8")!)).toEqual([0xff, 0xd8]);
    expect(parseHex("fff")).toBeNull();
    expect(parseHex("zz")).toBeNull();
    expect(parseHex("  ")).toBeNull();
  });

  it("spells bytes back out", () => {
    expect(formatHex(bytes(0x0f, 0xa0))).toBe("0fa0");
    expect(formatHex(bytes(0x0f, 0xa0), true, " ")).toBe("0F A0");
    expect(toBase64(ascii("abc"))).toBe("YWJj");
  });
});

describe("the dump", () => {
  it("lays a file out in rows", () => {
    expect(rowCount(0, 16)).toBe(0);
    expect(rowCount(1, 16)).toBe(1);
    expect(rowCount(32, 16)).toBe(2);
    expect(rowCount(33, 16)).toBe(3);
  });

  it("pads every offset to what the largest one needs", () => {
    expect(offsetDigits(16, 16)).toBe(4);
    expect(offsetDigits(0x10000, 16)).toBe(4);
    expect(offsetDigits(0x10001, 16)).toBe(6);
    expect(offsetDigits(1000, 10)).toBe(3);
    expect(formatOffset(26, 16, 4, false)).toBe("001a");
    expect(formatOffset(26, 16, 4, true)).toBe("001A");
    expect(formatOffset(26, 10, 3, false)).toBe("026");
  });

  it("spells a byte in two digits", () => {
    expect(formatByte(0, false)).toBe("00");
    expect(formatByte(0xab, true)).toBe("AB");
  });

  it("puts a byte at the column its digits belong in", () => {
    expect(columnOf(0)).toBe(0);
    expect(columnOf(1)).toBe(3);
    expect(columnOf(7)).toBe(21);
    expect(columnOf(8)).toBe(25);
    expect(columnOf(15)).toBe(46);
    expect(lineWidth(16)).toBe(48);
    expect(lineWidth(8)).toBe(23);
  });

  it("reads a column back as the byte it landed on", () => {
    expect(spotAt(0, 16)).toEqual({ index: 0, nibble: 0 });
    expect(spotAt(1, 16)).toEqual({ index: 0, nibble: 1 });
    expect(spotAt(2, 16)).toEqual({ index: 0, nibble: 0 });
    expect(spotAt(3, 16)).toEqual({ index: 1, nibble: 0 });
    expect(spotAt(25, 16)).toEqual({ index: 8, nibble: 0 });
    expect(spotAt(99, 16)).toEqual({ index: 15, nibble: 0 });
  });

  it("lays the bytes out a row at a time, padded where the file has run out", () => {
    const run = Uint8Array.from({ length: 20 }, (_, at) => at);
    expect(rowText(run, 0, 8, false)).toBe("00 01 02 03 04 05 06 07");
    expect(rowText(run, 2, 8, false)).toBe("10 11 12 13" + " ".repeat(12));
    expect(rowText(run, 2, 8, false)).toHaveLength(lineWidth(8));
    expect(rowText(run, 0, 8, true)).toBe("00 01 02 03 04 05 06 07");
    expect(rowText(Uint8Array.of(0xab), 0, 4, true)).toBe("AB" + " ".repeat(9));
  });

  it("writes the whole dump as one line a row", () => {
    const run = Uint8Array.from({ length: 10 }, (_, at) => at + 0xf0);
    expect(dumpLines(run, 8, false)).toEqual(["f0 f1 f2 f3 f4 f5 f6 f7", "f8 f9" + " ".repeat(18)]);
    expect(dumpLines(new Uint8Array(0), 16, false)).toEqual([""]);
  });

  it("draws the glyph column beside a row, blank past the end of the file", () => {
    const run = new TextEncoder().encode("hi");
    expect(rowGlyphs(run, 0, 4, pickEncoding("ascii"))).toBe("hi  ");
    expect(rowGlyphs(Uint8Array.of(0x00, 0x41), 0, 2, pickEncoding("ascii"))).toBe(".A");
  });
});

describe("the text column", () => {
  it("draws one glyph per byte and a full stop for the rest", () => {
    const ascii = pickEncoding("ascii");
    expect(textLine(bytes(0x41, 0x00, 0x7e, 0xff), ascii)).toBe("A.~.");
    expect(textLine(bytes(0x41, 0x00, 0x7e, 0xff), pickEncoding("latin1"))).toBe("A.~ÿ");
  });

  it("keeps the line the same length as the run", () => {
    const run = Uint8Array.from({ length: 256 }, (_, byte) => byte);
    for (const encoding of TEXT_ENCODINGS) {
      expect([...textLine(run, encoding)]).toHaveLength(256);
    }
  });

  it("draws CP437's control codes and box drawing", () => {
    const cp437 = pickEncoding("cp437");
    expect(cp437.glyph(0x00)).toBeNull();
    expect(cp437.glyph(0x01)).toBe("☺");
    expect(cp437.glyph(0x41)).toBe("A");
    expect(cp437.glyph(0xdb)).toBe("█");
  });

  it("takes a needle back to the bytes the column drew it from", () => {
    expect(Array.from(encodeText("AB", pickEncoding("ascii")) as Uint8Array)).toEqual([0x41, 0x42]);
    expect(Array.from(encodeText(" ", pickEncoding("cp437")) as Uint8Array)).toEqual([0x20]);
    expect(Array.from(encodeText("█", pickEncoding("cp437")) as Uint8Array)).toEqual([0xdb]);
    expect(Array.from(encodeText("é", pickEncoding("latin1")) as Uint8Array)).toEqual([0xe9]);
  });

  it("names the character an encoding has no byte for rather than dropping it", () => {
    expect(encodeText("é", pickEncoding("ascii"))).toEqual({ missing: "é" });
  });

  it("falls back to the first encoding for a name it does not know", () => {
    expect(pickEncoding("ebcdic").value).toBe("ascii");
    expect(pickEncoding(undefined).value).toBe("ascii");
  });
});

describe("the inspector", () => {
  it("reads the same bytes both ways round", () => {
    const run = bytes(0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08);
    expect(reading(valueReadings(run, 0, true), "UInt16")).toBe("513");
    expect(reading(valueReadings(run, 0, false), "UInt16")).toBe("258");
    expect(reading(valueReadings(run, 0, false), "UInt32")).toBe("16909060");
    expect(reading(valueReadings(run, 0, true), "Int8")).toBe("1");
    expect(reading(valueReadings(bytes(0xff), 0, true), "Int8")).toBe("-1");
    expect(reading(valueReadings(bytes(0xff), 0, true), "Binary")).toBe("11111111");
  });

  it("leaves out the readings a short run has no bytes for", () => {
    const rows = valueReadings(bytes(0x41), 0, true).filter((row) => row.value !== "");
    expect(rows.map((row) => row.label)).toEqual(["Binary", "Int8", "UInt8"]);
    expect(valueReadings(bytes(), 0, true)).toEqual([]);
  });

  it("reads a four-byte run as an instant", () => {
    expect(reading(valueReadings(bytes(0x00, 0x00, 0x00, 0x00), 0, false), "Unix time")).toBe("1970-01-01T00:00:00Z");
  });

  it("spells a GUID the way each end of the divide writes it", () => {
    const run = Uint8Array.from({ length: 16 }, (_, at) => at + 1);
    expect(reading(valueReadings(run, 0, false), "GUID")).toBe("01020304-0506-0708-090a-0b0c0d0e0f10");
    expect(reading(valueReadings(run, 0, true), "GUID")).toBe("04030201-0605-0807-090a-0b0c0d0e0f10");
  });

  it("reads a run as the text the byte-at-a-time column cannot", () => {
    const run = new TextEncoder().encode("héllo");
    expect(reading(textReadings(run, 0, run.length), "UTF-8")).toBe("héllo");
    expect(reading(textReadings(run, 0, run.length), "Hex")).toBe("68c3a96c6c6f");
  });

  it("draws a control code in a reading rather than losing it", () => {
    expect(reading(textReadings(ascii("a\nb"), 0, 3), "UTF-8")).toBe("a·b");
  });
});

describe("finding a run of bytes", () => {
  const haystack = ascii("the cat sat on the mat");

  it("reads a needle as hex or as what the column drew", () => {
    expect(needleFor("", "hex", pickEncoding("ascii"))).toBeNull();
    expect(found(needleFor("63 61 74", "hex", pickEncoding("ascii")))).toEqual([0x63, 0x61, 0x74]);
    expect(found(needleFor("cat", "text", pickEncoding("ascii")))).toEqual([0x63, 0x61, 0x74]);
    expect(needleFor("zz", "hex", pickEncoding("ascii"))).toHaveProperty("error");
    expect(needleFor("é", "text", pickEncoding("ascii"))).toHaveProperty("error");
  });

  it("finds the match at or after where it was asked from", () => {
    expect(findNext(haystack, ascii("at"), 0)).toBe(5);
    expect(findNext(haystack, ascii("at"), 6)).toBe(9);
    expect(findNext(haystack, ascii("the"), 1)).toBe(15);
  });

  it("wraps rather than running out", () => {
    expect(findNext(haystack, ascii("mat"), 20)).toBe(19);
    expect(findNext(haystack, ascii("the"), 20)).toBe(0);
    expect(findPrevious(haystack, ascii("mat"), 5)).toBe(19);
  });

  it("walks backwards from where it was asked", () => {
    expect(findPrevious(haystack, ascii("at"), 21)).toBe(20);
    expect(findPrevious(haystack, ascii("at"), 19)).toBe(9);
  });

  it("answers -1 for a needle that is nowhere", () => {
    expect(findNext(haystack, ascii("dog"), 0)).toBe(-1);
    expect(findPrevious(haystack, ascii("dog"), 10)).toBe(-1);
  });

  it("counts what there is, and stops counting at the ceiling", () => {
    expect(countMatches(haystack, ascii("at"))).toBe(3);
    expect(countMatches(haystack, ascii("dog"))).toBe(0);
    expect(countMatches(new Uint8Array(MATCH_CAP * 2), bytes(0))).toBe(MATCH_CAP);
  });

  it("reads an offset as decimal, or as hex when it is spelled like hex", () => {
    expect(parseOffset("16", 1000)).toBe(16);
    expect(parseOffset("0x10", 1000)).toBe(16);
    expect(parseOffset("1a", 1000)).toBe(26);
    expect(parseOffset("1 000", 2000)).toBe(1000);
    expect(parseOffset("", 1000)).toHaveProperty("error");
    expect(parseOffset("zz", 1000)).toHaveProperty("error");
    expect(parseOffset("1000", 1000)).toHaveProperty("error");
  });
});

describe("what the first bytes say a file is", () => {
  it("names the formats a hex dump opens on", () => {
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("PNG image");
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("JPEG image");
    expect(sniff(ascii("%PDF-1.7"))).toBe("PDF document");
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04))).toBe("Zip archive (or a format built on one)");
    expect(sniff(bytes(0x7f, 0x45, 0x4c, 0x46))).toBe("ELF executable");
  });

  it("reads past a wrapper that says nothing on its own", () => {
    const riff = (kind: string) => new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii(kind)]);
    expect(sniff(riff("WEBP"))).toBe("WebP image");
    expect(sniff(riff("WAVE"))).toBe("WAVE audio");
  });

  it("falls back to reading it as text, and to nothing at all", () => {
    expect(sniff(ascii("hello, world\n"))).toBe("Text (UTF-8)");
    expect(sniff(bytes(0x68, 0xe9, 0x6c, 0x6c, 0x6f))).toBe("Text (single-byte)");
    expect(sniff(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
    expect(sniff(bytes())).toBeNull();
  });
});
