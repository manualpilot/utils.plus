import { describe, expect, it } from "vitest";
import { columnTitle, parseRecords, readCsv, sniffDelimiter } from "../src/utilities/csv/parse";
import { cellText, compareCells, sortRows } from "../src/utilities/csv/rows";

const records = (text: string, delimiter = ",") => parseRecords(text, delimiter).records;

describe("parseRecords", () => {
  it("splits fields on the delimiter and records on either newline", () => {
    expect(records("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
    expect(records("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("keeps the last record when the document does not end on a newline", () => {
    expect(records("a,b")).toEqual([["a", "b"]]);
    expect(records("a,")).toEqual([["a", ""]]);
  });

  it("takes the delimiter and the newline inside a quoted field as text", () => {
    expect(records("a,\"b,c\"")).toEqual([["a", "b,c"]]);
    expect(records("a,\"b\nc\",d")).toEqual([["a", "b\nc", "d"]]);
  });

  it("reads a doubled quote inside a quoted field as one quote", () => {
    expect(records("\"27\"\" Monitor\",x")).toEqual([["27\" Monitor", "x"]]);
    expect(records("\"\",x")).toEqual([["", "x"]]);
  });

  it("leaves a quote in the middle of a bare field alone", () => {
    expect(records("a\"b,c")).toEqual([["a\"b", "c"]]);
  });

  it("runs an unclosed quote to the end of the document and says so", () => {
    const read = parseRecords("a,\"b\nc,d", ",");
    expect(read.records).toEqual([["a", "b\nc,d"]]);
    expect(read.unterminated).toBe(true);
    expect(parseRecords("a,\"b\"", ",").unterminated).toBe(false);
  });

  it("drops a blank line, and keeps an empty row somebody quoted", () => {
    expect(records("a\n\nb")).toEqual([["a"], ["b"]]);
    expect(records("")).toEqual([]);
    expect(records("\"\"")).toEqual([[""]]);
  });

  it("takes a byte order mark off the first title rather than into it", () => {
    expect(records("﻿id,name")).toEqual([["id", "name"]]);
  });

  it("splits on whatever delimiter it is handed", () => {
    expect(records("a\tb\tc", "\t")).toEqual([["a", "b", "c"]]);
    expect(records("a|b", "|")).toEqual([["a", "b"]]);
  });
});

describe("sniffDelimiter", () => {
  it("takes the one that splits every row evenly", () => {
    expect(sniffDelimiter("a,b,c\nd,e,f")).toBe(",");
    expect(sniffDelimiter("a;b;c\nd;e;f")).toBe(";");
    expect(sniffDelimiter("a\tb\tc\nd\te\tf")).toBe("\t");
    expect(sniffDelimiter("a|b\nc|d")).toBe("|");
  });

  it("is not fooled into reading a clock as three fields", () => {
    expect(sniffDelimiter("name,at\nada,12:30:00\nalan,09:15:00")).toBe(",");
  });

  it("falls back to the comma when nothing splits anything", () => {
    expect(sniffDelimiter("one\ntwo\nthree")).toBe(",");
    expect(sniffDelimiter("")).toBe(",");
  });

  it("prefers an even split to a wider uneven one", () => {
    expect(sniffDelimiter("a,b\nc|d|e|f\ng,h")).toBe(",");
  });
});

describe("readCsv", () => {
  it("takes the first record as the titles when it is asked to", () => {
    const table = readCsv("id,name\n1,Ada", "auto", true);
    expect(table.columns).toEqual(["id", "name"]);
    expect(table.rows).toEqual([["1", "Ada"]]);
  });

  it("names every column by its position when there is no header row", () => {
    const table = readCsv("1,Ada\n2,Alan", "auto", false);
    expect(table.columns).toEqual(["Column 1", "Column 2"]);
    expect(table.rows).toHaveLength(2);
  });

  it("reports the delimiter it settled on, and takes the one it is given", () => {
    expect(readCsv("a;b\nc;d", "auto", false).delimiter).toBe(";");
    expect(readCsv("a;b\nc;d", ",", false).delimiter).toBe(",");
  });

  it("widens the columns to the widest record and counts the rows that are not that wide", () => {
    const table = readCsv("id,name\n1,Ada,extra\n2", "auto", true);
    expect(table.columns).toEqual(["id", "name", "Column 3"]);
    expect(table.ragged).toBe(1);
  });

  it("counts no ragged rows when every record is the same width", () => {
    expect(readCsv("id,name\n1,Ada\n2,Alan", "auto", true).ragged).toBe(0);
  });

  it("has nothing to show for an empty document", () => {
    const table = readCsv("", "auto", true);
    expect(table.columns).toEqual([]);
    expect(table.rows).toEqual([]);
  });
});

describe("columnTitle", () => {
  it("stands in for a title that names nothing", () => {
    expect(columnTitle("id", 0)).toBe("id");
    expect(columnTitle("  ", 1)).toBe("Column 2");
    expect(columnTitle(undefined, 2)).toBe("Column 3");
  });
});

describe("sorting", () => {
  it("orders two numbers as numbers rather than as words", () => {
    expect(compareCells("9.99", "12.50")).toBeLessThan(0);
    expect(compareCells("12.50", "9.99")).toBeGreaterThan(0);
  });

  it("orders anything else the way words are ordered", () => {
    expect(compareCells("apple", "banana")).toBeLessThan(0);
    expect(compareCells("9.99", "banana")).toBeLessThan(0);
  });

  it("sorts the rows by one column and leaves the document's own order alone", () => {
    const rows = [["b", "2"], ["a", "10"], ["c", "1"]];
    expect(sortRows(rows, 0, "asc").map((row) => row[0])).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, 1, "asc").map((row) => row[1])).toEqual(["1", "2", "10"]);
    expect(sortRows(rows, 1, "desc").map((row) => row[1])).toEqual(["10", "2", "1"]);
    expect(rows[0][0]).toBe("b");
  });

  it("reads a field a short row does not have as an empty one", () => {
    expect(sortRows([["a"], ["b", "z"]], 1, "asc").map((row) => row[0])).toEqual(["a", "b"]);
  });
});

describe("cellText", () => {
  it("reads a field a row does not have as empty, and clips one nobody could read", () => {
    expect(cellText(["a"], 1)).toBe("");
    expect(cellText([`${"x".repeat(600)}`], 0)).toHaveLength(501);
  });
});
