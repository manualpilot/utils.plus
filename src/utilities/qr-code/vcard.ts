import { linkUrl, telNumber } from "./links";

export interface VCardFields {
  first: string;
  last: string;
  org: string;
  job: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  note: string;
}

export function writeVCard(fields: VCardFields): string {
  const full = [fields.first.trim(), fields.last.trim()].filter(Boolean).join(" ");
  const org = fields.org.trim();
  if (!full && !org) return "";
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${escape(fields.last.trim())};${escape(fields.first.trim())};;;`);
  lines.push(`FN:${escape(full || org)}`);
  if (org) lines.push(`ORG:${escape(org)}`);
  if (fields.job) lines.push(`TITLE:${escape(fields.job)}`);
  if (fields.phone) lines.push(`TEL;TYPE=CELL:${escape(telNumber(fields.phone))}`);
  if (fields.email) lines.push(`EMAIL;TYPE=INTERNET:${escape(fields.email.trim())}`);
  if (fields.website) lines.push(`URL:${escape(linkUrl(fields.website) ?? fields.website.trim())}`);
  if (fields.address) lines.push(`ADR;TYPE=HOME:;;${escape(fields.address)};;;;`);
  if (fields.note) lines.push(`NOTE:${escape(fields.note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function escape(value: string): string {
  return value.replace(/([\\;,])/g, "\\$1").replace(/\r?\n/g, "\\n");
}
