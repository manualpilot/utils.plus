import countries, { type Country } from "world-countries";
import { FALLBACK_COUNTRY, localCountryCode } from "../../common/local-country";
import { fold, rankedFilter, type SearchTerms, termRank } from "../../common/option-search";
import { DEFAULT_VIEW, VIEW_CODES } from "./shapes";

export type { Country };

export const COUNTRIES: readonly Country[] = [...countries]
  .sort((a, b) => a.name.common.localeCompare(b.name.common, "en"));

export const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country.cca2, label: country.name.common }));

export function findCountry(code: unknown): Country | undefined {
  return typeof code === "string" ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function pickCountry(code: unknown): Country {
  return findCountry(code) ?? findCountry(localCountryCode()) ?? findCountry(FALLBACK_COUNTRY) ?? COUNTRIES[0];
}

export function borderCountries(country: Country): Country[] {
  return country.borders.map((code) => BY_ALPHA3.get(code)).filter((border): border is Country => border !== undefined);
}

const BY_CODE = new Map(COUNTRIES.map((country) => [country.cca2, country]));
const BY_ALPHA3 = new Map(COUNTRIES.map((country) => [country.cca3, country]));

export const VIEW_OPTIONS = [
  { value: DEFAULT_VIEW, label: "Default" },
  ...VIEW_CODES
    .map((code) => ({ value: code, label: BY_CODE.get(code)?.name.common ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, "en")),
];

export const countryFilter = rankedFilter((code, needle) => termRank(SEARCH_TERMS.get(code), needle));

const SEARCH_TERMS = new Map(COUNTRIES.map((country) => [country.cca2, searchTerms(country)]));

function searchTerms(country: Country): SearchTerms {
  const rest = [
    country.name.official,
    ...country.altSpellings,
    ...country.capital,
    ...country.tld,
    ...Object.values(country.name.native).flatMap((name) => [name.common, name.official]),
    ...Object.values(country.translations).flatMap((name) => [name.common, name.official]),
  ];
  const codes = [country.cca2, country.cca3, country.ccn3, country.cioc].filter(Boolean);

  return {
    name: fold(country.name.common),
    codes: new Set(codes.map(fold)),
    rest: [fold([country.name.common, ...codes, ...rest].join(" "))],
  };
}
