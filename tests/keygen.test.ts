import { x25519 } from "@noble/curves/ed25519.js";
import { createRequire } from "node:module";
import sshpk from "sshpk";
import { describe, expect, it } from "vitest";
import { generateCertificate } from "../src/utilities/keygen/certificate";
import { formatSecret } from "../src/utilities/keygen/encoding";
import { generateJwkSet } from "../src/utilities/keygen/jwk";
import { generateSshKey } from "../src/utilities/keygen/keys";
import type { Jwk } from "../src/utilities/keygen/types";
import { isHostOrAddress } from "../src/utilities/keygen/validate";
import { generateWireguardConfigs } from "../src/utilities/keygen/wireguard";

const { createHash, createPrivateKey, createPublicKey, X509Certificate } = createRequire(import.meta.url)(
  "node:crypto",
) as typeof import("node:crypto");

const SETTINGS = { algorithm: "ed25519", variant: "", comment: "", name: "", email: "", passphrase: "" };

const SLOW = 60000;

describe("secret encodings", () => {
  const bytes = new TextEncoder().encode("foobar");

  it.each([
    ["hex", "666f6f626172"],
    ["hex-upper", "666F6F626172"],
    ["base64", "Zm9vYmFy"],
    ["base64url", "Zm9vYmFy"],
    ["base32", "MZXW6YTBOI======"],
    ["decimal", "112628796121458"],
  ])("spells the same bytes as %s", (format, expected) => {
    expect(formatSecret(bytes, format)).toBe(expected);
  });

  it("pads base32 to a whole group for every remainder", () => {
    const text = (length: number) => formatSecret(new TextEncoder().encode("foobar".slice(0, length)), "base32");
    expect([1, 2, 3, 4, 5, 6].map(text)).toEqual([
      "MY======",
      "MZXQ====",
      "MZXW6===",
      "MZXW6YQ=",
      "MZXW6YTB",
      "MZXW6YTBOI======",
    ]);
  });

  it("drops base64 padding only for the URL-safe spelling", () => {
    const odd = new Uint8Array([0xfb, 0xef]);
    expect(formatSecret(odd, "base64")).toBe("++8=");
    expect(formatSecret(odd, "base64url")).toBe("--8");
  });

  it("falls back to hex rather than hand back nothing for a format it does not know", () => {
    expect(formatSecret(bytes, "morse")).toBe("666f6f626172");
  });
});

describe("SSH keys", () => {
  it("writes an OpenSSH pair whose halves agree", { timeout: SLOW }, async () => {
    const key = await generateSshKey({ ...SETTINGS, comment: "me@example.com" });

    expect(key.privateKey).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----\n/);
    expect(key.publicKey).toMatch(/^ssh-ed25519 \S+ me@example\.com$/);
    expect(sshpk.parseKey(key.publicKey, "ssh").fingerprint("sha256").toString()).toBe(key.fingerprint);
    expect(sshpk.parsePrivateKey(key.privateKey, "ssh-private").fingerprint("sha256").toString()).toBe(key.fingerprint);
  });

  it("leaves the comment off the public line when there is none", { timeout: SLOW }, async () => {
    const key = await generateSshKey(SETTINGS);
    expect(key.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+$/);
  });

  it.each([
    ["ecdsa", "nistp256", "ecdsa-sha2-nistp256", 256],
    ["ecdsa", "nistp521", "ecdsa-sha2-nistp521", 521],
    ["rsa", "2048", "ssh-rsa", 2048],
  ])("builds a %s key on %s", { timeout: SLOW }, async (algorithm, variant, type, size) => {
    const key = await generateSshKey({ ...SETTINGS, algorithm, variant });

    expect(key.publicKey.startsWith(`${type} `)).toBe(true);
    const parsed = sshpk.parseKey(key.publicKey, "ssh");
    expect(parsed.size).toBe(size);
    expect(parsed.fingerprint("sha256").toString()).toBe(key.fingerprint);
  });

  it("encrypts the private half once a passphrase is given", { timeout: SLOW }, async () => {
    const key = await generateSshKey({ ...SETTINGS, passphrase: "hunter2" });

    expect(() => sshpk.parsePrivateKey(key.privateKey, "ssh-private")).toThrow(sshpk.KeyEncryptedError);
    const opened = sshpk.parsePrivateKey(key.privateKey, "ssh-private", { passphrase: "hunter2" });
    expect(opened.fingerprint("sha256").toString()).toBe(key.fingerprint);
  });

  it("gives a different key every time it is asked", { timeout: SLOW }, async () => {
    const [first, second] = await Promise.all([generateSshKey(SETTINGS), generateSshKey(SETTINGS)]);
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});

describe("WireGuard configurations", () => {
  const SERVER_KEY = "AAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAUE=";
  const SERVER_PUBLIC = "pOCSkrZRwni5dyxWn1+puxPZBrRqtoyd+dwrRAn4ogk=";

  it("names each side by the public half of the key the other one keeps", async () => {
    const { server, client } = await generateWireguardConfigs("");

    expect(server).toMatch(/^\[Interface\]\nPrivateKey = \S+\n\n\[Peer\]\nPublicKey = \S+\n$/);
    expect(field(client, "PublicKey")).toBe(publicOf(field(server, "PrivateKey")));
    expect(field(server, "PublicKey")).toBe(publicOf(field(client, "PrivateKey")));
  });

  it("keeps the server key it is handed, whitespace and all", async () => {
    const { server, client } = await generateWireguardConfigs(`  ${SERVER_KEY}\n`);

    expect(field(server, "PrivateKey")).toBe(SERVER_KEY);
    expect(field(client, "PublicKey")).toBe(SERVER_PUBLIC);
  });

  it("mints a server of its own when it is handed none", async () => {
    const [first, second] = await Promise.all([generateWireguardConfigs(""), generateWireguardConfigs("")]);
    expect(field(first.server, "PrivateKey")).not.toBe(field(second.server, "PrivateKey"));
  });

  it("gives the client a key of its own even when the server's is fixed", async () => {
    const [first, second] = await Promise.all([
      generateWireguardConfigs(SERVER_KEY),
      generateWireguardConfigs(SERVER_KEY),
    ]);
    expect(field(first.client, "PrivateKey")).not.toBe(field(second.client, "PrivateKey"));
  });

  it("clamps what it generates the way wg genkey does", async () => {
    const { server, client } = await generateWireguardConfigs("");

    for (const config of [server, client]) {
      const key = decode(field(config, "PrivateKey"));
      expect(key).toHaveLength(32);
      expect(key[0] & 7).toBe(0);
      expect(key[31] & 192).toBe(64);
    }
  });

  const field = (config: string, name: string) => config.match(new RegExp(`^${name} = (.+)$`, "m"))?.[1] ?? "";
  const decode = (base64: string) => Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const publicOf = (base64: string) => btoa(String.fromCharCode(...x25519.getPublicKey(decode(base64))));
});

describe("TLS certificates", () => {
  const CERTIFICATE = {
    algorithm: "rsa",
    variant: "2048",
    commonName: "localhost",
    altNames: "",
    days: 365,
    passphrase: "",
  };

  it("writes a certificate signed for itself, by the key that comes with it", { timeout: SLOW }, async () => {
    const result = await generateCertificate(CERTIFICATE);

    expect(result.privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    expect(result.certificate).toMatch(/^-----BEGIN CERTIFICATE-----\n/);

    const certificate = new X509Certificate(result.certificate);
    expect(certificate.subject).toBe("CN=localhost");
    expect(certificate.issuer).toBe(certificate.subject);
    expect(certificate.verify(certificate.publicKey)).toBe(true);
    expect(certificate.checkPrivateKey(createPrivateKey(result.privateKey))).toBe(true);
    expect(certificate.fingerprint256).toBe(result.fingerprint);
  });

  it.each([
    ["ecdsa", "nistp256"],
    ["ecdsa", "nistp384"],
    ["ecdsa", "nistp521"],
    ["rsa", "3072"],
  ])(
    "signs a %s certificate on %s that verifies against its own key",
    { timeout: SLOW },
    async (algorithm, variant) => {
      const result = await generateCertificate({ ...CERTIFICATE, algorithm, variant });

      const certificate = new X509Certificate(result.certificate);
      expect(certificate.verify(certificate.publicKey)).toBe(true);
      expect(certificate.checkPrivateKey(createPrivateKey(result.privateKey))).toBe(true);
    },
  );

  it("is a server certificate and not an authority", { timeout: SLOW }, async () => {
    const certificate = new X509Certificate((await generateCertificate(CERTIFICATE)).certificate);

    expect(certificate.ca).toBe(false);
    expect(certificate.keyUsage).toEqual(["1.3.6.1.5.5.7.3.1", "1.3.6.1.5.5.7.3.2"]);
  });

  it("falls back to the common name when no alternative names are given", { timeout: SLOW }, async () => {
    const certificate = new X509Certificate((await generateCertificate(CERTIFICATE)).certificate);

    expect(certificate.subjectAltName).toBe("DNS:localhost");
    expect(certificate.checkHost("localhost")).toBe("localhost");
  });

  it("tells host names and addresses apart in the list it is given", { timeout: SLOW }, async () => {
    const result = await generateCertificate({
      ...CERTIFICATE,
      altNames: "example.test, *.example.test 127.0.0.1 ::1",
    });

    const certificate = new X509Certificate(result.certificate);
    expect(certificate.subjectAltName).toBe(
      "DNS:example.test, DNS:*.example.test, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1",
    );
    expect(certificate.checkHost("www.example.test")).toBe("*.example.test");
    expect(certificate.checkIP("127.0.0.1")).toBe("127.0.0.1");
  });

  it("runs from now to the day it is given", { timeout: SLOW }, async () => {
    const certificate = new X509Certificate((await generateCertificate({ ...CERTIFICATE, days: 30 })).certificate);

    const days = (Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)) / 86400000;
    expect(days).toBeCloseTo(30, 3);
    expect(Date.parse(certificate.validFrom)).toBeLessThanOrEqual(Date.now());
  });

  it("encrypts the private half once a passphrase is given", { timeout: SLOW }, async () => {
    const result = await generateCertificate({ ...CERTIFICATE, passphrase: "hunter2" });

    expect(result.privateKey).toMatch(/^-----BEGIN ENCRYPTED PRIVATE KEY-----\n/);
    expect(() => createPrivateKey(result.privateKey)).toThrow();
    const opened = createPrivateKey({ key: result.privateKey, passphrase: "hunter2" });
    expect(new X509Certificate(result.certificate).checkPrivateKey(opened)).toBe(true);
  });

  it("gives a different certificate every time it is asked", { timeout: SLOW }, async () => {
    const [first, second] = await Promise.all([generateCertificate(CERTIFICATE), generateCertificate(CERTIFICATE)]);

    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(new X509Certificate(first.certificate).serialNumber)
      .not.toBe(new X509Certificate(second.certificate).serialNumber);
  });
});

describe("JSON Web Keys", () => {
  const JWK = { algorithm: "EdDSA", variant: "", keyId: "none", count: 1 };

  it("writes the two halves of one key, with the private members on the private half alone", async () => {
    const { privateKeys, publicKeys } = await generateJwkSet(JWK);

    expect(privateKeys).toHaveLength(1);
    expect(publicKeys).toHaveLength(1);
    expect(privateKeys[0]).toMatchObject({ kty: "OKP", use: "sig", alg: "EdDSA", crv: "Ed25519" });
    expect(publicKeys[0]).toEqual(omit(privateKeys[0], "d"));
    expect(privateKeys[0].d).toBeTruthy();
  });

  it("writes what a JWKS is read for in front of the key material", async () => {
    const [key] = (await generateJwkSet({ ...JWK, keyId: "uuid" })).publicKeys;
    expect(Object.keys(key)).toEqual(["kty", "kid", "use", "alg", "crv", "x"]);
  });

  it.each([
    ["ES256", "", { kty: "EC", crv: "P-256" }],
    ["ES384", "", { kty: "EC", crv: "P-384" }],
    ["ES512", "", { kty: "EC", crv: "P-521" }],
    ["EdDSA", "", { kty: "OKP", crv: "Ed25519" }],
    ["RS256", "2048", { kty: "RSA" }],
    ["PS384", "2048", { kty: "RSA" }],
    ["HS512", "", { kty: "oct" }],
  ])("writes the key %s names", { timeout: SLOW }, async (algorithm, variant, expected) => {
    const [key] = (await generateJwkSet({ ...JWK, algorithm, variant })).privateKeys;
    expect(key).toMatchObject({ ...expected, alg: algorithm });
  });

  it.each([
    ["ECDH-ES", "P-256", { kty: "EC", crv: "P-256" }],
    ["ECDH-ES+A128KW", "P-521", { kty: "EC", crv: "P-521" }],
    ["ECDH-ES+A256KW", "X25519", { kty: "OKP", crv: "X25519" }],
    ["RSA-OAEP-256", "2048", { kty: "RSA" }],
    ["RSA-OAEP", "2048", { kty: "RSA" }],
    ["A128KW", "", { kty: "oct" }],
    ["A256GCMKW", "", { kty: "oct" }],
  ])("writes %s as a key for encrypting", { timeout: SLOW }, async (algorithm, variant, expected) => {
    const [key] = (await generateJwkSet({ ...JWK, algorithm, variant })).privateKeys;
    expect(key).toMatchObject({ ...expected, use: "enc", alg: algorithm });
  });

  it("gives an AES key the width of the cipher it wraps with", async () => {
    for (const [algorithm, bytes] of [["A128KW", 16], ["A192KW", 24], ["A256GCMKW", 32]] as const) {
      const set = await generateJwkSet({ ...JWK, algorithm });
      expect(base64UrlBytes(set.privateKeys[0].k)).toHaveLength(bytes);
      expect(set.publicKeys).toEqual([]);
    }
  });

  it("takes the modulus the second field asks for", { timeout: SLOW }, async () => {
    const [key] = (await generateJwkSet({ ...JWK, algorithm: "RS256", variant: "3072" })).publicKeys;
    expect(base64UrlBytes(key.n).length * 8).toBe(3072);
  });

  it("gives an HMAC key the bytes its hash puts out, and no half to hand around", async () => {
    for (const [algorithm, bytes] of [["HS256", 32], ["HS384", 48], ["HS512", 64]] as const) {
      const set = await generateJwkSet({ ...JWK, algorithm });
      expect(base64UrlBytes(set.privateKeys[0].k)).toHaveLength(bytes);
      expect(set.publicKeys).toEqual([]);
    }
  });

  const EVERY_PAIR = [
    ["EdDSA", ""],
    ["ES256", ""],
    ["RS256", "2048"],
    ["PS512", "2048"],
    ["ECDH-ES", "P-384"],
    ["ECDH-ES+A256KW", "X25519"],
    ["RSA-OAEP-256", "2048"],
  ];

  it("writes a key OpenSSL reads back as the pair it came from", { timeout: SLOW }, async () => {
    for (const [algorithm, variant] of EVERY_PAIR) {
      const { privateKeys, publicKeys } = await generateJwkSet({ ...JWK, algorithm, variant });
      const privateKey = createPrivateKey({ key: privateKeys[0] as never, format: "jwk" });
      const publicKey = createPublicKey({ key: publicKeys[0] as never, format: "jwk" });
      expect(createPublicKey(privateKey).export({ type: "spki", format: "pem" }))
        .toEqual(publicKey.export({ type: "spki", format: "pem" }));
    }
  });

  it("leaves the kid off entirely rather than write an empty one", async () => {
    const [key] = (await generateJwkSet(JWK)).privateKeys;
    expect("kid" in key).toBe(false);
  });

  it("names each key with a UUID of its own", async () => {
    const kids = keyIds(await generateJwkSet({ ...JWK, keyId: "uuid", count: 4 }));

    expect(kids).toHaveLength(4);
    for (const kid of kids) {
      expect(kid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect(new Set(kids).size).toBe(4);
  });

  it("walks a timestamp on by a second for every key after the first", async () => {
    const kids = keyIds(await generateJwkSet({ ...JWK, keyId: "timestamp", count: 4 })).map(Number);

    expect(kids[0]).toBeCloseTo(Math.floor(Date.now() / 1000), -1);
    expect(kids).toEqual([kids[0], kids[0] + 1, kids[0] + 2, kids[0] + 3]);
  });

  it("walks an ISO date on by the same second, spelled out", async () => {
    const kids = keyIds(await generateJwkSet({ ...JWK, keyId: "iso", count: 3 }));

    for (const kid of kids) expect(kid).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(kids.map((kid) => Date.parse(kid) - Date.parse(kids[0]))).toEqual([0, 1000, 2000]);
  });

  it.each([["sha256", "sha256"], ["sha1", "sha1"]])(
    "names a key by its RFC 7638 %s thumbprint",
    async (keyId, hash) => {
      const { privateKeys, publicKeys } = await generateJwkSet({ ...JWK, keyId });
      const { crv, kty, x } = publicKeys[0];
      const expected = createHash(hash).update(JSON.stringify({ crv, kty, x })).digest("base64url");

      expect(publicKeys[0].kid).toBe(expected);
      expect(privateKeys[0].kid).toBe(expected);
    },
  );

  it("thumbprints an RSA key over its modulus and exponent", { timeout: SLOW }, async () => {
    const [key] = (await generateJwkSet({ ...JWK, algorithm: "RS256", variant: "2048", keyId: "sha256" })).publicKeys;
    const { e, kty, n } = key;
    expect(key.kid).toBe(createHash("sha256").update(JSON.stringify({ e, kty, n })).digest("base64url"));
  });

  it("builds a set of distinct keys, up to the eight it will go to", { timeout: SLOW }, async () => {
    const set = await generateJwkSet({ ...JWK, keyId: "sha256", count: 8 });

    expect(set.privateKeys).toHaveLength(8);
    expect(new Set(keyIds(set)).size).toBe(8);
    expect(new Set(set.privateKeys.map((key) => key.d)).size).toBe(8);
  });

  it("clamps a count from a shared link to something it can build", async () => {
    expect((await generateJwkSet({ ...JWK, count: 99 })).privateKeys).toHaveLength(8);
    expect((await generateJwkSet({ ...JWK, count: 0 })).privateKeys).toHaveLength(1);
  });

  it("names one key by its thumbprint and a set of them by nothing", async () => {
    const one = await generateJwkSet(JWK);
    expect(one.thumbprint).toBe(sha256Thumbprint(one.publicKeys[0]));
    expect((await generateJwkSet({ ...JWK, count: 2 })).thumbprint).toBe("");
  });

  const keyIds = (set: { privateKeys: Jwk[]; publicKeys: Jwk[] }) => set.publicKeys.map((key) => key.kid);
  const base64UrlBytes = (value: string) =>
    Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
  const omit = (jwk: Jwk, member: string) =>
    Object.fromEntries(Object.entries(jwk).filter(([name]) => name !== member));
  const sha256Thumbprint = ({ crv, kty, x }: Jwk) =>
    createHash("sha256").update(JSON.stringify({ crv, kty, x })).digest("base64url");
});

describe("certificate host names", () => {
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
