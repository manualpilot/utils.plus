import examples from "libphonenumber-js/examples.mobile";
import { getExampleNumber, parsePhoneNumberWithError, type PhoneNumber, type PhoneNumberType, validatePhoneNumberLength, type ValidatePhoneNumberLengthResult } from "libphonenumber-js/max";
import { areaCode, destinationCode } from "./area";
import { findRegion, HOME_REGION, mainRegion, type Region } from "./regions";
import { type Short, shortReading } from "./short";

export type Result =
  | { kind: "blank" }
  | { kind: "error"; message: string }
  | { kind: "short"; short: Short }
  | { kind: "reading"; reading: Reading };

export interface Reading {
  region?: Region;
  callingCode: string;
  nationalNumber: string;
  areaCode: string;
  destinationCode: string;
  extension: string;
  carrierCode: string;
  valid: boolean;
  possibility: string;
  type: string;
  formats: Format[];
  number: PhoneNumber;
}

export interface Format {
  label: string;
  value: string;
}

export function readNumber(input: string, region: Region): Result {
  const text = input.trim();
  if (!text) return { kind: "blank" };

  let parsed: PhoneNumber;
  try {
    parsed = parsePhoneNumberWithError(text, region.code);
  } catch (cause) {
    return { kind: "error", message: errorMessage(cause) };
  }

  const code = parsed.isValid() ? undefined : shortReading(parsed.nationalNumber, region);
  return code ? { kind: "short", short: code } : { kind: "reading", reading: reading(text, parsed, region) };
}

function reading(text: string, parsed: PhoneNumber, region: Region): Reading {
  const length = validatePhoneNumberLength(text, region.code);

  return {
    region: numberRegion(parsed),
    callingCode: `+${parsed.countryCallingCode}`,
    nationalNumber: parsed.nationalNumber,
    areaCode: areaCode(parsed),
    destinationCode: destinationCode(parsed),
    extension: parsed.ext ?? "",
    carrierCode: parsed.carrierCode ?? "",
    valid: parsed.isValid(),
    possibility: length ? POSSIBILITIES[length] ?? UNKNOWN : "Possible",
    type: TYPES[parsed.getType() ?? ""] ?? UNKNOWN,
    formats: formats(parsed),
    number: parsed,
  };
}

function numberRegion(parsed: PhoneNumber): Region | undefined {
  const possible = parsed.getPossibleCountries();
  const named = parsed.country ?? (possible.length === 1 ? possible[0] : undefined);
  if (named) return findRegion(named);
  return parsed.isNonGeographic() ? undefined : findRegion(mainRegion(parsed.countryCallingCode));
}

function formats(parsed: PhoneNumber): Format[] {
  const national = parsed.formatNational();
  const abroad = fromHome(parsed);

  return [
    { label: "E.164", value: parsed.format("E.164") },
    { label: "International", value: parsed.formatInternational() },
    { label: "National", value: national },
    { label: "RFC 3966", value: parsed.format("RFC3966") },
    { label: `Dialling from ${HOME_REGION.name}`, value: abroad === national ? "" : abroad },
  ];
}

function fromHome(parsed: PhoneNumber): string {
  try {
    return parsed.format("IDD", { fromCountry: HOME_REGION.code });
  } catch {
    return "";
  }
}

export function exampleNumber(region: Region): string {
  return getExampleNumber(region.code, examples)?.formatNational() ?? "";
}

const UNKNOWN = "Unknown";

const TYPES: Record<string, string> = {
  FIXED_LINE: "Fixed line",
  MOBILE: "Mobile",
  FIXED_LINE_OR_MOBILE: "Fixed line or mobile",
  TOLL_FREE: "Toll free",
  PREMIUM_RATE: "Premium rate",
  SHARED_COST: "Shared cost",
  VOIP: "VoIP",
  PERSONAL_NUMBER: "Personal number",
  PAGER: "Pager",
  UAN: "Universal access number",
  VOICEMAIL: "Voicemail",
} satisfies Record<PhoneNumberType, string>;

const POSSIBILITIES: Record<ValidatePhoneNumberLengthResult, string> = {
  INVALID_COUNTRY: "No country has that calling code",
  NOT_A_NUMBER: "Not a number",
  TOO_SHORT: "Too short",
  TOO_LONG: "Too long",
  INVALID_LENGTH: "Not a length numbers here are given",
};

const MESSAGES: Record<string, string> = {
  NOT_A_NUMBER: "Not a phone number",
  INVALID_COUNTRY: "No country has that calling code",
  TOO_SHORT: "Too short to be a phone number",
  TOO_LONG: "Too long to be a phone number",
};

function errorMessage(cause: unknown): string {
  const thrown = cause instanceof Error ? cause.message : String(cause);
  return MESSAGES[thrown] ?? thrown;
}
