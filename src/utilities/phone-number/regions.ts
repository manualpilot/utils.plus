import { type CountryCode, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js/max";
import metadata from "libphonenumber-js/metadata.max";
import { FALLBACK_COUNTRY, localCountryCode } from "../../common/local-country";
import { fold, NO_MATCH, rankedFilter } from "../../common/option-search";

export type { CountryCode };

export interface Region {
  code: CountryCode;
  name: string;
  flag: string;
  callingCode: string;
}

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });

export function regionFlag(code: string): string {
  if (!TWO_LETTERS.test(code)) return "";
  const indicator = (letter: string) => String.fromCodePoint(FIRST_INDICATOR + letter.charCodeAt(0) - FIRST_LETTER);
  return [...code].map(indicator).join("");
}

const TWO_LETTERS = /^[A-Z]{2}$/;
const FIRST_INDICATOR = 0x1f1e6;
const FIRST_LETTER = "A".charCodeAt(0);

export const REGIONS: readonly Region[] = getCountries()
  .map((code) => ({
    code,
    name: REGION_NAMES.of(code) ?? code,
    flag: regionFlag(code),
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const BY_CODE = new Map<string, Region>(REGIONS.map((region) => [region.code, region]));

const MAIN_REGIONS = new Map<string, CountryCode>(
  Object.entries(metadata.country_calling_codes)
    .flatMap(([calling, countries]) => countries[0] ? [[calling, countries[0]] as [string, CountryCode]] : []),
);

export function mainRegion(callingCode: string): CountryCode | undefined {
  return MAIN_REGIONS.get(callingCode);
}

export const REGION_OPTIONS = REGIONS.map((region) => ({ value: region.code, label: region.name }));

export function findRegion(code: unknown): Region | undefined {
  return typeof code === "string" ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function pickRegion(code: unknown): Region {
  return findRegion(code) ?? findRegion(localCountryCode()) ?? findRegion(FALLBACK_COUNTRY) ?? REGIONS[0];
}

export const HOME_REGION = pickRegion(undefined);

export function regionForInput(input: string, current: CountryCode): CountryCode | undefined {
  if (!input.trimStart().startsWith("+")) return undefined;
  const parsed = parsePhoneNumberFromString(input)?.country;
  if (parsed) return parsed;

  const calling = callingCodePrefix(input);
  if (!calling) return undefined;
  return findRegion(current)?.callingCode === calling ? current : MAIN_REGIONS.get(calling);
}

export function withRegion(input: string, region: Region): string {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("+")) return input;

  const calling = callingCodePrefix(trimmed);
  if (!calling) return `+${region.callingCode}`;

  const after = trimmed.slice(1);
  let digits = 0;
  let at = 0;
  while (at < after.length && digits < calling.length) {
    if (DIGIT.test(after[at])) digits++;
    at++;
  }
  return `+${region.callingCode}${after.slice(at)}`;
}

function callingCodePrefix(input: string): string | undefined {
  const digits = input.replace(DIGITS, "");
  for (let length = MAX_CALLING_CODE_DIGITS; length > 0; length--) {
    const prefix = digits.slice(0, length);
    if (MAIN_REGIONS.has(prefix)) return prefix;
  }
  return undefined;
}

const DIGIT = /\d/;
const DIGITS = /\D/g;
const MAX_CALLING_CODE_DIGITS = 3;

export const regionFilter = rankedFilter(rankOf, (search) => fold(search.replace(/^\+/, "")));

function rankOf(code: string, needle: string): number {
  const terms = SEARCH_TERMS.get(code);
  if (!terms) return NO_MATCH;
  if (terms.code === needle || terms.calling === needle) return 0;
  if (terms.name.startsWith(needle)) return 1;
  if (terms.name.includes(needle)) return 2;
  return terms.calling.startsWith(needle) ? 3 : NO_MATCH;
}

interface RegionTerms {
  name: string;
  code: string;
  calling: string;
}

const SEARCH_TERMS = new Map<string, RegionTerms>(
  REGIONS.map((region) => [region.code, {
    name: fold(region.name),
    code: fold(region.code),
    calling: region.callingCode,
  }]),
);
