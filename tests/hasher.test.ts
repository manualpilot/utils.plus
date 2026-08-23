import { describe, expect, it } from "vitest";
import { byteSize } from "../src/common/byte-size";
import { bcryptBase64Decode, bcryptBase64Encode } from "../src/utilities/hasher/bcrypt";
import { formatDigest, hashBytes, HASHES, hashStream, streams } from "../src/utilities/hasher/digest";
import { hashBlob } from "../src/utilities/hasher/file";
import { deriveKdf } from "../src/utilities/hasher/kdf";

const bytes = (text: string) => new TextEncoder().encode(text);
const digest = (variant: string, text: string, seed = 0) => formatDigest(hashBytes(variant, bytes(text), seed), "hex");

const PANGRAM = "The quick brown fox jumps over the lazy dog";

describe("cryptographic digests", () => {
  it.each([
    ["md5", "900150983cd24fb0d6963f7d28e17f72"],
    ["sha-1", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["sha-256", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["sha-224", "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7"],
    [
      "sha-512",
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a"
      + "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    ],
    ["sha-384", "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7"],
    ["sha-512-256", "53048e2681941ef99b2e29b76b4c7dabe4c2d0c634fc6d46e0e2f13107e7af23"],
    ["sha-512-224", "4634270f707b6a54daae7530460842e20e37ed265ceee9a43e8924aa"],
    ["sha3-224", "e642824c3f8cf24ad09234ee7d3c766fc9a3a5168d0c94ad73b46fdf"],
    ["sha3-256", "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"],
    ["sha3-384", "ec01498288516fc926459f58e2c6ad8df9b473cb0fc08c2596da7cf0e49be4b298d88cea927ac7f539f1edf228376d25"],
    [
      "sha3-512",
      "b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e"
      + "10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0",
    ],
    [
      "blake2b-512",
      "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1"
      + "7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
    ],
    ["blake2b-256", "bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319"],
    ["blake2s-256", "508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982"],
    ["blake2s-128", "aa4938119b1dc7b87cbad0ffd200d0ae"],
    ["blake3-256", "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85"],
    ["blake3-128", "6437b3ac38465133ffb63b75273a8db5"],
  ])("hashes abc with %s", (variant, expected) => {
    expect(digest(variant, "abc")).toBe(expected);
  });

  it("extends BLAKE3 past its 256-bit output rather than starting over", () => {
    expect(digest("blake3-512", "abc")).toBe(
      "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85"
        + "1fb250ae7393f5d02813b65d521a0d492d9ba09cf7ce7f4cffd900f23374bf0b",
    );
  });

  it("keeps Keccak-256 apart from SHA3-256, which only differ in their padding", () => {
    expect(digest("keccak-256", "")).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    expect(digest("sha3-256", "")).toBe("a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a");
  });

  it("hashes the UTF-8 bytes of the text, not its code units", () => {
    expect(digest("sha-256", "é")).toBe(formatDigest(hashBytes("sha-256", new Uint8Array([0xc3, 0xa9])), "hex"));
  });

  it("rejects an algorithm it does not know", () => {
    expect(() => hashBytes("sha-999", bytes("abc"))).toThrow(/not an algorithm/);
  });
});

describe("checksums", () => {
  it("matches the standard check value for 123456789", () => {
    expect(digest("crc32", "123456789")).toBe("cbf43926");
    expect(digest("crc32c", "123456789")).toBe("e3069283");
  });

  it("hashes shorter and longer inputs", () => {
    expect(digest("crc32", "abc")).toBe("352441c2");
    expect(digest("crc32c", "abc")).toBe("364b3fb7");
    expect(digest("crc32", PANGRAM)).toBe("414fa339");
  });

  it("matches the xxHash reference vectors", () => {
    expect(digest("xxh32", "")).toBe("02cc5d05");
    expect(digest("xxh32", "abc")).toBe("32d153ff");
    expect(digest("xxh64", "")).toBe("ef46db3751d8e999");
    expect(digest("xxh64", "abc")).toBe("44bc2cf5ad770999");
  });

  it("hashes inputs long enough to take the striped path", () => {
    expect(digest("xxh32", PANGRAM)).toBe("e85ea4de");
    expect(digest("xxh64", PANGRAM)).toBe("0b242d361fda71bc");
  });

  it("matches the MurmurHash3 reference vectors", () => {
    expect(digest("murmur3-32", "")).toBe("00000000");
    expect(digest("murmur3-32", "hello")).toBe("248bfa47");
    expect(digest("murmur3-32", PANGRAM)).toBe("2e4ff723");
    expect(digest("murmur3-128", "hello")).toBe("cbd8a7b341bd9b025b1e906a48ae1d19");
    expect(digest("murmur3-128", "abc")).toBe("b4963f3f3fad78673ba2744126ca2d52");
    expect(digest("murmur3-128", PANGRAM)).toBe("e34bbc7bbc071b6c7a433ca9c49a9347");
  });

  it("moves the hash when the seed moves", () => {
    expect(digest("xxh32", PANGRAM, 42)).toBe("4c29bb74");
    expect(digest("xxh64", PANGRAM, 42)).toBe("aa9f288a8baa3d3f");
    expect(digest("murmur3-32", PANGRAM, 42)).toBe("347ca102");
    expect(digest("murmur3-32", "", 42)).toBe(formatDigest(hashBytes("murmur3-32", bytes(""), 42), "hex"));
    expect(formatDigest(hashBytes("murmur3-32", bytes(""), 42), "decimal")).toBe("142593372");
  });

  it("leaves the seed alone for algorithms that have none", () => {
    expect(digest("crc32", "abc", 99)).toBe(digest("crc32", "abc"));
    expect(digest("sha-256", "abc", 99)).toBe(digest("sha-256", "abc"));
  });
});

describe("output formats", () => {
  const crc = hashBytes("crc32", bytes("123456789"));

  it("spells the same bytes every way the page offers", () => {
    expect(formatDigest(crc, "hex")).toBe("cbf43926");
    expect(formatDigest(crc, "hex-upper")).toBe("CBF43926");
    expect(formatDigest(crc, "decimal")).toBe("3421780262");
    expect(formatDigest(crc, "base64")).toBe("y/Q5Jg==");
    expect(formatDigest(crc, "base64url")).toBe("y_Q5Jg");
  });

  it("keeps the leading zero bytes that decimal drops", () => {
    const leading = new Uint8Array([0x00, 0x00, 0x12, 0x34]);
    expect(formatDigest(leading, "hex")).toBe("00001234");
    expect(formatDigest(leading, "decimal")).toBe("4660");
  });

  it("falls back to hexadecimal for a format it does not know", () => {
    expect(formatDigest(crc, "runes")).toBe("cbf43926");
  });
});

describe("bcrypt's base64", () => {
  it("round-trips through bcrypt's own alphabet, not the usual one", () => {
    const input = new Uint8Array(16).map((_, index) => index);
    expect(bcryptBase64Encode(input)).toBe("..CA.uOD/eaGAOmJB.yMBu");
    expect(bcryptBase64Decode(bcryptBase64Encode(input), 16)).toEqual(input);
  });

  it("stops at the requested length", () => {
    expect(bcryptBase64Decode("..CA.uOD/eaGAOmJB.yMBu", 4)).toEqual(new Uint8Array([0, 1, 2, 3]));
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => bcryptBase64Decode("abc+def", 4)).toThrow(/alphabet/);
  });
});

describe("password hashing", () => {
  const settings = { salt: "somesalt", memory: 65536, iterations: 2, parallelism: 1, cost: 4, blockSize: 1 };

  it("derives Argon2id and spells it as a PHC string", async () => {
    const { digest, encoded } = await deriveKdf("argon2id", "password", settings);
    expect(formatDigest(digest, "hex")).toBe("09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7");
    expect(encoded).toBe(
      "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc",
    );
  });

  it("keeps the three Argon2 versions apart", async () => {
    const id = await deriveKdf("argon2id", "password", settings);
    const i = await deriveKdf("argon2i", "password", settings);
    const d = await deriveKdf("argon2d", "password", settings);
    expect(new Set([id, i, d].map((result) => formatDigest(result.digest, "hex"))).size).toBe(3);
    expect(i.encoded.startsWith("$argon2i$")).toBe(true);
    expect(d.encoded.startsWith("$argon2d$")).toBe(true);
  });

  it("derives scrypt and spells its parameters as log2(N)", async () => {
    const { digest, encoded } = await deriveKdf("scrypt", "", { ...settings, salt: "", cost: 4, blockSize: 1 });
    expect(formatDigest(digest, "hex")).toBe("77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442");
    expect(encoded).toBe("$scrypt$ln=4,r=1,p=1$$d9ZXYjhleyA7GcpCwYoEl/FrSETjB0ro39/6P+3iFEI");
  });

  it("derives scrypt with the RFC's larger parameters", async () => {
    const { digest } = await deriveKdf("scrypt", "password", {
      ...settings,
      salt: "NaCl",
      cost: 10,
      blockSize: 8,
      parallelism: 16,
    });
    expect(formatDigest(digest, "hex")).toBe("fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b373162");
  });

  it("derives bcrypt and hands back the modular crypt string it is normally stored as", async () => {
    const { digest, encoded } = await deriveKdf("bcrypt", "", {
      ...settings,
      salt: "DCq7YPn5Rq63x1Lad4cll.",
      cost: 6,
    });
    expect(encoded).toBe("$2b$06$DCq7YPn5Rq63x1Lad4cll.TV4S6ytwfsfvkgY8jIucDrjc8deX1s.");
    expect(digest).toHaveLength(23);
    expect(bcryptBase64Encode(digest).startsWith("TV4S6ytwfsfvkgY8jIucDrjc8deX1s")).toBe(true);
  });

  it("derives PBKDF2-HMAC-SHA1 over the RFC 6070 vectors", async () => {
    const once = await deriveKdf("pbkdf2-sha1", "password", { ...settings, salt: "salt", iterations: 1 });
    expect(formatDigest(once.digest, "hex").startsWith("0c60c80f961f0e71f3a9b524af6012062fe037a6")).toBe(true);
    const many = await deriveKdf("pbkdf2-sha1", "password", { ...settings, salt: "salt", iterations: 4096 });
    expect(formatDigest(many.digest, "hex").startsWith("4b007901b765489abead49d926f721d065a429c1")).toBe(true);
  });

  it("derives PBKDF2 over its other two hashes and spells it as a PHC string", async () => {
    const sha256 = await deriveKdf("pbkdf2-sha256", "password", { ...settings, salt: "salt", iterations: 4096 });
    expect(formatDigest(sha256.digest, "hex")).toBe(
      "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a",
    );
    expect(sha256.encoded).toBe("$pbkdf2-sha256$i=4096$c2FsdA$xeR41ZKIyEGqUw22hFxMjZYok6ABzk4RpJY4c6qYE0o");

    const sha512 = await deriveKdf("pbkdf2-sha512", "password", { ...settings, salt: "salt", iterations: 4096 });
    expect(formatDigest(sha512.digest, "hex")).toBe(
      "d197b1b33db0143e018b12f3d1d1479e6cdebdcc97c5c0f87f6902e072f457b5",
    );
    expect(sha512.encoded.startsWith("$pbkdf2-sha512$i=4096$c2FsdA$")).toBe(true);
  });

  it("moves a PBKDF2 digest when the iteration count moves", async () => {
    const one = await deriveKdf("pbkdf2-sha256", "password", { ...settings, iterations: 1 });
    const two = await deriveKdf("pbkdf2-sha256", "password", { ...settings, iterations: 2 });
    expect(formatDigest(one.digest, "hex")).not.toBe(formatDigest(two.digest, "hex"));
  });

  it("rejects a password hash it does not know", async () => {
    await expect(deriveKdf("argon2x", "password", settings)).rejects.toThrow(/not an algorithm/);
  });
});

describe("streaming a file", () => {
  const CHUNKS = [bytes("The quick "), bytes("brown fox jumps over "), bytes("the lazy dog")];

  it.each(Object.keys(HASHES))("feeds %s in pieces and lands where one pass does", (variant) => {
    const stream = hashStream(variant, 42);
    for (const chunk of CHUNKS) stream.update(chunk);
    expect(formatDigest(stream.digest(), "hex")).toBe(digest(variant, PANGRAM, 42));
  });

  it("says which hashes it can walk through and which it has to buffer", () => {
    expect(streams("sha-256")).toBe(true);
    expect(streams("crc32")).toBe(true);
    expect(streams("xxh64")).toBe(false);
    expect(streams("murmur3-128")).toBe(false);
  });

  it("refuses a variant it does not know rather than hashing nothing", () => {
    expect(() => hashStream("runes")).toThrow(/not an algorithm/);
  });

  it("hashes a blob into the digest of the bytes inside it", async () => {
    const result = await hashBlob(new Blob([bytes(PANGRAM)]), "sha-256", 0, () => {}, () => true);
    expect(formatDigest(result!, "hex")).toBe(digest("sha-256", PANGRAM));
  });

  it("hashes an empty file rather than refusing it", async () => {
    const result = await hashBlob(new Blob([]), "sha-256", 0, () => {}, () => true);
    expect(formatDigest(result!, "hex")).toBe(digest("sha-256", ""));
  });

  it("counts its way to the end and hands back a buffered digest too", async () => {
    const percents: number[] = [];
    const result = await hashBlob(new Blob([new Uint8Array(4096)]), "xxh64", 7, (p) => percents.push(p), () => true);
    expect(percents.at(-1)).toBe(100);
    expect(formatDigest(result!, "hex")).toBe(digest("xxh64", "\0".repeat(4096), 7));
  });

  it("gives up on a run nothing is waiting for any more", async () => {
    const result = await hashBlob(new Blob([new Uint8Array(1024)]), "sha-256", 0, () => {}, () => false);
    expect(result).toBeNull();
  });

  it("writes a size in something somebody can read", () => {
    expect(byteSize(0)).toBe("0 bytes");
    expect(byteSize(1)).toBe("1 byte");
    expect(byteSize(1023)).toBe("1023 bytes");
    expect(byteSize(1024)).toBe("1.0 KiB");
    expect(byteSize(1536)).toBe("1.5 KiB");
    expect(byteSize(5 * 1024 ** 3)).toBe("5.0 GiB");
  });
});
