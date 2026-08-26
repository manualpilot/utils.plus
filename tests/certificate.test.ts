import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { arrange } from "../src/utilities/certificate/chain";
import { oidOf, readDer, timeOf } from "../src/utilities/certificate/der";
import { issue, type Settings } from "../src/utilities/certificate/issue";
import { decodeBase64 } from "../src/utilities/certificate/pem";
import { fileText, publicText, readItems, sniffDer } from "../src/utilities/certificate/read";
import type { Item } from "../src/utilities/certificate/types";
import { isHostOrAddress } from "../src/utilities/certificate/validate";
import { relative, validity } from "../src/utilities/certificate/validity";
import { integer, oid as writeOid, time as writeTime } from "../src/utilities/certificate/write";
import { BUNDLE, ED25519, ED25519_KEY, EXPIRED, INTERMEDIATE, LEAF, LEAF_KEY, LEAF_KEY_LOCKED, LEAF_PUBLIC, LEGACY_KEY_LOCKED, LOGGED, REQUEST, ROOT, SSH_ECDSA, SSH_ED25519, SSH_PRIVATE, SSH_RSA } from "./certificate-fixtures";

const { createPrivateKey, X509Certificate } = createRequire(import.meta.url)(
  "node:crypto",
) as typeof import("node:crypto");

const fact = (item: Item, label: string) => item.facts.find((row) => row.label === label)?.value ?? "";
const extension = (item: Item, name: string) => item.extensions.find((row) => row.name === name)?.value ?? "";

describe("DER", () => {
  it("reads an object identifier out of its one-byte first pair and its base-128 rest", () => {
    const bytes = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]);
    expect(oidOf(readDer(bytes))).toBe("1.2.840.113549.1.1.11");
  });

  it("reads the first two arcs back out of the one number they share", () => {
    expect(oidOf(readDer(new Uint8Array([0x06, 0x01, 0x00])))).toBe("0.0");
    expect(oidOf(readDer(new Uint8Array([0x06, 0x01, 0x51])))).toBe("2.1");
    expect(oidOf(readDer(new Uint8Array([0x06, 0x03, 0x81, 0x34, 0x03])))).toBe("2.100.3");
  });

  it("refuses a length that reaches past the bytes it was given", () => {
    expect(() => readDer(new Uint8Array([0x30, 0x7f, 0x02, 0x01, 0x01]))).toThrow(/more bytes/);
  });

  it("refuses the indefinite length that makes a document BER rather than DER", () => {
    expect(() => readDer(new Uint8Array([0x30, 0x80, 0x00, 0x00]))).toThrow(/DER/);
  });

  it("reads a two-digit year as RFC 5280 pivots it and a four-digit one as itself", () => {
    const utc = readDer(new Uint8Array([0x17, 0x0d, ...ascii("500101000000Z")]));
    const generalized = readDer(new Uint8Array([0x18, 0x0f, ...ascii("21250101000000Z")]));
    expect(timeOf(utc)?.toISOString()).toBe("1950-01-01T00:00:00.000Z");
    expect(timeOf(generalized)?.toISOString()).toBe("2125-01-01T00:00:00.000Z");
  });
});

describe("writing DER", () => {
  const bytes = (...values: number[]) => Array.from(integer(new Uint8Array(values))).slice(2);

  it("writes an object identifier the reader reads back as the one it was given", () => {
    for (const dotted of ["1.2.840.113549.1.1.11", "2.5.29.17", "1.3.101.112", "0.0", "2.100.3", "2.5.4.3"]) {
      expect(oidOf(readDer(writeOid(dotted)))).toBe(dotted);
    }
  });

  it("spends as few bytes on an integer as DER allows", () => {
    expect(bytes(0x7f, 0x00, 0x2a)).toEqual([0x7f, 0x00, 0x2a]);
    expect(bytes(0x00, 0x2a)).toEqual([0x2a]);
    expect(bytes(0x00, 0x00, 0x00, 0x00, 0x01)).toEqual([0x01]);
    expect(bytes(0x00)).toEqual([0x00]);
    expect(bytes(0x00, 0x00, 0x00)).toEqual([0x00]);
  });

  it("clears the sign with one zero byte and no more", () => {
    expect(bytes(0x80, 0x2a)).toEqual([0x00, 0x80, 0x2a]);
    expect(bytes(0xff)).toEqual([0x00, 0xff]);
    expect(bytes(0x00, 0x00, 0x80)).toEqual([0x00, 0x80]);
  });

  it("writes a time the reader reads back as the same instant, on both sides of the century", () => {
    for (const iso of ["2026-08-26T00:00:00.000Z", "2049-12-31T23:59:59.000Z", "2125-01-01T00:00:00.000Z"]) {
      expect(timeOf(readDer(writeTime(new Date(iso))))?.toISOString()).toBe(iso);
    }
  });
});

describe("what a certificate may be named for", () => {
  it.each([
    "localhost",
    "example.test",
    "*.example.test",
    "xn--80ak6aa92e.test",
    "a-b.c-d.test",
    "127.0.0.1",
    "255.255.255.255",
    "::1",
    "2001:db8::1",
    "2001:0db8:0000:0000:0000:0000:0000:0001",
  ])("takes %s", (value) => {
    expect(isHostOrAddress(value)).toBe(true);
  });

  it.each([
    "",
    "not a host",
    "-leading.test",
    "trailing-.test",
    "double..dot",
    "*",
    "*.*.example.test",
    "256.0.0.1",
    "1.2.3",
    "2001:db8::1::2",
    "2001:db8:zzzz::1",
    "12345::1",
  ])("refuses %s", (value) => {
    expect(isHostOrAddress(value)).toBe(false);
  });
});

describe("a certificate", () => {
  it("reads the names, the dates and the key the way OpenSSL reads them", async () => {
    const [item] = await readItems(LEAF);
    const openssl = new X509Certificate(LEAF);

    expect(item.kind).toBe("certificate");
    expect(item.name).toBe("example.test");
    expect(fact(item, "Subject")).toBe("C=AU, O=utils.plus, CN=example.test");
    expect(fact(item, "Issuer")).toBe("C=AU, O=utils.plus, CN=utils.plus Test Issuing CA");
    expect(fact(item, "Serial number").replace(/:/g, "")).toBe(openssl.serialNumber);
    expect(fact(item, "Not before")).toBe("2025-01-01 00:00:00 UTC");
    expect(fact(item, "Not after")).toBe("2125-01-01 00:00:00 UTC");
    expect(fact(item, "Public key")).toBe("ECDSA P-256");
    expect(fact(item, "Signature")).toBe("SHA-256 with ECDSA");
    expect(fact(item, "Version")).toBe("v3");
  });

  it("fingerprints the bytes rather than the reading of them", async () => {
    const [item] = await readItems(LEAF);
    const openssl = new X509Certificate(LEAF);

    expect(fact(item, "SHA-256")).toBe(openssl.fingerprint256);
    expect(fact(item, "SHA-1")).toBe(openssl.fingerprint);
    expect(fact(item, "Public key SHA-256")).toBe("iTygcdtsxp4cL9wrnrklvMQ4ZhwcVvMuN32R0FkW/mo=");
  });

  it("reads the extensions a TLS client actually acts on", async () => {
    const [item] = await readItems(LEAF);

    expect(extension(item, "Subject alternative name"))
      .toBe("DNS:example.test, DNS:www.example.test, IP:127.0.0.1");
    expect(extension(item, "Key usage")).toBe("Digital signature");
    expect(extension(item, "Extended key usage")).toBe("TLS server, TLS client");
    expect(extension(item, "Basic constraints")).toBe("End entity");
    expect(extension(item, "Authority information access")).toBe("OCSP: URI:http://ocsp.example.test");
    expect(extension(item, "CRL distribution points")).toBe("URI:http://crl.example.test/a.crl");
    expect(item.ca).toBe(false);
    expect(item.selfIssued).toBe(false);
  });

  it("marks the critical extensions as critical, since a reader that cannot read one must refuse the whole", async () => {
    const [item] = await readItems(LEAF);
    const critical = item.extensions.filter((row) => row.critical).map((row) => row.name);

    expect(critical).toEqual(["Basic constraints", "Key usage"]);
  });

  it("reads the extensions a certificate only picks up once it is public", async () => {
    const [item] = await readItems(LOGGED);

    expect(extension(item, "Certificate policies")).toBe("Domain validated");
    expect(extension(item, "TLS feature")).toBe("Must staple (status_request)");
    expect(extension(item, "Signed certificate timestamps")).toBe("2 timestamps");
  });

  it("shows an extension nobody has a word for as the bytes it is", async () => {
    const [item] = await readItems(LOGGED);
    const private_ = item.extensions.find((row) => row.oid === "1.3.6.1.4.1.99999.1");

    expect(private_?.name).toBe("1.3.6.1.4.1.99999.1");
    expect(private_?.value).toBe("04:03:01:02:03");
  });

  it("reads a root as a CA with the depth it allows below it", async () => {
    const [item] = await readItems(ROOT);

    expect(fact(item, "Public key")).toBe("RSA 2048");
    expect(fact(item, "Signature")).toBe("SHA-256 with RSA");
    expect(extension(item, "Basic constraints")).toBe("Certificate authority, path length 1");
    expect(extension(item, "Key usage")).toBe("Certificate signing, CRL signing");
    expect(item.ca).toBe(true);
    expect(item.selfIssued).toBe(true);
  });

  it("reads an Ed25519 certificate, which no library here could have read", async () => {
    const [item] = await readItems(ED25519);

    expect(fact(item, "Public key")).toBe("Ed25519");
    expect(fact(item, "Signature")).toBe("Ed25519");
    expect(item.name).toBe("ed25519.test");
  });
});

describe("validity", () => {
  it("counts in days inside a quarter and in calendar words past it", () => {
    const now = Date.UTC(2026, 0, 1);
    expect(relative(Date.UTC(2026, 0, 12), now)).toBe("in 11 days");
    expect(relative(Date.UTC(2025, 11, 20), now)).toBe("12 days ago");
    expect(relative(Date.UTC(2027, 0, 1), now)).toBe("in 1 year");
  });

  it("says which side of its window a certificate is on", async () => {
    const [expired] = await readItems(EXPIRED);
    const [leaf] = await readItems(LEAF);
    const now = Date.UTC(2026, 0, 1);

    expect(validity(expired.notBefore, expired.notAfter, now)?.colour).toBe("red");
    expect(validity(expired.notBefore, expired.notAfter, now)?.text).toMatch(/^Expired /);
    expect(validity(leaf.notBefore, leaf.notAfter, now)?.colour).toBe("teal");
    const soon = new Date(Date.UTC(2026, 5, 1));
    expect(validity(soon, new Date(Date.UTC(2027, 0, 1)), now)?.text).toBe("Valid in 4 months");
  });

  it("colours the last month of a certificate's life differently from the rest of it", async () => {
    const [leaf] = await readItems(LEAF);
    const almost = leaf.notAfter!.getTime() - 5 * 86400_000;

    expect(validity(leaf.notBefore, leaf.notAfter, almost)?.colour).toBe("yellow");
    expect(validity(leaf.notBefore, leaf.notAfter, almost)?.text).toBe("Expires in 5 days");
  });
});

describe("a chain", () => {
  it("puts the certificates back in the order a server has to send them in", async () => {
    const { chains } = arrange(await readItems(`${ROOT}\n${LEAF}\n${INTERMEDIATE}`));

    expect(chains).toHaveLength(1);
    expect(chains[0].rows.map((row) => row.role)).toEqual(["Leaf", "Intermediate", "Root"]);
    expect(chains[0].rows.map((row) => row.name)).toEqual([
      "C=AU, O=utils.plus, CN=example.test",
      "C=AU, O=utils.plus, CN=utils.plus Test Issuing CA",
      "C=AU, O=utils.plus, CN=utils.plus Test Root CA",
    ]);
    expect(chains[0].complete).toBe(true);
    expect(chains[0].ordered).toBe(false);
    expect(chains[0].note).toMatch(/leaf first/);
  });

  it("says nothing about the order when the order was already right", async () => {
    const { chains } = arrange(await readItems(`${LEAF}\n${INTERMEDIATE}\n${ROOT}`));

    expect(chains[0].ordered).toBe(true);
    expect(chains[0].note).toBe("");
  });

  it("names the certificate nothing here issued when the middle is missing", async () => {
    const { chains } = arrange(await readItems(`${LEAF}\n${ROOT}`));

    expect(chains).toHaveLength(2);
    expect(chains[0].rows.map((row) => row.role)).toEqual(["Leaf"]);
    expect(chains[0].rows[0].issue).toBe("Nothing here issued C=AU, O=utils.plus, CN=utils.plus Test Issuing CA");
    expect(chains[0].complete).toBe(false);
    expect(chains[0].note).toMatch(/stops short of a self-signed root/);
  });

  it("draws the certificates in chain order whatever order they were pasted in", async () => {
    const { items } = arrange(await readItems(`${INTERMEDIATE}\n${ROOT}\n${LEAF}`));

    expect(items.map((item) => item.name)).toEqual([
      "example.test",
      "utils.plus Test Issuing CA",
      "utils.plus Test Root CA",
    ]);
  });

  it("reads a PKCS#7 bundle as the certificates inside it", async () => {
    const items = await readItems(BUNDLE);

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.kind === "certificate")).toBe(true);
    expect(arrange(items).chains[0].rows).toHaveLength(3);
  });
});

describe("a key beside a certificate", () => {
  it("says so when the private key is the certificate's own", async () => {
    const { matches, items } = arrange(await readItems(`${LEAF}\n${LEAF_KEY}`));
    const [certificate, key] = items;

    expect(key.heading).toBe("Private key");
    expect(matches[key.id]).toEqual({ text: "Matches example.test", found: true });
    expect(matches[certificate.id]).toEqual({ text: "Private key matches", found: true });
  });

  it("says so when it is not", async () => {
    const { matches, items } = arrange(await readItems(`${LEAF}\n${ED25519_KEY}`));

    expect(matches[items[1].id]).toEqual({ text: "Matches nothing here", found: false });
    expect(matches[items[0].id]).toBeUndefined();
  });

  it("works an Ed25519 public half back out of the seed the key is written as", async () => {
    const { matches, items } = arrange(await readItems(`${ED25519}\n${ED25519_KEY}`));

    expect(items[1].facts.find((row) => row.label === "Public key")?.value).toBe("Ed25519");
    expect(matches[items[1].id]).toEqual({ text: "Matches ed25519.test", found: true });
  });

  it("matches a public key on its own against the certificate it belongs to", async () => {
    const { matches, items } = arrange(await readItems(`${LEAF}\n${LEAF_PUBLIC}`));

    expect(items[1].heading).toBe("Public key");
    expect(matches[items[1].id]?.found).toBe(true);
  });

  it("says what locked an encrypted key and claims nothing about whose it is", async () => {
    const { matches, items } = arrange(await readItems(`${LEAF}\n${LEAF_KEY_LOCKED}`));

    expect(items[1].heading).toBe("Encrypted private key");
    expect(items[1].facts.find((row) => row.label === "Encryption")?.value).toMatch(/^PBES2/);
    expect(items[1].identity).toBe("");
    expect(matches[items[1].id]).toBeUndefined();
    expect(matches[items[0].id]).toBeUndefined();
  });

  it("reads a traditionally encrypted key off its headers rather than failing on its body", async () => {
    const [item] = await readItems(LEGACY_KEY_LOCKED);

    expect(item.heading).toBe("Encrypted private key");
    expect(item.facts.find((row) => row.label === "Encryption")?.value).toMatch(/^AES-256-CBC,/);
    expect(item.identity).toBe("");
    expect(publicText(LEGACY_KEY_LOCKED)).toBe("");
  });
});

describe("a request", () => {
  it("reads the subject and the extensions it is asking for", async () => {
    const [item] = await readItems(REQUEST);

    expect(item.kind).toBe("request");
    expect(fact(item, "Subject")).toBe("C=AU, O=utils.plus, CN=request.test");
    expect(fact(item, "Public key")).toBe("RSA 2048");
    expect(extension(item, "Subject alternative name")).toBe("DNS:request.test, DNS:alt.request.test");
  });
});

describe("an SSH key", () => {
  it("fingerprints a public key line both ways ssh-keygen does", async () => {
    const [item] = await readItems(SSH_ED25519);

    expect(item.heading).toBe("SSH public key");
    expect(item.name).toBe("ada@example.test");
    expect(fact(item, "Algorithm")).toBe("ssh-ed25519");
    expect(fact(item, "Fingerprint")).toBe("SHA256:BXxgus5qjl4w/pnvtrZbtpev9aqqHi4K0v419Cl584w");
    expect(fact(item, "Legacy fingerprint")).toBe("MD5:21:64:a9:b8:7a:dd:5f:04:e5:67:6a:f9:7d:6e:31:c7");
  });

  it("reads the RSA and the ECDSA spellings, which write their fields in their own orders", async () => {
    const [rsa] = await readItems(SSH_RSA);
    const [ecdsa] = await readItems(SSH_ECDSA);

    expect(rsa.facts.find((row) => row.label === "Public key")?.value).toBe("RSA 2048");
    expect(ecdsa.facts.find((row) => row.label === "Public key")?.value).toBe("ECDSA P-256");
  });

  it("reads an OpenSSH private key's public half and matches it to its own public line", async () => {
    const { matches, items } = arrange(await readItems(`${SSH_PRIVATE}\n${SSH_ED25519}`));

    expect(items[0].heading).toBe("Private key");
    expect(items[0].facts.find((row) => row.label === "Format")?.value).toBe("OpenSSH");
    expect(items[0].identity).toBe(items[1].identity);
    expect(matches).toEqual({});
  });
});

describe("what was pasted", () => {
  it("reads base64 with no armour around it", async () => {
    const bare = LEAF.replace(/-----[A-Z ]+-----/g, "").trim();
    const [item] = await readItems(bare);

    expect(item.kind).toBe("certificate");
    expect(item.name).toBe("example.test");
  });

  it("says which block it could not read rather than showing nothing at all", async () => {
    const items = await readItems(
      `${LEAF}\n-----BEGIN PGP PUBLIC KEY BLOCK-----\nAAAA\n-----END PGP PUBLIC KEY BLOCK-----`,
    );

    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("certificate");
    expect(items[1].error).toBe("This page does not read PGP PUBLIC KEY BLOCK blocks");
  });

  it("says so when nothing pasted is readable at all", async () => {
    const [item] = await readItems("not a certificate");

    expect(item.kind).toBe("unreadable");
    expect(item.error).toMatch(/not a certificate/);
  });

  it("reads nothing out of nothing", async () => {
    expect(await readItems("   ")).toEqual([]);
  });

  it("armours a DER file into the one spelling the box and the link both hold", () => {
    const der = decodeBase64(LEAF.replace(/-----[A-Z ]+-----/g, ""))!;

    expect(sniffDer(der)).toBe("CERTIFICATE");
    expect(fileText(der)).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
    expect(fileText(new TextEncoder().encode(SSH_ED25519))).toBe(SSH_ED25519);
    expect(fileText(new Uint8Array([1, 2, 3]))).toBe("");
  });

  it("keeps a private key out of the share link and leaves everything else in it", () => {
    const shared = publicText(`${LEAF}\n${LEAF_KEY}\n${SSH_PRIVATE}`);

    expect(shared).toContain("BEGIN CERTIFICATE");
    expect(shared).not.toContain("PRIVATE KEY");
    expect(publicText(LEAF_KEY)).toBe("");
    expect(publicText(LEAF_KEY.replace(/-----[A-Z ]+-----/g, ""))).toBe("");
  });
});

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

const SLOW = 60000;

const SETTINGS: Settings = {
  kind: "self-signed",
  algorithm: "ecdsa",
  variant: "P-256",
  commonName: "made.test",
  organisation: "",
  country: "",
  altNames: "",
  days: 90,
  passphrase: "",
  issuerCertificate: "",
  issuerKey: "",
};

describe("issuing a certificate", () => {
  it("writes a self-signed certificate OpenSSL reads and verifies", async () => {
    const made = await issue({
      ...SETTINGS,
      organisation: "utils.plus",
      country: "au",
      altNames: "made.test, 10.0.0.1",
    });
    const openssl = new X509Certificate(made.certificate);

    expect(openssl.subject).toContain("CN=made.test");
    expect(openssl.subject).toBe(openssl.issuer);
    expect(openssl.verify(openssl.publicKey)).toBe(true);
    expect(openssl.subjectAltName).toBe("DNS:made.test, IP Address:10.0.0.1");
    expect(openssl.ca).toBe(false);
  });

  it("tells host names and addresses apart in the list it is given", async () => {
    const made = await issue({ ...SETTINGS, altNames: "example.test, *.example.test 127.0.0.1 ::1" });
    const openssl = new X509Certificate(made.certificate);

    expect(openssl.subjectAltName).toBe(
      "DNS:example.test, DNS:*.example.test, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1",
    );
    expect(openssl.checkHost("www.example.test")).toBe("*.example.test");
    expect(openssl.checkIP("127.0.0.1")).toBe("127.0.0.1");
  });

  it("runs from now to the day it is given, and is a different certificate every time", async () => {
    const [first, second] = await Promise.all([issue({ ...SETTINGS, days: 30 }), issue({ ...SETTINGS, days: 30 })]);
    const openssl = new X509Certificate(first.certificate);

    expect((Date.parse(openssl.validTo) - Date.parse(openssl.validFrom)) / 86400000).toBeCloseTo(30, 3);
    expect(Date.parse(openssl.validFrom)).toBeLessThanOrEqual(Date.now());
    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(openssl.serialNumber).not.toBe(new X509Certificate(second.certificate).serialNumber);
  });

  it("writes the subject in the order a certificate is read in", async () => {
    const made = await issue({ ...SETTINGS, organisation: "utils.plus", country: "au" });
    const [item] = await readItems(made.certificate);

    expect(fact(item, "Subject")).toBe("C=AU, O=utils.plus, CN=made.test");
    expect(fact(item, "Public key")).toBe("ECDSA P-256");
    expect(fact(item, "Signature")).toBe("SHA-256 with ECDSA");
  });

  it.each([
    ["ecdsa", "P-384"],
    ["ed25519", ""],
    ["rsa", "2048"],
  ])("signs with %s and is verified by OpenSSL", async (algorithm, variant) => {
    const made = await issue({ ...SETTINGS, algorithm, variant });
    const openssl = new X509Certificate(made.certificate);

    expect(openssl.verify(openssl.publicKey)).toBe(true);
  }, SLOW);

  it("writes a root that may sign and a leaf that may not", async () => {
    const root = await issue({ ...SETTINGS, kind: "root", commonName: "Root CA" });
    const leaf = await issue(SETTINGS);
    const [asRoot] = await readItems(root.certificate);
    const [asLeaf] = await readItems(leaf.certificate);

    expect(new X509Certificate(root.certificate).ca).toBe(true);
    expect(extension(asRoot, "Basic constraints")).toBe("Certificate authority");
    expect(extension(asRoot, "Key usage")).toBe("Digital signature, Certificate signing, CRL signing");
    expect(extension(asRoot, "Subject alternative name")).toBe("");
    expect(extension(asRoot, "Extended key usage")).toBe("");
    expect(extension(asLeaf, "Basic constraints")).toBe("End entity");
    expect(extension(asLeaf, "Extended key usage")).toBe("TLS server, TLS client");
  });

  it("signs a certificate with a root that was pasted in, and OpenSSL agrees it did", async () => {
    const root = await issue({ ...SETTINGS, kind: "root", commonName: "Root CA", days: 3650 });
    const leaf = await issue({
      ...SETTINGS,
      kind: "issued",
      issuerCertificate: root.certificate,
      issuerKey: root.privateKey,
    });

    const authority = new X509Certificate(root.certificate);
    const issued = new X509Certificate(leaf.certificate);
    expect(issued.issuer).toBe(authority.subject);
    expect(issued.checkIssued(authority)).toBe(true);
    expect(issued.verify(authority.publicKey)).toBe(true);
  });

  it("puts the leaf and everything above it in one chain, in the order a server sends them", async () => {
    const root = await issue({ ...SETTINGS, kind: "root", commonName: "Root CA", days: 3650 });
    const leaf = await issue({
      ...SETTINGS,
      kind: "issued",
      issuerCertificate: root.certificate,
      issuerKey: root.privateKey,
    });
    const { chains } = arrange(await readItems(leaf.chain));

    expect(chains[0].rows.map((row) => row.role)).toEqual(["Leaf", "Root"]);
    expect(chains[0].ordered).toBe(true);
    expect(chains[0].complete).toBe(true);
  });

  it("writes an intermediate that may issue leaves and nothing below them", async () => {
    const root = await issue({ ...SETTINGS, kind: "root", commonName: "Root CA", days: 3650 });
    const middle = await issue({
      ...SETTINGS,
      kind: "intermediate",
      commonName: "Issuing CA",
      issuerCertificate: root.certificate,
      issuerKey: root.privateKey,
    });
    const [item] = await readItems(middle.certificate);

    expect(extension(item, "Basic constraints")).toBe("Certificate authority, path length 0");
    expect(new X509Certificate(middle.certificate).verify(new X509Certificate(root.certificate).publicKey)).toBe(true);
  });

  it("points back at the issuer's own key identifier", async () => {
    const root = await issue({ ...SETTINGS, kind: "root", commonName: "Root CA", days: 3650 });
    const leaf = await issue({
      ...SETTINGS,
      kind: "issued",
      issuerCertificate: root.certificate,
      issuerKey: root.privateKey,
    });
    const [asRoot] = await readItems(root.certificate);
    const [asLeaf] = await readItems(leaf.certificate);

    expect(asLeaf.aki).toBe(asRoot.ski);
    expect(asRoot.aki).toBe(asRoot.ski);
  });

  it("makes a key the certificate it came with is matched to", async () => {
    const made = await issue(SETTINGS);
    const { matches, items } = arrange(await readItems(`${made.certificate}${made.privateKey}`));

    expect(matches[items[0].id]?.found).toBe(true);
    expect(matches[items[1].id]?.text).toBe("Matches made.test");
  });

  it("locks the private key with a passphrase both OpenSSL and this page read", async () => {
    const made = await issue({ ...SETTINGS, passphrase: "hunter2" });
    const [, key] = await readItems(`${made.certificate}${made.privateKey}`);

    expect(made.privateKey).toMatch(/^-----BEGIN ENCRYPTED PRIVATE KEY-----/);
    expect(key.heading).toBe("Encrypted private key");
    expect(key.facts.find((row) => row.label === "Encryption")?.value).toBe("PBES2 with AES-256-CBC");
    expect(() => createPrivateKey({ key: made.privateKey, passphrase: "hunter2" })).not.toThrow();
    expect(() => createPrivateKey({ key: made.privateKey, passphrase: "wrong" })).toThrow();
  });

  it("refuses to sign with an authority that is not one, or with a key that is not its", async () => {
    const leaf = await issue(SETTINGS);
    const root = await issue({ ...SETTINGS, kind: "root", commonName: "Root CA" });
    const signed = { ...SETTINGS, kind: "issued" };

    await expect(issue({ ...signed, issuerCertificate: leaf.certificate, issuerKey: leaf.privateKey }))
      .rejects.toThrow(/not a certificate authority/);
    await expect(issue({ ...signed, issuerCertificate: root.certificate, issuerKey: leaf.privateKey }))
      .rejects.toThrow(/does not go with this certificate/);
    await expect(issue({ ...signed, issuerCertificate: "", issuerKey: "" }))
      .rejects.toThrow(/Paste the certificate/);
  });

  it("writes a far-off expiry as a generalized time, which is the only way to say a year in full", async () => {
    const made = await issue({ ...SETTINGS, days: 36525 });
    const [item] = await readItems(made.certificate);

    expect(item.notAfter!.getUTCFullYear()).toBeGreaterThan(2100);
    expect(new X509Certificate(made.certificate).validTo).toContain(String(item.notAfter!.getUTCFullYear()));
  });
});
