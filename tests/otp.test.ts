// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32 } from "../src/common/base32";
import { qrModules, qrPath } from "../src/common/qr";
import { computeCode } from "../src/utilities/otp/compute";
import { type Algorithm, hotp, timeStep } from "../src/utilities/otp/hotp";
import { ocra, type OcraInputs, parseSuite, questionProblem, sessionProblem } from "../src/utilities/otp/ocra";
import { generateSecret, readSecret, secretProblem } from "../src/utilities/otp/secret";
import { readUri, type UriFields, uriKeyless, writeUri } from "../src/utilities/otp/uri";
import { scanQr } from "./scan-qr";

const ascii = (text: string) => new TextEncoder().encode(text);

const SEEDS: Record<Algorithm, Uint8Array> = {
  SHA1: ascii("12345678901234567890"),
  SHA256: ascii("12345678901234567890123456789012"),
  SHA512: ascii("1234567890123456789012345678901234567890123456789012345678901234"),
};

describe("HOTP", () => {
  it.each([
    [0, "755224"],
    [1, "287082"],
    [2, "359152"],
    [3, "969429"],
    [4, "338314"],
    [5, "254676"],
    [6, "287922"],
    [7, "162583"],
    [8, "399871"],
    [9, "520489"],
  ])("counts %i into %s", (counter, code) => {
    expect(hotp(SEEDS.SHA1, BigInt(counter), "SHA1", 6)).toBe(code);
  });

  it("takes the low digits of the same truncation whatever the width", () => {
    expect(hotp(SEEDS.SHA1, 0n, "SHA1", 10)).toBe("1284755224");
    expect(hotp(SEEDS.SHA1, 0n, "SHA1", 4)).toBe("5224");
  });
});

describe("TOTP", () => {
  it.each([
    [59, "SHA1", "94287082"],
    [59, "SHA256", "46119246"],
    [59, "SHA512", "90693936"],
    [1111111109, "SHA1", "07081804"],
    [1111111109, "SHA256", "68084774"],
    [1111111109, "SHA512", "25091201"],
    [1111111111, "SHA1", "14050471"],
    [1111111111, "SHA256", "67062674"],
    [1111111111, "SHA512", "99943326"],
    [1234567890, "SHA1", "89005924"],
    [1234567890, "SHA256", "91819424"],
    [1234567890, "SHA512", "93441116"],
    [2000000000, "SHA1", "69279037"],
    [2000000000, "SHA256", "90698825"],
    [2000000000, "SHA512", "38618901"],
    [20000000000, "SHA1", "65353130"],
    [20000000000, "SHA256", "77737706"],
    [20000000000, "SHA512", "47863826"],
  ] as [number, Algorithm, string][])("reads %i as %s %s", (seconds, algorithm, code) => {
    expect(hotp(SEEDS[algorithm], timeStep(seconds, 30), algorithm, 8)).toBe(code);
  });

  it("names the step RFC 6238 says each moment falls in", () => {
    expect(timeStep(59, 30)).toBe(1n);
    expect(timeStep(1111111109, 30)).toBe(0x23523ecn);
    expect(timeStep(20000000000, 30)).toBe(0x27bc86aan);
  });
});

describe("OCRA", () => {
  const answer = (suite: string, key: Uint8Array, inputs: Partial<OcraInputs>) =>
    ocra(key, parseSuite(suite), { counter: 0n, question: "", password: "", session: "", seconds: 0, ...inputs });

  const MOMENT = 1206446790;

  it.each([
    ["00000000", "237653"],
    ["11111111", "243178"],
    ["22222222", "653583"],
    ["33333333", "740991"],
    ["44444444", "608993"],
    ["55555555", "388898"],
    ["66666666", "816933"],
    ["77777777", "224598"],
    ["88888888", "750600"],
    ["99999999", "294470"],
  ])("answers a plain numeric question %s with %s", (question, code) => {
    expect(answer("OCRA-1:HOTP-SHA1-6:QN08", SEEDS.SHA1, { question })).toBe(code);
  });

  it.each([
    [0, "65347737"],
    [1, "86775851"],
    [2, "78192410"],
    [3, "71565254"],
    [4, "10104329"],
    [5, "65983500"],
    [6, "70069104"],
    [7, "91771096"],
    [8, "75011558"],
    [9, "08522129"],
  ])("counts a PIN-carrying suite at %i into %s", (counter, code) => {
    const inputs = { counter: BigInt(counter), question: "12345678", password: "1234" };
    expect(answer("OCRA-1:HOTP-SHA256-8:C-QN08-PSHA1", SEEDS.SHA256, inputs)).toBe(code);
  });

  it.each([
    ["00000000", "83238735"],
    ["11111111", "01501458"],
    ["22222222", "17957585"],
    ["33333333", "86776967"],
    ["44444444", "86807031"],
  ])("hashes the PIN itself for a suite with no counter: %s is %s", (question, code) => {
    expect(answer("OCRA-1:HOTP-SHA256-8:QN08-PSHA1", SEEDS.SHA256, { question, password: "1234" })).toBe(code);
  });

  it.each([
    [0, "00000000", "07016083"],
    [1, "11111111", "63947962"],
    [2, "22222222", "70123924"],
    [3, "33333333", "25341727"],
    [4, "44444444", "33203315"],
    [5, "55555555", "34205738"],
    [6, "66666666", "44343969"],
    [7, "77777777", "51946085"],
    [8, "88888888", "20403879"],
    [9, "99999999", "31409299"],
  ])("counts SHA-512 at %i and %s into %s", (counter, question, code) => {
    expect(answer("OCRA-1:HOTP-SHA512-8:C-QN08", SEEDS.SHA512, { counter: BigInt(counter), question })).toBe(code);
  });

  it.each([
    ["00000000", "95209754"],
    ["11111111", "55907591"],
    ["22222222", "22048402"],
    ["33333333", "24218844"],
    ["44444444", "36209546"],
  ])("counts the minute a moment falls in: %s is %s", (question, code) => {
    const inputs = { question, seconds: MOMENT };
    expect(answer("OCRA-1:HOTP-SHA512-8:QN08-T1M", SEEDS.SHA512, inputs)).toBe(code);
  });

  it.each([
    ["CLI22220SRV11110", "28247970"],
    ["SRV11110CLI22220", "15510767"],
    ["CLI22224SRV11114", "83412541"],
    ["SRV11114CLI22224", "28934924"],
  ])("answers an alphanumeric question %s with %s", (question, code) => {
    expect(answer("OCRA-1:HOTP-SHA256-8:QA08", SEEDS.SHA256, { question })).toBe(code);
  });

  it("answers a client's half of a mutual exchange with the PIN hashed in", () => {
    const inputs = { question: "SRV11110CLI22220", password: "1234" };
    expect(answer("OCRA-1:HOTP-SHA512-8:QA08-PSHA1", SEEDS.SHA512, inputs)).toBe("18806276");
    expect(answer("OCRA-1:HOTP-SHA512-8:QA08", SEEDS.SHA512, { question: "CLI22220SRV11110" })).toBe("79496648");
  });

  it.each([
    ["SIG10000", "53095496"],
    ["SIG11000", "04110475"],
    ["SIG12000", "31331128"],
    ["SIG13000", "76028668"],
    ["SIG14000", "46554205"],
  ])("signs %s as %s", (question, code) => {
    expect(answer("OCRA-1:HOTP-SHA256-8:QA08", SEEDS.SHA256, { question })).toBe(code);
  });

  it.each([
    ["SIG1000000", "77537423"],
    ["SIG1100000", "31970405"],
    ["SIG1200000", "10235557"],
    ["SIG1300000", "95213541"],
    ["SIG1400000", "65360607"],
  ])("signs %s against the clock as %s", (question, code) => {
    expect(answer("OCRA-1:HOTP-SHA512-8:QA10-T1M", SEEDS.SHA512, { question, seconds: MOMENT })).toBe(code);
  });

  it("hashes the suite as it was written", () => {
    const lower = answer("ocra-1:hotp-sha1-6:qn08", SEEDS.SHA1, { question: "00000000" });
    expect(lower).not.toBe("237653");
  });
});

describe("an OCRA suite", () => {
  it("reads every input the specification defines", () => {
    const suite = parseSuite("OCRA-1:HOTP-SHA512-10:C-QA64-PSHA256-S128-T20S");
    expect(suite).toMatchObject({
      algorithm: "SHA512",
      digits: 10,
      counter: true,
      question: { format: "A", length: 64 },
      password: "SHA256",
      session: 128,
      step: 20,
    });
  });

  it("takes the inputs in any order and stands the defaults in for a bare one", () => {
    expect(parseSuite("OCRA-1:HOTP-SHA1-6:QN08-T-P-S")).toMatchObject({ password: "SHA1", session: 64, step: 60 });
    expect(parseSuite("OCRA-1:HOTP-SHA1-6:T1H-QN08-C")).toMatchObject({ counter: true, step: 3600 });
  });

  it.each([
    ["HOTP-SHA1-6:QN08", "three parts"],
    ["OCRA-2:HOTP-SHA1-6:QN08", "only OCRA-1"],
    ["OCRA-1:HOTP-SHA3-6:QN08", "not a crypto function"],
    ["OCRA-1:HOTP-SHA1-3:QN08", "4 to 10"],
    ["OCRA-1:HOTP-SHA1-6:C", "name a question"],
    ["OCRA-1:HOTP-SHA1-6:QN08-QA10", "already asked for"],
    ["OCRA-1:HOTP-SHA1-6:QN08-X", "not an input"],
    ["OCRA-1:HOTP-SHA1-6:QN02", "4 to 64"],
    ["OCRA-1:HOTP-SHA1-6:QN08-T99H", "1 to 48"],
  ])("says what is wrong with %s", (suite, complaint) => {
    expect(() => parseSuite(suite)).toThrow(new RegExp(complaint));
  });

  it("hands back the whole HMAC when the suite asks for no truncation", () => {
    const suite = parseSuite("OCRA-1:HOTP-SHA1-0:QN08");
    const code = ocra(SEEDS.SHA1, suite, { counter: 0n, question: "0", password: "", session: "", seconds: 0 });
    expect(code).toMatch(/^[0-9a-f]{40}$/);
  });

  it("holds a question to its format and to the field it is written into", () => {
    const numeric = parseSuite("OCRA-1:HOTP-SHA1-6:QN08");
    const hex = parseSuite("OCRA-1:HOTP-SHA1-6:QH08");
    expect(questionProblem("12ab", numeric)).toMatch(/digits only/);
    expect(questionProblem("12xy", hex)).toMatch(/0-9 and A-F/);
    expect(questionProblem("CLI22220SRV11110", parseSuite("OCRA-1:HOTP-SHA1-6:QA08"))).toBeNull();
    expect(questionProblem("a".repeat(129), parseSuite("OCRA-1:HOTP-SHA1-6:QA64"))).toMatch(/at most 128 bytes/);
  });

  it("holds session information to the length the suite named", () => {
    const suite = parseSuite("OCRA-1:HOTP-SHA1-6:QN08-S064");
    expect(sessionProblem("a".repeat(64), suite)).toBeNull();
    expect(sessionProblem("a".repeat(65), suite)).toMatch(/up to 64 bytes/);
  });
});

describe("a secret", () => {
  it.each(
    [
      ["base32", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"],
      ["hex", "3132333435363738393031323334353637383930"],
      ["text", "12345678901234567890"],
    ] as const,
  )("reads the same twenty bytes written as %s", (format, text) => {
    expect(readSecret(text, format)).toEqual(SEEDS.SHA1);
  });

  it("reads Base32 in the shapes it is copied in", () => {
    const spaced = readSecret("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", "base32");
    expect(spaced).toEqual(SEEDS.SHA1);
    expect(readSecret("MZXW6===", "base32")).toEqual(ascii("foo"));
    expect(readSecret("MZXW6", "base32")).toEqual(ascii("foo"));
  });

  it.each(
    [
      ["base32", "JBSWY3DP1", "not a Base32 character"],
      ["base32", "A", "truncated"],
      ["hex", "3132zz", "0-9 and A-F"],
      ["hex", "313", "truncated"],
    ] as const,
  )("says why %s cannot read %s", (format, text, complaint) => {
    expect(secretProblem(text, format)).toMatch(new RegExp(complaint));
  });

  it("has nothing to say about a box nobody has typed in", () => {
    expect(secretProblem("", "base32")).toBeNull();
    expect(secretProblem("", "hex")).toBeNull();
  });

  it.each(
    [
      ["base32", 20, /^[A-Z2-7]{32}$/],
      ["hex", 32, /^[0-9a-f]{64}$/],
      ["text", 64, /^[A-Za-z0-9]{64}$/],
    ] as const,
  )("generates a %s secret of %i bytes", (format, size, shape) => {
    expect(generateSecret(format, size)).toMatch(shape);
    expect(generateSecret(format, size)).not.toBe(generateSecret(format, size));
  });

  it("generates one the same reader can read back", () => {
    const secret = generateSecret("base32", 20);
    expect(readSecret(secret, "base32")).toHaveLength(20);
  });
});

describe("Base32", () => {
  it.each([
    ["", ""],
    ["f", "MY======"],
    ["fo", "MZXQ===="],
    ["foo", "MZXW6==="],
    ["foob", "MZXW6YQ="],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI======"],
  ])("writes %s padded as %s", (text, encoded) => {
    expect(encodeBase32(ascii(text), true)).toBe(encoded);
    expect(encodeBase32(ascii(text))).toBe(encoded.replace(/=+$/, ""));
    expect(decodeBase32(encoded)).toEqual(ascii(text));
  });
});

describe("what the page computes", () => {
  const settings = {
    mode: "totp" as const,
    secret: "12345678901234567890",
    format: "text" as const,
    algorithm: "SHA1" as Algorithm,
    digits: 8,
    period: 30,
    counter: 0,
    seconds: 59,
    suite: null,
    question: "",
    password: "",
    session: "",
  };

  it("counts the clock for TOTP and says which step it counted", () => {
    const result = computeCode(settings);
    expect(result?.code).toBe("94287082");
    expect(result?.crypto).toBe("HMAC-SHA-1, 8 digits");
    expect(result?.counted).toEqual([{ label: "Time step", value: "1 · 0x1" }]);
  });

  it("counts the counter for HOTP, and the clock has no bearing on it", () => {
    const result = computeCode({ ...settings, mode: "hotp", digits: 6, counter: 3, seconds: 1234567890 });
    expect(result?.code).toBe("969429");
    expect(result?.counted).toEqual([{ label: "Counter", value: "3" }]);
  });

  it("counts both the counter and the clock when the suite asks for the pair", () => {
    const suite = parseSuite("OCRA-1:HOTP-SHA1-6:C-QN08-T1M");
    const result = computeCode({ ...settings, mode: "ocra", suite, question: "00000000", counter: 7, seconds: 120 });
    expect(result?.counted).toEqual([{ label: "Counter", value: "7" }, { label: "Time step", value: "2 · 0x2" }]);
  });

  it.each([
    ["a secret nobody has typed", { secret: "" }],
    ["a secret this format cannot read", { secret: "JBSWY3DP1", format: "base32" as const }],
    ["a period that is not a number yet", { period: null }],
    ["a digit count that is not a number yet", { digits: null }],
  ])("has no code to show for %s", (_, overrides) => {
    expect(computeCode({ ...settings, ...overrides })).toBeNull();
  });

  it("has no code to show for an OCRA question nobody has typed", () => {
    const suite = parseSuite("OCRA-1:HOTP-SHA1-6:QN08");
    expect(computeCode({ ...settings, mode: "ocra", suite, question: "" })).toBeNull();
    expect(computeCode({ ...settings, mode: "ocra", suite, question: "12ab" })).toBeNull();
  });
});

describe("the otpauth URI", () => {
  const fields: UriFields = {
    mode: "totp",
    issuer: "utils.plus",
    label: "local",
    secret: "JBSWY3DPEHPK3PXP",
    format: "base32",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    counter: 0,
  };

  it("spells every field a TOTP enrolment carries, and the issuer in both of its places", () => {
    expect(writeUri(fields)).toBe(
      "otpauth://totp/utils.plus:local?secret=JBSWY3DPEHPK3PXP&issuer=utils.plus&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("counts uses instead of seconds for HOTP", () => {
    expect(writeUri({ ...fields, mode: "hotp", counter: 7 })).toBe(
      "otpauth://hotp/utils.plus:local?secret=JBSWY3DPEHPK3PXP&issuer=utils.plus&algorithm=SHA1&digits=6&counter=7",
    );
  });

  it("escapes a label as a URI does and leaves the @ of an address alone", () => {
    const uri = writeUri({ ...fields, issuer: "ACME Co", label: "john.doe@email.com" });
    expect(uri.startsWith("otpauth://totp/ACME%20Co:john.doe@email.com?")).toBe(true);
    expect(uri).toContain("issuer=ACME%20Co");
    expect(readUri(uri, fields)).toMatchObject({ issuer: "ACME Co", label: "john.doe@email.com" });
  });

  it.each([
    ["every field it was written from", fields],
    ["an issuer nobody has typed", { ...fields, issuer: "" }],
    ["a label nobody has typed", { ...fields, label: "" }],
    ["a counter and no clock", { ...fields, mode: "hotp" as const, counter: 41 }],
  ])("reads back %s", (_, written) => {
    expect(readUri(writeUri(written), written)).toEqual(written);
  });

  it("writes a hex or a text secret out as the Base32 the format carries", () => {
    const hex = { ...fields, secret: "3132333435363738393031323334353637383930", format: "hex" as const };
    expect(writeUri(hex)).toContain("secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(writeUri({ ...fields, secret: "12345678901234567890", format: "text" })).toContain(
      "secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    );
    expect(readUri(writeUri(hex), hex)).toMatchObject({ secret: hex.secret, format: "hex" });
  });

  it("leaves out a secret it cannot spell rather than writing one that is wrong", () => {
    expect(writeUri({ ...fields, secret: "JBSWY3DP1" })).not.toContain("secret=");
  });

  it("pours a secret that is different bytes into the box in Base32", () => {
    const uri = "otpauth://totp/utils.plus:local?secret=GEZDGNBVGY3TQOJQ&issuer=utils.plus";
    expect(readUri(uri, { ...fields, secret: "abcdef", format: "hex" })).toMatchObject({
      secret: "GEZDGNBVGY3TQOJQ",
      format: "base32",
    });
  });

  it("answers with the format's own defaults for the parameters a URI leaves out", () => {
    const held = { ...fields, algorithm: "SHA512" as const, digits: 10, period: 60 };
    expect(readUri("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP", held)).toMatchObject({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
  });

  it("leaves the box for the other type's parameter as it was", () => {
    expect(readUri("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP", { ...fields, counter: 9 })).toMatchObject({
      counter: 9,
    });
    expect(readUri("otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP", { ...fields, period: 90 })).toMatchObject({
      period: 90,
      counter: 0,
    });
  });

  it("reads a hyphenated hash and a type in either case", () => {
    expect(readUri("otpauth://TOTP/x?algorithm=sha-256", fields)).toMatchObject({ mode: "totp", algorithm: "SHA256" });
  });

  it.each([
    ["the prefix", "otpauth://totp/Acme:local?issuer=utils.plus", "Acme"],
    ["the parameter", "otpauth://totp/utils.plus:local?issuer=Acme", "Acme"],
    ["a URI carrying only the parameter", "otpauth://totp/local?issuer=Acme", "Acme"],
    ["a prefix somebody emptied", "otpauth://totp/:local?issuer=utils.plus", ""],
  ])("takes the issuer from %s", (_, text, issuer) => {
    expect(readUri(text, fields)?.issuer).toBe(issuer);
  });

  it.each([
    ["one carrying a key", "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP", false],
    ["one whose key parameter is empty", "otpauth://totp/x?secret=&digits=6", true],
    ["one that never had the parameter", "otpauth://totp/utils.plus:local?digits=6", true],
    ["text that is not a URI at all", "utils.plus:local", true],
  ])("says of %s whether it enrols nothing", (_, text, keyless) => {
    expect(uriKeyless(text)).toBe(keyless);
  });

  it.each([
    ["text that is not a URI at all", "utils.plus:local"],
    ["a scheme that only opens like one", "otpauth-migration://offline?data=x"],
    ["a type the format has no code for", "otpauth://ocra/x?secret=JBSWY3DPEHPK3PXP"],
    ["a type that only opens like one", "otpauth://totpx/x"],
  ])("is not read from %s", (_, text) => {
    expect(readUri(text, fields)).toBeNull();
  });
});

describe("the QR code", () => {
  it.each([
    ["a TOTP enrolment", "otpauth://totp/utils.plus:local?secret=JBSWY3DPEHPK3PXP&issuer=utils.plus&digits=6"],
    [
      "an HOTP one with an address in the label",
      "otpauth://hotp/ACME%20Co:john.doe@email.com?secret=JBSWY3DP&counter=41",
    ],
    ["the longest a page can spell", `otpauth://totp/${"a".repeat(120)}:${"b".repeat(120)}?secret=JBSWY3DPEHPK3PXP`],
    ["a character outside Latin-1", "otpauth://totp/caf\u00e9 \u2615?secret=JBSWY3DPEHPK3PXP"],
  ])("reads back as %s", (_, uri) => {
    expect(scanQr(qrModules(uri)!)).toBe(uri);
  });

  it("has nothing to draw for text no version has room for", () => {
    expect(qrModules("x".repeat(3000))).toBeNull();
  });

  it("draws each run of dark modules as one subpath, offset by the quiet zone", () => {
    expect(qrPath([[true, true, false, true]])).toBe("M4 4h2v1h-2zM7 4h1v1h-1z");
    expect(qrPath([[false, false]])).toBe("");
    expect(qrPath([[false, true, true]])).toBe("M5 4h2v1h-2z");
  });
});
