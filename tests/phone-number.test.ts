import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { place, zoneWithOffset } from "../src/utilities/phone-number/geo";
import { exampleNumber, type Reading, readNumber } from "../src/utilities/phone-number/parse";
import { findRegion, pickRegion, REGION_OPTIONS, regionFilter, regionFlag, regionForInput, REGIONS, withRegion } from "../src/utilities/phone-number/regions";
import type { Short } from "../src/utilities/phone-number/short";
import { retype, retypeAll, type Typed } from "../src/utilities/phone-number/typing";

function region(code: string) {
  const found = findRegion(code);
  if (!found) throw new Error(`no region ${code}`);
  return found;
}

function read(input: string, code = "AU"): Reading {
  const result = readNumber(input, region(code));
  if (result.kind !== "reading") throw new Error(`${input} did not parse: ${JSON.stringify(result)}`);
  return result.reading;
}

function readShort(input: string, code = "AU"): Short | undefined {
  const result = readNumber(input, region(code));
  return result.kind === "short" ? result.short : undefined;
}

function formatted(input: string, label: string, code = "AU"): string {
  const format = read(input, code).formats.find((entry) => entry.label === label);
  if (!format) throw new Error(`no ${label} format`);
  return format.value;
}

const options = REGION_OPTIONS.map((option) => ({ ...option }));

function search(term: string): string[] {
  return regionFilter({ options, search: term, limit: Infinity })
    .flatMap((option) => "value" in option ? [String(option.value)] : []);
}

describe("the regions", () => {
  it("are the ones the library carries metadata for, in the order the labels read in", () => {
    expect(REGIONS.length).toBe(245);
    expect(new Set(REGIONS.map((entry) => entry.code)).size).toBe(REGIONS.length);

    const names = REGIONS.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("include the two dialling regions ISO has no country for", () => {
    expect(region("AC").name).toBe("Ascension Island");
    expect(region("TA").callingCode).toBe("290");
    expect(findRegion("SH")?.callingCode).toBe("290");
  });

  it("draws a flag out of the code itself rather than carrying one", () => {
    expect(regionFlag("AU")).toBe("\u{1F1E6}\u{1F1FA}");
    expect(regionFlag("GB")).toBe("\u{1F1EC}\u{1F1E7}");
    expect(REGIONS.every((entry) => /^\p{Regional_Indicator}{2}$/u.test(entry.flag))).toBe(true);
    expect(regionFlag("001")).toBe("");
  });

  it("labels an option with the name alone, so what the search box is seeded with is searchable", () => {
    expect(REGION_OPTIONS.find((option) => option.value === "AU")?.label).toBe("Australia");
    expect(REGION_OPTIONS.every((option) => !/\p{Regional_Indicator}/u.test(option.label))).toBe(true);
    expect(search("Australia")).toEqual(["AU"]);
  });

  it("falls back rather than fails, which is what opens a page on a link naming a region that has gone", () => {
    expect(pickRegion("NZ").name).toBe("New Zealand");
    expect(pickRegion("au").code).toBe("AU");
    expect(findRegion("ZZ")).toBeUndefined();
    expect(findRegion(42)).toBeUndefined();
    expect(pickRegion("ZZ")).toBe(pickRegion(undefined));
  });
});

describe("the picker's search", () => {
  it("puts an exactly typed code or dialling code first", () => {
    expect(search("AU")[0]).toBe("AU");
    expect(search("61")[0]).toBe("AU");
    expect(search("+61")[0]).toBe("AU");
  });

  it("prefers a name that begins with what was typed to one that merely holds it", () => {
    const indian = search("india");
    expect(indian[0]).toBe("IN");
    expect(indian).toContain("IO");
    expect(indian.indexOf("IN")).toBeLessThan(indian.indexOf("IO"));
  });

  it("finds a name through the marks a keyboard may not have", () => {
    expect(search("aland")).toContain("AX");
  });

  it("offers a dialling code somebody is part way through typing", () => {
    expect(search("35")).toContain("IE");
    expect(search("zzz")).toEqual([]);
  });
});

describe("a leading plus", () => {
  it("hands the country to the digits, whichever region was showing", () => {
    expect(regionForInput("+61 2 9374 4000", "US")).toBe("AU");
    expect(regionForInput("+44 20 7183 8750", "AU")).toBe("GB");
  });

  it("reads a shared calling code down to the region the whole number names", () => {
    expect(regionForInput("+1 416 555 0199", "US")).toBe("CA");
    expect(regionForInput("+1 202 555 0173", "CA")).toBe("US");
  });

  it("leaves a half-typed number on the region already chosen when both share the code", () => {
    expect(regionForInput("+1", "CA")).toBe("CA");
    expect(regionForInput("+1", "AU")).toBe("US");
    expect(regionForInput("+3", "AU")).toBeUndefined();
  });

  it("moves nothing without one, the digits then being national", () => {
    expect(regionForInput("0412 345 678", "AU")).toBeUndefined();
    expect(regionForInput("", "AU")).toBeUndefined();
  });

  it("stays put for a global calling code, which names no region to pick", () => {
    expect(regionForInput("+800 1234 5678", "AU")).toBeUndefined();
  });
});

describe("picking a country while the box holds an international number", () => {
  it("rewrites the calling code and keeps the rest exactly as it was typed", () => {
    expect(withRegion("+61 2 9374 4000", region("GB"))).toBe("+44 2 9374 4000");
    expect(withRegion("+12025550173", region("AU"))).toBe("+612025550173");
  });

  it("leaves a national number alone, the picker being what already says which country it is in", () => {
    expect(withRegion("0412 345 678", region("GB"))).toBe("0412 345 678");
    expect(withRegion("", region("GB"))).toBe("");
  });

  it("answers a bare plus with the code alone", () => {
    expect(withRegion("+", region("GB"))).toBe("+44");
  });
});

describe("reading a number", () => {
  it("says nothing at all about an empty box", () => {
    expect(readNumber("   ", region("AU"))).toEqual({ kind: "blank" });
  });

  it("reads a national number against the region it was given", () => {
    const reading = read("0412 345 678");
    expect(reading.valid).toBe(true);
    expect(reading.type).toBe("Mobile");
    expect(reading.region?.code).toBe("AU");
    expect(reading.callingCode).toBe("+61");
    expect(reading.nationalNumber).toBe("412345678");
  });

  it("writes the same number every way it is written", () => {
    expect(formatted("+61 2 9374 4000", "E.164")).toBe("+61293744000");
    expect(formatted("+61 2 9374 4000", "International")).toBe("+61 2 9374 4000");
    expect(formatted("+61 2 9374 4000", "National")).toBe("(02) 9374 4000");
    expect(formatted("+61 2 9374 4000", "RFC 3966")).toBe("tel:+61293744000");
    expect(read("+61 2 9374 4000").formats).toHaveLength(5);
    expect(read("+61 2 9374 4000").formats[4].label).toMatch(/^Dialling from /);
  });

  it("drops the dialling-from row when it would only repeat the national format", () => {
    const home = read("+61 2 9374 4000").formats;
    const abroad = read("+81 3 3224 9999").formats;
    const national = (formats: { label: string; value: string }[]) => formats[2].value;
    expect(home[4].value === "" || home[4].value !== national(home)).toBe(true);
    expect(abroad[4].value).not.toBe("");
    expect(abroad[4].value).not.toBe(national(abroad));
  });

  it("takes a number apart into the pieces it is dialled in", () => {
    const reading = read("+61 2 9374 4000");
    expect(reading.callingCode).toBe("+61");
    expect(reading.nationalNumber).toBe("293744000");
    expect(reading.type).toBe("Fixed line");
    expect(reading.carrierCode).toBe("");
    expect(read("+55 15 3411 2500", "BR").carrierCode).toBe("");
  });

  it("reads the area code out of the grouping the plan itself is written in", () => {
    expect(read("+61 2 9374 4000").areaCode).toBe("2");
    expect(read("+44 20 7183 8750").areaCode).toBe("20");
    expect(read("+1 415 555 0132", "US").areaCode).toBe("415");
    expect(read("+81 3 3224 9999").areaCode).toBe("3");
  });

  it("gives a mobile a destination code and no area code, except where the plan says otherwise", () => {
    const mobile = read("0412 345 678");
    expect(mobile.areaCode).toBe("");
    expect(mobile.destinationCode).toBe("412");

    const brazilian = read("+55 11 91234 5678", "BR");
    expect(brazilian.areaCode).toBe("11");
    expect(brazilian.destinationCode).toBe("11");
  });

  it("names no area in a plan that has none", () => {
    expect(read("+45 32 12 34 56", "DK").areaCode).toBe("");
    expect(read("+47 22 12 34 56", "NO").areaCode).toBe("");
    expect(read("+65 6123 4567", "SG").areaCode).toBe("");
    expect(read("+39 02 1234 5678", "IT").areaCode).toBe("02");
  });

  it("names no area for a number that is not anywhere", () => {
    expect(read("+1 800 555 0199", "US").areaCode).toBe("");
    expect(read("+1 800 555 0199", "US").destinationCode).toBe("800");
    expect(read("+800 1234 5678").areaCode).toBe("");
  });

  it("keeps an extension written either way", () => {
    expect(read("+61 2 9374 4000 ext. 123").extension).toBe("123");
    expect(read("+61 2 9374 4000;ext=99").extension).toBe("99");
    expect(read("+61 2 9374 4000").extension).toBe("");
  });

  it("reads a number spelled in letters no further than its digits", () => {
    const reading = read("1-800-FLOWERS", "US");
    expect(reading.nationalNumber).toBe("1800");
    expect(reading.valid).toBe(false);
  });

  it("says which way a number that is not valid failed", () => {
    expect(read("+61 2 93").possibility).toBe("Too short");
    expect(read("+61 2 9374 400012").possibility).toBe("Not a length numbers here are given");
  });

  it("keeps possible and valid apart, a number being able to fail only the second", () => {
    const reading = read("+61 2 9374");
    expect(reading.valid).toBe(false);
    expect(reading.possibility).toBe("Possible");
  });

  it("names no region for a global calling code", () => {
    expect(read("+800 1234 5678").region).toBeUndefined();
    expect(read("+800 1234 5678").callingCode).toBe("+800");
  });

  it("falls back to the country its calling code belongs to", () => {
    expect(read("+44 20", "GB").region?.code).toBe("GB");
    expect(read("+61 2 93").region?.code).toBe("AU");
    expect(read("+1 416 555 0199").region?.code).toBe("CA");
  });

  it("turns what the library threw into something written for the person typing", () => {
    expect(readNumber("abc", region("AU"))).toEqual({ kind: "error", message: "Not a phone number" });
    expect(readNumber("+999 999 999 999", region("AU"))).toEqual({
      kind: "error",
      message: "No country has that calling code",
    });
    expect(readNumber("+1234567890123456789", region("AU"))).toEqual({
      kind: "error",
      message: "Too long to be a phone number",
    });
  });
});

describe("the place a number is in", () => {
  const MAPS = join(import.meta.dirname, "../src/utilities/phone-number/maps");
  const asked: string[] = [];

  beforeAll(() => {
    if (!existsSync(MAPS)) throw new Error(`no maps at ${MAPS} — run \`npm run phone-geo\``);
    vi.stubGlobal("fetch", (url: string) => {
      asked.push(url);
      const name = url.split("/").pop()?.split("?")[0] ?? "";
      const file = readFileSync(join(MAPS, name), "utf8");
      return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(file)) });
    });
  });

  it("reads where the range was issued, who was given it and what the clock says", async () => {
    const found = await place(read("+86 138 0013 8000").number);
    expect(found.location).toBe("Beijing");
    expect(found.network).toBe("China Mobile");
    expect(found.zones).toEqual(["Asia/Shanghai"]);
  });

  it("leaves empty whatever the maps do not carry", async () => {
    const found = await place(read("+61 2 9374 4000").number);
    expect(found.location).toBe("");
    expect(found.zones).toEqual(["Australia/Sydney"]);
  });

  it("answers with the longest prefix the map has, and not the first", async () => {
    expect((await place(read("+1 416 555 0199").number)).location).toBe("Ontario");
    expect((await place(read("+1 212 555 0199").number)).location).toBe("New York, NY");
  });

  it("asks for a calling code's map once however many numbers of it are read", async () => {
    asked.length = 0;
    await place(read("+49 30 123456").number);
    const first = [...asked];
    expect(first.length).toBeGreaterThan(0);
    await place(read("+49 89 123456").number);
    expect(asked).toEqual(first);
  });

  it("says what the clock reads there rather than only which zone it is", () => {
    expect(zoneWithOffset("Australia/Sydney")).toMatch(/^Australia\/Sydney \(GMT[+-]\d+(?::\d+)?\)$/);
    expect(zoneWithOffset("Mars/Olympus_Mons")).toBe("Mars/Olympus_Mons");
  });
});

describe("a short code", () => {
  it("is answered as one rather than as a phone number that failed", () => {
    const emergency = readShort("000");
    expect(emergency?.emergency).toBe(true);
    expect(emergency?.cost).toBe("Toll free");
    expect(emergency?.digits).toBe("000");
    expect(emergency?.region.code).toBe("AU");
    expect(readShort("911", "US")?.emergency).toBe(true);
    expect(readShort("112", "DE")?.emergency).toBe(true);
  });

  it("is read against the region showing, being short only within one", () => {
    expect(readShort("611", "US")?.carrierSpecific).toBe(true);
    expect(readShort("611")).toBeUndefined();
    expect(read("611").valid).toBe(false);
  });

  it("says what it costs and what it is for", () => {
    const premium = readShort("19123456");
    expect(premium?.cost).toBe("Premium rate");
    expect(premium?.smsService).toBe(true);
    expect(premium?.emergency).toBe(false);
    expect(readShort("225")?.cost).toBe("Standard rate");
  });

  it("is never given the formats a real number has", () => {
    expect(readNumber("000", region("AU")).kind).toBe("short");
    expect(readShort("+61 2 9374 4000")).toBeUndefined();
    expect(readNumber("+61 2 9374 4000", region("AU")).kind).toBe("reading");
  });
});

describe("the placeholder", () => {
  it("is the library's own example of a mobile in that region", () => {
    expect(exampleNumber(region("AU"))).toBe("0412 345 678");
    expect(exampleNumber(region("US"))).toBe("(201) 555-0123");
    expect(read(exampleNumber(region("GB")), "GB").valid).toBe(true);
  });
});

describe("formatting as it is typed", () => {
  function type(chars: string, code = "AU"): Typed {
    let typed: Typed = { value: "", caret: 0 };
    for (const character of chars) {
      const value = typed.value.slice(0, typed.caret) + character + typed.value.slice(typed.caret);
      typed = retype({ value, caret: typed.caret + 1, previous: typed.value }, region(code).code);
    }
    return typed;
  }

  function backspace(typed: Typed, code = "AU"): Typed {
    const value = typed.value.slice(0, typed.caret - 1) + typed.value.slice(typed.caret);
    return retype({ value, caret: typed.caret - 1, previous: typed.value }, region(code).code);
  }

  it("spaces a number as the digits arrive", () => {
    expect(type("0412").value).toBe("0412");
    expect(type("04123").value).toBe("0412 3");
    expect(type("0412345678").value).toBe("0412 345 678");
    expect(type("+61293744000").value).toBe("+61 2 9374 4000");
  });

  it("leaves the caret after the character just typed and not at the end of the formatting", () => {
    expect(type("+61")).toEqual({ value: "+61", caret: 3 });
    expect(type("0412345678").caret).toBe(12);
  });

  it("keeps the caret where an edit in the middle left it", () => {
    const typed = retype({ value: "0412 9345 678", caret: 6, previous: "0412 345 678" }, "AU");
    expect(significantOf(typed.value)).toBe("04129345678");
    expect(significantOf(typed.value.slice(0, typed.caret))).toBe("04129");
  });

  it("takes the digit when a backspace lands on a separator the page put there", () => {
    expect(backspace({ value: "+61 2", caret: 4 })).toEqual({ value: "+62", caret: 2 });

    const between = backspace({ value: "0412 345 678", caret: 9 });
    expect(significantOf(between.value)).toBe("041234678");
    expect(between.value).toBe("0412 346 78");
    expect(significantOf(between.value.slice(0, between.caret))).toBe("041234");
  });

  it("takes only the digit when a backspace lands on one", () => {
    expect(backspace({ value: "0412 345 678", caret: 12 })).toEqual({ value: "0412 345 67", caret: 11 });
  });

  it("empties back to nothing rather than to a stray separator", () => {
    let typed = type("0412");
    while (typed.value !== "") typed = backspace(typed);
    expect(typed).toEqual({ value: "", caret: 0 });
  });

  it("leaves a value that already holds letters exactly as it is", () => {
    const alpha = { value: "1-800-FLOWERS", caret: 13, previous: "1-800-FLOWER" };
    expect(retype(alpha, "US")).toEqual({ value: "1-800-FLOWERS", caret: 13 });

    const extension = { value: "+61 2 9374 4000 ext. 12", caret: 23, previous: "+61 2 9374 4000 ext. 1" };
    expect(retype(extension, "AU").value).toBe("+61 2 9374 4000 ext. 12");
    expect(retypeAll("+61 2 9374 4000;ext=99", "AU")).toBe("+61 2 9374 4000;ext=99");
  });

  it("takes its own separators back the moment a letter arrives", () => {
    expect(retype({ value: "1 (800F", caret: 7, previous: "1 (800" }, "US")).toEqual({ value: "1800F", caret: 5 });
    expect(type("1-800-FLOWERS", "US").value).toBe("1800FLOWERS");
  });

  it("leaves the separators of a pasted value alone", () => {
    const pasted = { value: "1-800-FLOWERS", caret: 13, previous: "" };
    expect(retype(pasted, "US")).toEqual({ value: "1-800-FLOWERS", caret: 13 });
  });

  it("respaces the digits for the country the picker has moved to", () => {
    expect(retypeAll("0412 345 678", "AU")).toBe("0412 345 678");
    expect(retypeAll("0412 345 678", "NZ")).toBe("0412345678");
    expect(retypeAll("090-1234-5678", "JP")).toBe("090-1234-5678");
    expect(retypeAll("+61293744000", "GB")).toBe("+61 2 9374 4000");
  });

  it("hands back what it cannot format rather than dropping it", () => {
    expect(retypeAll("", "AU")).toBe("");
    expect(retypeAll("+612937440001234", "AU")).toBe("+61 2937440001234");
  });
});

function significantOf(text: string): string {
  return text.replace(/[^+\d]/g, "");
}
