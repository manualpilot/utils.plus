import { randomBytes } from "@noble/hashes/utils.js";
import { DAY_MS, ECDSA_SIGNATURES } from "./algorithms";
import { fromBinary, toBinary, toHex } from "./encoding";
import { toPem, webCryptoKeyPair } from "./results";
import type { Certificate, CertificateSettings } from "./types";
import { isAddress } from "./validate";

type Forge = typeof import("node-forge");
type ForgeCertificate = ReturnType<Forge["pki"]["createCertificate"]>;

export async function generateCertificate(settings: CertificateSettings): Promise<Certificate> {
  const forge = await loadForge();
  const pair = await webCryptoKeyPair(settings.algorithm, settings.variant);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));

  const cert = forge.pki.createCertificate();
  cert.version = 2;
  cert.serialNumber = serialNumber();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(cert.validity.notBefore.getTime() + settings.days * DAY_MS);
  const subject = [{ name: "commonName", value: settings.commonName.trim() }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions(certificateExtensions(settings));

  const der = settings.algorithm === "rsa"
    ? signWithForge(forge, cert, pkcs8)
    : await signWithWebCrypto(forge, cert, pair, settings.variant);

  return {
    privateKey: settings.passphrase
      ? unixPem(forge.pki.encryptedPrivateKeyToPem(encryptedPrivateKey(forge, pkcs8, settings.passphrase)))
      : toPem(pkcs8, "PRIVATE KEY"),
    certificate: unixPem(forge.pem.encode({ type: "CERTIFICATE", body: der })),
    fingerprint: forge.md.sha256.create().update(der).digest().toHex().toUpperCase().replace(/..\B/g, "$&:"),
  };
}

function signWithForge(forge: Forge, cert: ForgeCertificate, pkcs8: Uint8Array): string {
  const privateKey = forge.pki.privateKeyFromPem(toPem(pkcs8, "PRIVATE KEY"));
  cert.publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
  cert.sign(privateKey, forge.md.sha256.create());
  return forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
}

async function signWithWebCrypto(
  forge: Forge,
  cert: ForgeCertificate,
  pair: CryptoKeyPair,
  variant: string,
): Promise<string> {
  const { asn1, pki, util } = forge;
  const { oid, hash } = ECDSA_SIGNATURES[variant] ?? ECDSA_SIGNATURES.nistp256;
  const algorithm = () =>
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
    ]);

  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const tbs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(cert.version).getBytes()),
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, util.hexToBytes(cert.serialNumber)),
    algorithm(),
    pki.distinguishedNameToAsn1(cert.issuer),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      timeToAsn1(forge, cert.validity.notBefore),
      timeToAsn1(forge, cert.validity.notAfter),
    ]),
    pki.distinguishedNameToAsn1(cert.subject),
    asn1.fromDer(util.createBuffer(toBinary(spki))),
    pki.certificateExtensionsToAsn1(cert.extensions),
  ]);

  const body = asn1.toDer(tbs).getBytes();
  const signed = await crypto.subtle.sign({ name: "ECDSA", hash }, pair.privateKey, fromBinary(body));
  const certificate = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    tbs,
    algorithm(),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false, "\0" + derSignature(forge, new Uint8Array(signed))),
  ]);
  return asn1.toDer(certificate).getBytes();
}

function certificateExtensions({ algorithm, altNames, commonName }: CertificateSettings) {
  return [
    { name: "basicConstraints", critical: true, cA: false },
    { name: "keyUsage", critical: true, digitalSignature: true, keyEncipherment: algorithm === "rsa" },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames: altNameList(altNames, commonName) },
  ];
}

function altNameList(altNames: string, commonName: string) {
  const listed = splitAltNames(altNames);
  const names = listed.length > 0 ? listed : [commonName.trim()];
  return names.map((name) => isAddress(name) ? { type: 7, ip: name } : { type: 2, value: name });
}

export function splitAltNames(value: string): string[] {
  return value.split(/[,\s]+/).filter((entry) => entry !== "");
}

function timeToAsn1(forge: Forge, date: Date) {
  const { asn1 } = forge;
  return date.getUTCFullYear() < 2050
    ? asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false, asn1.dateToUtcTime(date))
    : asn1.create(asn1.Class.UNIVERSAL, asn1.Type.GENERALIZEDTIME, false, asn1.dateToGeneralizedTime(date));
}

function derSignature(forge: Forge, signature: Uint8Array): string {
  const { asn1 } = forge;
  const half = signature.length / 2;
  const pair = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    unsignedInteger(forge, signature.subarray(0, half)),
    unsignedInteger(forge, signature.subarray(half)),
  ]);
  return asn1.toDer(pair).getBytes();
}

function unsignedInteger(forge: Forge, bytes: Uint8Array) {
  const value = toBinary(unsignedBytes(bytes));
  return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, value);
}

export function unsignedBytes(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  const trimmed = bytes.subarray(start);
  if ((trimmed[0] & 0x80) === 0) return trimmed;
  const padded = new Uint8Array(trimmed.length + 1);
  padded.set(trimmed, 1);
  return padded;
}

function encryptedPrivateKey(forge: Forge, pkcs8: Uint8Array, passphrase: string) {
  const info = forge.asn1.fromDer(forge.util.createBuffer(toBinary(pkcs8)));
  return forge.pki.encryptPrivateKeyInfo(info, passphrase, { algorithm: "aes256" });
}

function unixPem(pem: string): string {
  return pem.replace(/\r\n/g, "\n");
}

function serialNumber(): string {
  return toHex(unsignedBytes(randomBytes(16)));
}

async function loadForge(): Promise<Forge> {
  const forge = await import("node-forge");
  return (forge as unknown as { default: Forge }).default;
}
