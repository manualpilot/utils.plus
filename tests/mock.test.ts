import { describe, expect, it } from "vitest";
import type { JsonValue, SchemaDocument } from "../src/common/schema/ir";
import { type LanguageId, LANGUAGES } from "../src/common/schema/languages";
import { checkCard, checkEan, checkIban, checkImei, checkIsbn, eanDigit, ibanCheckDigits, identify, isbn10Digit, luhnDigit, luhnHolds } from "../src/utilities/mock/checksums";
import { fieldForName, normalise } from "../src/utilities/mock/detect";
import { FIELDS } from "../src/utilities/mock/fields";
import { generateBatch, type Optionality, rowName, rowSchema } from "../src/utilities/mock/generate";
import { LOCALES } from "../src/utilities/mock/locales";
import { stringFromPattern } from "../src/utilities/mock/pattern";
import { SAMPLE_JSON_SCHEMA, SAMPLE_PYDANTIC, SAMPLE_ZOD } from "../src/utilities/mock/samples";
import { freshSeed, Rng, rowRng } from "../src/utilities/mock/seed";
import { FORMATS } from "../src/utilities/mock/write";
import { validate } from "../src/utilities/schema/validate";

function read(language: LanguageId, source: string): SchemaDocument {
  const { document, errors } = LANGUAGES[language].read(source);
  if (!document) throw new Error(`unreadable: ${errors.map((error) => error.message).join("; ")}`);
  return document;
}

const options = (overrides: Partial<Parameters<typeof generateBatch>[1]> = {}) => ({
  seed: "test",
  count: 20,
  locale: "en-US" as const,
  optional: "always" as Optionality,
  ...overrides,
});

function rowDocument(doc: SchemaDocument): SchemaDocument {
  return { root: rowSchema(doc), defs: doc.defs };
}

function problemsIn(doc: SchemaDocument, rows: JsonValue[]): string[] {
  const shape = rowDocument(doc);
  return rows.flatMap((row) =>
    validate(row, shape).map((problem) => `${problem.pointer || "(root)"}: ${problem.message}`)
  );
}

describe("the seeded stream", () => {
  it("hands back the same values for the same seed", () => {
    const first = Array.from({ length: 50 }, () => new Rng("abc").next());
    const second = Array.from({ length: 50 }, () => new Rng("abc").next());
    expect(first).toEqual(second);
  });

  it("hands back different values for seeds a character apart", () => {
    expect(new Rng("seed1").next()).not.toBe(new Rng("seed2").next());
  });

  it("stays inside its bounds", () => {
    const rng = new Rng("bounds");
    for (let i = 0; i < 2000; i++) {
      const value = rng.between(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("covers every value of a small range rather than favouring one end", () => {
    const rng = new Rng("spread");
    const counts = new Map<number, number>();
    for (let i = 0; i < 6000; i++) {
      const value = rng.below(6);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const count of counts.values()) expect(count).toBeGreaterThan(800);
  });

  it("gives each row a stream of its own, so a longer batch leaves the rows already drawn alone", () => {
    const ten = Array.from({ length: 10 }, (_unused, index) => rowRng("batch", index).next());
    const fifty = Array.from({ length: 50 }, (_unused, index) => rowRng("batch", index).next());
    expect(fifty.slice(0, 10)).toEqual(ten);
  });

  it("draws a fresh seed from an alphabet with no lookalikes in it", () => {
    for (let i = 0; i < 200; i++) expect(freshSeed()).toMatch(/^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/);
  });
});

describe("a batch is reproducible", () => {
  const doc = read("json-schema", SAMPLE_JSON_SCHEMA);

  it("is the same batch for the same seed", () => {
    expect(generateBatch(doc, options()).rows).toEqual(generateBatch(doc, options()).rows);
  });

  it("is a different batch for a different seed", () => {
    const first = generateBatch(doc, options({ seed: "one" })).rows;
    const second = generateBatch(doc, options({ seed: "two" })).rows;
    expect(first).not.toEqual(second);
  });

  it("leaves the rows already on screen alone when more are asked for", () => {
    const ten = generateBatch(doc, options({ count: 10 })).rows;
    const forty = generateBatch(doc, options({ count: 40 })).rows;
    expect(forty.slice(0, 10)).toEqual(ten);
    expect(forty).toHaveLength(40);
  });

  it("reads no clock, so the same seed is the same dates whenever it is asked", () => {
    const dates = generateBatch(doc, options()).rows.map((row) => (row as Record<string, JsonValue>).createdAt);
    expect(dates).toEqual(
      generateBatch(doc, options()).rows.map((row) => (row as Record<string, JsonValue>).createdAt),
    );
  });
});

describe("every row satisfies the schema it was generated from", () => {
  const samples: [LanguageId, string][] = [
    ["json-schema", SAMPLE_JSON_SCHEMA],
    ["zod", SAMPLE_ZOD],
    ["pydantic", SAMPLE_PYDANTIC],
  ];

  for (const [language, source] of samples) {
    for (const optional of ["always", "sometimes", "never"] as Optionality[]) {
      it(`${language}, optional fields ${optional}`, () => {
        const doc = read(language, source);
        const { rows } = generateBatch(doc, options({ count: 40, optional }));
        expect(problemsIn(doc, rows)).toEqual([]);
      });
    }
  }

  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    it(`holds for ${locale}, whose names and addresses are its own`, () => {
      const doc = read("json-schema", SAMPLE_JSON_SCHEMA);
      const { rows } = generateBatch(doc, options({ count: 25, locale }));
      expect(problemsIn(doc, rows)).toEqual([]);
    });
  }

  it("honours a minimum, a maximum and a multipleOf together", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"object\",\"properties\":{\"amount\":{\"type\":\"number\",\"minimum\":10,\"maximum\":20,\"multipleOf\":0.25}},"
        + "\"required\":[\"amount\"]}",
    );
    const { rows } = generateBatch(doc, options({ count: 100 }));
    expect(problemsIn(doc, rows)).toEqual([]);
    for (const row of rows) {
      const amount = (row as Record<string, number>).amount;
      expect(amount).toBeGreaterThanOrEqual(10);
      expect(amount).toBeLessThanOrEqual(20);
    }
  });

  it("honours an exclusive bound on an integer", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"object\",\"properties\":{\"n\":{\"type\":\"integer\",\"exclusiveMinimum\":0,\"exclusiveMaximum\":5}},"
        + "\"required\":[\"n\"]}",
    );
    const { rows } = generateBatch(doc, options({ count: 60 }));
    expect(problemsIn(doc, rows)).toEqual([]);
  });

  it("honours minLength and maxLength even where the name suggested something longer", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"object\",\"properties\":{\"description\":{\"type\":\"string\",\"minLength\":4,\"maxLength\":8}},"
        + "\"required\":[\"description\"]}",
    );
    const { rows } = generateBatch(doc, options({ count: 40 }));
    expect(problemsIn(doc, rows)).toEqual([]);
  });

  it("builds a tuple to the shape its prefix asks for", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"object\",\"properties\":{\"pair\":{\"type\":\"array\",\"prefixItems\":[{\"type\":\"string\"},{\"type\":\"integer\"}],"
        + "\"items\":false,\"minItems\":2,\"maxItems\":2}},\"required\":[\"pair\"]}",
    );
    const { rows } = generateBatch(doc, options({ count: 10 }));
    for (const row of rows) {
      const pair = (row as Record<string, JsonValue[]>).pair;
      expect(pair).toHaveLength(2);
      expect(typeof pair[0]).toBe("string");
      expect(Number.isInteger(pair[1])).toBe(true);
    }
  });

  it("leaves optional keys out entirely when asked to, and fills every one when asked to", () => {
    const doc = read("json-schema", SAMPLE_JSON_SCHEMA);
    const lean = generateBatch(doc, options({ optional: "never" })).rows as Record<string, JsonValue>[];
    const full = generateBatch(doc, options({ optional: "always" })).rows as Record<string, JsonValue>[];
    for (const row of lean) expect(Object.keys(row)).not.toContain("company");
    for (const row of full) expect(Object.keys(row)).toContain("company");
  });

  it("stops rather than circling on a model that holds one of itself", () => {
    const doc = read(
      "json-schema",
      "{\"$ref\":\"#/$defs/Node\",\"$defs\":{\"Node\":{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"},"
        + "\"child\":{\"$ref\":\"#/$defs/Node\"}},\"required\":[\"name\"]}}}",
    );
    const { rows } = generateBatch(doc, options({ count: 5 }));
    expect(rows).toHaveLength(5);
    expect(problemsIn(doc, rows)).toEqual([]);
  });

  it("reads a root that is a list of something as a batch of that something", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"array\",\"items\":{\"type\":\"object\",\"title\":\"Widget\",\"properties\":{\"sku\":{\"type\":\"string\"}},"
        + "\"required\":[\"sku\"]}}",
    );
    const { rows } = generateBatch(doc, options({ count: 7 }));
    expect(rows).toHaveLength(7);
    for (const row of rows) expect(Array.isArray(row)).toBe(false);
    expect(rowName(doc)).toBe("Widget");
  });
});

describe("what a property is called", () => {
  it("reads a name written in any of the ways a schema writes one", () => {
    for (const spelling of ["firstName", "first_name", "FIRST-NAME", "first name", "FirstName"]) {
      expect(normalise(spelling)).toBe("first name");
    }
  });

  it("lands on the field the name means", () => {
    const expected: [string, string][] = [
      ["firstName", "firstName"],
      ["surname", "lastName"],
      ["email_address", "email"],
      ["mobileNumber", "phone"],
      ["postalCode", "postcode"],
      ["countryCode", "countryCode"],
      ["country", "country"],
      ["cardNumber", "creditCard"],
      ["iban", "iban"],
      ["isbn", "isbn"],
      ["createdAt", "pastDateTime"],
      ["expiresAt", "futureDateTime"],
      ["jobTitle", "jobTitle"],
      ["latitude", "latitude"],
      ["ipAddress", "ipv4"],
      ["userAgent", "userAgent"],
      ["isActive", "boolean"],
      ["balance", "price"],
    ];
    for (const [name, field] of expected) expect(fieldForName(name)).toBe(field);
  });

  it("tells apart the names one of which is a prefix of the other", () => {
    expect(fieldForName("countryCode")).toBe("countryCode");
    expect(fieldForName("country")).toBe("country");
    expect(fieldForName("jobTitle")).toBe("jobTitle");
    expect(fieldForName("title")).toBe("title");
    expect(fieldForName("status")).toBe("status");
    expect(fieldForName("state")).toBe("region");
  });

  it("says nothing about a name it does not know", () => {
    expect(fieldForName("zzz")).toBeUndefined();
  });
});

describe("the checksums", () => {
  it("computes a Luhn digit that its own check accepts", () => {
    const rng = new Rng("luhn");
    for (let i = 0; i < 500; i++) {
      const body = rng.digits(15);
      expect(luhnHolds(body + luhnDigit(body))).toBe(true);
    }
  });

  it("accepts the published test card numbers", () => {
    for (const number of ["4242424242424242", "5555555555554444", "378282246310005", "6011111111111117"]) {
      expect(checkCard(number)?.valid).toBe(true);
    }
  });

  it("names the digit that would have made a card hold", () => {
    const result = checkCard("4242424242424243");
    expect(result?.valid).toBe(false);
    expect(result?.expected).toBe("2");
  });

  it("ignores the spaces and hyphens a number is written with", () => {
    expect(checkCard("4242 4242 4242 4242")?.valid).toBe(true);
    expect(checkCard("4242-4242-4242-4242")?.normalised).toBe("4242424242424242");
  });

  it("accepts real IBANs and rejects one digit changed", () => {
    for (const iban of ["GB82WEST12345698765432", "DE89370400440532013000", "FR1420041010050500013M02606"]) {
      expect(checkIban(iban)?.valid).toBe(true);
    }
    expect(checkIban("GB82WEST12345698765433")?.valid).toBe(false);
  });

  it("computes IBAN check digits its own check accepts", () => {
    const bban = "370400440532013000";
    expect(ibanCheckDigits("DE", bban)).toBe("89");
    expect(checkIban(`DE${ibanCheckDigits("DE", bban)}${bban}`)?.valid).toBe(true);
  });

  it("says when an IBAN is the wrong length for its country rather than blaming the digits", () => {
    const result = checkIban("DE8937040044053201300");
    expect(result?.valid).toBe(false);
    expect(result?.detail).toContain("22 characters");
  });

  it("checks both spellings of an ISBN", () => {
    expect(checkIsbn("0-306-40615-2")?.valid).toBe(true);
    expect(checkIsbn("978-0-306-40615-7")?.valid).toBe(true);
    expect(checkIsbn("978-0-306-40615-8")?.valid).toBe(false);
  });

  it("writes an X for an ISBN-10 whose check digit is ten", () => {
    expect(isbn10Digit("043942089")).toBe("X");
    expect(checkIsbn("043942089X")?.valid).toBe(true);
  });

  it("checks a barcode by its length", () => {
    expect(checkEan("4006381333931")?.valid).toBe(true);
    expect(checkEan("4006381333931")?.detail).toBe("EAN-13");
    expect(eanDigit("400638133393")).toBe("1");
  });

  it("names an IMEI rather than reporting it as a card nobody issued", () => {
    const formats = identify("490154203237518").map((candidate) => candidate.format);
    expect(formats).toContain("IMEI");
    expect(checkImei("490154203237518")?.valid).toBe(true);
  });

  it("offers every format a value could be, since fifteen digits are two different things", () => {
    expect(identify("378282246310005").map((candidate) => candidate.format)).toEqual(["Payment card", "IMEI"]);
  });

  it("says nothing at all about a value that is no format's shape", () => {
    expect(identify("hello")).toEqual([]);
    expect(identify("12")).toEqual([]);
  });

  it("does not offer a length no card has as a card", () => {
    expect(checkCard("9780306406157")).toBeNull();
    expect(identify("9780306406157").map((candidate) => candidate.format)).toEqual(["ISBN", "Barcode"]);
  });
});

describe("the generated numbers are the ones the checkers accept", () => {
  const rng = () => new Rng("numbers");

  it("generates cards that pass Luhn and belong to a real issuer range", () => {
    const stream = rng();
    for (let i = 0; i < 300; i++) {
      const card = String(FIELDS.creditCard.generate(stream, LOCALES["en-US"]));
      const result = checkCard(card);
      expect(result?.valid).toBe(true);
    }
  });

  it("generates IBANs that pass mod 97 for every locale", () => {
    for (const locale of Object.values(LOCALES)) {
      const stream = rng();
      for (let i = 0; i < 50; i++) {
        expect(checkIban(String(FIELDS.iban.generate(stream, locale)))?.valid).toBe(true);
      }
    }
  });

  it("generates ISBNs and barcodes that hold", () => {
    const stream = rng();
    for (let i = 0; i < 300; i++) {
      expect(checkIsbn(String(FIELDS.isbn.generate(stream, LOCALES["en-US"])))?.valid).toBe(true);
      expect(checkEan(String(FIELDS.ean.generate(stream, LOCALES["en-US"])))?.valid).toBe(true);
    }
  });

  it("generates a UUID of the version it claims", () => {
    const stream = rng();
    for (let i = 0; i < 200; i++) {
      expect(String(FIELDS.uuid.generate(stream, LOCALES["en-US"]))).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("keeps a made-up address inside the ranges reserved for documentation", () => {
    const stream = rng();
    for (let i = 0; i < 100; i++) {
      expect(String(FIELDS.ipv6.generate(stream, LOCALES["en-US"]))).toMatch(/^2001:0db8:/);
      expect(String(FIELDS.imageUrl.generate(stream, LOCALES["en-US"]))).toMatch(/^https:\/\/example\.com\//);
    }
  });
});

describe("the locales", () => {
  it("writes a Japanese name family-first and in its own script", () => {
    const stream = new Rng("jp");
    for (let i = 0; i < 50; i++) {
      const name = String(FIELDS.fullName.generate(stream, LOCALES["ja-JP"]));
      expect(name).toMatch(/[^ -]/);
      expect(name.split(" ")[0]).toSatisfy((part: string) => LOCALES["ja-JP"].surnames.includes(part));
    }
  });

  it("still writes an email address anybody's parser will take", () => {
    for (const locale of Object.values(LOCALES)) {
      const stream = new Rng("mail");
      for (let i = 0; i < 50; i++) {
        expect(String(FIELDS.email.generate(stream, locale))).toMatch(/^[a-z0-9.]{2,}@[a-z.]+$/);
      }
    }
  });

  it("keeps an accented name whole where the locale writes one", () => {
    const names = LOCALES["de-DE"].surnames.join(" ");
    expect(names).toContain("Müller");
  });
});

describe("a pattern", () => {
  const drawn = (pattern: string, seed = "pattern") => {
    const rng = new Rng(seed);
    return Array.from({ length: 40 }, () => stringFromPattern(rng, pattern));
  };

  it("generates strings the pattern itself matches", () => {
    const patterns = [
      "^[A-Z]{3}-[0-9]{6}$",
      "^\\d{4,6}$",
      "[a-z]+@[a-z]+\\.(com|org)",
      "^(cat|dog|bird)$",
      "^[A-Z][a-z]{2,8}$",
      "^#[0-9a-fA-F]{6}$",
      "^\\w+$",
      "^(a|b)*c$",
      "^x?y{2}z+$",
      "^[^0-9]{3}$",
    ];
    for (const pattern of patterns) {
      const expression = new RegExp(pattern);
      for (const value of drawn(pattern)) {
        expect(value).not.toBeNull();
        expect(expression.test(value as string)).toBe(true);
      }
    }
  });

  it("gives up rather than guessing at what it cannot generate", () => {
    for (const pattern of ["(a)\\1", "(?=foo)bar", "^\\bword\\b$", "[z-a]", "((("]) {
      expect(stringFromPattern(new Rng("give-up"), pattern)).toBeNull();
    }
  });

  it("keeps the pattern rather than a length bound that contradicts it, and says which it dropped", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"object\",\"properties\":{\"code\":{\"type\":\"string\",\"pattern\":\"^[A-Z]{3}-[0-9]{6}$\",\"maxLength\":4}},"
        + "\"required\":[\"code\"]}",
    );
    const { rows, notes } = generateBatch(doc, options({ count: 5 }));
    for (const row of rows) expect((row as Record<string, string>).code).toMatch(/^[A-Z]{3}-\d{6}$/);
    expect(notes.join(" ")).toContain("the pattern was kept");
  });

  it("says so on the batch when a pattern was left unmet", () => {
    const doc = read(
      "json-schema",
      "{\"type\":\"object\",\"properties\":{\"ref\":{\"type\":\"string\",\"pattern\":\"(?=x)y\"}},\"required\":[\"ref\"]}",
    );
    const { notes } = generateBatch(doc, options({ count: 3 }));
    expect(notes.join(" ")).toContain("not one this page can generate from");
  });
});

describe("the batch is written out", () => {
  const rows: JsonValue[] = [
    { id: 1, name: "Ada", address: { city: "London" }, tags: ["a", "b"] },
    { id: 2, name: "He said \"hi\", then left", address: { city: "Paris" }, extra: null },
  ];

  it("writes JSON that reads back as what went in", () => {
    expect(JSON.parse(FORMATS.json.write(rows, "Customer"))).toEqual(rows);
  });

  it("writes one JSON value per line as NDJSON", () => {
    const lines = FORMATS.ndjson.write(rows, "Customer").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line))).toEqual(rows);
  });

  it("flattens a nested record into a column per leaf and keeps a list whole", () => {
    const header = FORMATS.csv.write(rows, "Customer").split("\r\n")[0];
    expect(header).toBe("id,name,address.city,tags,extra");
  });

  it("quotes a CSV field holding a comma or a quote, and doubles the quote", () => {
    const line = FORMATS.csv.write(rows, "Customer").split("\r\n")[2];
    expect(line).toContain("\"He said \"\"hi\"\", then left\"");
  });

  it("gives a column to a key only some rows have, and leaves it empty in the rest", () => {
    const [header, first] = FORMATS.csv.write(rows, "Customer").split("\r\n");
    expect(header.split(",")).toContain("extra");
    expect(first.endsWith(",")).toBe(true);
  });

  it("writes SQL that quotes its identifiers and escapes its strings", () => {
    const sql = FORMATS.sql.write(rows, "Customer");
    expect(sql).toContain("INSERT INTO \"customer\"");
    expect(sql).toContain("\"address_city\"");
    expect(sql).toContain("'He said \"hi\", then left'");
    expect(sql).toContain("NULL");
  });

  it("writes a SQL string with an apostrophe in it by doubling the apostrophe", () => {
    expect(FORMATS.sql.write([{ name: "O'Hara" }], "People")).toContain("'O''Hara'");
  });

  it("writes a boolean as a keyword rather than as a quoted word", () => {
    expect(FORMATS.sql.write([{ active: true, gone: false }], "Rows")).toContain("(TRUE, FALSE)");
  });
});
