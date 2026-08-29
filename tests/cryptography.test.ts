import { generateHybridIdentity, identityToRecipient } from "age-encryption";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ageDecrypt, ageEncrypt, ageUnarmor, generateAgeIdentity, identityRecipients } from "../src/utilities/cryptography/age";
import { boxCipher, boxKeypair, boxPublicKey } from "../src/utilities/cryptography/box";
import { decodeBytes, fromBase64, fromHex, respell, toBase64, toHex } from "../src/utilities/cryptography/encoding";
import { type Job, runJob } from "../src/utilities/cryptography/run";
import { message, readField } from "../src/utilities/cryptography/settings";
import { openBytes, sealBytes } from "../src/utilities/cryptography/symmetric";
import * as fixture from "./age-fixtures";

const { createCipheriv, createDecipheriv } = createRequire(import.meta.url)(
  "node:crypto",
) as typeof import("node:crypto");

const hex = (text: string) => fromHex(text);
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

const ALICE_SECRET = hex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
const ALICE_PUBLIC = hex("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
const BOB_SECRET = hex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
const BOB_PUBLIC = hex("de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
const BOX_NONCE = hex("69696ee955b62b73cd62bda875fc73d68219e0036b7a0b37");
const BOX_MESSAGE = hex(
  "be075fc53c81f2d5cf141316ebeb0c7b5228c52a4c62cbd44b66849b64244ffce5ecbaaf33bd751a1ac728d45e6c61296cdc3c012"
    + "33561f41db66cce314adb310e3be8250c46f06dceea3a7fa1348057e2f6556ad6b1318a024a838f21af1fde048977eb48f59ffd49"
    + "24ca1c60902e52f0a089bc76897040e082f937763848645e0705",
);
const BOX_CIPHERTEXT = "f3ffc7703f9400e52a7dfb4b3d3305d98e993b9f48681273c29650ba32fc76ce48332ea7164d96a4476fb8c5"
  + "31a1186ac0dfc17c98dce87b4da7f011ec48c97271d2c20f9b928fe2270d6fb863d51738b48eeee314a7cc8ab932164548e526ae9"
  + "0224368517acfeabd6bb3732bc0e9da99832b61ca01b6de56244a9e88d5f9b37973f622a43d14a6599b1f654cb45a74e355a5";

const SECRETBOX_KEY = hex("1b27556473e985d462cd51197a9a46c76009549eac6474f206c4ee0844f68389");

const KEY_32 = hex("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");

const SLOW = 30000;

const AGE_KEYED = {
  recipient: "key" as const,
  recipients: fixture.RECIPIENT,
  identities: fixture.IDENTITY,
  password: "",
};

const AGE_PASSWORDED = {
  recipient: "password" as const,
  recipients: "",
  identities: "",
  password: fixture.PASSPHRASE,
};

describe("NaCl", () => {
  it("boxes NaCl's own test vector, byte for byte", () => {
    const sealed = boxCipher(ALICE_SECRET, BOB_PUBLIC, BOX_NONCE).encrypt(BOX_MESSAGE);
    expect(toHex(sealed)).toBe(BOX_CIPHERTEXT);
  });

  it("opens it from the other side, which is what makes the agreement an agreement", () => {
    const opened = boxCipher(BOB_SECRET, ALICE_PUBLIC, BOX_NONCE).decrypt(hex(BOX_CIPHERTEXT));
    expect(toHex(opened)).toBe(toHex(BOX_MESSAGE));
  });

  it("derives the public half of a secret key", () => {
    expect(toHex(boxPublicKey(ALICE_SECRET))).toBe(toHex(ALICE_PUBLIC));
    const pair = boxKeypair();
    expect(toHex(boxPublicKey(pair.secretKey))).toBe(toHex(pair.publicKey));
  });

  it("writes the same secretbox as TweetNaCl, tag first", async () => {
    const sealed = await sealBytes({
      algorithm: "nacl-secretbox",
      key: SECRETBOX_KEY,
      nonce: BOX_NONCE,
      aad: undefined,
      data: BOX_MESSAGE,
    });
    expect(toHex(sealed)).toBe(BOX_CIPHERTEXT);
  });

  it("refuses a box a single byte of the peer key is wrong in", () => {
    const wrong = new Uint8Array(BOB_PUBLIC);
    wrong[0] ^= 1;
    expect(() => boxCipher(ALICE_SECRET, wrong, BOX_NONCE).decrypt(hex(BOX_CIPHERTEXT))).toThrow();
  });
});

describe("the stream ciphers", () => {
  it("lands where OpenSSL lands for ChaCha20-Poly1305", async () => {
    const nonce = hex("070000004041424344454647");
    const aad = hex("50515253c0c1c2c3c4c5c6c7");
    const plaintext = bytes("Ladies and Gentlemen of the class of '99");

    const cipher = createCipheriv("chacha20-poly1305", KEY_32, nonce, { authTagLength: 16 });
    cipher.setAAD(aad, { plaintextLength: plaintext.length });
    const openssl = concat(cipher.update(plaintext), cipher.final(), cipher.getAuthTag());

    const sealed = await sealBytes({ algorithm: "chacha20-poly1305", key: KEY_32, nonce, aad, data: plaintext });
    expect(toHex(sealed)).toBe(toHex(openssl));
  });

  it("opens what OpenSSL sealed", async () => {
    const nonce = hex("070000004041424344454647");
    const cipher = createCipheriv("chacha20-poly1305", KEY_32, nonce, { authTagLength: 16 });
    const sealed = concat(cipher.update(bytes("through OpenSSL")), cipher.final(), cipher.getAuthTag());

    const opened = await openBytes({
      algorithm: "chacha20-poly1305",
      key: KEY_32,
      nonce,
      aad: undefined,
      data: sealed,
    });
    expect(text(opened)).toBe("through OpenSSL");
  });

  it("takes a 24-byte nonce for XChaCha20-Poly1305 and comes back with the same bytes", async () => {
    const nonce = hex("404142434445464748494a4b4c4d4e4f5051525354555657");
    const request = { algorithm: "xchacha20-poly1305", key: KEY_32, nonce, aad: undefined };
    const sealed = await sealBytes({ ...request, data: bytes("extended nonce") });
    expect(text(await openBytes({ ...request, data: sealed }))).toBe("extended nonce");
  });
});

describe("AES through Web Crypto", () => {
  it("puts the GCM tag where OpenSSL expects to find it", async () => {
    const iv = hex("cafebabefacedbaddecaf888");
    const aad = bytes("header");
    const plaintext = bytes("the same sixteen");

    const sealed = await sealBytes({ algorithm: "aes-gcm", key: KEY_32, nonce: iv, aad, data: plaintext });
    const decipher = createDecipheriv("aes-256-gcm", KEY_32, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(sealed.subarray(sealed.length - 16));
    const opened = concat(decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final());
    expect(text(opened)).toBe("the same sixteen");
  });

  it("will not open GCM against different additional data", async () => {
    const iv = hex("cafebabefacedbaddecaf888");
    const sealed = await sealBytes({ algorithm: "aes-gcm", key: KEY_32, nonce: iv, aad: bytes("a"), data: bytes("x") });
    await expect(openBytes({ algorithm: "aes-gcm", key: KEY_32, nonce: iv, aad: bytes("b"), data: sealed })).rejects
      .toThrow();
  });

  it.each(["aes-cbc", "aes-ctr"])("%s comes back with what went in", async (algorithm) => {
    const iv = hex("000102030405060708090a0b0c0d0e0f");
    const request = { algorithm, key: KEY_32, nonce: iv, aad: undefined };
    const sealed = await sealBytes({ ...request, data: bytes("a message of no particular length") });
    expect(text(await openBytes({ ...request, data: sealed }))).toBe("a message of no particular length");
  });

  it("pads CBC out to whole blocks and leaves CTR the length it was", async () => {
    const iv = hex("000102030405060708090a0b0c0d0e0f");
    const request = { key: KEY_32, nonce: iv, aad: undefined, data: bytes("nine byte") };
    expect((await sealBytes({ ...request, algorithm: "aes-cbc" })).length).toBe(16);
    expect((await sealBytes({ ...request, algorithm: "aes-ctr" })).length).toBe(9);
  });
});

describe("a whole job", () => {
  const ALGORITHMS = ["aes-gcm", "aes-cbc", "aes-ctr", "chacha20-poly1305", "xchacha20-poly1305", "nacl-secretbox"];

  it.each(ALGORITHMS)("%s carries text there and back", async (algorithm) => {
    const job = jobFor(algorithm);
    const sealed = await runJob({ ...job, text: "Meet me at the usual place" });
    expect(sealed.text).toBeTruthy();

    const opened = await runJob({ ...job, mode: "decrypt", text: sealed.text ?? "" });
    expect(opened.text).toBe("Meet me at the usual place");
  });

  it("carries a NaCl box there and back between two keypairs", async () => {
    const job = { ...jobFor("nacl-box"), key: ALICE_SECRET, peerKey: BOB_PUBLIC };
    const sealed = await runJob({ ...job, text: "one way" });
    const opened = await runJob({
      ...job,
      mode: "decrypt",
      key: BOB_SECRET,
      peerKey: ALICE_PUBLIC,
      text: sealed.text ?? "",
    });
    expect(opened.text).toBe("one way");
  });

  it("writes the nonce in front of the ciphertext and reads it back off there", async () => {
    const job = jobFor("xchacha20-poly1305");
    const sealed = await runJob({ ...job, text: "prefixed" });
    const payload = decodeBytes(sealed.text ?? "", "base64");
    expect(toHex(payload.subarray(0, 24))).toBe(toHex(job.nonce));

    const opened = await runJob({ ...job, mode: "decrypt", text: sealed.text ?? "" });
    expect(toHex(opened.nonce ?? new Uint8Array())).toBe(toHex(job.nonce));
  });

  it("says so rather than half-open a payload too short to hold a nonce", async () => {
    await expect(runJob({ ...jobFor("aes-gcm"), mode: "decrypt", text: "AAAA" })).rejects.toThrow(/12-byte iv/i);
  });

  it("will not open a ciphertext under a different key", async () => {
    const job = jobFor("aes-gcm");
    const sealed = await runJob({ ...job, text: "secret" });
    const other = { ...job, mode: "decrypt" as const, key: hex("00".repeat(32)), text: sealed.text ?? "" };
    await expect(runJob(other)).rejects.toThrow();
  });

  it("names an encrypted file after the one it came from, and gives the name back on the way out", async () => {
    const job = { ...jobFor("aes-gcm"), source: "file" as const, filename: "notes.txt", bytes: bytes("in a file") };
    const sealed = await runJob(job);
    expect(sealed.name).toBe("notes.txt.enc");

    const opened = await runJob({ ...job, mode: "decrypt", filename: sealed.name ?? "", bytes: sealed.bytes ?? null });
    expect(text(opened.bytes ?? new Uint8Array())).toBe("in a file");
    expect(opened.name).toBe("notes.txt");
  });

  it("marks a decrypted file whose name says nothing about having been encrypted", async () => {
    const job = { ...jobFor("aes-gcm"), source: "file" as const, filename: "payload", bytes: bytes("x") };
    const sealed = await runJob(job);
    const opened = await runJob({ ...job, mode: "decrypt", filename: "payload", bytes: sealed.bytes ?? null });
    expect(opened.name).toBe("payload.decrypted");
  });

  it("carries an age message there and back, armoured", async () => {
    const job = { ...jobFor("age"), text: fixture.MESSAGE };
    const sealed = await runJob(job);
    expect(sealed.text).toMatch(/^-----BEGIN AGE ENCRYPTED FILE-----\n/);
    expect(sealed.text).toMatch(/-----END AGE ENCRYPTED FILE-----\n$/);

    const opened = await runJob({ ...job, mode: "decrypt", text: sealed.text ?? "" });
    expect(opened.text).toBe(fixture.MESSAGE);
  });

  it("names an age file .age and takes that suffix back off again", async () => {
    const job = { ...jobFor("age"), source: "file" as const, filename: "notes.txt", bytes: bytes("in a file") };
    const sealed = await runJob(job);
    expect(sealed.name).toBe("notes.txt.age");

    const opened = await runJob({ ...job, mode: "decrypt", filename: sealed.name ?? "", bytes: sealed.bytes ?? null });
    expect(text(opened.bytes ?? new Uint8Array())).toBe("in a file");
    expect(opened.name).toBe("notes.txt");
  });

  it("refuses to spell a plaintext that is not text as text", async () => {
    const job = { ...jobFor("aes-gcm"), source: "file" as const, filename: "b.bin", bytes: hex("fffefdfc") };
    const sealed = await runJob(job);
    const asText = { ...jobFor("aes-gcm"), mode: "decrypt" as const, text: toBase64(sealed.bytes ?? new Uint8Array()) };
    await expect(runJob(asText)).rejects.toThrow(/not UTF-8/);
  });

  function jobFor(algorithm: string): Job {
    return {
      mode: "encrypt",
      algorithm,
      source: "text",
      text: "",
      bytes: null,
      filename: "",
      encoding: "base64",
      key: KEY_32,
      peerKey: BOB_PUBLIC,
      nonce: hex("000102030405060708090a0b0c0d0e0f1011121314151617").subarray(0, nonceLength(algorithm)),
      aad: undefined,
      pgp: { recipient: "password", publicKey: "", privateKey: "", passphrase: "", password: "" },
      age: AGE_KEYED,
    };
  }
});

describe("age", () => {
  it("opens a file the age binary itself wrote to a recipient", async () => {
    expect(text(await ageDecrypt(await ageUnarmor(fixture.FILE), AGE_KEYED))).toBe(fixture.MESSAGE);
  });

  it("opens one the age binary itself sealed to a passphrase", { timeout: SLOW }, async () => {
    expect(text(await ageDecrypt(await ageUnarmor(fixture.PASSPHRASE_FILE), AGE_PASSWORDED))).toBe(fixture.MESSAGE);
  });

  it("opens a post-quantum file the age binary wrote, with the identity age-keygen -pq minted", async () => {
    const settings = { ...AGE_KEYED, identities: fixture.PQ_IDENTITY };
    expect(text(await ageDecrypt(await ageUnarmor(fixture.PQ_FILE), settings))).toBe(fixture.MESSAGE);
    expect(header(await ageUnarmor(fixture.PQ_FILE))[1]).toMatch(/^-> mlkem768x25519 /);
  });

  it("seals to a post-quantum recipient and reads it back", async () => {
    const identity = await generateHybridIdentity();
    const recipient = await identityToRecipient(identity);
    expect(identity).toMatch(/^AGE-SECRET-KEY-PQ-1[0-9A-Z]+$/);
    expect(recipient).toMatch(/^age1pq1[0-9a-z]+$/);

    const sealed = await ageEncrypt(bytes("after the quantum computer"), { ...AGE_KEYED, recipients: recipient });
    expect(header(sealed)[1]).toMatch(/^-> mlkem768x25519 /);
    expect(text(await ageDecrypt(sealed, { ...AGE_KEYED, identities: identity }))).toBe("after the quantum computer");
  });

  it("draws the X25519 identity behind the generate button, and derives the recipient shown under it", async () => {
    const identity = await generateAgeIdentity();
    expect(identity).toMatch(/^AGE-SECRET-KEY-1[0-9A-Z]+$/);
    const [recipient] = await identityRecipients(identity);
    expect(recipient).toBe(await identityToRecipient(identity));

    const sealed = await ageEncrypt(bytes("both sides"), { ...AGE_KEYED, recipients: recipient });
    expect(header(sealed)[1]).toMatch(/^-> X25519 /);
    expect(text(await ageDecrypt(sealed, { ...AGE_KEYED, identities: identity }))).toBe("both sides");
  });

  it("seals to every recipient on the list, and either identity opens it", async () => {
    const other = await generateAgeIdentity();
    const recipients = `${fixture.RECIPIENT}\n# and one more\n${await identityToRecipient(other)}\n`;
    const sealed = await ageEncrypt(bytes("two ways in"), { ...AGE_KEYED, recipients });

    expect(header(sealed).filter((line) => line.startsWith("-> "))).toHaveLength(2);
    expect(text(await ageDecrypt(sealed, AGE_KEYED))).toBe("two ways in");
    expect(text(await ageDecrypt(sealed, { ...AGE_KEYED, identities: other }))).toBe("two ways in");
  });

  it("names the line that is not a key, and cuts a long one short", async () => {
    const settings = { ...AGE_KEYED, recipients: "age1nonsense" };
    await expect(ageEncrypt(bytes("x"), settings)).rejects.toThrow("That is not an age recipient: age1nonsense");

    const long = { ...AGE_KEYED, identities: `AGE-SECRET-KEY-1${"Q".repeat(80)}` };
    await expect(ageDecrypt(await ageUnarmor(fixture.FILE), long)).rejects.toThrow(
      /identity: AGE-SECRET-KEY-1QQQQQQQQ…$/,
    );
  });

  it("tells a wrong passphrase from an identity that is somebody else's", { timeout: SLOW }, async () => {
    const stranger = { ...AGE_KEYED, identities: await generateAgeIdentity() };
    await expect(ageDecrypt(await ageUnarmor(fixture.FILE), stranger)).rejects.toThrow(/None of those identities/);

    const wrong = { ...AGE_PASSWORDED, password: "wrong horse" };
    await expect(ageDecrypt(await ageUnarmor(fixture.PASSPHRASE_FILE), wrong)).rejects.toThrow(/passphrase does not/);
  });

  it("says a file that is not one is not one", async () => {
    await expect(ageDecrypt(bytes("hello"), AGE_KEYED)).rejects.toThrow();
    await expect(ageUnarmor("not armoured at all!")).rejects.toThrow(/armoured age file/);
  });

  const header = (payload: Uint8Array) =>
    Array.from(payload.subarray(0, 512), (byte) => String.fromCharCode(byte)).join("").split("\n");
});

describe("the fields", () => {
  it("reads hex however it is punctuated, and Base64 in either alphabet", () => {
    expect(toHex(fromHex("de:ad be-ef"))).toBe("deadbeef");
    expect(toHex(fromBase64("_-8="))).toBe(toHex(fromBase64("/+8=")));
    expect(toHex(fromBase64("3q2+7w"))).toBe("deadbeef");
  });

  it("says what is wrong with text that is not the encoding it is being read as", () => {
    expect(() => fromHex("abc")).toThrow(/even number/i);
    expect(() => fromHex("zz")).toThrow(/0-9/);
    expect(() => fromBase64("!!!!")).toThrow(/Base64/);
  });

  it("re-spells a key rather than invalidate it when the encoding moves", () => {
    expect(respell("deadbeef", "hex", "base64")).toBe("3q2+7w==");
    expect(respell("3q2+7w==", "base64", "hex")).toBe("deadbeef");
    expect(respell("dead!", "hex", "base64")).toBe("dead!");
  });

  it("holds a key to the length its cipher takes, and leaves a blank one alone", () => {
    expect(readField("", "hex", 32)).toEqual({ bytes: null, error: null });
    expect(readField("deadbeef", "hex", 32).error).toMatch(/Needs 32 bytes, and this is 4/);
    expect(readField("00".repeat(32), "hex", 32).bytes).toHaveLength(32);
  });

  it("answers a bare OperationError with the three things it could have been", () => {
    const failure = new DOMException("", "OperationError");
    expect(message(failure, "decrypt")).toMatch(/did not decrypt/);
    expect(message(new Error("That block holds no public key"), "decrypt")).toBe("That block holds no public key");
  });
});

function concat(...parts: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function nonceLength(algorithm: string): number {
  if (algorithm === "aes-gcm" || algorithm === "chacha20-poly1305") return 12;
  return algorithm.startsWith("aes-") ? 16 : 24;
}
