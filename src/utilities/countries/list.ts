import type { ComboboxParsedItem, OptionsFilter } from "@mantine/core";
import countries, { type Country } from "world-countries";
import { FALLBACK_COUNTRY, localCountryCode } from "../../common/local-country";
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

export const countryFilter: OptionsFilter = ({ options, search }) => {
  const needle = fold(search.trim());
  if (!needle) return options;

  return options
    .flatMap((option) => {
      const rank = isItem(option) ? rankOf(String(option.value), needle) : NO_MATCH;
      return rank === NO_MATCH ? [] : [{ option, rank }];
    })
    .sort((a, b) => a.rank - b.rank)
    .map((match) => match.option);
};

function rankOf(code: string, needle: string): number {
  const terms = SEARCH_TERMS.get(code);
  if (!terms) return NO_MATCH;
  if (terms.codes.has(needle)) return 0;
  if (terms.name.startsWith(needle)) return 1;
  if (terms.name.includes(needle)) return 2;
  return terms.everything.includes(needle) ? 3 : NO_MATCH;
}

const NO_MATCH = Number.MAX_SAFE_INTEGER;

function isItem(option: ComboboxParsedItem): option is Extract<ComboboxParsedItem, { value: unknown }> {
  return "value" in option;
}

const SEARCH_TERMS = new Map(COUNTRIES.map((country) => [country.cca2, searchTerms(country)]));

interface SearchTerms {
  name: string;
  codes: Set<string>;
  everything: string;
}

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
    everything: fold([country.name.common, ...codes, ...rest].join(" ")),
  };
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
