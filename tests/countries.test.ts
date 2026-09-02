import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_COUNTRY, localCountryCode } from "../src/common/local-country";
import { areaText, callingCodes, coordinates, currencyRows, decimalDegrees, demonymRows, languageName, languageRows, nativeNameRows } from "../src/utilities/countries/facts";
import { borderCountries, COUNTRIES, COUNTRY_OPTIONS, countryFilter, findCountry, pickCountry, VIEW_OPTIONS } from "../src/utilities/countries/list";
import { type Box, flight, type Framing, mapOf, prepare } from "../src/utilities/countries/map";
import { boundariesOf, DEFAULT_VIEW, localView, pickView, type View, VIEW_CODES } from "../src/utilities/countries/shapes";

function country(code: string) {
  const found = findCountry(code);
  if (!found) throw new Error(`no country ${code}`);
  return found;
}

const options = COUNTRY_OPTIONS.map((option) => ({ ...option }));

function search(term: string): string[] {
  return countryFilter({ options, search: term, limit: Infinity })
    .flatMap((option) => "value" in option ? [String(option.value)] : []);
}

describe("the list", () => {
  it("is every country the library ships, in the order the labels read in", () => {
    expect(COUNTRIES.length).toBe(250);
    expect(COUNTRIES[0].name.common).toBe("Afghanistan");
    expect(new Set(COUNTRIES.map((entry) => entry.cca2)).size).toBe(COUNTRIES.length);

    const names = COUNTRIES.map((entry) => entry.name.common);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("labels an option with the name alone, so what the search box is seeded with is searchable", () => {
    const australia = COUNTRY_OPTIONS.find((option) => option.value === "AU");
    expect(australia?.label).toBe("Australia");
    expect(COUNTRY_OPTIONS.every((option) => !/\p{Regional_Indicator}/u.test(option.label))).toBe(true);
    expect(search(String(australia?.label))).toEqual(["AU"]);
  });

  it("looks a country up by either of its codes and by neither of anything else's", () => {
    expect(country("AU").name.common).toBe("Australia");
    expect(country("au").cca3).toBe("AUS");
    expect(findCountry("AUS")).toBeUndefined();
    expect(findCountry("ZZ")).toBeUndefined();
    expect(findCountry(42)).toBeUndefined();
  });

  it("falls back rather than fails, which is what opens a page on a link naming a country that has gone", () => {
    expect(pickCountry("NZ").name.common).toBe("New Zealand");
    expect(pickCountry("ZZ")).toBe(pickCountry(undefined));
    expect(pickCountry(null).cca2).toBe(localCountryCode());
  });

  it("reads a land border back as the country it names", () => {
    expect(borderCountries(country("AU"))).toEqual([]);
    expect(borderCountries(country("PT")).map((border) => border.cca2)).toEqual(["ES"]);
    expect(borderCountries(country("CN")).map((border) => border.cca2)).toContain("HK");
    expect(borderCountries(country("CN"))).toHaveLength(country("CN").borders.length);
  });
});

describe("the picker's search", () => {
  it("answers to a code as readily as to a name", () => {
    expect(search("australia")).toEqual(["AU"]);
    expect(search("AUS")).toContain("AU");
    expect(search("036")).toContain("AU");
    expect(search(".au")).toContain("AU");
  });

  it("answers to a name typed without its diacritics", () => {
    expect(search("cote d'ivoire")).toContain("CI");
    expect(search("Côte d'Ivoire")).toContain("CI");
    expect(search("aland")).toContain("AX");
  });

  it("answers to what a country calls itself and to what everybody else calls it", () => {
    expect(search("deutschland")).toContain("DE");
    expect(search("allemagne")).toContain("DE");
    expect(search("nippon")).toContain("JP");
    expect(search("canberra")).toContain("AU");
  });

  it("ranks a code above a name it begins, and a name above anything a translation happens to hold", () => {
    expect(search("de")[0]).toBe("DE");
    expect(search("aus")[0]).toBe("AU");
    expect(search("036")).toEqual(["AU"]);

    expect(search("uni").slice(0, 4)).toEqual(["AE", "GB", "US", "UM"]);
    const ranked = search("uni");
    expect(ranked.indexOf("RE")).toBeGreaterThan(ranked.indexOf("US"));
    expect(ranked.indexOf("RE")).toBeLessThan(ranked.indexOf("MX"));
  });

  it("offers the whole list for an empty box and none of it for a word no country answers to", () => {
    expect(search("")).toHaveLength(COUNTRIES.length);
    expect(search("   ")).toHaveLength(COUNTRIES.length);
    expect(search("atlantis")).toEqual([]);
  });
});

describe("where the browser thinks it is", () => {
  it("takes the country off the clock before it takes it off a language", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
      { timeZone: "Europe/Berlin" } as Intl.ResolvedDateTimeFormatOptions,
    );
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);

    expect(localCountryCode()).toBe("DE");
    vi.restoreAllMocks();
  });

  it("knows both spellings of a zone, since which one a browser reports is its ICU's business", () => {
    for (const [timeZone, expected] of [["Asia/Calcutta", "IN"], ["Asia/Kolkata", "IN"], ["Europe/Kyiv", "UA"]]) {
      vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
        { timeZone } as Intl.ResolvedDateTimeFormatOptions,
      );
      expect(localCountryCode()).toBe(expected);
    }
    vi.restoreAllMocks();
  });

  it("takes a region off the language when the clock belongs to no country", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
      { timeZone: "UTC" } as Intl.ResolvedDateTimeFormatOptions,
    );
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en", "fr-CA", "de-DE"]);

    expect(localCountryCode()).toBe("CA");
    vi.restoreAllMocks();
  });

  it("opens on Australia rather than maximise a bare language into the country its speakers mostly live in", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
      { timeZone: "Etc/UTC" } as Intl.ResolvedDateTimeFormatOptions,
    );
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en", "not a tag at all"]);

    expect(localCountryCode()).toBe(FALLBACK_COUNTRY);
    expect(FALLBACK_COUNTRY).toBe("AU");
    vi.restoreAllMocks();
  });
});

describe("the facts", () => {
  it("joins a dialling root to each of its suffixes, and says nothing where there is no root", () => {
    expect(callingCodes(country("AU"))).toEqual(["+61"]);
    expect(callingCodes(country("CI"))).toEqual(["+225"]);
    expect(callingCodes(country("RU"))).toEqual(["+73", "+74", "+75", "+78", "+79"]);
    expect(callingCodes(country("US"))).toHaveLength(380);
    expect(callingCodes(country("AQ"))).toEqual([]);
  });

  it("gives an area in both units, and none at all where the data does not know it", () => {
    expect(areaText(country("AU"))).toBe("7,692,024\u00a0km² (2,969,907.07\u00a0sq\u00a0mi)");
    expect(areaText(country("MC"))).toBe("2.02\u00a0km² (0.78\u00a0sq\u00a0mi)");
    expect(areaText(country("SJ"))).toBe("");
  });

  it("writes coordinates in degrees, carrying the rounding rather than reading sixty seconds", () => {
    expect(coordinates(country("AU"))).toBe("27°00′00″S 133°00′00″E");
    expect(decimalDegrees(country("AU"))).toBe("-27, 133");
    expect(coordinates(country("AW"))).toBe("12°30′00″N 69°58′00″W");
  });

  it("names a language by the code the data keys it on", () => {
    expect(languageName("eng")).toBe("English");
    expect(languageName("per")).toBe("Persian");
    expect(languageName("zdj")).toBe("Comorian");
    expect(languageName("qqq")).toBe("qqq");
  });

  it("reads the tables the country carries", () => {
    expect(currencyRows(country("AU"))).toEqual([{ code: "AUD", name: "Australian dollar", symbol: "$" }]);
    expect(currencyRows(country("CH")).map((row) => row.code)).toEqual(["CHF"]);
    expect(languageRows(country("CH"))).toContainEqual({ code: "roh", name: "Romansh" });
    expect(nativeNameRows(country("AU"))).toEqual([
      { language: "English", common: "Australia", official: "Commonwealth of Australia" },
    ]);
    expect(nativeNameRows(country("AQ"))).toEqual([]);
    expect(demonymRows(country("AU"))).toContainEqual({
      language: "French",
      masculine: "Australien",
      feminine: "Australienne",
    });
  });
});

const SHAPES = join(import.meta.dirname, "../src/utilities/countries");

function boundaryFile(name: string): View {
  const file = join(SHAPES, name);
  if (!existsSync(file)) throw new Error(`no boundaries at ${file} — run \`npm run country-shapes\``);
  return JSON.parse(readFileSync(file, "utf8")) as View;
}

const BASE = boundaryFile("world.json");
const DEFAULT_BOUNDARIES = boundariesOf(BASE, undefined, DEFAULT_VIEW);
const CHINA_BOUNDARIES = boundariesOf(BASE, boundaryFile("views/CN.json"), "CN");

function drawn(code: string, boundaries = DEFAULT_BOUNDARIES, from?: Framing) {
  const found = country(code);
  const [latitude, longitude] = found.latlng;
  return mapOf(
    prepare(boundaries.shapes),
    prepare(boundaries.world),
    code,
    borderCountries(found).map((border) => border.cca2),
    { longitude, latitude, across: found.area > 0 ? 2 * Math.sqrt(found.area) / 111 : 6 },
    from,
  );
}

function framingOf(code: string): Framing {
  const map = drawn(code);
  if (!map) throw new Error(`no map of ${code}`);
  return map.framing;
}

function opening(keyframe: Keyframe): { x: number; y: number; scale: number } {
  const read = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)$/.exec(String(keyframe.transform));
  if (!read) throw new Error(`not a flight: ${String(keyframe.transform)}`);
  return { x: Number(read[1]), y: Number(read[2]), scale: Number(read[3]) };
}

function ringsIn(path: string | undefined): number {
  return (path?.match(/M/g) ?? []).length;
}

function acrossIn(path: string): [number, number] {
  const across = [...path.matchAll(/[ML](-?[\d.]+) /g)].map((point) => Number(point[1]));
  return [Math.min(...across), Math.max(...across)];
}

describe("the point of view", () => {
  it("offers Natural Earth's own set and every country it authors one for, named as the page names them", () => {
    expect(VIEW_OPTIONS[0]).toEqual({ value: DEFAULT_VIEW, label: "Default" });
    expect(VIEW_OPTIONS).toHaveLength(VIEW_CODES.length + 1);
    expect(VIEW_OPTIONS).toContainEqual({ value: "CN", label: "China" });
    expect(VIEW_OPTIONS).toContainEqual({ value: "GB", label: "United Kingdom" });
    expect(VIEW_OPTIONS.every((option) => !/\p{Regional_Indicator}/u.test(option.label))).toBe(true);

    const labels = VIEW_OPTIONS.slice(1).map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("opens on the reader's own view where Natural Earth publishes one, and on the default where it does not", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
      { timeZone: "Europe/Berlin" } as Intl.ResolvedDateTimeFormatOptions,
    );
    expect(localView()).toBe("DE");
    expect(pickView(undefined)).toBe("DE");

    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue(
      { timeZone: "Australia/Sydney" } as Intl.ResolvedDateTimeFormatOptions,
    );
    expect(localView()).toBe(DEFAULT_VIEW);
    vi.restoreAllMocks();
  });

  it("falls back rather than fails, which is what opens a link naming a view that has since gone", () => {
    expect(pickView("CN")).toBe("CN");
    expect(pickView("cn")).toBe("CN");
    expect(pickView(DEFAULT_VIEW)).toBe(DEFAULT_VIEW);
    expect(pickView("AU")).toBe(localView());
    expect(pickView("ZZ")).toBe(localView());
    expect(pickView(42)).toBe(localView());
  });

  it("draws the default view for a code that names no published one, whatever it was asked for", () => {
    expect(boundariesOf(BASE, undefined, "CN").view).toBe(DEFAULT_VIEW);
  });
});

describe("the boundaries", () => {
  it("has one for every country the picker offers, or says which country holds the land instead", () => {
    for (const entry of COUNTRIES) {
      const shape = DEFAULT_BOUNDARIES.world[entry.cca2];
      const absent = DEFAULT_BOUNDARIES.absent[entry.cca2];
      expect(shape !== undefined || absent !== undefined, `${entry.cca2} is in neither`).toBe(true);
      expect(shape !== undefined && absent !== undefined, `${entry.cca2} is in both`).toBe(false);
    }
    expect(Object.keys(DEFAULT_BOUNDARIES.absent).sort()).toEqual(
      ["BQ", "BV", "CC", "CX", "GF", "GP", "MQ", "RE", "SJ", "TK", "YT"],
    );
    expect(DEFAULT_BOUNDARIES.absent.RE).toBe("FR");
  });
});

describe("the map", () => {
  it("frames a country on what is near enough to it to be one place", () => {
    expect(ringsIn(drawn("AU")?.own)).toBe(2);
    expect(DEFAULT_BOUNDARIES.world.FR.length).toBe(7);
    expect(ringsIn(drawn("FR")?.own)).toBe(2);
    expect(drawn("FR")?.rest.map((land) => land.code)).not.toContain("BR");
    expect(drawn("FR")?.borders.map((land) => land.code).sort()).toEqual(
      ["AD", "BE", "CH", "DE", "ES", "IT", "LU", "MC"],
    );
  });

  it("draws a country either side of the antimeridian as one place", () => {
    const fiji = drawn("FJ")?.own;
    expect(ringsIn(fiji)).toBeGreaterThan(20);
    const [west, east] = acrossIn(String(fiji));
    expect(west).toBeGreaterThan(0);
    expect(east).toBeLessThan(1000);
  });

  it("draws the smallest country at a size somebody can see", () => {
    const [west, east] = acrossIn(String(drawn("VA")?.own));
    expect(east - west).toBeGreaterThan(100);
    expect(drawn("VA")?.borders.map((land) => land.code)).toEqual(["IT"]);
  });

  it("frames a country with no boundary on where the list says it is", () => {
    const reunion = drawn("RE");
    expect(reunion?.own).toBeUndefined();
    expect(reunion?.rest.map((land) => land.code)).toEqual(["FR"]);
  });

  it("flies from where the last map was framed, over everything the flight passes across", () => {
    const estonia = drawn("EE", DEFAULT_BOUNDARIES, framingOf("RU"));
    const opened = estonia?.from as Box;
    expect(opened).toBeDefined();
    expect(opened.right - opened.left).toBeGreaterThan(10000);

    expect(estonia?.rest.length).toBeGreaterThan(3 * Number(drawn("EE")?.rest.length));

    const russia = drawn("RU", DEFAULT_BOUNDARIES, framingOf("EE"));
    const closed = russia?.from as Box;
    expect(closed).toBeDefined();
    expect(closed.right - closed.left).toBeLessThan(100);
  });

  it("cuts rather than fly where the two frames have nothing in common", () => {
    expect(drawn("IS", DEFAULT_BOUNDARIES, framingOf("AU"))?.from).toBeUndefined();
    expect(drawn("PT", DEFAULT_BOUNDARIES, framingOf("PT"))?.from).toBeUndefined();
  });

  it("opens a flight over the frame it is flown from and lands on the whole box", () => {
    const frames = flight({ left: 250, top: 125, right: 750, bottom: 375 }, 1.6);
    const [first] = frames;
    const last = frames[frames.length - 1];

    expect(opening(first)).toEqual({ x: -500, y: -250, scale: 2 });
    expect(first.strokeWidth).toBe(0.8);
    expect(opening(last)).toEqual({ x: 0, y: 0, scale: 1 });
    expect(last.strokeWidth).toBe(1.6);

    expect(opening(frames[frames.length >> 1]).scale).toBeCloseTo(Math.SQRT2, 6);
  });

  it("draws a point of view as that view has it", () => {
    expect(CHINA_BOUNDARIES.absent).toMatchObject({ TW: "CN", XK: "RS" });
    expect(CHINA_BOUNDARIES.shapes.TW).toBeUndefined();
    expect(CHINA_BOUNDARIES.view).toBe("CN");
    const taiwan = drawn("TW", CHINA_BOUNDARIES);
    expect(taiwan?.own).toBeUndefined();
    expect(taiwan?.rest.map((land) => land.code)).toContain("CN");
    expect(CHINA_BOUNDARIES.shapes.AU).toBe(DEFAULT_BOUNDARIES.world.AU);
  });
});
