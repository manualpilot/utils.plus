import type { PageContent } from "../page-document.ts";

export default {
  related: ["/json", "/mock", "/config"],
  howItWorks: [
    "Validation puts a schema beside a JSON payload and checks the payload as you type. Each problem is listed with its JSON Pointer and a sentence, and marked in the payload: on the key when the key is at fault, such as a property the schema does not allow, and on the value otherwise. Clicking a problem selects it in the editor.",
    "Conversion puts one schema language beside another; all three are read into one intermediate form and written out of it. Pydantic needs a class per object, so an inline object becomes a class named after its field, and enums become `Literal` types. Zod is written in Zod 4's style, `z.email()` rather than `z.string().email()`, though both are read.",
    "`format` is checked rather than treated as an annotation: `email`, `date`, `date-time`, `time`, `uuid`, `ipv4`, `ipv6`, `uri`, `hostname` and a few more, with `2023-02-29` refused as a date. String lengths count code points, so an emoji is one character, and `multipleOf: 0.1` accepts `0.3` despite floating point. When every branch of a union fails and only one of them could have fitted the value's type, that branch's own errors are reported.",
    "With the schema first, Generate payload writes a skeleton the schema accepts the shape of: empty strings and zeros, defaults and first enum values, nested objects built out. Swap puts the payload first, and the button then writes a schema inferred from it, every key required and string formats detected, for you to loosen.",
  ],
  examples: [
    {
      title: "A payload against a Pydantic model",
      blocks: [
        {
          code:
            "class Address(BaseModel):\n    postcode: str = Field(pattern=\"^[0-9]{4,6}$\")\n\n\nclass User(BaseModel):\n    email: EmailStr\n    age: int = Field(ge=0)\n    address: Optional[Address] = None",
        },
        {
          code: "{\n  \"email\": \"ada.example.com\",\n  \"age\": 36.5,\n  \"address\": { \"postcode\": \"SW1Y\" }\n}",
        },
        {
          table: [
            ["Pointer", "Problem"],
            ["`/email`", "Must be a valid email address"],
            ["`/age`", "Must be a whole number, found 36.5"],
            ["`/address/postcode`", "Must match /^[0-9]{4,6}$/"],
          ],
        },
        "`address` may be an `Address` or null. The value is an object, so only the `Address` branch could fit, and its complaint about the postcode is the one shown. Given `5` instead, it says “Expected Address or null, found an integer”.",
      ],
    },
    {
      title: "Zod to Pydantic",
      blocks: [
        {
          code:
            "export const User = z.object({\n  id: z.uuid(),\n  role: z.enum([\"admin\", \"viewer\"]).default(\"viewer\"),\n  nickname: z.string().optional(),\n  address: z.object({ city: z.string().min(1) }),\n});",
        },
        {
          code:
            "from typing import Literal, Optional\nfrom uuid import UUID\nfrom pydantic import BaseModel, Field\n\n\nclass UserAddress(BaseModel):\n    city: str = Field(..., min_length=1)\n\n\nclass User(BaseModel):\n    id: UUID\n    role: Literal[\"admin\", \"viewer\"] = \"viewer\"\n    nickname: Optional[str] = None\n    address: UserAddress",
        },
      ],
    },
    {
      title: "A schema inferred from records",
      blocks: [
        {
          code:
            "[\n  { \"id\": \"5f1c2b9e-8a41-4d3a-9c6e-2f0b7d8e1a34\", \"email\": \"ada@example.com\", \"score\": 9 },\n  { \"id\": \"0b7d8e1a-2f0b-4d3a-9c6e-5f1c2b9e8a41\", \"email\": \"grace@example.com\", \"score\": 7.5, \"team\": null }\n]",
        },
        {
          code:
            "export const Root = z.array(z.object({\n  id: z.uuid(),\n  email: z.email(),\n  score: z.number(),\n  team: z.null().optional(),\n}));",
        },
        "Every element is read and the readings merged: `9` and `7.5` make a number rather than an integer, and `team`, present in one record only, becomes optional.",
      ],
    },
  ],
  problems: [
    {
      title: "`.optional()` and `Optional` are not the same",
      blocks: [
        "In Zod, `.optional()` means the key may be missing. In Python, `Optional[str]` means the value may be null, and a model has no way to say a key may be absent. So a property that is neither required nor given a default becomes `Optional[str] = None` in Pydantic, as `nickname` does above, and accepts null where the Zod schema did not.",
      ],
    },
    {
      title: "`.refine()` disappears",
      blocks: [
        "A refinement is a function, and neither JSON Schema nor a Pydantic field has anywhere to put one. It is left out of the conversion and of validation, and listed under The schema as “.refine() is a rule written in code, so it is left out of the conversion”.",
      ],
    },
    {
      title: "A `$ref` to another file",
      blocks: [
        "Only references inside the document, `#/$defs/Name` or `#/definitions/Name`, are followed. Nothing is fetched, so a reference to `https://example.com/address.json` is reported as pointing outside the document and allows any value in the meantime.",
      ],
    },
    {
      title: "The payload is not quite JSON",
      blocks: [
        "The payload is read as strict JSON, so a trailing comma gives “Line 1, column 9 — Expected a property name in double quotes” and nothing is validated until it is fixed. [Repair on the JSON page](/json) removes trailing commas and comments and requotes single-quoted strings.",
      ],
    },
  ],
  faq: [
    {
      question: "Which JSON Schema draft does it use?",
      answer:
        "It writes draft 2020-12. It reads the 2020-12 keywords and the draft-07 spellings still common in older schemas: `definitions` beside `$defs`, and `items` as an array for a tuple beside `prefixItems`.",
    },
    {
      question: "Which keywords are checked?",
      answer:
        "Types, `enum`, `const`, `properties`, `required`, `additionalProperties`, `patternProperties`, `propertyNames` patterns, `minProperties`, `maxProperties`, `dependentRequired`, `items`, `prefixItems`, `contains` with `minContains` and `maxContains`, the length and item counts, `uniqueItems`, the numeric bounds, `multipleOf`, `pattern`, `format`, `allOf`, `anyOf`, `oneOf` as exactly one, `not`, `if`/`then`/`else` and local `$ref`. All of them survive a conversion to JSON Schema. Zod and Pydantic are written without `not`, `if`, `contains`, `patternProperties`, the property counts or `dependentRequired`, and with `oneOf` as a plain union, and a note under The schema says so for each one the schema uses.",
    },
    {
      question: "Is my Zod or Pydantic code run?",
      answer:
        "No. It is parsed as source with the same grammar the editor highlights it with, and read as written. A schema built at run time, such as `z.object(makeShape())`, cannot be followed and is reported as such: “The shape of an object schema has to be written out in the file”.",
    },
  ],
  references: [
    {
      title: "JSON Schema Validation, draft 2020-12",
      url: "https://json-schema.org/draft/2020-12/json-schema-validation",
    },
    { title: "JSON Schema Core, draft 2020-12", url: "https://json-schema.org/draft/2020-12/json-schema-core" },
    { title: "Zod API documentation", url: "https://zod.dev/api" },
    { title: "Pydantic models", url: "https://docs.pydantic.dev/latest/concepts/models/" },
    { title: "RFC 6901, JSON Pointer", url: "https://www.rfc-editor.org/rfc/rfc6901" },
  ],
} satisfies PageContent;
