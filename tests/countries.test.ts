import { describe, expect, it, vi } from "vitest";
import { areaText, callingCodes, coordinates, currencyRows, decimalDegrees, demonymRows, languageName, languageRows, nativeNameRows } from "../src/utilities/countries/facts";
import { borderCountries, COUNTRIES, COUNTRY_OPTIONS, countryFilter, findCountry, pickCountry } from "../src/utilities/countries/list";
import { FALLBACK_COUNTRY, localCountryCode } from "../src/utilities/countries/local";

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
