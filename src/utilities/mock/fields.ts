import type { JsonValue } from "../../common/schema/ir";
import { CARD_BRANDS, eanDigit, IBAN_COUNTRIES, ibanCheckDigits, luhnDigit } from "./checksums";
import type { Locale } from "./locales";
import type { Rng } from "./seed";
import { COLOUR_NAMES, COMPANY_STEMS, CURRENCIES, DEPARTMENTS, FILE_EXTENSIONS, GENERIC_TLDS, HTTP_METHODS, HTTP_STATUSES, JOB_TITLES, LANGUAGE_TAGS, LOREM, MAIL_DOMAINS, MIME_TYPES, PRODUCT_ADJECTIVES, PRODUCT_NOUNS, STATUSES, TIMEZONES, USER_AGENTS } from "./words";

export type Produces = "string" | "integer" | "number" | "boolean";

export interface Field {
  produces: Produces;
  generate: (rng: Rng, locale: Locale) => JsonValue;
}

export type FieldId = keyof typeof TABLE;

export function fieldNamed(id: string): Field | undefined {
  return (FIELDS as Record<string, Field>)[id];
}

const TABLE = {
  firstName: { produces: "string", generate: (rng, locale) => rng.pick(locale.givenNames) },
  lastName: { produces: "string", generate: (rng, locale) => rng.pick(locale.surnames) },
  fullName: { produces: "string", generate: fullName },
  username: {
    produces: "string",
    generate: (rng, locale) => `${handle(rng, locale)}${rng.chance(0.4) ? rng.between(2, 99) : ""}`,
  },
  email: {
    produces: "string",
    generate: (rng, locale) => `${handle(rng, locale)}${rng.between(1, 999)}@${rng.pick(MAIL_DOMAINS)}`,
  },
  phone: { produces: "string", generate: (rng, locale) => fromPattern(rng, rng.pick(locale.phones)) },
  jobTitle: { produces: "string", generate: (rng) => rng.pick(JOB_TITLES) },
  department: { produces: "string", generate: (rng) => rng.pick(DEPARTMENTS) },
  gender: { produces: "string", generate: (rng) => rng.pick(["female", "male", "non-binary", "prefer not to say"]) },
  age: { produces: "integer", generate: (rng) => rng.between(18, 79) },
  birthDate: { produces: "string", generate: (rng) => isoDate(rng.between(ANCHOR - YEAR * 80, ANCHOR - YEAR * 18)) },

  street: { produces: "string", generate: address },
  city: { produces: "string", generate: (rng, locale) => rng.pick(locale.cities) },
  postcode: { produces: "string", generate: (rng, locale) => fromPattern(rng, rng.pick(locale.postcodes)) },
  region: { produces: "string", generate: (rng, locale) => rng.pick(locale.regions) },
  country: { produces: "string", generate: (_rng, locale) => locale.country },
  countryCode: { produces: "string", generate: (_rng, locale) => locale.countryCode },
  latitude: { produces: "number", generate: (rng) => rng.float(-90, 90, 6) },
  longitude: { produces: "number", generate: (rng) => rng.float(-180, 180, 6) },
  timezone: { produces: "string", generate: (rng) => rng.pick(TIMEZONES) },

  company: {
    produces: "string",
    generate: (rng, locale) => `${rng.pick(COMPANY_STEMS)} ${rng.pick(locale.companySuffixes)}`,
  },
  product: {
    produces: "string",
    generate: (rng) => `${rng.pick(PRODUCT_ADJECTIVES)} ${rng.pick(PRODUCT_NOUNS)}`,
  },
  price: {
    produces: "number",
    generate: (rng, locale) => locale.currency === "JPY" ? rng.between(100, 99999) : rng.float(1, 999, 2),
  },
  currency: { produces: "string", generate: (rng, locale) => rng.chance(0.6) ? locale.currency : rng.pick(CURRENCIES) },
  creditCard: { produces: "string", generate: creditCard },
  iban: { produces: "string", generate: iban },
  bic: { produces: "string", generate: bic },
  isbn: { produces: "string", generate: isbn },
  ean: { produces: "string", generate: (rng) => withEanDigit(`${rng.between(1, 9)}${rng.digits(11)}`) },

  dateTime: { produces: "string", generate: (rng) => isoDateTime(anyInstant(rng)) },
  date: { produces: "string", generate: (rng) => isoDate(anyInstant(rng)) },
  time: { produces: "string", generate: (rng) => isoDateTime(anyInstant(rng)).slice(11) },
  pastDateTime: { produces: "string", generate: (rng) => isoDateTime(rng.between(ANCHOR - YEAR * 5, ANCHOR)) },
  futureDateTime: { produces: "string", generate: (rng) => isoDateTime(rng.between(ANCHOR, ANCHOR + YEAR * 5)) },
  epochSeconds: { produces: "integer", generate: (rng) => Math.floor(anyInstant(rng) / 1000) },
  duration: { produces: "string", generate: (rng) => `P${rng.between(1, 30)}DT${rng.between(0, 23)}H` },

  url: { produces: "string", generate: (rng, locale) => `https://${domain(rng, locale)}/${slug(rng)}` },
  domain: { produces: "string", generate: domain },
  imageUrl: { produces: "string", generate: (rng) => `https://example.com/images/${slug(rng)}.jpg` },
  slug: { produces: "string", generate: slug },
  ipv4: {
    produces: "string",
    generate: (rng) => `${rng.between(1, 223)}.${rng.below(256)}.${rng.below(256)}.${rng.between(1, 254)}`,
  },
  ipv6: { produces: "string", generate: ipv6 },
  mac: { produces: "string", generate: mac },
  uuid: { produces: "string", generate: uuid },
  userAgent: { produces: "string", generate: (rng) => rng.pick(USER_AGENTS) },
  httpMethod: { produces: "string", generate: (rng) => rng.pick(HTTP_METHODS) },
  httpStatus: { produces: "integer", generate: (rng) => rng.pick(HTTP_STATUSES) },
  mimeType: { produces: "string", generate: (rng) => rng.pick(MIME_TYPES) },
  fileName: { produces: "string", generate: (rng) => `${slug(rng)}.${rng.pick(FILE_EXTENSIONS)}` },
  semver: { produces: "string", generate: (rng) => `${rng.below(6)}.${rng.below(20)}.${rng.below(40)}` },
  token: { produces: "string", generate: (rng) => token(rng, 32) },
  languageTag: { produces: "string", generate: (rng) => rng.pick(LANGUAGE_TAGS) },
  hostname: { produces: "string", generate: domain },

  word: { produces: "string", generate: (rng) => rng.pick(LOREM) },
  title: { produces: "string", generate: (rng) => capitalise(words(rng, rng.between(2, 6))) },
  sentence: { produces: "string", generate: (rng) => sentence(rng) },
  paragraph: {
    produces: "string",
    generate: (rng) => Array.from({ length: rng.between(3, 6) }, () => sentence(rng)).join(" "),
  },

  boolean: { produces: "boolean", generate: (rng) => rng.chance(0.5) },
  integer: { produces: "integer", generate: (rng) => rng.between(1, 1000) },
  decimal: { produces: "number", generate: (rng) => rng.float(0, 1000, 2) },
  status: { produces: "string", generate: (rng) => rng.pick(STATUSES) },
  colourName: { produces: "string", generate: (rng) => rng.pick(COLOUR_NAMES) },
  hexColour: { produces: "string", generate: (rng) => `#${hex(rng, 6)}` },
} satisfies Record<string, Field>;

export const FIELDS: Record<FieldId, Field> = TABLE;

export function fromPattern(rng: Rng, pattern: string): string {
  let out = "";
  for (const character of pattern) {
    if (character === "#") out += rng.below(10);
    else if (character === "?") out += LETTERS[rng.below(LETTERS.length)];
    else out += character;
  }
  return out;
}

function creditCard(rng: Rng): string {
  const brand = rng.pick(CARD_BRANDS);
  const length = rng.pick(brand.lengths);
  const prefix = rng.pick(brand.prefixes);
  const body = prefix + rng.digits(length - prefix.length - 1);
  return body + luhnDigit(body);
}

function iban(rng: Rng, locale: Locale): string {
  const country = locale.iban ?? FALLBACK_IBAN;
  const bban = fromBbanSpec(rng, IBAN_COUNTRIES[country].bban);
  return `${country}${ibanCheckDigits(country, bban)}${bban}`;
}

function fromBbanSpec(rng: Rng, spec: string): string {
  let out = "";
  for (const [, kind, count] of spec.matchAll(/([nac])(\d+)/g)) {
    const alphabet = kind === "n" ? DIGITS : kind === "a" ? LETTERS : LETTERS + DIGITS;
    for (let i = 0; i < Number(count); i++) out += alphabet[rng.below(alphabet.length)];
  }
  return out;
}

function bic(rng: Rng, locale: Locale): string {
  const bank = Array.from({ length: 4 }, () => LETTERS[rng.below(LETTERS.length)]).join("");
  const location = fromPattern(rng, "??");
  return `${bank}${locale.countryCode}${location}${rng.chance(0.5) ? fromPattern(rng, "???") : ""}`;
}

function isbn(rng: Rng): string {
  return withEanDigit(`${rng.chance(0.85) ? "978" : "979"}${rng.digits(9)}`);
}

function withEanDigit(body: string): string {
  return body + eanDigit(body);
}

function fullName(rng: Rng, locale: Locale): string {
  const given = rng.pick(locale.givenNames);
  const family = rng.pick(locale.surnames);
  return locale.familyNameFirst ? `${family} ${given}` : `${given} ${family}`;
}

function address(rng: Rng, locale: Locale): string {
  return locale.addressFormat
    .replace("{number}", String(rng.between(1, 240)))
    .replace("{street}", rng.pick(locale.streets))
    .replace("{block}", `${rng.between(1, 5)}-${rng.between(1, 30)}-${rng.between(1, 20)}`);
}

function handle(rng: Rng, locale: Locale): string {
  const stem = asciiSlug(`${rng.pick(locale.givenNames)}.${rng.pick(locale.surnames)}`);
  return stem.length > 1 ? stem : `${rng.pick(LOREM)}.${rng.pick(LOREM)}`;
}

function asciiSlug(text: string): string {
  const stripped = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return stripped.replace(/[^a-z0-9.]+/g, "").replace(/^\.+|\.+$/g, "");
}

function domain(rng: Rng, locale: Locale): string {
  const tld = rng.chance(0.6) ? rng.pick(GENERIC_TLDS) : locale.tld;
  return `${rng.pick(COMPANY_STEMS).toLowerCase()}.${tld}`;
}

function slug(rng: Rng): string {
  return words(rng, rng.between(2, 4)).replace(/ /g, "-");
}

function words(rng: Rng, count: number): string {
  return Array.from({ length: count }, () => rng.pick(LOREM)).join(" ");
}

function sentence(rng: Rng): string {
  return `${capitalise(words(rng, rng.between(6, 14)))}.`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function uuid(rng: Rng): string {
  const digits = hex(rng, 32).split("");
  digits[12] = "4";
  digits[16] = "89ab"[rng.below(4)];
  const joined = digits.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${
    joined.slice(20)
  }`;
}

function ipv6(rng: Rng): string {
  return `2001:0db8:${Array.from({ length: 6 }, () => hex(rng, 4)).join(":")}`;
}

function mac(rng: Rng): string {
  const first = (rng.below(64) * 4 + 2).toString(16).padStart(2, "0");
  return [first, ...Array.from({ length: 5 }, () => hex(rng, 2))].join(":");
}

function hex(rng: Rng, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += HEX[rng.below(16)];
  return out;
}

function token(rng: Rng, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += TOKEN_ALPHABET[rng.below(TOKEN_ALPHABET.length)];
  return out;
}

function anyInstant(rng: Rng): number {
  return rng.between(ANCHOR - YEAR * 5, ANCHOR + YEAR * 5);
}

function isoDateTime(instant: number): string {
  return new Date(instant).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isoDate(instant: number): string {
  return new Date(instant).toISOString().slice(0, 10);
}

const ANCHOR = Date.UTC(2025, 0, 1);

const YEAR = 365.2425 * 24 * 60 * 60 * 1000;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const DIGITS = "0123456789";

const HEX = "0123456789abcdef";

const TOKEN_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const FALLBACK_IBAN = "DE";
