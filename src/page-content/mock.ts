import type { PageContent } from "../page-document.ts";

export default {
  related: ["/schema", "/json", "/csv", "/sql", "/unique-id"],
  howItWorks: [
    "Paste a JSON Schema, Zod or Pydantic model and the batch appears beside it, rebuilt as you type. Every row is a function of the seed, the schema and the settings beside them, and nothing else, so the same seed gives the same batch byte for byte, including from a shared link. The dice draws a new seed; Rows goes up to 1,000.",
    "A schema says a field is a string, not that it is a surname, so the page reads the schema's `format` first, then the property name, then the type. `fullName`, `first_name` and `FIRST-NAME` get names; `email` an address; `postcode` a postcode for the locale; `cardNumber` a Luhn-valid number with a real issuer prefix; `iban` an IBAN whose check digits hold. A name never overrides the type: an `email` declared as a number gets a number.",
    "Rows satisfy their schema: enums, lengths, bounds, `oneOf`, `not`, `if`, `contains` and property counts are honoured, and a string is drawn from its `pattern`. Anything unmet is listed above the panes. Optional fields can be Always filled, Sometimes, or Left out.",
    "The locale sets names, cities, postcodes, phone numbers and bank details, for seven countries, Japan among them, where names come family name first; a UK postcode is a real district with letters Royal Mail allows. Hosts, URLs and email addresses sit under `example.com`, `example.net`, `example.org`, `.example` and `.test`, and IP addresses in the documentation ranges. Phone numbers use the drama ranges regulators keep in the US, the UK, Germany and France; Spain, Italy and Japan keep none, so theirs start with digits their numbering plan gives no service, which a strict validator rejects.",
    "Output is JSON, NDJSON, CSV or SQL, to copy or save as a file named after the rows. CSV and SQL give a nested object a column per leaf, `address.city` in CSV and `address_city` in SQL, and keep a list whole as JSON text.",
  ],
  examples: [
    {
      title: "Two customers from a JSON Schema",
      blocks: [
        {
          code:
            "{\n  \"title\": \"Customer\",\n  \"type\": \"object\",\n  \"properties\": {\n    \"id\": { \"type\": \"string\", \"format\": \"uuid\" },\n    \"fullName\": { \"type\": \"string\" },\n    \"email\": { \"type\": \"string\" },\n    \"reference\": { \"type\": \"string\", \"pattern\": \"^[A-Z]{3}-[0-9]{6}$\" },\n    \"balance\": { \"type\": \"number\", \"minimum\": 0, \"maximum\": 500, \"multipleOf\": 0.01 },\n    \"address\": {\n      \"type\": \"object\",\n      \"properties\": { \"city\": { \"type\": \"string\" }, \"postcode\": { \"type\": \"string\" } },\n      \"required\": [\"city\", \"postcode\"]\n    }\n  },\n  \"required\": [\"id\", \"fullName\", \"email\", \"reference\", \"balance\", \"address\"]\n}",
        },
        "With seed `utils`, 2 rows and the United Kingdom locale:",
        {
          code:
            "[\n  {\n    \"id\": \"40547d4e-1e45-4db3-876b-07ec714de539\",\n    \"fullName\": \"William Hughes\",\n    \"email\": \"jack.williams341@example.net\",\n    \"reference\": \"ZTD-446969\",\n    \"balance\": 283.25,\n    \"address\": {\n      \"city\": \"Oxford\",\n      \"postcode\": \"EH10 1LY\"\n    }\n  },\n  {\n    \"id\": \"950f8f48-f195-4413-8d53-9b19d4974d34\",\n    \"fullName\": \"Charlie Young\",\n    \"email\": \"alfie.young802@example.org\",\n    \"reference\": \"URV-398129\",\n    \"balance\": 459.79,\n    \"address\": {\n      \"city\": \"Glasgow\",\n      \"postcode\": \"SE1 6SE\"\n    }\n  }\n]",
        },
      ],
    },
    {
      title: "The same batch as SQL",
      blocks: [
        {
          code:
            "INSERT INTO \"customer\" (\"id\", \"full_name\", \"email\", \"reference\", \"balance\", \"address_city\", \"address_postcode\") VALUES ('40547d4e-1e45-4db3-876b-07ec714de539', 'William Hughes', 'jack.williams341@example.net', 'ZTD-446969', 283.25, 'Oxford', 'EH10 1LY');\nINSERT INTO \"customer\" (\"id\", \"full_name\", \"email\", \"reference\", \"balance\", \"address_city\", \"address_postcode\") VALUES ('950f8f48-f195-4413-8d53-9b19d4974d34', 'Charlie Young', 'alfie.young802@example.org', 'URV-398129', 459.79, 'Glasgow', 'SE1 6SE');",
        },
        "The table is named after the schema's title, the columns are snake_case and double-quoted, so a column called `order` cannot break the statement. There is no `CREATE TABLE`.",
      ],
    },
    {
      title: "Checking a number",
      blocks: [
        "Check mode takes a payment card, an IBAN, an ISBN, an EAN or UPC barcode or an IMEI, ignoring spaces and hyphens, and offers every format the value could be:",
        {
          table: [
            ["Number", "Result"],
            ["`4111 1111 1111 1112`", "Payment card, Visa: fails; 1 is the check digit that would hold"],
            [
              "`GB82 WEST 1234 5698 7654 33`",
              "IBAN, United Kingdom: fails; its check digits are the 82 after GB, where 55 would hold",
            ],
            ["`378282246310005`", "Payment card, American Express: valid. IMEI: also valid"],
            ["`978-0-306-40615-7`", "ISBN-13 and EAN-13 barcode: both valid"],
          ],
        },
      ],
    },
  ],
  problems: [
    {
      title: "A value that ignores its pattern",
      blocks: [
        "A pattern is drawn from if it uses the syntax people usually write: literals, classes, groups, alternation and counted repeats. A backreference, a lookaround or a word boundary cannot be generated from, so `^(a)\\1$` gives the note “The pattern ^(a)\\1$ is not one this page can generate from, so those values are ordinary text.”, and those rows will fail that pattern.",
      ],
    },
    {
      title: "A `timestamp` in the future",
      blocks: [
        "Dates come from a window around 1 January 2025 rather than from today, so a batch is the same whenever it is opened. A name that says when keeps its range under any format: `createdAt` and `updatedAt` fall in the five years before, `expiresAt` in the five after, and `birthDate` 18 to 80 years before; `format: date-time` or `date` only decides how it is written. A name such as `timestamp` lands anywhere five years either side.",
      ],
    },
    {
      title: "Empty cells in the CSV",
      blocks: [
        "With Optional fields on Sometimes, an optional key is in some rows and not others. Every key any row has gets a column, and CSV cannot tell an absent key from a null, so both are an empty cell rather than the word `null`. SQL writes `NULL`.",
      ],
    },
  ],
  faq: [
    {
      question: "Is the same seed always the same data?",
      answer:
        "Yes, with the same schema and settings. Each row is drawn from its own stream keyed by the seed and its position, so going from 10 rows to 50 leaves the first ten as they were. The generator is not cryptographic, and the UUIDs repeat with the seed; for fresh random ones use [the UUID generator](/unique-id).",
    },
    {
      question: "Are the card numbers real cards?",
      answer:
        "No. They pass the Luhn check and start with a prefix a real network uses, so a library that checks the format accepts them, but no account stands behind them. For a payment provider's sandbox, use the test numbers that provider publishes.",
    },
    {
      question: "What if the root of the schema is an array?",
      answer:
        "Then each row is one element of it: a schema for a list of customers produces customers, not lists. The SQL table and the saved file are named after the element's title or model.",
    },
  ],
  references: [
    {
      title: "JSON Schema Validation, draft 2020-12",
      url: "https://json-schema.org/draft/2020-12/json-schema-validation",
    },
    { title: "RFC 2606, Reserved Top Level DNS Names", url: "https://www.rfc-editor.org/rfc/rfc2606" },
    {
      title: "RFC 5737, IPv4 Address Blocks Reserved for Documentation",
      url: "https://www.rfc-editor.org/rfc/rfc5737",
    },
    { title: "RFC 4180, Common Format and MIME Type for CSV Files", url: "https://www.rfc-editor.org/rfc/rfc4180" },
    { title: "Stripe test card numbers", url: "https://docs.stripe.com/testing" },
  ],
} satisfies PageContent;
