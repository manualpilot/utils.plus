import { EMAIL_PATTERN } from "../../common/email";

export function linkUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return new URL(SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`).href;
  } catch {
    return null;
  }
}

export function writeLink(text: string): string {
  return linkUrl(text) ?? "";
}

export function linkProblem(text: string): string | null {
  if (!text.trim()) return null;
  return linkUrl(text) === null ? "Enter a web address" : null;
}

export function writeMail(fields: MailFields): string {
  const address = fields.address.trim();
  if (!address) return "";
  const query: string[] = [];
  if (fields.subject) query.push(`subject=${encodeURIComponent(fields.subject)}`);
  if (fields.body) query.push(`body=${encodeURIComponent(fields.body)}`);
  return query.length > 0 ? `mailto:${address}?${query.join("&")}` : `mailto:${address}`;
}

export interface MailFields {
  address: string;
  subject: string;
  body: string;
}

export function telNumber(text: string): string {
  const trimmed = text.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(UNDIALLABLE, "");
}

export function writeCall(text: string): string {
  const number = telNumber(text);
  return number === "" || number === "+" ? "" : `tel:${number}`;
}

export function writeSms(fields: SmsFields): string {
  const number = telNumber(fields.number);
  if (number === "" || number === "+") return "";
  return fields.message ? `SMSTO:${number}:${fields.message}` : `SMSTO:${number}`;
}

export interface SmsFields {
  number: string;
  message: string;
}

export function addressProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return EMAIL_PATTERN.test(trimmed) ? null : "Enter a valid address";
}

export function numberProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (WRITTEN.test(trimmed)) return "A number is digits, spaces and + - ( )";
  return /[0-9]/.test(trimmed) ? null : "A number needs at least one digit";
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const UNDIALLABLE = /[^0-9*#,;]/g;

const WRITTEN = /[^0-9+*#,;()\-.\s/]/;
