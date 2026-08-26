export interface Check {
  valid: boolean;
  normalised: string;
  expected?: string;
  detail?: string;
}

export function luhnDigit(body: string): string {
  return String((10 - luhnSum(`${body}0`) % 10) % 10);
}

export function luhnHolds(value: string): boolean {
  return value.length > 1 && luhnSum(value) % 10 === 0;
}

function luhnSum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - 1 - i;
    const digit = digits.charCodeAt(i) - 48;
    if (fromRight % 2 === 1) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }
  return sum;
}

export function checkCard(value: string): Check | null {
  const normalised = value.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(normalised) || !CARD_LENGTHS.has(normalised.length)) return null;

  const brand = cardBrandOf(normalised);
  const body = normalised.slice(0, -1);
  const expected = luhnDigit(body);
  return {
    valid: luhnHolds(normalised) && brand !== null,
    normalised,
    expected: luhnHolds(normalised) ? undefined : expected,
    detail: brand ? brand.label : "No issuer claims this prefix and length",
  };
}

export function ibanRemainder(rearranged: string): number {
  let remainder = 0;
  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    const part = code >= 65 && code <= 90 ? String(code - 55) : character;
    for (const digit of part) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder;
}

export function ibanCheckDigits(country: string, bban: string): string {
  return String(98 - ibanRemainder(`${bban}${country}00`)).padStart(2, "0");
}

export function checkIban(value: string): Check | null {
  const normalised = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(normalised)) return null;

  const country = normalised.slice(0, 2);
  const expected = IBAN_COUNTRIES[country];
  const bban = normalised.slice(4);
  const holds = ibanRemainder(`${bban}${normalised.slice(0, 4)}`) === 1;

  if (expected && normalised.length !== expected.length) {
    return {
      valid: false,
      normalised,
      detail: `${expected.name} IBANs are ${expected.length} characters, and this is ${normalised.length}`,
    };
  }

  return {
    valid: holds && expected !== undefined,
    normalised,
    expected: holds ? undefined : ibanCheckDigits(country, bban),
    detail: expected ? expected.name : `No country uses the code ${country}`,
  };
}

export function isbn10Digit(body: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (body.charCodeAt(i) - 48) * (10 - i);
  const digit = (11 - sum % 11) % 11;
  return digit === 10 ? "X" : String(digit);
}

export function eanDigit(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += (body.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  return String((10 - sum % 10) % 10);
}

export function checkIsbn(value: string): Check | null {
  const normalised = value.replace(/[\s-]/g, "").toUpperCase();

  if (/^\d{9}[\dX]$/.test(normalised)) {
    const expected = isbn10Digit(normalised);
    return {
      valid: normalised[9] === expected,
      normalised,
      expected: normalised[9] === expected ? undefined : expected,
      detail: `ISBN-10, registration group ${normalised[0]}`,
    };
  }

  if (/^97[89]\d{10}$/.test(normalised)) {
    const expected = eanDigit(normalised.slice(0, 12));
    return {
      valid: normalised[12] === expected,
      normalised,
      expected: normalised[12] === expected ? undefined : expected,
      detail: `ISBN-13, prefix ${normalised.slice(0, 3)}`,
    };
  }

  return null;
}

export function checkEan(value: string): Check | null {
  const normalised = value.replace(/[\s-]/g, "");
  const kind = EAN_LENGTHS[normalised.length];
  if (!kind || !/^\d+$/.test(normalised)) return null;

  const expected = eanDigit(normalised.slice(0, -1));
  const actual = normalised[normalised.length - 1];
  return { valid: actual === expected, normalised, expected: actual === expected ? undefined : expected, detail: kind };
}

export function checkImei(value: string): Check | null {
  const normalised = value.replace(/[\s-]/g, "");
  if (!/^\d{15}$/.test(normalised)) return null;

  const expected = luhnDigit(normalised.slice(0, 14));
  return {
    valid: luhnHolds(normalised),
    normalised,
    expected: luhnHolds(normalised) ? undefined : expected,
    detail: `Reporting body identifier ${normalised.slice(0, 2)}`,
  };
}

export interface Candidate extends Check {
  format: string;
}

export function identify(value: string): Candidate[] {
  return CHECKERS.flatMap(({ format, check }) => {
    const result = check(value);
    return result ? [{ format, ...result }] : [];
  });
}

const CHECKERS: { format: string; check: (value: string) => Check | null }[] = [
  { format: "Payment card", check: checkCard },
  { format: "IBAN", check: checkIban },
  { format: "ISBN", check: checkIsbn },
  { format: "Barcode", check: checkEan },
  { format: "IMEI", check: checkImei },
];

export function cardBrandOf(digits: string): CardBrand | null {
  return CARD_BRANDS.find((brand) =>
    brand.lengths.includes(digits.length) && brand.prefixes.some((prefix) => digits.startsWith(prefix))
  ) ?? null;
}

export interface CardBrand {
  label: string;
  prefixes: string[];
  lengths: number[];
}

export const CARD_BRANDS: CardBrand[] = [
  { label: "Visa", prefixes: ["4"], lengths: [16] },
  {
    label: "Mastercard",
    prefixes: ["51", "52", "53", "54", "55", "2221", "2222", "2223", "2224", "2225", "2226", "2270", "2720"],
    lengths: [16],
  },
  { label: "American Express", prefixes: ["34", "37"], lengths: [15] },
  { label: "Discover", prefixes: ["6011", "644", "645", "646", "647", "648", "649", "65"], lengths: [16] },
  { label: "JCB", prefixes: ["3528", "3529", "353", "354", "355", "356", "357", "358"], lengths: [16] },
  { label: "Diners Club", prefixes: ["300", "301", "302", "303", "304", "305", "36", "38"], lengths: [14] },
  { label: "UnionPay", prefixes: ["62"], lengths: [16, 19] },
  { label: "Maestro", prefixes: ["5018", "5020", "5038", "6304", "6759", "6761", "6762", "6763"], lengths: [16] },
];

const CARD_LENGTHS = new Set(CARD_BRANDS.flatMap((brand) => brand.lengths));

export interface IbanCountry {
  name: string;
  length: number;
  bban: string;
}

export const IBAN_COUNTRIES: Record<string, IbanCountry> = {
  DE: { name: "Germany", length: 22, bban: "n18" },
  GB: { name: "United Kingdom", length: 22, bban: "a4n14" },
  FR: { name: "France", length: 27, bban: "n10c11n2" },
  ES: { name: "Spain", length: 24, bban: "n20" },
  IT: { name: "Italy", length: 27, bban: "a1n10c12" },
  NL: { name: "Netherlands", length: 18, bban: "a4n10" },
  BE: { name: "Belgium", length: 16, bban: "n12" },
  AT: { name: "Austria", length: 20, bban: "n16" },
  CH: { name: "Switzerland", length: 21, bban: "n5c12" },
  IE: { name: "Ireland", length: 22, bban: "a4n14" },
  PT: { name: "Portugal", length: 25, bban: "n21" },
  PL: { name: "Poland", length: 28, bban: "n24" },
  SE: { name: "Sweden", length: 24, bban: "n20" },
  NO: { name: "Norway", length: 15, bban: "n11" },
  DK: { name: "Denmark", length: 18, bban: "n14" },
  FI: { name: "Finland", length: 18, bban: "n14" },
};

const EAN_LENGTHS: Record<number, string> = { 8: "EAN-8", 12: "UPC-A", 13: "EAN-13", 14: "GTIN-14" };
