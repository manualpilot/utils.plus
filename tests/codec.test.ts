import { describe, expect, it } from "vitest";
import { convert, decodeToBytes, encodeBytes } from "../src/utilities/codec/convert";
import type { ByteFormat } from "../src/utilities/codec/formats";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe("base64", () => {
  it("encodes with padding and the standard alphabet", () => {
    expect(encodeBytes(bytes("Hello, World!"), "base64", "standard")).toBe("SGVsbG8sIFdvcmxkIQ==");
    expect(encodeBytes(bytes("f"), "base64", "standard")).toBe("Zg==");
    expect(encodeBytes(bytes("fo"), "base64", "standard")).toBe("Zm8=");
    expect(encodeBytes(bytes("foo"), "base64", "standard")).toBe("Zm9v");
  });

  it("drops padding for the no-padding variants", () => {
    expect(encodeBytes(bytes("Hello, World!"), "base64", "standard-nopad")).toBe("SGVsbG8sIFdvcmxkIQ");
  });

  it("swaps + and / for - and _ in the URL-safe variant", () => {
    const data = new Uint8Array([0xfb, 0xff, 0xbf]);
    expect(encodeBytes(data, "base64", "standard")).toBe("+/+/");
    expect(encodeBytes(data, "base64", "url")).toBe("-_-_");
  });

  it("decodes either alphabet, with or without padding", () => {
    expect(decodeToBytes("-_-_", "base64", "standard")).toEqual(new Uint8Array([0xfb, 0xff, 0xbf]));
    expect(text(decodeToBytes("SGVsbG8sIFdvcmxkIQ", "base64", "url"))).toBe("Hello, World!");
    expect(text(decodeToBytes("SGVsbG8s\nIFdvcmxkIQ==", "base64", "standard"))).toBe("Hello, World!");
  });

  it("decodes a body copied out of a query string, escapes and all", () => {
    expect(text(decodeToBytes("SGVsbG8sIFdvcmxkIQ%3D%3D", "base64", "standard"))).toBe("Hello, World!");
    expect(decodeToBytes("%2B%2F%2B%2F", "base64", "standard")).toEqual(new Uint8Array([0xfb, 0xff, 0xbf]));
  });

  it("rejects invalid characters and truncated input", () => {
    expect(() => decodeToBytes("SGVsbG8*", "base64", "standard")).toThrow(/not valid/);
    expect(() => decodeToBytes("SGVsbG8%zz", "base64", "standard")).toThrow(/not valid/);
    expect(() => decodeToBytes("SGVsbG8sI", "base64", "standard")).toThrow(/truncated/i);
  });
});

describe("base32", () => {
  it.each([
    ["", ""],
    ["f", "MY======"],
    ["fo", "MZXQ===="],
    ["foo", "MZXW6==="],
    ["foob", "MZXW6YQ="],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI======"],
  ])("encodes %o as %o", (plain, encoded) => {
    expect(encodeBytes(bytes(plain), "base32", "rfc4648")).toBe(encoded);
  });

  it("encodes the extended hex alphabet", () => {
    expect(encodeBytes(bytes("foobar"), "base32", "base32hex")).toBe("CPNMUOJ1E8======");
  });

  it("omits padding where the variant has none", () => {
    expect(encodeBytes(bytes("foobar"), "base32", "rfc4648-nopad")).toBe("MZXW6YTBOI");
    expect(encodeBytes(bytes("foobar"), "base32", "crockford")).not.toContain("=");
  });

  it("decodes each alphabet back to the original bytes", () => {
    for (const variant of ["rfc4648", "rfc4648-nopad", "base32hex", "crockford"]) {
      const encoded = encodeBytes(bytes("foobar"), "base32", variant);
      expect(text(decodeToBytes(encoded, "base32", variant))).toBe("foobar");
    }
  });

  it("accepts lowercase, hyphens and letter aliases in Crockford input", () => {
    const encoded = encodeBytes(bytes("foobar"), "base32", "crockford");
    const messy = `${encoded.slice(0, 3)}-${encoded.slice(3)}`.toLowerCase();
    expect(text(decodeToBytes(messy, "base32", "crockford"))).toBe("foobar");
    expect(decodeToBytes("IO", "base32", "crockford")).toEqual(decodeToBytes("10", "base32", "crockford"));
  });

  it("rejects characters outside the selected alphabet", () => {
    expect(() => decodeToBytes("MZXW6YT8", "base32", "rfc4648")).toThrow(/not valid/);
    expect(() => decodeToBytes("CPNMUOJ1", "base32", "base32hex")).not.toThrow();
  });
});

describe("hex", () => {
  it("encodes in the requested case and spacing", () => {
    expect(encodeBytes(bytes("Hi!"), "hex", "lower")).toBe("486921");
    expect(encodeBytes(new Uint8Array([0xde, 0xad, 0xbe, 0xef]), "hex", "upper")).toBe("DEADBEEF");
    expect(encodeBytes(bytes("Hi!"), "hex", "lower-spaced")).toBe("48 69 21");
    expect(encodeBytes(new Uint8Array([0xde, 0xad]), "hex", "upper-spaced")).toBe("DE AD");
  });

  it("decodes regardless of case, separators or 0x prefixes", () => {
    expect(text(decodeToBytes("486921", "hex", "lower"))).toBe("Hi!");
    expect(text(decodeToBytes("48 69 21", "hex", "lower"))).toBe("Hi!");
    expect(text(decodeToBytes("0x48:0x69-0x21", "hex", "upper"))).toBe("Hi!");
  });

  it("rejects odd digit counts and non-hex characters", () => {
    expect(() => decodeToBytes("486", "hex", "lower")).toThrow(/even number/);
    expect(() => decodeToBytes("48zz", "hex", "lower")).toThrow(/hexadecimal/);
  });
});

describe("decimal", () => {
  it("encodes one value per byte", () => {
    expect(encodeBytes(bytes("Hi!"), "decimal", "space")).toBe("72 105 33");
    expect(encodeBytes(bytes("Hi!"), "decimal", "comma")).toBe("72, 105, 33");
    expect(encodeBytes(bytes("Hi!"), "decimal", "padded")).toBe("072 105 033");
  });

  it("decodes across separators", () => {
    expect(text(decodeToBytes("72,105 33", "decimal", "space"))).toBe("Hi!");
    expect(text(decodeToBytes("072 105 033", "decimal", "padded"))).toBe("Hi!");
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(() => decodeToBytes("72 256", "decimal", "space")).toThrow(/0-255/);
    expect(() => decodeToBytes("72 -1", "decimal", "space")).toThrow(/not a decimal number/);
  });
});

describe("binary", () => {
  it("encodes 8 bits per byte", () => {
    expect(encodeBytes(bytes("Hi"), "binary", "spaced")).toBe("01001000 01101001");
    expect(encodeBytes(bytes("Hi"), "binary", "continuous")).toBe("0100100001101001");
  });

  it("decodes with or without separators", () => {
    expect(text(decodeToBytes("01001000 01101001", "binary", "spaced"))).toBe("Hi");
    expect(text(decodeToBytes("0100100001101001", "binary", "spaced"))).toBe("Hi");
  });

  it("rejects partial bytes and stray characters", () => {
    expect(() => decodeToBytes("0100100", "binary", "spaced")).toThrow(/8-bit bytes/);
    expect(() => decodeToBytes("01001002", "binary", "spaced")).toThrow(/0 and 1/);
  });
});

describe("deflate", () => {
  const sample = "Compress me, compress me, compress me, and then compress me once more.";

  it.each(["zlib", "raw", "gzip"])("round trips through %s", async (variant) => {
    const encoded = await convert(sample, "encode", "deflate", variant);
    expect(encoded.error).toBe("");
    expect(await convert(encoded.output, "decode", "deflate", variant)).toEqual({
      output: sample,
      error: "",
      byteLength: sample.length,
    });
  });

  it("wraps the compressed bytes in Base64 and counts them rather than the text", async () => {
    const { output, byteLength } = await convert(sample, "encode", "deflate", "zlib");
    expect(output).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(byteLength).toBeLessThan(sample.length);
    expect(decodeToBytes(output, "base64", "standard")).toHaveLength(byteLength);
  });

  it.each([
    ["zlib", [0x78]],
    ["gzip", [0x1f, 0x8b]],
  ])("writes the %s header", async (variant, header) => {
    const { output } = await convert(sample, "encode", "deflate", variant);
    const compressed = decodeToBytes(output, "base64", "standard");
    expect(Array.from(compressed.slice(0, header.length))).toEqual(header);
  });

  it("reads a Base64 body written anywhere else, padded or not", async () => {
    const { output } = await convert(sample, "encode", "deflate", "raw");
    const urlSafe = output.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect((await convert(urlSafe, "decode", "deflate", "raw")).output).toBe(sample);
  });

  it("reads a body written with a wrapper other than the one selected", async () => {
    const { output } = await convert(sample, "encode", "deflate", "gzip");
    expect((await convert(output, "decode", "deflate", "zlib")).output).toBe(sample);
  });

  it("says so when the bytes are not compressed at all", async () => {
    expect((await convert("SGVsbG8sIFdvcmxkIQ==", "decode", "deflate", "raw")).error).toBe(
      "Input is not zlib, gzip or raw deflate data",
    );
  });

  it("reads a SAMLRequest out of the query string it was copied from", async () => {
    const request = "HY1LC4JAFEb%2FiszeZ2pyyUBwIxRBRos2MYw3HHAeea%2Fhz0%2FcnnM%2BvhNJM3loFh7tHb8LEgermSzBLmqxzBac"
      + "JE1gpUECVtA31wtkUQJ%2BduyUm0TQtbV4V1gNqviUInjiTNrZWmzVJokW7CyxtLyhJM3D5Bim5SM7QJFBXrxE0G7H2kreVyOzhzjWg49"
      + "wlcZPGCln4r6%2F9Tj%2FtMLIj17E5z8%3D";
    const { output, error } = await convert(request, "decode", "deflate", "zlib");

    expect(error).toBe("");
    expect(output).toBe(
      "<samlp:AuthnRequest xmlns:samlp=\"urn:oasis:names:tc:SAML:2.0:protocol\" ID=\"_8e8dc5f6\" Version=\"2.0\" "
        + "IssueInstant=\"2014-07-16T23:52:45Z\" Destination=\"http://idp.example.com/SSOService.php\"/>",
    );
  });

  it("reports a body that is not Base64 as the Base64 problem it is", async () => {
    expect((await convert("not base64!", "decode", "deflate", "zlib")).error).toMatch(/not valid/);
  });

  it("has nothing to say about an empty box", async () => {
    expect(await convert("", "encode", "deflate", "gzip")).toEqual({ output: "", error: "", byteLength: 0 });
  });
});

describe("nato", () => {
  it("spells out letters and digits, with Break standing in for a space", () => {
    expect(encodeBytes(bytes("Hi 42"), "nato", "standard")).toBe("Hotel India Break Four Two");
  });

  it("prefers the spellings the selected preset uses", () => {
    expect(encodeBytes(bytes("AJX"), "nato", "standard")).toBe("Alfa Juliett Xray");
    expect(encodeBytes(bytes("AJX"), "nato", "alternate")).toBe("Alpha Juliet X-ray");
    expect(encodeBytes(bytes("349"), "nato", "aviation")).toBe("Tree Fower Niner");
  });

  it("passes through characters it has no word for", () => {
    expect(encodeBytes(bytes("hi!"), "nato", "standard")).toBe("Hotel India !");
    expect(text(decodeToBytes("Hotel India !", "nato", "standard"))).toBe("HI!");
  });

  it("decodes any preset's spelling, and bare characters, whatever the variant", () => {
    expect(text(decodeToBytes("alpha JULIETT x-ray", "nato", "aviation"))).toBe("AJX");
    expect(text(decodeToBytes("Tree Wun Ait", "nato", "standard"))).toBe("318");
    expect(text(decodeToBytes("H I break 4 2", "nato", "standard"))).toBe("HI 42");
  });

  it("treats newlines as word breaks", () => {
    expect(text(decodeToBytes("Hotel India\nTango Oscar", "nato", "standard"))).toBe("HI TO");
  });

  it("rejects words that spell nothing", () => {
    expect(() => decodeToBytes("Hotel Iceland", "nato", "standard")).toThrow(/not a NATO phonetic word/);
  });
});

describe("morse", () => {
  it("separates letters by a space and words by the variant's gap", () => {
    expect(encodeBytes(bytes("SOS"), "morse", "slash")).toBe("... --- ...");
    expect(encodeBytes(bytes("Hi there"), "morse", "slash")).toBe(".... .. / - .... . .-. .");
    expect(encodeBytes(bytes("Hi there"), "morse", "spaces")).toBe(".... ..   - .... . .-. .");
  });

  it("encodes digits and punctuation", () => {
    expect(encodeBytes(bytes("Hello, World!"), "morse", "slash")).toBe(
      ".... . .-.. .-.. --- --..-- / .-- --- .-. .-.. -.. -.-.--",
    );
    expect(encodeBytes(bytes("42"), "morse", "slash")).toBe("....- ..---");
  });

  it("draws the marks as interpunct and minus for the symbols variant", () => {
    expect(encodeBytes(bytes("Hi there"), "morse", "symbols")).toBe("···· ·· / − ···· · ·−· ·");
  });

  it("decodes back to upper case, whichever marks and gaps were used", () => {
    expect(text(decodeToBytes(".... .. / - .... . .-. .", "morse", "slash"))).toBe("HI THERE");
    expect(text(decodeToBytes(".... ..   - .... . .-. .", "morse", "slash"))).toBe("HI THERE");
    expect(text(decodeToBytes("···· ·· / − ···· · ·−· ·", "morse", "slash"))).toBe("HI THERE");
    expect(text(decodeToBytes(".... ..\n- .... . .-. .", "morse", "slash"))).toBe("HI THERE");
    expect(text(decodeToBytes("... ___ ...", "morse", "slash"))).toBe("SOS");
  });

  it("rejects characters with no code and codes with no character", () => {
    expect(() => encodeBytes(bytes("Grusße"), "morse", "slash")).toThrow(/has no Morse code/);
    expect(() => decodeToBytes("........", "morse", "slash")).toThrow(/not a Morse code sequence/);
  });

  it("keeps a slash in the plain text distinct from the word gap", () => {
    const encoded = encodeBytes(bytes("a/b c"), "morse", "slash");
    expect(encoded).toBe(".- -..-. -... / -.-.");
    expect(text(decodeToBytes(encoded, "morse", "slash"))).toBe("A/B C");
  });
});

describe("rot13", () => {
  it("rotates letters and leaves everything else alone", () => {
    expect(encodeBytes(bytes("Hello, World!"), "rot13", "rot13")).toBe("Uryyb, Jbeyq!");
    expect(encodeBytes(bytes("abc123"), "rot13", "rot13")).toBe("nop123");
  });

  it("rotates digits by five as well for ROT18, which is where the name comes from", () => {
    expect(encodeBytes(bytes("abc123"), "rot13", "rot18")).toBe("nop678");
  });

  it("rotates the printable graphics for ROT47", () => {
    expect(encodeBytes(bytes("Hello"), "rot13", "rot47")).toBe("w6==@");
    expect(encodeBytes(bytes("a b"), "rot13", "rot47")).toBe("2 3");
  });

  it.each(["rot13", "rot18", "rot47"])("is its own inverse for %s", (variant) => {
    const sample = "Pack my box, 12 jugs!";
    expect(text(decodeToBytes(encodeBytes(bytes(sample), "rot13", variant), "rot13", variant))).toBe(sample);
  });
});

describe("caesar", () => {
  it("shifts by three, which is the shift the cipher is named for", () => {
    expect(encodeBytes(bytes("Hello, World!"), "caesar", "letters", "3")).toBe("Khoor, Zruog!");
    expect(text(decodeToBytes("Khoor, Zruog!", "caesar", "letters", "3"))).toBe("Hello, World!");
  });

  it("wraps a shift that is negative or longer than the alphabet", () => {
    expect(encodeBytes(bytes("abc"), "caesar", "letters", "-1")).toBe("zab");
    expect(encodeBytes(bytes("abc"), "caesar", "letters", "29")).toBe("def");
  });

  it("turns digits and the printable graphics when the variant says to", () => {
    expect(encodeBytes(bytes("abc 789"), "caesar", "alphanumeric", "3")).toBe("def 012");
    expect(encodeBytes(bytes("abc 789"), "caesar", "letters", "3")).toBe("def 789");
    expect(encodeBytes(bytes("~"), "caesar", "ascii", "1")).toBe("!");
  });

  it("says so when the shift is missing or is not a whole number", () => {
    expect(() => encodeBytes(bytes("abc"), "caesar", "letters", "")).toThrow(/needs a shift/);
    expect(() => encodeBytes(bytes("abc"), "caesar", "letters", "two")).toThrow(/whole number/);
  });
});

describe("vigenere", () => {
  it("encodes ATTACKATDAWN under LEMON", () => {
    expect(encodeBytes(bytes("ATTACKATDAWN"), "vigenere", "standard", "LEMON")).toBe("LXFOPVEFRNHR");
    expect(text(decodeToBytes("LXFOPVEFRNHR", "vigenere", "standard", "LEMON"))).toBe("ATTACKATDAWN");
  });

  it("extends the key with the text itself for autokey", () => {
    expect(encodeBytes(bytes("ATTACKATDAWN"), "vigenere", "autokey", "QUEENLY")).toBe("QNXEPVYTWTWP");
    expect(text(decodeToBytes("QNXEPVYTWTWP", "vigenere", "autokey", "QUEENLY"))).toBe("ATTACKATDAWN");
  });

  it("is its own inverse for beaufort", () => {
    expect(encodeBytes(bytes("ATTACKATDAWN"), "vigenere", "beaufort", "LEMON")).toBe("LLTOLBETLNPR");
    expect(text(decodeToBytes("LLTOLBETLNPR", "vigenere", "beaufort", "LEMON"))).toBe("ATTACKATDAWN");
  });

  it("keeps case and passes non-letters through without spending the key on them", () => {
    expect(encodeBytes(bytes("Attack at dawn!"), "vigenere", "standard", "lemon")).toBe("Lxfopv ef rnhr!");
  });

  it("reads a key for its letters alone, and says so when it holds none", () => {
    expect(encodeBytes(bytes("ATTACK"), "vigenere", "standard", "le-mon 1")).toBe("LXFOPV");
    expect(() => encodeBytes(bytes("ATTACK"), "vigenere", "standard", "42")).toThrow(/at least one letter/);
  });
});

describe("xor", () => {
  it("spells the result the way the variant asks", () => {
    expect(encodeBytes(bytes("Hi"), "xor", "hex-hex", "2f")).toBe("6746");
    expect(encodeBytes(bytes("Hi"), "xor", "hex-base64", "2f")).toBe("Z0Y=");
  });

  it("repeats the key under the text and undoes itself", () => {
    const sample = "Attack at dawn";
    const encoded = encodeBytes(bytes(sample), "xor", "text-hex", "key");
    expect(text(decodeToBytes(encoded, "xor", "text-hex", "key"))).toBe(sample);
  });

  it("reads a hex key with the separators any other hex takes", () => {
    expect(encodeBytes(bytes("Hi"), "xor", "hex-hex", "0x2f")).toBe("6746");
  });

  it("rejects a key that is empty or is not the spelling the variant named", () => {
    expect(() => encodeBytes(bytes("Hi"), "xor", "text-hex", "")).toThrow(/must not be empty/);
    expect(() => encodeBytes(bytes("Hi"), "xor", "hex-hex", "secret")).toThrow(/The XOR key contains/);
  });
});

describe("cipher keys reach the page", () => {
  it.each(
    [
      ["caesar", "letters", "3"],
      ["vigenere", "standard", "LEMON"],
      ["xor", "text-base64", "secret"],
    ] as const,
  )("round trips %s through convert", async (format, variant, key) => {
    const sample = "Grüße, 世界! 🎉";
    const encoded = await convert(sample, "encode", format, variant, key);
    expect(encoded.error).toBe("");
    expect((await convert(encoded.output, "decode", format, variant, key)).output).toBe(sample);
  });

  it("reports the key that is missing rather than falling quiet", async () => {
    expect((await convert("hi", "encode", "vigenere", "standard", "")).error).toMatch(/at least one letter/);
    expect((await convert("hi", "encode", "caesar", "letters", "")).error).toMatch(/needs a shift/);
  });
});

describe("round trips", () => {
  const variants: [ByteFormat, string][] = [
    ["base64", "standard"],
    ["base64", "url-nopad"],
    ["base32", "rfc4648"],
    ["base32", "crockford"],
    ["hex", "upper-spaced"],
    ["decimal", "comma"],
    ["binary", "continuous"],
  ];

  it.each(variants)("survives %s/%s", (format, variant) => {
    const sample = "Grüße, 世界! 🎉  ";
    const encoded = encodeBytes(bytes(sample), format, variant);
    expect(text(decodeToBytes(encoded, format, variant))).toBe(sample);
  });

  const textVariants: [ByteFormat, string][] = [
    ["nato", "standard"],
    ["nato", "alternate"],
    ["nato", "aviation"],
    ["morse", "slash"],
    ["morse", "spaces"],
    ["morse", "symbols"],
  ];

  it.each(textVariants)("survives %s/%s", (format, variant) => {
    const sample = "Pack my box, 12 jugs!";
    const encoded = encodeBytes(bytes(sample), format, variant);
    expect(text(decodeToBytes(encoded, format, variant))).toBe(sample.toUpperCase());
  });

  it("carries characters NATO cannot spell, including astral ones", () => {
    const sample = "OK 🎉";
    const encoded = encodeBytes(bytes(sample), "nato", "standard");
    expect(text(decodeToBytes(encoded, "nato", "standard"))).toBe(sample);
  });

  it.each([...variants, ...textVariants])("handles empty input for %s/%s", (format, variant) => {
    expect(encodeBytes(new Uint8Array(), format, variant)).toBe("");
    expect(Array.from(decodeToBytes("", format, variant))).toEqual([]);
  });
});
