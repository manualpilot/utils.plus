import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { algorithmOf, DAY_MS, generateParams, importParams, keyAlgorithm, KINDS, signatureAlgorithm, signParams } from "./algorithms";
import { bitsOf, derOf } from "./der";
import { readPrivateKey } from "./keys";
import { addressBytes } from "./names";
import { armour, type Block, fingerprintHex, pemBlocks } from "./pem";
import { splitAltNames } from "./validate";
import { bitString, boolean, explicit, implicit, integer, namedBits, nul, octetString, oid, printableString, sequence, set, time, utf8String } from "./write";
import { readCertificate } from "./x509";

export interface Settings {
  kind: string;
  algorithm: string;
  variant: string;
  commonName: string;
  organisation: string;
  country: string;
  altNames: string;
  days: number;
  passphrase: string;
  issuerCertificate: string;
  issuerKey: string;
}

export interface Issued {
  privateKey: string;
  certificate: string;
  chain: string;
  fingerprint: string;
  authority: boolean;
  locked: boolean;
}

export async function issue(settings: Settings): Promise<Issued> {
  const kind = KINDS[settings.kind] ?? KINDS["self-signed"];
  const pair = await crypto.subtle.generateKey(
    generateParams(settings.algorithm, settings.variant),
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));

  const subject = distinguishedName(settings);
  const issuer = kind.signed ? await readIssuer(settings.issuerCertificate, settings.issuerKey) : {
    name: subject,
    keyId: keyIdentifier(spki),
    key: pair.privateKey,
    algorithm: settings.algorithm,
    variant: settings.variant,
    certificate: "",
  };

  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + settings.days * DAY_MS);
  const algorithm = signatureAlgorithm(issuer.algorithm, issuer.variant);
  const tbs = sequence([
    explicit(0, integer(2)),
    integer(serialNumber()),
    algorithm,
    issuer.name,
    sequence([time(notBefore), time(notAfter)]),
    subject,
    spki,
    explicit(3, sequence(extensions(kind, settings, spki, issuer.keyId))),
  ]);

  const raw = new Uint8Array(await crypto.subtle.sign(signParams(issuer.algorithm, issuer.variant), issuer.key, tbs));
  const der = sequence([tbs, algorithm, bitString(issuer.algorithm === "ecdsa" ? ecdsaSignature(raw) : raw)]);
  const certificate = armour(der, "CERTIFICATE");

  return {
    privateKey: settings.passphrase
      ? armour(await lock(pkcs8, settings.passphrase), "ENCRYPTED PRIVATE KEY")
      : armour(pkcs8, "PRIVATE KEY"),
    certificate,
    chain: issuer.certificate === "" ? "" : certificate + issuer.certificate,
    fingerprint: fingerprintHex(sha256(der)),
    authority: kind.authority,
    locked: settings.passphrase !== "",
  };
}

export interface Issuer {
  name: Uint8Array;
  keyId: Uint8Array;
  key: CryptoKey;
  algorithm: string;
  variant: string;
  certificate: string;
}

export async function readIssuer(certificateText: string, keyText: string): Promise<Issuer> {
  const blocks = certificateBlocks(certificateText);
  if (blocks.length === 0) throw new Error("Paste the certificate of the authority that is to sign this");

  const certificate = readCertificate(blocks[0].bytes!);
  if (!certificate.extensions.ca) throw new Error("This certificate is not a certificate authority");
  const named = algorithmOf(certificate.key);
  if (!named) throw new Error(`This page cannot sign with ${certificate.key.label}`);

  const block = pemBlocks(keyText).find((found) => KEYS.has(found.label) && found.bytes);
  if (!block?.bytes) throw new Error("Paste the private key of the authority that is to sign this");
  if (block.label === "ENCRYPTED PRIVATE KEY" || block.headers["Proc-Type"]?.includes("ENCRYPTED")) {
    throw new Error("This key is locked, and this page asks for no passphrase — paste it unlocked");
  }
  if (block.label === "OPENSSH PRIVATE KEY") throw new Error("An OpenSSH key signs SSH and not certificates");

  const reading = await readPrivateKey(block.label, block.bytes);
  if (reading.key === null || reading.key.identity === "") throw new Error("This key could not be read");
  if (reading.key.identity !== certificate.key.identity) throw new Error("This key does not go with this certificate");

  return {
    name: certificate.subjectDer,
    keyId: fromHex(certificate.extensions.ski) ?? keyIdentifier(certificate.spki),
    key: await crypto.subtle.importKey(
      "pkcs8",
      pkcs8Of(block.label, block.bytes, named),
      importParams(named.algorithm, named.variant),
      false,
      ["sign"],
    ),
    ...named,
    certificate: blocks.map((found) => armour(found.bytes!, "CERTIFICATE")).join(""),
  };
}

export async function checkIssuer(certificateText: string, keyText: string): Promise<string> {
  if (certificateText.trim() === "" || keyText.trim() === "") return "";
  try {
    await readIssuer(certificateText, keyText);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "This authority could not be read";
  }
}

const CERTIFICATES = new Set(["CERTIFICATE", "X509 CERTIFICATE", "TRUSTED CERTIFICATE"]);
const KEYS = new Set([
  "PRIVATE KEY",
  "RSA PRIVATE KEY",
  "EC PRIVATE KEY",
  "ENCRYPTED PRIVATE KEY",
  "OPENSSH PRIVATE KEY",
]);

function certificateBlocks(text: string): Block[] {
  return pemBlocks(text).filter((block) => CERTIFICATES.has(block.label) && block.bytes !== null);
}

function pkcs8Of(
  label: string,
  bytes: Uint8Array<ArrayBuffer>,
  named: { algorithm: string; variant: string },
): Uint8Array<ArrayBuffer> {
  if (label === "PRIVATE KEY") return bytes;
  return sequence([integer(0), keyAlgorithm(named.algorithm, named.variant), octetString(bytes)]);
}

const BASIC_CONSTRAINTS = "2.5.29.19";
const KEY_USAGE = "2.5.29.15";
const EXTENDED_KEY_USAGE = "2.5.29.37";
const SUBJECT_ALT_NAME = "2.5.29.17";
const SUBJECT_KEY_ID = "2.5.29.14";
const AUTHORITY_KEY_ID = "2.5.29.35";
const SERVER_AUTH = "1.3.6.1.5.5.7.3.1";
const CLIENT_AUTH = "1.3.6.1.5.5.7.3.2";

function extensions(
  kind: { authority: boolean; pathLength: number | null },
  settings: Settings,
  spki: Uint8Array,
  issuerKeyId: Uint8Array,
): Uint8Array[] {
  const depth = kind.pathLength === null ? [] : [integer(kind.pathLength)];
  const rows = [
    extension(BASIC_CONSTRAINTS, true, sequence(kind.authority ? [boolean(true), ...depth] : [])),
    extension(KEY_USAGE, true, namedBits(usageBits(kind.authority, settings.algorithm))),
  ];

  if (!kind.authority) {
    rows.push(extension(EXTENDED_KEY_USAGE, false, sequence([oid(SERVER_AUTH), oid(CLIENT_AUTH)])));
    const names = altNames(settings);
    if (names.length > 0) rows.push(extension(SUBJECT_ALT_NAME, false, sequence(names)));
  }

  rows.push(extension(SUBJECT_KEY_ID, false, octetString(keyIdentifier(spki))));
  rows.push(extension(AUTHORITY_KEY_ID, false, sequence([implicit(0, issuerKeyId)])));
  return rows;
}

function extension(id: string, critical: boolean, value: Uint8Array): Uint8Array {
  return sequence(critical ? [oid(id), boolean(true), octetString(value)] : [oid(id), octetString(value)]);
}

function usageBits(authority: boolean, algorithm: string): number[] {
  if (authority) return [0, 5, 6];
  return algorithm === "rsa" ? [0, 2] : [0];
}

function altNames(settings: Settings): Uint8Array[] {
  const listed = splitAltNames(settings.altNames);
  const names = (listed.length > 0 ? listed : [settings.commonName.trim()]).filter((name) => name !== "");
  return names.map((name) => {
    const address = addressBytes(name);
    return address ? implicit(7, address) : implicit(2, new TextEncoder().encode(name));
  });
}

function distinguishedName({ commonName, organisation, country }: Settings): Uint8Array {
  const parts: Uint8Array[] = [];
  if (country.trim()) parts.push(attribute("2.5.4.6", printableString(country.trim().toUpperCase())));
  if (organisation.trim()) parts.push(attribute("2.5.4.10", utf8String(organisation.trim())));
  parts.push(attribute("2.5.4.3", utf8String(commonName.trim())));
  return sequence(parts);
}

function attribute(type: string, value: Uint8Array): Uint8Array {
  return set([sequence([oid(type), value])]);
}

function keyIdentifier(spki: Uint8Array): Uint8Array {
  const key = derOf(spki)?.items[1];
  return sha1(key ? bitsOf(key) : spki);
}

function serialNumber(): Uint8Array {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[0] &= 0x7f;
  return bytes;
}

function ecdsaSignature(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  return sequence([integer(raw.subarray(0, half)), integer(raw.subarray(half))]);
}

const PBES2 = "1.2.840.113549.1.5.13";
const PBKDF2 = "1.2.840.113549.1.5.12";
const HMAC_SHA256 = "1.2.840.113549.2.9";
const AES_256_CBC = "2.16.840.1.101.3.4.1.42";

const ROUNDS = 100_000;

async function lock(pkcs8: Uint8Array<ArrayBuffer>, passphrase: string): Promise<Uint8Array<ArrayBuffer>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ROUNDS, hash: "SHA-256" },
    base,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt"],
  );
  const locked = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, pkcs8));

  return sequence([
    sequence([
      oid(PBES2),
      sequence([
        sequence([oid(PBKDF2), sequence([octetString(salt), integer(ROUNDS), sequence([oid(HMAC_SHA256), nul()])])]),
        sequence([oid(AES_256_CBC), octetString(iv)]),
      ]),
    ]),
    octetString(locked),
  ]);
}

function fromHex(text: string): Uint8Array | null {
  if (text === "") return null;
  const pairs = text.split(":");
  const bytes = new Uint8Array(pairs.length);
  for (let index = 0; index < pairs.length; index += 1) bytes[index] = parseInt(pairs[index], 16);
  return bytes;
}
