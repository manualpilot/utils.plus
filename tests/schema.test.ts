import { describe, expect, it } from "vitest";
import { inferSchema } from "../src/utilities/schema/infer";
import type { JsonValue, SchemaDocument } from "../src/utilities/schema/ir";
import { writeJsonSchema } from "../src/utilities/schema/json-schema";
import { type LanguageId, LANGUAGES } from "../src/utilities/schema/languages";
import { parseJson, pointerOf } from "../src/utilities/schema/locate";
import { samplePayload } from "../src/utilities/schema/sample";
import { validate } from "../src/utilities/schema/validate";

function read(language: LanguageId, source: string): SchemaDocument {
  const { document, errors } = LANGUAGES[language].read(source);
  if (!document) throw new Error(`unreadable: ${errors.map((error) => error.message).join("; ")}`);
  return document;
}

function check(language: LanguageId, source: string, payload: JsonValue): string[] {
  return validate(payload, read(language, source)).map((problem) =>
    `${problem.pointer || "(root)"}: ${problem.message}`
  );
}

const convert = (from: LanguageId, to: LanguageId, source: string) => LANGUAGES[to].write(read(from, source));

const holding = (property: string) => `{ "type": "object", "properties": { "value": ${property} } }`;

describe("finding a place in the payload", () => {
  const text = "{\n  \"a\": [1, {\"b\": \"x\"}],\n  \"c\": null\n}";

  it("records the span of every value under the pointer that names it", () => {
    const parsed = parseJson(text);
    if (!parsed.ok) throw new Error(parsed.error.message);

    const slice = (pointer: string) => {
      const span = parsed.parsed.spans.get(pointer)!;
      return text.slice(span.from, span.to);
    };

    expect(slice("")).toBe(text);
    expect(slice("/a")).toBe("[1, {\"b\": \"x\"}]");
    expect(slice("/a/0")).toBe("1");
    expect(slice("/a/1/b")).toBe("\"x\"");
    expect(slice("/c")).toBe("null");
  });

  it("records the key beside it, which is what an error about a property points at", () => {
    const parsed = parseJson(text);
    if (!parsed.ok) throw new Error(parsed.error.message);

    const span = parsed.parsed.keys.get("/a/1/b")!;
    expect(text.slice(span.from, span.to)).toBe("\"b\"");
    expect(parsed.parsed.keys.get("")).toBeUndefined();
  });

  it("escapes the two characters a pointer cannot hold as themselves", () => {
    expect(pointerOf(["a/b", "c~d", 2])).toBe("/a~1b/c~0d/2");

    const parsed = parseJson("{\"a/b\": 1}");
    if (!parsed.ok) throw new Error(parsed.error.message);
    expect(parsed.parsed.spans.has("/a~1b")).toBe(true);
  });

  it("says where a document stopped making sense", () => {
    const broken = parseJson("{\n  \"a\": 1,\n  \"b\":\n}");
    expect(broken.ok).toBe(false);
    if (broken.ok) return;
    expect(broken.error.line).toBe(4);
    expect(broken.error.message).toBe("Expected a value");
  });

  it("reads the values JSON.parse reads, and refuses what it refuses", () => {
    const round = (source: string) => {
      const parsed = parseJson(source);
      return parsed.ok ? parsed.parsed.value : "failed";
    };

    expect(round("{\"a\": \"\\u00e9\\n\\\"\", \"b\": -1.5e3, \"c\": [true, false, null]}")).toEqual(
      { a: "é\n\"", b: -1500, c: [true, false, null] },
    );
    expect(round("{'a': 1}")).toBe("failed");
    expect(round("[1, 2,]")).toBe("failed");
    expect(round("{} {}")).toBe("failed");
    expect(round("01")).toBe("failed");
  });
});

describe("checking a payload against a schema", () => {
  it("says what was expected and what was found", () => {
    expect(check("json-schema", holding("{ \"type\": \"string\" }"), { value: 3 })).toEqual([
      "/value: Expected a string, found an integer",
    ]);
  });

  it("names a required property that is not there, against the object that should have carried it", () => {
    const schema = "{ \"type\": \"object\", \"properties\": { \"a\": {} }, \"required\": [\"a\", \"b\"] }";
    expect(check("json-schema", schema, { a: 1 })).toEqual(["(root): Missing required property \"b\""]);
  });

  it("names a property the schema closed the door on", () => {
    const schema = "{ \"type\": \"object\", \"properties\": { \"a\": {} }, \"additionalProperties\": false }";
    expect(check("json-schema", schema, { a: 1, b: 2 })).toEqual(["/b: Unexpected property \"b\""]);
  });

  it("checks every other key against the schema an open object gave them", () => {
    const schema = "{ \"type\": \"object\", \"additionalProperties\": { \"type\": \"integer\" } }";
    expect(check("json-schema", schema, { a: 1, b: "x" })).toEqual(["/b: Expected an integer, found a string"]);
  });

  it("measures a string in characters rather than in code units", () => {
    const schema = holding("{ \"type\": \"string\", \"minLength\": 3 }");
    expect(check("json-schema", schema, { value: "🙂🙂" })).toEqual([
      "/value: Must be at least 3 characters long, found 2",
    ]);
  });

  it("holds a string to its pattern and to its format", () => {
    expect(check("json-schema", holding("{ \"type\": \"string\", \"pattern\": \"^a+$\" }"), { value: "ab" })).toEqual([
      "/value: Must match /^a+$/",
    ]);
    expect(check("json-schema", holding("{ \"type\": \"string\", \"format\": \"email\" }"), { value: "nope" })).toEqual(
      [
        "/value: Must be a valid email address",
      ],
    );
    expect(check("json-schema", holding("{ \"type\": \"string\", \"format\": \"date\" }"), { value: "2024-02-31" }))
      .toEqual(["/value: Must be a valid date"]);
    expect(check("json-schema", holding("{ \"type\": \"string\", \"format\": \"uuid\" }"), {
      value: "8f14e45f-ceea-467a-9a3f-2b0c3d4e5f60",
    })).toEqual([]);
  });

  it("holds a number to its bounds, exclusive and not", () => {
    const bounded = holding("{ \"type\": \"number\", \"minimum\": 1, \"exclusiveMaximum\": 10 }");
    expect(check("json-schema", bounded, { value: 1 })).toEqual([]);
    expect(check("json-schema", bounded, { value: 0 })).toEqual(["/value: Must be 1 or more, found 0"]);
    expect(check("json-schema", bounded, { value: 10 })).toEqual(["/value: Must be less than 10, found 10"]);
  });

  it("reads a multiple of a decimal as the decimal it was written as", () => {
    const schema = holding("{ \"type\": \"number\", \"multipleOf\": 0.1 }");
    expect(check("json-schema", schema, { value: 0.3 })).toEqual([]);
    expect(check("json-schema", schema, { value: 0.35 })).toEqual(["/value: Must be a multiple of 0.1, found 0.35"]);
  });

  it("counts the items in an array and says which two of them are the same", () => {
    const schema = holding("{ \"type\": \"array\", \"minItems\": 2, \"uniqueItems\": true }");
    expect(check("json-schema", schema, { value: [1] })).toEqual(["/value: Must have at least 2 items, found 1"]);
    expect(check("json-schema", schema, { value: [1, 2, 1] })).toEqual([
      "/value: Items must be unique — 1 and 3 are the same",
    ]);
  });

  it("holds each position of a tuple to the schema written for that position", () => {
    const schema = holding(
      "{ \"type\": \"array\", \"prefixItems\": [{ \"type\": \"string\" }, { \"type\": \"integer\" }] }",
    );
    expect(check("json-schema", schema, { value: ["a", "b"] })).toEqual([
      "/value/1: Expected an integer, found a string",
    ]);
  });

  it("names the values an enum allows", () => {
    expect(check("json-schema", holding("{ \"enum\": [\"a\", \"b\"] }"), { value: "c" })).toEqual([
      "/value: Must be \"a\" or \"b\"",
    ]);
  });

  it("follows a reference, and a model that holds one of itself", () => {
    const tree = `{
      "$ref": "#/$defs/Node",
      "$defs": {
        "Node": {
          "type": "object",
          "properties": { "name": { "type": "string" }, "child": { "$ref": "#/$defs/Node" } },
          "required": ["name"]
        }
      }
    }`;
    expect(check("json-schema", tree, { name: "a", child: { name: "b", child: { name: "c" } } })).toEqual([]);
    expect(check("json-schema", tree, { name: "a", child: { child: {} } })).toEqual([
      "/child: Missing required property \"name\"",
      "/child/child: Missing required property \"name\"",
    ]);
  });

  it("reports inside the one branch of a union the value could have been", () => {
    const nullableAddress = `{
      "$defs": { "Address": { "type": "object", "properties": { "city": { "type": "string" } }, "required": ["city"] } },
      "type": "object",
      "properties": { "value": { "anyOf": [{ "$ref": "#/$defs/Address" }, { "type": "null" }] } }
    }`;
    expect(check("json-schema", nullableAddress, { value: {} })).toEqual([
      "/value: Missing required property \"city\"",
    ]);
    expect(check("json-schema", nullableAddress, { value: 3 })).toEqual([
      "/value: Expected Address or null, found an integer",
    ]);
    expect(check("json-schema", nullableAddress, { value: null })).toEqual([]);
  });

  it("takes a boolean where a schema was expected as either everything or nothing", () => {
    expect(check("json-schema", "{ \"type\": \"object\", \"properties\": { \"value\": true } }", { value: 1 })).toEqual(
      [],
    );
    expect(check("json-schema", "{ \"type\": \"object\", \"properties\": { \"value\": false } }", { value: 1 }))
      .toEqual([
        "/value: Nothing is allowed here",
      ]);
  });

  it("reads the draft-07 spellings of a tuple and of the definitions beside it", () => {
    const schema = `{
      "type": "object",
      "properties": { "value": { "type": "array", "items": [{ "type": "string" }], "additionalItems": false } },
      "definitions": { "Unused": { "type": "string" } }
    }`;
    expect(check("json-schema", schema, { value: ["a"] })).toEqual([]);
    expect(check("json-schema", schema, { value: ["a", "b"] })).toEqual(["/value/1: Nothing is allowed here"]);
  });
});

describe("reading Zod", () => {
  const source = `import { z } from "zod";

    export const Role = z.enum(["admin", "user"]);

    export const Account = z.object({
      id: z.uuid(),
      name: z.string().min(2).max(10).describe("what to call them"),
      age: z.int().nonnegative().optional(),
      role: Role.default("user"),
      score: z.number().nullable(),
      tags: z.array(z.string()).min(1),
      pair: z.tuple([z.string(), z.number()]),
      counts: z.record(z.string(), z.int()),
      "odd-key": z.literal(7),
    }).strict();`;

  it("reads a whole file of declarations, with the last one as the schema being written", () => {
    expect(check("zod", source, {
      id: "8f14e45f-ceea-467a-9a3f-2b0c3d4e5f60",
      name: "Ada",
      role: "admin",
      score: null,
      tags: ["x"],
      pair: ["a", 1],
      counts: { a: 1 },
      "odd-key": 7,
    })).toEqual([]);
  });

  it("carries every constraint the chain put on a field", () => {
    const problems = check("zod", source, {
      id: "not-a-uuid",
      name: "A",
      age: -1,
      role: "nobody",
      score: "x",
      tags: [],
      pair: ["a"],
      counts: { a: 1.5 },
      "odd-key": 8,
      extra: true,
    });

    expect(problems).toEqual([
      "/id: Must be a valid UUID",
      "/name: Must be at least 2 characters long, found 1",
      "/age: Must be 0 or more, found -1",
      "/role: Must be \"admin\" or \"user\"",
      "/score: Expected a number or null, found a string",
      "/tags: Must have at least 1 item, found 0",
      "/pair: Must have at least 2 items, found 1",
      "/counts/a: Must be a whole number, found 1.5",
      "/odd-key: Must be 7",
      "/extra: Unexpected property \"extra\"",
    ]);
  });

  it("takes optional, nullish and default as three ways of not having to be there", () => {
    const source = `import { z } from "zod";
      export const S = z.object({ a: z.string().optional(), b: z.string().nullish(), c: z.string().default("x") });`;
    expect(check("zod", source, {})).toEqual([]);
    expect(check("zod", source, { b: null })).toEqual([]);
  });

  it("reads the Zod 3 spelling of a format as well as the Zod 4 one", () => {
    const three = "import { z } from \"zod\";\nexport const S = z.object({ a: z.string().email() });";
    const four = "import { z } from \"zod\";\nexport const S = z.object({ a: z.email() });";
    expect(check("zod", three, { a: "nope" })).toEqual(["/a: Must be a valid email address"]);
    expect(check("zod", four, { a: "nope" })).toEqual(["/a: Must be a valid email address"]);
  });

  it("follows the name whatever the import bound z to, and reads a model that holds one of itself", () => {
    const source = `import { z as v } from "zod";
      export const Node: any = v.object({ name: v.string(), child: v.lazy(() => Node).optional() });`;
    expect(check("zod", source, { name: "a", child: { name: "b" } })).toEqual([]);
    expect(check("zod", source, { name: "a", child: { child: {} } })).toEqual([
      "/child: Missing required property \"name\"",
      "/child/child: Missing required property \"name\"",
    ]);
  });

  it("says what it could not follow rather than throwing or running it", () => {
    const built = "import { z } from \"zod\";\nexport const S = z.object(makeShape());";
    const { document, errors } = LANGUAGES.zod.read(built);
    expect(document).not.toBeNull();
    expect(errors.map((error) => error.message)).toContain(
      "The shape of an object schema has to be written out in the file",
    );

    expect(LANGUAGES.zod.read("const = ;").document).toBeNull();
    expect(LANGUAGES.zod.read("const x = 1;").errors[0].message).toMatch(/not something this page can read/);
  });
});

describe("reading Pydantic", () => {
  const source = `from typing import Annotated, Literal, Optional
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr, Field


class Role(str, Enum):
    ADMIN = "admin"
    USER = "user"


class Base(BaseModel):
    id: UUID


class Account(Base):
    name: str = Field(..., min_length=2, max_length=10, description="what to call them")
    age: Optional[int] = Field(None, ge=0)
    email: EmailStr
    role: Role = "user"
    score: float | None = None
    tags: list[str] = []
    pair: tuple[str, float]
    counts: dict[str, int] = {}
    note: Annotated[str, Field(max_length=4)] = "ok"
`;

  it("reads the fields, the inherited ones, and every constraint on them", () => {
    expect(check("pydantic", source, {
      id: "8f14e45f-ceea-467a-9a3f-2b0c3d4e5f60",
      name: "Ada",
      email: "ada@example.com",
      pair: ["a", 1],
    })).toEqual([]);

    expect(check("pydantic", source, {
      id: "x",
      name: "A",
      age: -1,
      email: "nope",
      role: "nobody",
      score: "x",
      tags: [1],
      pair: ["a"],
      counts: { a: 1.5 },
      note: "toolong",
    })).toEqual([
      "/id: Must be a valid UUID",
      "/name: Must be at least 2 characters long, found 1",
      "/age: Must be 0 or more, found -1",
      "/email: Must be a valid email address",
      "/role: Must be \"admin\" or \"user\"",
      "/score: Expected a number or null, found a string",
      "/tags/0: Expected a string, found an integer",
      "/pair: Must have at least 2 items, found 1",
      "/counts/a: Must be a whole number, found 1.5",
      "/note: Must be at most 4 characters long, found 7",
    ]);
  });

  it("takes a default and only a default as what makes a field optional", () => {
    const source = `from pydantic import BaseModel, Field

class S(BaseModel):
    a: str
    b: str = Field(..., min_length=1)
    c: str = "x"
    d: str = Field("y")
    e: str = Field(default="z")
    f: list[str] = Field(default_factory=list)
`;
    expect(check("pydantic", source, { a: "1", b: "2" })).toEqual([]);
    expect(check("pydantic", source, {})).toEqual([
      "(root): Missing required property \"a\"",
      "(root): Missing required property \"b\"",
    ]);
  });

  it("reads both spellings of an optional and the model that names another model", () => {
    const source = `from typing import Optional
from pydantic import BaseModel

class Address(BaseModel):
    city: str

class User(BaseModel):
    home: Optional[Address] = None
    work: Address | None = None
`;
    expect(check("pydantic", source, {})).toEqual([]);
    expect(check("pydantic", source, { home: null, work: { city: "London" } })).toEqual([]);
    expect(check("pydantic", source, { home: {} })).toEqual(["/home: Missing required property \"city\""]);
  });

  it("says what it could not follow rather than throwing", () => {
    const { document, errors } = LANGUAGES.pydantic.read(
      "from pydantic import BaseModel\n\nclass S(BaseModel):\n    a: Wat\n",
    );
    expect(document).not.toBeNull();
    expect(errors.map((error) => error.message)).toContain("Wat is not a type this page knows how to read");
    expect(LANGUAGES.pydantic.read("x = 1\n").document).toBeNull();
  });
});

describe("converting between the three", () => {
  const JSON_SCHEMA = `{
    "type": "object",
    "properties": {
      "name": { "type": "string", "minLength": 1, "description": "what to call them" },
      "age": { "type": "integer", "minimum": 0 },
      "email": { "type": "string", "format": "email" },
      "role": { "enum": ["admin", "user"], "default": "user" },
      "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 3 },
      "home": { "type": "object", "properties": { "city": { "type": "string" } }, "required": ["city"] }
    },
    "required": ["name", "email", "home"]
  }`;

  const GOOD = { name: "Ada", email: "ada@example.com", home: { city: "London" } };
  const BAD = { name: "", age: -1, email: "nope", role: "nobody", tags: ["a", "b", "c", "d"], home: {} };

  it.each(["zod", "pydantic", "json-schema"] as const)("keeps what the schema says when written as %s", (language) => {
    const written = convert("json-schema", language, JSON_SCHEMA);
    expect(check(language, written, GOOD)).toEqual([]);
    expect(check(language, written, BAD)).toEqual(check("json-schema", JSON_SCHEMA, BAD));
  });

  it("goes round all three and comes back saying the same thing", () => {
    const zod = convert("json-schema", "zod", JSON_SCHEMA);
    const pydantic = convert("zod", "pydantic", zod);
    const back = convert("pydantic", "json-schema", pydantic);

    expect(check("json-schema", back, GOOD)).toEqual([]);
    expect(check("json-schema", back, BAD)).toEqual(check("json-schema", JSON_SCHEMA, BAD));
  });

  it("writes Zod as Zod 4 writes it", () => {
    expect(convert("json-schema", "zod", JSON_SCHEMA)).toBe(`import { z } from "zod";

export const Schema = z.object({
  name: z.string().min(1).describe("what to call them"),
  age: z.int().min(0).optional(),
  email: z.email(),
  role: z.enum(["admin", "user"]).default("user"),
  tags: z.array(z.string()).max(3).optional(),
  home: z.object({
    city: z.string(),
  }),
});
`);
  });

  it("writes Pydantic with a class per object and a name taken from the field", () => {
    expect(convert("json-schema", "pydantic", JSON_SCHEMA)).toBe(`from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class ModelHome(BaseModel):
    city: str


class Model(BaseModel):
    name: str = Field(..., description="what to call them", min_length=1)
    age: Optional[int] = Field(None, ge=0)
    email: EmailStr
    role: Literal["admin", "user"] = "user"
    tags: Optional[list[str]] = Field(None, max_length=3)
    home: ModelHome
`);
  });

  it("writes the model a Pydantic class holds before the class that holds it", () => {
    const written = convert("json-schema", "pydantic", JSON_SCHEMA);
    expect(written.indexOf("class ModelHome")).toBeLessThan(written.indexOf("class Model(BaseModel)"));
  });

  it("keeps a JSON Schema root that is only a pointer as the model it points at", () => {
    const zod = "import { z } from \"zod\";\nexport const User = z.object({ a: z.string() });";
    const written = convert("zod", "json-schema", zod);
    expect(JSON.parse(written)).toMatchObject({ title: "User", type: "object" });
    expect(JSON.parse(written).$defs).toBeUndefined();
  });

  it("leaves the pointer where a model holds one of itself, there being no inline form of it", () => {
    const source = `from pydantic import BaseModel
from typing import Optional

class Node(BaseModel):
    name: str
    child: Optional["Node"] = None
`;
    const written = JSON.parse(convert("pydantic", "json-schema", source));
    expect(written.$ref).toBe("#/$defs/Node");
    expect(written.$defs.Node.properties.child).toBeDefined();
  });
});

describe("the payload a schema asks for", () => {
  it("fills every field in with the empty value of its type", () => {
    const source = `{
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "age": { "type": "integer" },
        "ok": { "type": "boolean" },
        "nothing": { "type": "null" }
      }
    }`;
    expect(samplePayload(read("json-schema", source))).toEqual({ name: "", age: 0, ok: false, nothing: null });
  });

  it("uses whatever the schema said it should be, in preference to the empty value", () => {
    const source = holding("{ \"type\": \"string\", \"default\": \"hello\" }");
    expect(samplePayload(read("json-schema", source))).toEqual({ value: "hello" });

    const chosen = holding("{ \"enum\": [\"a\", \"b\"] }");
    expect(samplePayload(read("json-schema", chosen))).toEqual({ value: "a" });
  });

  it("builds the nested objects and arrays out rather than leaving them empty", () => {
    const source = `{
      "type": "object",
      "properties": {
        "home": { "type": "object", "properties": { "city": { "type": "string" }, "zip": { "type": "integer" } } },
        "tags": { "type": "array", "items": { "type": "string" } },
        "people": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" } } } }
      }
    }`;
    expect(samplePayload(read("json-schema", source))).toEqual({
      home: { city: "", zip: 0 },
      tags: [""],
      people: [{ name: "" }],
    });
  });

  it("fills an array up to the count it has to have", () => {
    const source = holding("{ \"type\": \"array\", \"items\": { \"type\": \"integer\" }, \"minItems\": 3 }");
    expect(samplePayload(read("json-schema", source))).toEqual({ value: [0, 0, 0] });
  });

  it("takes the shape over the emptiness where a field is allowed to be null", () => {
    const source = holding(
      "{ \"anyOf\": [{ \"type\": \"object\", \"properties\": { \"a\": { \"type\": \"string\" } } }, { \"type\": \"null\" }] }",
    );
    expect(samplePayload(read("json-schema", source))).toEqual({ value: { a: "" } });
  });

  it("stops at the second time round a model that holds one of itself", () => {
    const source = `{
      "$ref": "#/$defs/Node",
      "$defs": {
        "Node": { "type": "object", "properties": { "name": { "type": "string" }, "child": { "$ref": "#/$defs/Node" } } }
      }
    }`;
    expect(samplePayload(read("json-schema", source))).toEqual({ name: "", child: null });
  });

  it("hands back something the schema it came from accepts", () => {
    const document = read(
      "json-schema",
      `{
      "type": "object",
      "properties": { "a": { "type": "string" }, "b": { "type": "array", "items": { "type": "integer" } } },
      "required": ["a", "b"]
    }`,
    );
    expect(validate(samplePayload(document), document)).toEqual([]);
  });
});

describe("the schema a payload implies", () => {
  const written = (value: JsonValue) => JSON.parse(writeJsonSchema(inferSchema(value)));

  it("reads each value as the type it is, and a string as the format it looks like", () => {
    expect(written({ n: 1, f: 1.5, s: "x", b: true, z: null, id: "8f14e45f-ceea-467a-9a3f-2b0c3d4e5f60" }))
      .toMatchObject({
        type: "object",
        properties: {
          n: { type: "integer" },
          f: { type: "number" },
          s: { type: "string" },
          b: { type: "boolean" },
          z: { type: "null" },
          id: { type: "string", format: "uuid" },
        },
        required: ["n", "f", "s", "b", "z", "id"],
      });
  });

  it("folds the elements of an array into one reading of them", () => {
    expect(written([{ a: 1, b: "x" }, { a: 2 }])).toMatchObject({
      type: "array",
      items: { type: "object", properties: { a: { type: "integer" }, b: { type: "string" } }, required: ["a"] },
    });
  });

  it("widens rather than picks a side when two elements disagree", () => {
    expect(written([1, 1.5])).toMatchObject({ items: { type: "number" } });
    expect(written([1, "x"])).toMatchObject({ items: { anyOf: [{ type: "integer" }, { type: "string" }] } });
  });

  it("says nothing about what goes in an array it was shown none of", () => {
    expect(written([])).toEqual({ $schema: expect.any(String), title: "Root", type: "array" });
  });

  it("hands back a schema the payload it was read from passes", () => {
    const payload: JsonValue = {
      id: "8f14e45f-ceea-467a-9a3f-2b0c3d4e5f60",
      xs: [{ a: 1 }, { a: 2, b: "x" }],
      at: "2024-01-15",
    };
    expect(validate(payload, inferSchema(payload))).toEqual([]);
  });
});
