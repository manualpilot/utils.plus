import type { QrCorrection } from "../../common/qr";
import { type MailFields, type SmsFields, writeCall, writeLink, writeMail, writeSms } from "./links";
import { type VCardFields, writeVCard } from "./vcard";
import { type WifiFields, writeWifi } from "./wifi";

export type Kind = "text" | "url" | "wifi" | "vcard" | "email" | "phone" | "sms";

export const KINDS: Record<Kind, KindSpec> = {
  text: { label: "Plain Text", hint: "Type something and its code appears here." },
  url: { label: "URL", hint: "Enter a web address and its code appears here." },
  wifi: { label: "WiFi", hint: "Enter the network name and its code appears here." },
  vcard: { label: "vCard", hint: "Enter a name or an organisation and the card's code appears here." },
  email: { label: "Email", hint: "Enter an address and its code appears here." },
  phone: { label: "Phone Call", hint: "Enter a number and its code appears here." },
  sms: { label: "SMS", hint: "Enter a number and its code appears here." },
};

export interface KindSpec {
  label: string;
  hint: string;
}

export const KIND_OPTIONS = (Object.keys(KINDS) as Kind[]).map((kind) => ({ value: kind, label: KINDS[kind].label }));

export const CORRECTION_OPTIONS = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
];

export interface Fields {
  text: string;
  url: string;
  wifi: WifiFields;
  vcard: VCardFields;
  mail: MailFields;
  phone: string;
  sms: SmsFields;
}

export function writePayload(kind: Kind, fields: Fields): string {
  switch (kind) {
    case "text":
      return fields.text.trim() ? fields.text : "";
    case "url":
      return writeLink(fields.url);
    case "wifi":
      return writeWifi(fields.wifi);
    case "vcard":
      return writeVCard(fields.vcard);
    case "email":
      return writeMail(fields.mail);
    case "phone":
      return writeCall(fields.phone);
    case "sms":
      return writeSms(fields.sms);
  }
}

export function pickKind(value: unknown): Kind {
  return typeof value === "string" && value in KINDS ? value as Kind : "text";
}

export function pickCorrection(value: unknown): QrCorrection {
  return value === "L" || value === "Q" || value === "H" ? value : "M";
}

export function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
