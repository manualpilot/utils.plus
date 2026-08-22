import { Metadata, type NumberingPlan, type PhoneNumber } from "libphonenumber-js/max";

export function destinationCode(number: PhoneNumber): string {
  const groups = number.formatInternational().split(NON_DIGITS);
  return groups.length <= 3 ? "" : groups[2];
}

export function areaCode(number: PhoneNumber): string {
  const type = number.getType();
  if (!type || !GEOGRAPHIC.has(type)) return "";
  if (!nationalPrefix(number) && !number.nationalNumber.startsWith("0")) return "";
  if (type === "MOBILE" && !MOBILE_AREAS.has(number.countryCallingCode)) return "";
  return destinationCode(number);
}

const NON_DIGITS = /\D+/;

const GEOGRAPHIC = new Set(["FIXED_LINE", "FIXED_LINE_OR_MOBILE", "MOBILE"]);

const MOBILE_AREAS = new Set(["52", "54", "55", "62"]);

const metadata = new Metadata();

function nationalPrefix(number: PhoneNumber): boolean {
  if (!number.country) return false;
  metadata.selectNumberingPlan(number.country);
  const plan = metadata.numberingPlan as (NumberingPlan & Partial<WithNationalPrefix>) | undefined;
  return Boolean(plan?.nationalPrefix?.());
}

interface WithNationalPrefix {
  nationalPrefix(): string | undefined;
}
