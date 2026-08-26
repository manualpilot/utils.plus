import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { CONTEXT, intOf, type Node, numberOf, oidOf, readDer, tagged, textOf, timeOf } from "./der";
import { type ExtensionReading, readExtensions } from "./extensions";
import { readPublicKey } from "./keys";
import { type Name, readName } from "./names";
import { named, REQUEST_ATTRIBUTES, SIGNATURE_NAMES } from "./oids";
import { fingerprintHex, toBase64 } from "./pem";
import type { PublicKey } from "./types";

export interface Certificate {
  version: number;
  serial: string;
  serialNumber: string;
  subject: Name;
  issuer: Name;
  notBefore: Date | null;
  notAfter: Date | null;
  signature: string;
  key: PublicKey;
  extensions: ExtensionReading;
  fingerprints: Fingerprints;
  selfIssued: boolean;
  subjectDer: Uint8Array;
  spki: Uint8Array;
}

export interface Request {
  version: number;
  subject: Name;
  signature: string;
  key: PublicKey;
  extensions: ExtensionReading;
  attributes: { label: string; value: string }[];
  fingerprints: Fingerprints;
}

export interface Fingerprints {
  sha256: string;
  sha1: string;
  pin: string;
}

export function readCertificate(der: Uint8Array): Certificate {
  const root = readDer(der);
  const tbs = root.items[0];
  const algorithm = root.items[1];
  if (!tbs || !algorithm || tbs.items.length < 6) throw new Error("This is not an X.509 certificate");

  let cursor = 0;
  let version = 1;
  const first = tbs.items[0];
  if (first.cls === CONTEXT && first.tag === 0) {
    version = (first.items[0] ? numberOf(first.items[0]) : 0) + 1;
    cursor = 1;
  }

  const serial = tbs.items[cursor];
  const issuer = tbs.items[cursor + 2];
  const validity = tbs.items[cursor + 3];
  const subject = tbs.items[cursor + 4];
  const spki = tbs.items[cursor + 5];
  if (!serial || !issuer || !validity || !subject || !spki) throw new Error("This is not an X.509 certificate");

  const subjectName = readName(subject);
  const issuerName = readName(issuer);

  return {
    version,
    serial: fingerprintHex(serial.content),
    serialNumber: intOf(serial).toString(),
    subject: subjectName,
    issuer: issuerName,
    notBefore: validity.items[0] ? timeOf(validity.items[0]) : null,
    notAfter: validity.items[1] ? timeOf(validity.items[1]) : null,
    signature: named(SIGNATURE_NAMES, oidOf(algorithm.items[0])),
    key: readPublicKey(spki),
    extensions: readExtensions(tagged(tbs.items.slice(cursor + 6), 3)?.items[0]),
    fingerprints: fingerprints(der, spki),
    selfIssued: subjectName.text === issuerName.text && subjectName.text !== "",
    subjectDer: subject.raw,
    spki: spki.raw,
  };
}

export function readRequest(der: Uint8Array): Request {
  const root = readDer(der);
  const info = root.items[0];
  const algorithm = root.items[1];
  if (!info || !algorithm || info.items.length < 3) throw new Error("This is not a certification request");

  const subject = info.items[1];
  const spki = info.items[2];
  if (!subject || !spki) throw new Error("This is not a certification request");

  const attributes = tagged(info.items, 0);
  return {
    version: (info.items[0] ? numberOf(info.items[0]) : 0) + 1,
    subject: readName(subject),
    signature: named(SIGNATURE_NAMES, oidOf(algorithm.items[0])),
    key: readPublicKey(spki),
    extensions: readExtensions(requestedExtensions(attributes)),
    attributes: plainAttributes(attributes),
    fingerprints: fingerprints(der, spki),
  };
}

const EXTENSION_REQUEST = "1.2.840.113549.1.9.14";

function requestedExtensions(attributes: Node | undefined): Node | undefined {
  for (const attribute of attributes?.items ?? []) {
    if (attribute.items[0] && oidOf(attribute.items[0]) === EXTENSION_REQUEST) return attribute.items[1]?.items[0];
  }
  return undefined;
}

function plainAttributes(attributes: Node | undefined): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const attribute of attributes?.items ?? []) {
    const type = attribute.items[0];
    const value = attribute.items[1]?.items[0];
    if (!type || !value) continue;
    const oid = oidOf(type);
    if (oid === EXTENSION_REQUEST) continue;
    rows.push({ label: named(REQUEST_ATTRIBUTES, oid), value: textOf(value) });
  }
  return rows;
}

function fingerprints(der: Uint8Array, spki: Node): Fingerprints {
  return {
    sha256: fingerprintHex(sha256(der)),
    sha1: fingerprintHex(sha1(der)),
    pin: toBase64(sha256(spki.raw)),
  };
}
