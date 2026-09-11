import type { PageContent } from "../page-document.ts";

export default {
  related: ["/schema", "/config", "/diff", "/csv", "/mock"],
  howItWorks: [
    "Most formatters run the text through `JSON.parse` and `JSON.stringify`. That is how `12345678901234567890` becomes `12345678901234567000`, `1.0` becomes `1`, a second `\"tag\"` key replaces the first, and keys that look like integers jump to the front. This page reads the document into a syntax tree instead and prints every number, string and key back as it was written, so Format, Minify and Sort Keys change the layout and nothing else.",
    "Edit mode has the toolbar: Format at 2, 4 or 8 spaces, Sort Keys, Minify, Escape, Unescape, a Transform menu with Repair, Expand embedded JSON and the JSON Lines conversions, and a Fold menu. Each action answers in the bar under the editor, and one that cannot run says why and where. The bar also shows the JSONPath of the caret, and a count of keys or elements sits beside every brace.",
    "Query mode puts a JSONPath box above the document and the matches beside it, as values or as normalised paths. The language is RFC 9535, filters and its five functions included, and it runs over the same tree, so a name selector returns every entry under a duplicated key.",
    "For JSON Lines, one value per line, Array to JSON Lines writes each element minified on its own line and JSON Lines to array reads them back. Minify and Sort Keys work line by line; Format refuses, since a value spread over several lines is no longer JSON Lines.",
  ],
  examples: [
    {
      title: "A long ID and a repeated key",
      blocks: [
        { code: "{\"id\": 12345678901234567890, \"price\": 1.0, \"tag\": \"a\", \"tag\": \"b\"}" },
        "Format at 2 spaces keeps all four entries as written:",
        { code: "{\n  \"id\": 12345678901234567890,\n  \"price\": 1.0,\n  \"tag\": \"a\",\n  \"tag\": \"b\"\n}" },
        "`JSON.stringify(JSON.parse(text), null, 2)` rounds the ID, drops the decimal point and loses the first tag:",
        { code: "{\n  \"id\": 12345678901234567000,\n  \"price\": 1,\n  \"tag\": \"b\"\n}" },
      ],
    },
    {
      title: "Repairing a hand-written object",
      blocks: [
        {
          code:
            "{\n  // exported from a config\n  name: 'Ada',\n  tags: ['maths', 'engines',],\n  active: True,\n  ratio: NaN,\n}",
        },
        {
          code:
            "{\n  \"name\": \"Ada\",\n  \"tags\": [\n    \"maths\",\n    \"engines\"\n  ],\n  \"active\": true,\n  \"ratio\": null\n}",
        },
        "The status bar lists what changed: 1 comment removed, 2 trailing commas removed, 3 single-quoted strings requoted, 4 bare keys quoted, 1 Python or JavaScript literal replaced, 1 non-finite number made null.",
      ],
    },
    {
      title: "Filtering with JSONPath",
      blocks: [
        {
          code:
            "{\n  \"store\": {\n    \"book\": [\n      { \"title\": \"Sayings of the Century\", \"price\": 8.95 },\n      { \"title\": \"Sword of Honour\", \"price\": 12.99 },\n      { \"title\": \"Moby Dick\", \"price\": 8.99 }\n    ]\n  }\n}",
        },
        "`$.store.book[?@.price < 10].title` finds 2 matches. With Result set to Paths:",
        { code: "[\n  \"$['store']['book'][0]['title']\",\n  \"$['store']['book'][2]['title']\"\n]" },
      ],
    },
  ],
  problems: [
    {
      title: "Trailing commas and comments",
      blocks: [
        "JSON allows neither, so `{\"a\": 1,}` stops Format with “Not valid JSON at line 1, column 9”, the brace the comma was waiting for. JSONC, which VS Code's `settings.json` is written in, and JSON5 allow both; Repair removes them.",
      ],
    },
    {
      title: "Single quotes, bare keys and Python's `True`",
      blocks: [
        "A JavaScript object literal or a Python `repr` looks like JSON and is not. Repair requotes the strings, quotes bare keys, reads `0xFF` as `255`, and turns `True`, `None` and `undefined` into `true` and `null`. `NaN` and `Infinity` have no JSON spelling and become `null`, which changes the value and is listed separately. A Python tuple stops the repair at its bracket.",
      ],
    },
    {
      title: "Integers above 2^53",
      blocks: [
        "A JavaScript number is a double, so `JSON.parse(\"9007199254740993\")` gives `9007199254740992`. RFC 8259 only promises that integers within ±(2^53-1) are read alike everywhere. This page keeps every digit, but whatever reads the result next may still round it; an ID sent as a string is safe.",
      ],
    },
    {
      title: "A duplicate key only some tools see",
      blocks: [
        "RFC 8259 says names SHOULD be unique and leaves a repeat to the parser, and `JSON.parse` silently keeps the last. Here both stay visible, Sort Keys puts them side by side in their written order, and a query for the name returns both.",
      ],
    },
  ],
  faq: [
    {
      question: "Does Repair guess at missing brackets?",
      answer:
        "No. A truncated document or an unclosed string is reported with its place: `{\"a\": [1, 2` gives “Could not repair: the document ends before its \"]\" at line 1, column 12”. Closing brackets until something parses would produce a document nobody wrote.",
    },
    {
      question: "How does Sort Keys order the keys?",
      answer:
        "By character code, at every depth, so digits come before capitals and capitals before lower case: `\"Zeta\"` sorts ahead of `\"alpha\"`. Arrays keep their order, and two entries with the same name stay in the order they were written.",
    },
    {
      question: "What is Expand embedded JSON for?",
      answer:
        "A log line or webhook often carries an object stored as a string. Expand opens every string that holds an object or an array, however deep, and leaves `\"42\"` and `\"true\"` alone, since unquoting those would change their type. Escape and Unescape go the other way, turning the whole document into one string and back.",
    },
    {
      question: "Can it check the document against a schema?",
      answer:
        "No; the editor only checks that it is JSON. The [schema validator](/schema) takes a JSON Schema, Zod or Pydantic model and marks each fault in the payload.",
    },
  ],
  references: [
    { title: "RFC 8259, The JSON Data Interchange Format", url: "https://www.rfc-editor.org/rfc/rfc8259" },
    { title: "RFC 9535, JSONPath: Query Expressions for JSON", url: "https://www.rfc-editor.org/rfc/rfc9535" },
    { title: "JSON Lines", url: "https://jsonlines.org/" },
    { title: "The JSON5 Data Interchange Format", url: "https://spec.json5.org/" },
    { title: "RFC 7493, The I-JSON Message Format", url: "https://www.rfc-editor.org/rfc/rfc7493" },
  ],
} satisfies PageContent;
