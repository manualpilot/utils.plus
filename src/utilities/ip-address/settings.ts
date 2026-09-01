import { AS_MAX } from "./asn";
import { BITS, type Family } from "./parse";

export const FAMILIES = {
  ipv4: {
    label: "IPv4",
    title: "IPv4 Address",
    sample: "192.168.1.130/26",
    hint: "e.g. 192.168.1.130/26",
    probe: "e.g. 192.168.1.200 or 192.168.1.192/28",
  },
  ipv6: {
    label: "IPv6",
    title: "IPv6 Address",
    sample: "2001:db8:abcd:12::1/64",
    hint: "e.g. 2001:db8:abcd:12::1/64",
    probe: "e.g. 2001:db8:abcd:12::99 or 2001:db8:abcd:12::/72",
  },
};

export type Mode = Family | "asn";

export const ASN = { label: "AS", title: "AS Number", sample: "AS15169", hint: `e.g. AS15169, or 0 to ${AS_MAX}` };

export const MODE_OPTIONS = [
  ...Object.entries(FAMILIES).map(([value, { label }]) => ({ value, label })),
  { value: "asn", label: ASN.label },
];

export function titleOf(mode: Mode): string {
  return mode === "asn" ? ASN.title : FAMILIES[mode].title;
}

export const SPLIT_LIMIT = 64;

export function pickMode(value: unknown): Mode {
  if (value === "ipv6" || value === "asn") return value;
  return "ipv4";
}

export function pickFamily(value: unknown): Family {
  return value === "ipv6" ? "ipv6" : "ipv4";
}

export function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function pickAddress(value: unknown, family: Family): string {
  return typeof value === "string" ? value : FAMILIES[family].sample;
}

export function pickAsn(value: unknown): string {
  return typeof value === "string" ? value : ASN.sample;
}

export function pickSplit(value: unknown, family: Family): number | "" {
  if (typeof value !== "number" || !Number.isInteger(value)) return "";
  return value >= 1 && value <= BITS[family] ? value : "";
}
