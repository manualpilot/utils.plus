// @vitest-environment node
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { parseFieldValue, writeFieldValue } from "../src/utilities/jwt/fields";
import { generateSigningKey, signToken, verifySignature } from "../src/utilities/jwt/sign";
import { readToken } from "../src/utilities/jwt/token";
import type { Field } from "../src/utilities/jwt/types";

const HS256_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const HS256_SECRET = "your-256-bit-secret";

function field(name: string, value: string): Field {
  return { id: name, name, value };
}

describe("reading a token", () => {
  it("takes the header and the claims apart", () => {
    const reading = readToken(HS256_TOKEN);
    expect(reading.error).toBeNull();
    expect(reading.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(reading.payload).toEqual({ sub: "1234567890", name: "John Doe", iat: 1516239022 });
    expect(reading.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("reads a token with whitespace around it", () => {
    expect(readToken(`\n  ${HS256_TOKEN}  \n`).header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("says nothing about an empty box", () => {
    expect(readToken("   ")).toEqual({ header: null, payload: null, signature: "", error: null });
  });

  it("counts the parts it was given", () => {
    expect(readToken("one.two").error).toBe("A JWT is three parts separated by dots; this has 2");
    expect(readToken("a.b.c.d").error).toBe("A JWT is three parts separated by dots; this has 4");
  });

  it("names a JWE rather than count its parts", () => {
    expect(readToken("a.b.c.d.e").error).toBe("That is an encrypted JWE; this page reads signed tokens");
  });

  it("says which half it could not read", () => {
    expect(readToken("!!!.eyJhIjoxfQ.sig").error).toBe("The header is not base64url");
    expect(readToken("eyJhIjoxfQ.!!!.sig").error).toBe("The payload is not base64url");
    expect(readToken("bm90IGpzb24.eyJhIjoxfQ.sig").error).toBe("The header is not JSON");
    expect(readToken("eyJhIjoxfQ.WzEsMl0.sig").error).toBe("The payload is not a JSON object");
  });

  it("keeps the header it could read when the payload is the broken half", () => {
    const reading = readToken("eyJhbGciOiJIUzI1NiJ9.WzEsMl0.sig");
    expect(reading.header).toEqual({ alg: "HS256" });
    expect(reading.payload).toBeNull();
  });

  it("reads a payload written in characters base64 has to spell out", () => {
    expect(readToken("eyJhIjoxfQ.eyJuYW1lIjoiw5xuw69jw7Zkw6kg4pyTIn0.sig").payload).toEqual({ name: "Ünïcödé ✓" });
  });
});

describe("a form field and the JSON it stands for", () => {
  it.each([
    ["3600", 3600],
    ["true", true],
    ["null", null],
    ["[\"a\",\"b\"]", ["a", "b"]],
    ["{\"a\":1}", { a: 1 }],
    ["John Doe", "John Doe"],
    ["1234567890", 1234567890],
    ["\"1234567890\"", "1234567890"],
    ["007", "007"],
    ["", ""],
  ])("reads %s", (text, value) => {
    expect(parseFieldValue(text)).toEqual(value);
  });

  it.each([
    [3600, "3600"],
    [true, "true"],
    [null, "null"],
    [["a", "b"], "[\"a\",\"b\"]"],
    ["John Doe", "John Doe"],
    ["1234567890", "\"1234567890\""],
    ["007", "007"],
    ["", ""],
  ])("writes %s back", (value, text) => {
    expect(writeFieldValue(value)).toBe(text);
  });

  it("round trips anything a claim can hold", () => {
    for (const value of [3600, "3600", true, "true", null, "null", "abc", ["a"], { a: 1 }, ""]) {
      expect(parseFieldValue(writeFieldValue(value))).toEqual(value);
    }
  });
});

describe("generating a key", () => {
  it("draws an HMAC secret of the size its hash puts out", async () => {
    const lengths = await Promise.all(["HS256", "HS384", "HS512"].map((alg) => generateSigningKey(alg)));
    expect(lengths.map((secret) => Math.floor(secret.length * 3 / 4))).toEqual([32, 48, 64]);
    expect(lengths[0]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("writes an asymmetric key as a PKCS#8 PEM", async () => {
    const key = await generateSigningKey("EdDSA");
    expect(key.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(key.trimEnd().endsWith("-----END PRIVATE KEY-----")).toBe(true);
  });

  it("draws a different secret every time", async () => {
    expect(await generateSigningKey("HS256")).not.toBe(await generateSigningKey("HS256"));
  });
});

describe("signing and checking", () => {
  const claims = [field("sub", "John Doe"), field("iat", "1516239022")];

  it.each(["EdDSA", "HS256", "HS512", "ES256", "RS256", "PS256"])("round trips %s", async (alg) => {
    const secret = await generateSigningKey(alg);
    const result = await signToken({ alg, headers: [field("typ", "JWT")], claims, secret });

    expect(result.keyError).toBeNull();
    expect(result.tokenError).toBeNull();
    expect(readToken(result.token).header).toEqual({ alg, typ: "JWT" });
    expect(readToken(result.token).payload).toEqual({ sub: "John Doe", iat: 1516239022 });
    await expect(verifySignature(result.token, secret, alg)).resolves.toBe(true);
  }, 30000);

  it("sends a claim as the JSON its box reads as, and as text when it reads as none", async () => {
    const secret = await generateSigningKey("HS256");
    const written = [field("sub", "1234567890"), field("quoted", "\"1234567890\""), field("roles", "[\"a\",\"b\"]")];
    const { token } = await signToken({ alg: "HS256", headers: [], claims: written, secret });

    expect(readToken(token).payload).toEqual({ sub: 1234567890, quoted: "1234567890", roles: ["a", "b"] });
  });

  it("checks the well-known HS256 token against its own secret", async () => {
    await expect(verifySignature(HS256_TOKEN, HS256_SECRET, "HS256")).resolves.toBe(true);
  });

  it("calls a signature that does not match invalid rather than unreadable", async () => {
    await expect(verifySignature(HS256_TOKEN, "not-the-secret", "HS256")).resolves.toBe(false);
  });

  it("holds a secret to the byte, spaces and all", async () => {
    await expect(verifySignature(HS256_TOKEN, `${HS256_SECRET} `, "HS256")).resolves.toBe(false);
  });

  it("checks the signature of a token that expired long ago", async () => {
    const secret = await generateSigningKey("HS256");
    const { token } = await signToken({ alg: "HS256", headers: [], claims: [field("exp", "1")], secret });
    await expect(verifySignature(token, secret, "HS256")).resolves.toBe(true);
  });

  it("puts the chosen algorithm in the header, over any row that says otherwise", async () => {
    const secret = await generateSigningKey("HS256");
    const headers = [field("alg", "none"), field("kid", "the-key")];
    const { token } = await signToken({ alg: "HS256", headers, claims, secret });

    const header = readToken(token).header;
    expect(header).toEqual({ alg: "HS256", kid: "the-key" });
    expect(Object.keys(header ?? {})[0]).toBe("alg");
  });

  it("leaves a row nobody has named yet out of the token", async () => {
    const secret = await generateSigningKey("HS256");
    const { token } = await signToken({
      alg: "HS256",
      headers: [],
      claims: [field("sub", "abc"), field("  ", "orphan")],
      secret,
    });
    expect(readToken(token).payload).toEqual({ sub: "abc" });
  });

  it("hands back the public half of an asymmetric key", async () => {
    const secret = await generateSigningKey("ES256");
    const { token, publicKey } = await signToken({ alg: "ES256", headers: [], claims, secret });

    expect(publicKey.startsWith("-----BEGIN PUBLIC KEY-----")).toBe(true);
    await expect(verifySignature(token, publicKey, "ES256")).resolves.toBe(true);
  });

  it("has no public half to hand back for a shared secret", async () => {
    const secret = await generateSigningKey("HS256");
    expect((await signToken({ alg: "HS256", headers: [], claims, secret })).publicKey).toBe("");
  });

  it("checks a signature against the private key by deriving the public one", async () => {
    const secret = await generateSigningKey("EdDSA");
    const { token } = await signToken({ alg: "EdDSA", headers: [], claims, secret });
    await expect(verifySignature(token, secret, "EdDSA")).resolves.toBe(true);
  });

  it("checks a signature against a JWK, private or public", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const pem = await exportPKCS8(privateKey);
    const { token } = await signToken({ alg: "ES256", headers: [], claims, secret: pem });

    const { exportJWK } = await import("jose");
    const privateJwk = JSON.stringify(await exportJWK(privateKey));
    const publicJwk = JSON.stringify(await exportJWK(publicKey));
    await expect(verifySignature(token, privateJwk, "ES256")).resolves.toBe(true);
    await expect(verifySignature(token, publicJwk, "ES256")).resolves.toBe(true);
  });

  it("checks a signature against an SPKI public key", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    const { token } = await signToken({
      alg: "EdDSA",
      headers: [],
      claims,
      secret: await exportPKCS8(privateKey),
    });
    await expect(verifySignature(token, await exportSPKI(publicKey), "EdDSA")).resolves.toBe(true);
  });

  it("says a phrase is not a key for an algorithm that signs with one", async () => {
    const result = await signToken({ alg: "EdDSA", headers: [], claims, secret: "hunter2" });
    expect(result.keyError).toBe("EdDSA signs with a key, so this needs a PEM or a JWK rather than a phrase");
    expect(result.token).toBe("");
  });

  it("says an empty box is the thing that is missing", async () => {
    expect((await signToken({ alg: "HS256", headers: [], claims, secret: "  " })).keyError).toBe("Required");
  });

  it("says a public key cannot sign", async () => {
    const { publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    const result = await signToken({ alg: "EdDSA", headers: [], claims, secret: await exportSPKI(publicKey) });
    expect(result.keyError).toBe("That is a public key; signing needs the private half");
  });

  it("points a PKCS#1 key at the conversion it needs", async () => {
    const pkcs1 = "-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----";
    const result = await signToken({ alg: "RS256", headers: [], claims, secret: pkcs1 });
    expect(result.keyError).toContain("openssl pkcs8 -topk8");
  });

  it("passes on what the key itself could not do", async () => {
    const secret = await generateSigningKey("ES256");
    await expect(verifySignature(HS256_TOKEN, secret, "ES512")).rejects.toThrow();
  });
});
