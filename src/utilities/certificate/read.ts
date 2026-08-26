import { sha256 } from "@noble/hashes/sha2.js";
import { derOf, type Node, oidOf, TAG, tagged, UNIVERSAL } from "./der";
import { certificateFacts, privateKeyFacts, publicKeyFacts, requestFacts, sshFacts } from "./facts";
import { type PrivateReading, readPrivateKey, readPublicKey, rsaKey } from "./keys";
import { armour, type Block, decodeBase64, pemBlocks, toBase64 } from "./pem";
import { readOpenSshPrivate, readSshLine, type SshKey } from "./ssh";
import type { Item } from "./types";
import { readCertificate, readRequest } from "./x509";

const CERTIFICATES = new Set(["CERTIFICATE", "X509 CERTIFICATE", "TRUSTED CERTIFICATE"]);
const REQUESTS = new Set(["CERTIFICATE REQUEST", "NEW CERTIFICATE REQUEST"]);
const PRIVATE_KEYS = new Set([
  "PRIVATE KEY",
  "RSA PRIVATE KEY",
  "EC PRIVATE KEY",
  "DSA PRIVATE KEY",
  "ENCRYPTED PRIVATE KEY",
]);
const BUNDLES = new Set(["PKCS7", "PKCS #7", "CMS"]);

export async function readItems(text: string): Promise<Item[]> {
  const blocks = pemBlocks(text);
  const items: Item[] = [];

  for (const block of blocks) items.push(...await fromBlock(block));

  let loose = text;
  for (const block of blocks) loose = loose.replace(block.text, "\n");
  for (const line of loose.split(/\r?\n/)) {
    const ssh = readSshLine(line);
    if (ssh) items.push(sshItem(ssh));
  }

  if (items.length === 0 && loose.trim() !== "") {
    const label = sniffBase64(loose);
    if (label) return await readItems(`-----BEGIN ${label}-----\n${loose.trim()}\n-----END ${label}-----`);
    items.push(unreadable("This is not a certificate, a request or a key this page can read"));
  }

  items.forEach((item, index) => {
    item.id = String(index);
  });
  return items;
}

async function fromBlock(block: Block): Promise<Item[]> {
  if (!block.bytes) return [unreadable(`The base64 inside this ${block.label} block is unreadable`)];

  if (CERTIFICATES.has(block.label)) return [certificateItem(block.bytes)];
  if (REQUESTS.has(block.label)) return [requestItem(block.bytes)];
  if (block.label === "PUBLIC KEY") return [publicKeyItem(block.bytes)];
  if (block.label === "RSA PUBLIC KEY") return [rsaPublicItem(block.bytes)];
  if (block.label === "OPENSSH PRIVATE KEY") return [openSshItem(block.bytes)];
  if (PRIVATE_KEYS.has(block.label)) {
    if (block.headers["Proc-Type"]?.includes("ENCRYPTED")) return [lockedItem(block.headers["DEK-Info"] ?? "")];
    return [privateKeyItem(await readPrivateKey(block.label, block.bytes), block.label)];
  }
  if (BUNDLES.has(block.label)) {
    const bundled = bundleCertificates(block.bytes);
    if (bundled === null) return [unreadable("This bundle carries no certificates")];
    return bundled.map(certificateItem);
  }
  return [unreadable(`This page does not read ${block.label} blocks`)];
}

function certificateItem(der: Uint8Array): Item {
  try {
    const certificate = readCertificate(der);
    return {
      ...blank("certificate", "Certificate", certificate.subject.common),
      facts: certificateFacts(certificate),
      extensions: certificate.extensions.rows,
      identity: certificate.key.identity,
      subject: certificate.subject.text,
      issuer: certificate.issuer.text,
      ski: certificate.extensions.ski,
      aki: certificate.extensions.aki,
      selfIssued: certificate.selfIssued,
      ca: certificate.extensions.ca,
      notBefore: certificate.notBefore,
      notAfter: certificate.notAfter,
    };
  } catch (e) {
    return unreadable(message(e));
  }
}

function requestItem(der: Uint8Array): Item {
  try {
    const request = readRequest(der);
    return {
      ...blank("request", "Certificate request", request.subject.common),
      facts: requestFacts(request),
      extensions: request.extensions.rows,
      identity: request.key.identity,
      subject: request.subject.text,
    };
  } catch (e) {
    return unreadable(message(e));
  }
}

function publicKeyItem(der: Uint8Array): Item {
  const spki = derOf(der);
  if (!spki) return unreadable("This is not a public key this page can read");
  const key = readPublicKey(spki);
  return {
    ...blank("key", "Public key", key.label),
    facts: publicKeyFacts(key, toBase64(sha256(spki.raw))),
    identity: key.identity,
  };
}

function rsaPublicItem(der: Uint8Array): Item {
  const written = derOf(der);
  const modulus = written?.items[0];
  const exponent = written?.items[1];
  if (!modulus || !exponent) return unreadable("This is not an RSA public key this page can read");
  const key = rsaKey(modulus.content, exponent.content);
  return { ...blank("key", "Public key", key.label), facts: publicKeyFacts(key, ""), identity: key.identity };
}

function privateKeyItem(reading: PrivateReading, label: string): Item {
  if (reading.error) return { ...unreadable(reading.error), secret: true };
  if (reading.encrypted) return lockedItem(reading.scheme);
  return {
    ...blank("key", "Private key", reading.key?.label ?? label.toLowerCase()),
    facts: privateKeyFacts(reading),
    identity: reading.key?.identity ?? "",
    secret: true,
  };
}

function lockedItem(scheme: string): Item {
  return {
    ...blank("key", "Encrypted private key", ""),
    facts: [{ label: "Encryption", value: scheme }],
    secret: true,
    error: "Locked, so only the scheme that locked it can be read here — its public half cannot",
  };
}

function openSshItem(bytes: Uint8Array): Item {
  const reading = readOpenSshPrivate(bytes);
  if (!reading?.key) return { ...unreadable("This is not an OpenSSH private key"), secret: true };
  const ssh = reading.key;
  return {
    ...blank("key", "Private key", ssh.key.label),
    facts: [
      { label: "Format", value: "OpenSSH" },
      ...sshFacts(ssh),
      { label: "Encryption", value: reading.encrypted ? reading.cipher : "" },
    ],
    identity: ssh.key.identity,
    secret: true,
  };
}

function sshItem(ssh: SshKey): Item {
  return {
    ...blank("key", ssh.certificate ? "OpenSSH certificate" : "SSH public key", ssh.comment || ssh.key.label),
    facts: sshFacts(ssh),
    identity: ssh.key.identity,
    error: ssh.certificate ? "An OpenSSH certificate carries more than a key, and only its name is read here" : "",
  };
}

function unreadable(error: string): Item {
  return { ...blank("unreadable", "Unreadable", ""), error };
}

function blank(kind: Item["kind"], heading: string, name: string): Item {
  return {
    id: "",
    kind,
    heading,
    name,
    facts: [],
    extensions: [],
    identity: "",
    secret: false,
    error: "",
    subject: "",
    issuer: "",
    ski: "",
    aki: "",
    selfIssued: false,
    ca: false,
    notBefore: null,
    notAfter: null,
  };
}

const SIGNED_DATA = "1.2.840.113549.1.7.2";

function bundleCertificates(bytes: Uint8Array): Uint8Array[] | null {
  const root = derOf(bytes);
  if (!root?.items[0] || oidOf(root.items[0]) !== SIGNED_DATA) return null;
  const signed = tagged(root.items, 0)?.items[0];
  const certificates = signed ? tagged(signed.items, 0) : undefined;
  return certificates ? certificates.items.map((item) => item.raw) : null;
}

export function sniffDer(bytes: Uint8Array): string {
  const root = derOf(bytes);
  if (!root) return "";
  if (reads(() => readCertificate(bytes))) return "CERTIFICATE";
  if (reads(() => readRequest(bytes))) return "CERTIFICATE REQUEST";
  if (root.items.length === 2 && is(root.items[0], TAG.sequence) && is(root.items[1], TAG.bitString)) {
    return "PUBLIC KEY";
  }
  if (root.items[0] && oidOf(root.items[0]) === SIGNED_DATA) return "PKCS7";
  if (is(root.items[0], TAG.integer) && is(root.items[1], TAG.sequence) && is(root.items[2], TAG.octetString)) {
    return "PRIVATE KEY";
  }
  if (root.items.length === 2 && is(root.items[0], TAG.sequence) && is(root.items[1], TAG.octetString)) {
    return "ENCRYPTED PRIVATE KEY";
  }
  if (root.items.length >= 9 && root.items.every((item) => is(item, TAG.integer))) return "RSA PRIVATE KEY";
  return "";
}

function reads(read: () => unknown): boolean {
  try {
    read();
    return true;
  } catch {
    return false;
  }
}

export function fileText(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!CONTROL.test(text)) return text;
  } catch {
  }
  const label = sniffDer(bytes);
  return label === "" ? "" : armour(bytes, label);
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

function sniffBase64(text: string): string {
  const bytes = decodeBase64(text);
  return bytes ? sniffDer(bytes) : "";
}

function is(node: Node | undefined, tag: number): boolean {
  return node?.cls === UNIVERSAL && node.tag === tag;
}

const SECRETS = new Set([...PRIVATE_KEYS, "OPENSSH PRIVATE KEY"]);

export function publicText(text: string): string {
  const blocks = pemBlocks(text);
  if (blocks.length === 0) return SECRETS.has(sniffBase64(text)) ? "" : text.trim();

  let kept = text;
  for (const block of blocks) if (SECRETS.has(block.label)) kept = kept.replace(block.text, "");
  return kept.trim();
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "This document could not be read";
}
