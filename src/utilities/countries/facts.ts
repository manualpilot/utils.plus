import { COUNTRIES, type Country } from "./list";

export function callingCodes(country: Country): string[] {
  const { root, suffixes } = country.idd;
  if (!root) return [];
  return suffixes.length > 0 ? suffixes.map((suffix) => root + suffix) : [root];
}

export function areaText(country: Country): string {
  if (country.area < 0) return "";
  const imperial = `(${number(country.area / KM2_PER_SQUARE_MILE)}${NBSP}sq${NBSP}mi)`;
  return `${number(country.area)}${NBSP}km² ${imperial}`;
}

const NBSP = "\u00a0";

const KM2_PER_SQUARE_MILE = 2.589988110336;

export function decimalDegrees(country: Country): string {
  const [latitude, longitude] = country.latlng;
  return `${latitude}, ${longitude}`;
}

export function coordinates(country: Country): string {
  const [latitude, longitude] = country.latlng;
  return `${degrees(latitude, "N", "S")} ${degrees(longitude, "E", "W")}`;
}

function degrees(value: number, positive: string, negative: string): string {
  const total = Math.round(Math.abs(value) * 3600);
  const minutes = Math.floor(total / 60) % 60;
  return `${Math.floor(total / 3600)}°${pad(minutes)}′${pad(total % 60)}″${value < 0 ? negative : positive}`;
}

export function currencyRows(country: Country): { code: string; name: string; symbol: string }[] {
  return Object.entries(country.currencies).map(([code, currency]) => ({ code, ...currency }));
}

export function languageRows(country: Country): { code: string; name: string }[] {
  return Object.entries(country.languages).map(([code, name]) => ({ code, name }));
}

export function nativeNameRows(country: Country): { language: string; common: string; official: string }[] {
  return Object.entries(country.name.native).map(([code, name]) => ({ language: languageName(code), ...name }));
}

export function demonymRows(country: Country): { language: string; masculine: string; feminine: string }[] {
  return Object.entries(country.demonyms).map(([code, forms]) => ({
    language: languageName(code),
    masculine: forms.m,
    feminine: forms.f,
  }));
}

export function languageName(code: string): string {
  const named = LANGUAGE_DISPLAY.of(code);
  if (named && named !== code) return named;
  return DATA_LANGUAGE_NAMES.get(code) ?? code;
}

const LANGUAGE_DISPLAY = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });

const DATA_LANGUAGE_NAMES = new Map(
  COUNTRIES.flatMap((country) => Object.entries(country.languages)),
);

function number(value: number): string {
  return NUMBER_FORMAT.format(value);
}

const NUMBER_FORMAT = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
