import { x25519 } from "@noble/curves/ed25519.js";
import { identityToRecipient } from "age-encryption";
import bcrypt from "bcrypt-pbkdf";
import { execFileSync, spawnSync } from "node:child_process";
import { createDecipheriv, createHash, createPrivateKey, createPublicKey, type KeyObject, sign, verify } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ageRecipientsFile, generateAgeIdentity, identityProblem } from "../src/utilities/keygen/age";
import { formatSecret } from "../src/utilities/keygen/encoding";
import { generateJwkSet } from "../src/utilities/keygen/jwk";
import { generateSshKey } from "../src/utilities/keygen/keys";
import { generateNaclKeypair } from "../src/utilities/keygen/nacl";
import type { Jwk } from "../src/utilities/keygen/types";
import { generateWireguardConfigs } from "../src/utilities/keygen/wireguard";

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
    const file = readPrivateKey(key.privateKey);
    expect(file.comment).toBe("me@example.com");
    expect(file.blob.toString("base64")).toBe(key.publicKey.split(" ")[1]);
    expect(sshFingerprint(key.publicKey)).toBe(key.fingerprint);
    expectOnePair(file.privateKey, file.blob);
  });

  it("leaves the comment off the public line when there is none", { timeout: SLOW }, async () => {
    const key = await generateSshKey(SETTINGS);
    expect(key.publicKey).toMatch(/^ssh-ed25519 [A-Za-z0-9+/=]+$/);
  });

  it.each([
    ["ecdsa", "nistp256", "ecdsa-sha2-nistp256", { namedCurve: "prime256v1" }],
    ["ecdsa", "nistp384", "ecdsa-sha2-nistp384", { namedCurve: "secp384r1" }],
    ["ecdsa", "nistp521", "ecdsa-sha2-nistp521", { namedCurve: "secp521r1" }],
    ["rsa", "2048", "ssh-rsa", { modulusLength: 2048, publicExponent: 65537n }],
  ])("builds a %s key on %s", { timeout: SLOW }, async (algorithm, variant, type, details) => {
    const key = await generateSshKey({ ...SETTINGS, algorithm, variant });

    expect(key.publicKey.startsWith(`${type} `)).toBe(true);
    expect(sshFingerprint(key.publicKey)).toBe(key.fingerprint);
    const file = readPrivateKey(key.privateKey);
    expect(file.blob.toString("base64")).toBe(key.publicKey.split(" ")[1]);
    expect(publicKeyOf(file.blob).asymmetricKeyDetails).toMatchObject(details);
    expectOnePair(file.privateKey, file.blob);
  });

  it("pads the private section to a whole block with a counting run", { timeout: SLOW }, async () => {
    const file = readPrivateKey((await generateSshKey({ ...SETTINGS, comment: "odd" })).privateKey);
    expect([file.cipher, file.kdf]).toEqual(["none", "none"]);
    expect(file.padding).toEqual(Array.from(file.padding, (_, index) => index + 1));
    expect(file.sectionLength % 8).toBe(0);
  });

  it("encrypts the private half once a passphrase is given", { timeout: SLOW }, async () => {
    const key = await generateSshKey({ ...SETTINGS, algorithm: "ecdsa", variant: "nistp256", passphrase: "hunter2" });

    const checks = sectionOf(key.privateKey, "wrong").checks;
    expect(checks[0]).not.toBe(checks[1]);
    const file = readPrivateKey(key.privateKey, "hunter2");
    expect([file.cipher, file.kdf, file.rounds]).toEqual(["aes256-ctr", "bcrypt", 16]);
    expect(file.sectionLength % 16).toBe(0);
    expectOnePair(file.privateKey, file.blob);
  });

  it("gives a different key every time it is asked", { timeout: SLOW }, async () => {
    const [first, second] = await Promise.all([generateSshKey(SETTINGS), generateSshKey(SETTINGS)]);
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});

describe.skipIf(spawnSync("ssh-keygen", ["-?"]).error !== undefined)("SSH keys read by ssh-keygen", () => {
  const directory = mkdtempSync(join(tmpdir(), "keygen-"));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it.each([
    ["ed25519", "", ""],
    ["ecdsa", "nistp384", ""],
    ["rsa", "3072", ""],
    ["ed25519", "", "hunter2"],
    ["rsa", "2048", "hunter2"],
  ])("opens a %s key %s with passphrase %j", { timeout: SLOW }, async (algorithm, variant, passphrase) => {
    const key = await generateSshKey({ ...SETTINGS, algorithm, variant, comment: "me@example.com", passphrase });
    const path = join(directory, `${algorithm}${variant}${passphrase}`);
    writeFileSync(path, key.privateKey, { mode: 0o600 });
    writeFileSync(`${path}.pub`, `${key.publicKey}\n`);

    const derived = execFileSync("ssh-keygen", ["-y", "-P", passphrase, "-f", path], { input: "" }).toString();
    expect(derived.split(" ").slice(0, 2)).toEqual(key.publicKey.split(" ").slice(0, 2));
    const listed = execFileSync("ssh-keygen", ["-l", "-E", "sha256", "-f", `${path}.pub`]).toString();
    expect(listed.split(" ")[1]).toBe(key.fingerprint);
    if (passphrase) {
      expect(spawnSync("ssh-keygen", ["-y", "-P", "wrong", "-f", path], { input: "" }).status).not.toBe(0);
    }
  });
});

describe("NaCl box keys", () => {
  it("writes both halves of one X25519 pair in the encoding it was asked for", async () => {
    const { secretKey, publicKey } = await generateNaclKeypair("hex");

    expect(secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(publicKey).toBe(formatSecret(x25519.getPublicKey(fromHex(secretKey)), "hex"));
  });

  it("says the same pair the other way when the encoding is the other one", async () => {
    const { secretKey, publicKey } = await generateNaclKeypair("base64");

    expect(secretKey).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(publicKey).toBe(formatSecret(x25519.getPublicKey(decodeBase64(secretKey)), "base64"));
  });

  it("draws a fresh pair every time it is asked", async () => {
    const [first, second] = await Promise.all([generateNaclKeypair("hex"), generateNaclKeypair("hex")]);
    expect(first.secretKey).not.toBe(second.secretKey);
    expect(first.publicKey).not.toBe(second.publicKey);
  });

  const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
  const decodeBase64 = (text: string) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
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

describe("age identities", () => {
  it.each([
    [false, /^AGE-SECRET-KEY-1[0-9A-Z]+$/, /^age1[0-9a-z]+$/],
    [true, /^AGE-SECRET-KEY-PQ-1[0-9A-Z]+$/, /^age1pq1[0-9a-z]+$/],
  ])("writes the file age-keygen writes with -pq %s, comment lines and all", async (pq, secret, published) => {
    const { file, recipient } = await generateAgeIdentity(pq);
    const [created, publishedLine, identity, nothing] = file.split("\n");

    expect(created).toMatch(/^# created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(publishedLine).toBe(`# public key: ${recipient}`);
    expect(identity).toMatch(secret);
    expect(recipient).toMatch(published);
    expect(nothing).toBe("");
    expect(await identityToRecipient(identity)).toBe(recipient);
  });

  it("hands out a recipient two kilobytes long for the post-quantum kind, and 62 characters for the curve", async () => {
    expect((await generateAgeIdentity(false)).recipient).toHaveLength(62);
    expect((await generateAgeIdentity(true)).recipient.length).toBeGreaterThan(1900);
  });

  it("gives a different identity every time it is asked", async () => {
    const [first, second] = await Promise.all([generateAgeIdentity(false), generateAgeIdentity(false)]);
    expect(first.recipient).not.toBe(second.recipient);
  });
});

describe("age recipients files", () => {
  it("answers a whole identity file with the recipient it names, which is what age-keygen -y writes", async () => {
    const { file, recipient } = await generateAgeIdentity(false);
    expect(await ageRecipientsFile(file)).toBe(`${recipient}\n`);
  });

  it("converts every identity in a file, in the order they were written", async () => {
    const identities = await Promise.all([generateAgeIdentity(false), generateAgeIdentity(true)]);
    const file = identities.map(({ file }) => file).join("");
    expect(await ageRecipientsFile(file)).toBe(`${identities.map(({ recipient }) => recipient).join("\n")}\n`);
  });

  it("takes a bare identity, that being what somebody pastes as often as the file around it", async () => {
    const { file, recipient } = await generateAgeIdentity(true);
    expect(await ageRecipientsFile(file.split("\n")[2])).toBe(`${recipient}\n`);
  });

  it("has nothing to convert in a file that is all comments", async () => {
    await expect(ageRecipientsFile("# created: 2026-01-01T00:00:00Z\n")).rejects.toThrow("no identity");
  });

  it("says which line was refused, cut short where a post-quantum key would run on", async () => {
    const { file } = await generateAgeIdentity(false);
    const broken = `${file}AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ\n`;
    await expect(ageRecipientsFile(broken)).rejects.toThrow("That is not an age identity: AGE-SECRET-KEY-1QQQQQQQQ…");
  });

  it("holds a line to the shape of an identity as it is typed, and skips the comments around it", () => {
    expect(identityProblem("")).toBe("");
    expect(identityProblem("# public key: age1abc\n\nAGE-SECRET-KEY-1ABC")).toBe("");
    expect(identityProblem("age1abc")).toBe("That is not an age identity: age1abc");
    expect(identityProblem("age-secret-key-1abc")).toBe("That is not an age identity: age-secret-key-1abc");
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
  const base64UrlBytes = (value: string) => Buffer.from(value, "base64url");
  const omit = (jwk: Jwk, member: string) =>
    Object.fromEntries(Object.entries(jwk).filter(([name]) => name !== member));
  const sha256Thumbprint = ({ crv, kty, x }: Jwk) =>
    createHash("sha256").update(JSON.stringify({ crv, kty, x })).digest("base64url");
});

const SSH_CURVES: Record<string, string> = { nistp256: "P-256", nistp384: "P-384", nistp521: "P-521" };

function wire(bytes: Buffer) {
  let at = 0;
  const uint32 = () => bytes.readUInt32BE((at += 4) - 4);
  const field = () => {
    const length = uint32();
    return bytes.subarray(at, at += length);
  };
  return { uint32, field, text: () => field().toString(), rest: () => [...bytes.subarray(at)] };
}

function sectionOf(pem: string, passphrase = "") {
  const bytes = Buffer.from(pem.replace(/-----[A-Z ]+-----|\s/g, ""), "base64");
  expect(bytes.subarray(0, 15).toString("latin1")).toBe("openssh-key-v1\0");
  const outer = wire(bytes.subarray(15));
  const cipher = outer.text();
  const kdf = outer.text();
  const options = wire(outer.field());
  expect(outer.uint32()).toBe(1);
  const blob = outer.field();
  let section = outer.field();
  let rounds = 0;
  if (kdf === "bcrypt") {
    const salt = options.field();
    rounds = options.uint32();
    const password = Buffer.from(passphrase);
    const derived = Buffer.alloc(48);
    bcrypt.pbkdf(password, password.length, salt, salt.length, derived, derived.length, rounds);
    section = createDecipheriv("aes-256-ctr", derived.subarray(0, 32), derived.subarray(32)).update(section);
  }
  const inner = wire(section);
  return { cipher, kdf, rounds, blob, sectionLength: section.length, checks: [inner.uint32(), inner.uint32()], inner };
}

function readPrivateKey(pem: string, passphrase = "") {
  const { inner, checks, ...file } = sectionOf(pem, passphrase);
  expect(checks[0]).toBe(checks[1]);
  const privateKey = createPrivateKey({ key: secretJwk(inner), format: "jwk" });
  return { ...file, privateKey, comment: inner.text(), padding: inner.rest() };
}

function secretJwk(inner: ReturnType<typeof wire>): Record<string, string> {
  const type = inner.text();
  if (type === "ssh-ed25519") {
    const point = inner.field();
    const secret = inner.field();
    expect(secret.subarray(32)).toEqual(point);
    return {
      kty: "OKP",
      crv: "Ed25519",
      x: point.toString("base64url"),
      d: secret.subarray(0, 32).toString("base64url"),
    };
  }
  if (type === "ssh-rsa") {
    const [n, e, d, qi, p, q] = Array.from({ length: 6 }, () => unsigned(inner.field()));
    const [dp, dq] = [p, q].map((prime) => fromBigInt(toBigInt(d) % (toBigInt(prime) - 1n)));
    const members = { n, e, d, p, q, dp, dq, qi };
    return {
      kty: "RSA",
      ...Object.fromEntries(Object.entries(members).map(([name, value]) => [name, value.toString("base64url")])),
    };
  }
  const point = ecPoint(inner.text(), inner.field());
  const d = unsigned(inner.field());
  const size = Buffer.from(point.x, "base64url").length;
  return { ...point, d: Buffer.concat([Buffer.alloc(size - d.length), d]).toString("base64url") };
}

function publicKeyOf(blob: Buffer): KeyObject {
  const fields = wire(blob);
  const type = fields.text();
  if (type === "ssh-ed25519") {
    return createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: fields.field().toString("base64url") },
      format: "jwk",
    });
  }
  if (type === "ssh-rsa") {
    const [e, n] = [unsigned(fields.field()), unsigned(fields.field())];
    return createPublicKey({
      key: { kty: "RSA", e: e.toString("base64url"), n: n.toString("base64url") },
      format: "jwk",
    });
  }
  return createPublicKey({ key: ecPoint(fields.text(), fields.field()), format: "jwk" });
}

function ecPoint(curve: string, point: Buffer): Record<string, string> {
  expect(point[0]).toBe(4);
  const size = (point.length - 1) / 2;
  const [x, y] = [point.subarray(1, 1 + size), point.subarray(1 + size)].map((half) => half.toString("base64url"));
  return { kty: "EC", crv: SSH_CURVES[curve], x, y };
}

function expectOnePair(privateKey: KeyObject, blob: Buffer) {
  const data = Buffer.from("utils.plus");
  const hash = privateKey.asymmetricKeyType === "ed25519" ? null : "sha256";
  expect(verify(hash, data, publicKeyOf(blob), sign(hash, data, privateKey))).toBe(true);
}

function sshFingerprint(line: string): string {
  const digest = createHash("sha256").update(Buffer.from(line.split(" ")[1], "base64")).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}

const unsigned = (bytes: Buffer) => (bytes[0] === 0 ? bytes.subarray(1) : bytes);
const toBigInt = (bytes: Buffer) => BigInt(`0x${bytes.toString("hex") || "0"}`);
const fromBigInt = (value: bigint) =>
  Buffer.from(value.toString(16).padStart(Math.ceil(value.toString(16).length / 2) * 2, "0"), "hex");
