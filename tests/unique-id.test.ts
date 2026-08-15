import { describe, expect, it } from "vitest";
import { generateId } from "../src/utilities/unique-id/generate";
import { ID_TYPES, type IdSettings } from "../src/utilities/unique-id/types";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const settings = (overrides: Partial<IdSettings> = {}): IdSettings => ({
  name: "example.com",
  namespace: DNS_NAMESPACE,
  prefix: "",
  domain: "person",
  localId: 0,
  ...overrides,
});

const batch = (type: string, size: number, overrides?: Partial<IdSettings>) =>
  Array.from({ length: size }, () => generateId(type, settings(overrides)));

const uuid = (version: string) =>
  new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);

const SHAPES: Record<string, RegExp> = {
  "uuid-v1": uuid("1"),
  "uuid-v2": uuid("2"),
  "uuid-v3": uuid("3"),
  "uuid-v4": uuid("4"),
  "uuid-v5": uuid("5"),
  "uuid-v6": uuid("6"),
  "uuid-v7": uuid("7"),
  "uuid-v8": uuid("8"),
  nanoid: /^[A-Za-z0-9_-]{21}$/,
  cuid: /^c[0-9a-z]{24}$/,
  cuid2: /^[a-z][0-9a-z]{23}$/,
  ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
  ksuid: /^[0-9A-Za-z]{27}$/,
  xid: /^[0-9a-v]{20}$/,
  typeid: /^[0-7][0-9a-hjkmnp-tv-z]{25}$/,
  objectid: /^[0-9a-f]{24}$/,
  pushid: /^[-0-9A-Z_a-z]{20}$/,
  snowflake: /^[1-9][0-9]*$/,
  sonyflake: /^[1-9][0-9]*$/,
};

const DETERMINISTIC = ["uuid-v3", "uuid-v5"];

describe("generateId", () => {
  it("knows every type the picker offers", () => {
    const offered = ID_TYPES.flatMap((group) => group.items.map((item) => item.value));
    expect(offered.sort()).toEqual(Object.keys(SHAPES).sort());
  });

  it.each(Object.entries(SHAPES))("gives %s the shape it is named for", (type, shape) => {
    for (const id of batch(type, 25)) expect(id).toMatch(shape);
  });

  it.each(Object.keys(SHAPES).filter((type) => !DETERMINISTIC.includes(type)))(
    "never hands out the same %s twice in a batch",
    (type) => {
      const ids = batch(type, 500);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("hashes a namespaced UUID to the value the RFC's own vectors give", () => {
    expect(generateId("uuid-v3", settings())).toBe("9073926b-929f-31c2-abc9-fad77ae3e8eb");
    expect(generateId("uuid-v5", settings())).toBe("cfbff0d1-9375-5685-968c-48ce8b15ae17");
  });

  it("puts the local ID and the domain into a DCE Security UUID", () => {
    const person = generateId("uuid-v2", settings({ localId: 1000, domain: "person" }));
    expect(person.slice(0, 8)).toBe("000003e8");
    expect(person.slice(21, 23)).toBe("00");

    const group = generateId("uuid-v2", settings({ localId: 4294967295, domain: "group" }));
    expect(group.slice(0, 8)).toBe("ffffffff");
    expect(group.slice(21, 23)).toBe("01");

    expect(generateId("uuid-v2", settings({ domain: "org" })).slice(21, 23)).toBe("02");
  });

  it("prefixes a TypeID only when there is a prefix to use", () => {
    expect(generateId("typeid", settings({ prefix: "user" }))).toMatch(/^user_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    expect(generateId("typeid", settings({ prefix: "" }))).not.toContain("_");
  });

  it("keeps a burst of PushIDs in ascending order", () => {
    const ids = batch("pushid", 200);
    expect([...ids].sort()).toEqual(ids);
  });

  it("stamps the current second into the types that carry one", () => {
    const now = Math.floor(Date.now() / 1000);
    const objectId = parseInt(generateId("objectid", settings()).slice(0, 8), 16);
    expect(Math.abs(objectId - now)).toBeLessThan(2);
  });
});
