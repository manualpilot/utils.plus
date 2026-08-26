import { inner, type Node, numberOf, oidOf, TAG, tagged, textOf, timeOf } from "./der";
import { generalName, generalNames } from "./names";
import { ACCESS_METHODS, EXTENDED_KEY_USAGES, EXTENSIONS, KEY_USAGES, named, POLICIES } from "./oids";
import { hex } from "./pem";
import type { Extension } from "./types";

export interface ExtensionReading {
  rows: Extension[];
  ski: string;
  aki: string;
  ca: boolean;
  pathLength: number | null;
  names: string[];
}

const EMPTY: ExtensionReading = { rows: [], ski: "", aki: "", ca: false, pathLength: null, names: [] };

export function readExtensions(list: Node | undefined): ExtensionReading {
  if (!list) return EMPTY;
  const reading: ExtensionReading = { ...EMPTY, rows: [], names: [] };

  for (const extension of list.items) {
    const type = extension.items[0];
    if (!type) continue;
    const oid = oidOf(type);
    const last = extension.items[extension.items.length - 1];
    const critical = extension.items.length > 2 && extension.items[1].content[0] !== 0;
    const value = last ? inner(last) : null;

    reading.rows.push({ oid, name: named(EXTENSIONS, oid), critical, value: value ? read(oid, value) : "" });
    if (!value) continue;

    if (oid === SUBJECT_ALT_NAME) reading.names = generalNames(value);
    if (oid === SUBJECT_KEY_ID) reading.ski = hex(value.content, ":").toUpperCase();
    if (oid === AUTHORITY_KEY_ID) {
      const keyId = tagged(value.items, 0);
      reading.aki = keyId ? hex(keyId.content, ":").toUpperCase() : "";
    }
    if (oid === BASIC_CONSTRAINTS) {
      reading.ca = value.items[0]?.tag === TAG.boolean && value.items[0].content[0] !== 0;
      const depth = value.items.find((item) => item.tag === TAG.integer);
      reading.pathLength = depth ? numberOf(depth) : null;
    }
  }

  return reading;
}

const SUBJECT_ALT_NAME = "2.5.29.17";
const ISSUER_ALT_NAME = "2.5.29.18";
const SUBJECT_KEY_ID = "2.5.29.14";
const AUTHORITY_KEY_ID = "2.5.29.35";
const KEY_USAGE_PERIOD = "2.5.29.16";
const BASIC_CONSTRAINTS = "2.5.29.19";
const KEY_USAGE = "2.5.29.15";
const EXTENDED_KEY_USAGE = "2.5.29.37";
const CRL_POINTS = "2.5.29.31";
const FRESHEST_CRL = "2.5.29.46";
const AUTHORITY_INFO = "1.3.6.1.5.5.7.1.1";
const SUBJECT_INFO = "1.3.6.1.5.5.7.1.11";
const POLICY_LIST = "2.5.29.32";
const NAME_CONSTRAINTS = "2.5.29.30";
const TIMESTAMPS = "1.3.6.1.4.1.11129.2.4.2";
const TLS_FEATURE = "1.3.6.1.5.5.7.1.24";
const OCSP_NO_CHECK = "1.3.6.1.5.5.7.48.1.5";
const NETSCAPE_COMMENT = "2.16.840.1.113730.1.13";

function read(oid: string, value: Node): string {
  try {
    return describe(oid, value);
  } catch {
    return unknown(value);
  }
}

function describe(oid: string, value: Node): string {
  switch (oid) {
    case SUBJECT_ALT_NAME:
    case ISSUER_ALT_NAME:
      return generalNames(value).join(", ");
    case SUBJECT_KEY_ID:
      return hex(value.content, ":").toUpperCase();
    case AUTHORITY_KEY_ID:
      return authorityKey(value);
    case BASIC_CONSTRAINTS:
      return basicConstraints(value);
    case KEY_USAGE:
      return bitNames(value, KEY_USAGES).join(", ");
    case KEY_USAGE_PERIOD:
      return usagePeriod(value);
    case EXTENDED_KEY_USAGE:
      return value.items.map((item) => named(EXTENDED_KEY_USAGES, oidOf(item))).join(", ");
    case CRL_POINTS:
    case FRESHEST_CRL:
      return distributionPoints(value).join(", ");
    case AUTHORITY_INFO:
    case SUBJECT_INFO:
      return accessDescriptions(value).join(", ");
    case POLICY_LIST:
      return value.items.map((item) => item.items[0] ? named(POLICIES, oidOf(item.items[0])) : "").join(", ");
    case NAME_CONSTRAINTS:
      return nameConstraints(value);
    case TIMESTAMPS:
      return timestampCount(value.content);
    case TLS_FEATURE:
      return value.items.map((item) => named(TLS_FEATURES, String(numberOf(item)))).join(", ");
    case OCSP_NO_CHECK:
      return "Present";
    case NETSCAPE_COMMENT:
      return textOf(value);
    default:
      return unknown(value);
  }
}

const TLS_FEATURES: Record<string, string> = { "5": "Must staple (status_request)" };

function authorityKey(value: Node): string {
  const keyId = tagged(value.items, 0);
  const issuer = tagged(value.items, 1);
  const serial = tagged(value.items, 2);
  return [
    keyId ? `keyid:${hex(keyId.content, ":").toUpperCase()}` : "",
    issuer?.items[0] ? `issuer:${generalName(issuer.items[0])}` : "",
    serial ? `serial:${hex(serial.content, ":").toUpperCase()}` : "",
  ].filter((part) => part !== "").join(", ");
}

function usagePeriod(value: Node): string {
  const from = tagged(value.items, 0);
  const to = tagged(value.items, 1);
  return [from ? `from ${period(from)}` : "", to ? `to ${period(to)}` : ""].filter((part) => part !== "").join(", ");
}

function period(node: Node): string {
  return timeOf(node)?.toISOString().replace("T", " ").replace(".000Z", " UTC") ?? "";
}

function basicConstraints(value: Node): string {
  const authority = value.items[0]?.tag === TAG.boolean && value.items[0].content[0] !== 0;
  const depth = value.items.find((item) => item.tag === TAG.integer);
  const written = depth === undefined ? "" : `, path length ${numberOf(depth)}`;
  return authority ? `Certificate authority${written}` : "End entity";
}

function distributionPoints(value: Node): string[] {
  const points: string[] = [];
  for (const point of value.items) {
    const chosen = tagged(point.items, 0);
    const full = chosen ? tagged(chosen.items, 0) : undefined;
    if (full) points.push(...generalNames(full));
  }
  return points;
}

function accessDescriptions(value: Node): string[] {
  return value.items.map((access) => {
    const method = access.items[0];
    const location = access.items[1];
    if (!method || !location) return "";
    return `${named(ACCESS_METHODS, oidOf(method))}: ${generalName(location)}`;
  }).filter((text) => text !== "");
}

function nameConstraints(value: Node): string {
  const permitted = tagged(value.items, 0);
  const excluded = tagged(value.items, 1);
  return [
    permitted ? `permitted: ${subtrees(permitted).join(", ")}` : "",
    excluded ? `excluded: ${subtrees(excluded).join(", ")}` : "",
  ].filter((part) => part !== "").join("; ");
}

function subtrees(node: Node): string[] {
  return node.items.map((tree) => tree.items[0] ? generalName(tree.items[0]) : "").filter((name) => name !== "");
}

function timestampCount(bytes: Uint8Array): string {
  if (bytes.length < 2) return "";
  let offset = 2;
  let count = 0;
  while (offset + 2 <= bytes.length) {
    offset += 2 + ((bytes[offset] << 8) | bytes[offset + 1]);
    count += 1;
  }
  return count === 1 ? "1 timestamp" : `${count} timestamps`;
}

function unknown(value: Node): string {
  const bytes = value.raw;
  if (bytes.length <= UNKNOWN_BYTES) return hex(bytes, ":").toUpperCase();
  return `${hex(bytes.subarray(0, UNKNOWN_BYTES), ":").toUpperCase()}… (${bytes.length} bytes)`;
}

const UNKNOWN_BYTES = 32;

export function bitNames(node: Node, names: string[]): string[] {
  const bytes = node.content;
  if (bytes.length < 2) return [];
  const total = (bytes.length - 1) * 8 - bytes[0];
  const set: string[] = [];
  for (let bit = 0; bit < Math.min(total, names.length); bit += 1) {
    if ((bytes[1 + (bit >> 3)] & (0x80 >> (bit & 7))) !== 0) set.push(names[bit]);
  }
  return set;
}
