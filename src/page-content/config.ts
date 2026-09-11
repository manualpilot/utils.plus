import type { PageContent } from "../page-document.ts";

export default {
  related: ["/json", "/schema", "/diff", "/csv"],
  howItWorks: [
    "Choose a From and a To format and press Convert. Each of the five formats is read into one plain tree of objects, lists, strings, numbers, booleans and nulls and written back out of it, so any format converts to any other. Comments, YAML anchors and the original layout are not part of that tree and do not survive; the values do. YAML and JSON are written at 2, 4 or 8 spaces.",
    "Every format keeps its own document, so picking a different From format shows that format's text, and Swap turns the conversion round. A result pane with anything in it asks before it is written over, and the editor's undo still has the old text.",
    "`.env` and `.properties` are flat, so a path is spelled in the key: `database__host` in a `.env`, `database.host` in `.properties`, and `replicas__0`, `replicas__1` for the elements of a list. Reading back, keys numbered from zero become a list again. Keys keep the case they were written in.",
    "A flat file holds only text, so its values are typed on the way in. `true`, `false` and `null` get their meaning, and text becomes a number only when it spells the same number back: `5432` is a number, while `1.0`, `007` and `1e3` stay strings. A quoted `.env` value is always a string, and a string that would read back as something else is quoted on the way out.",
    "What the target cannot hold is named, not dropped quietly. TOML has no null and no integer wider than 64 bits, and a flat file has nowhere to put an empty `{}` or `[]`, so the warning lists every path that was left out. A document that is a single value cannot become TOML, `.env` or `.properties` at all, and TOML cannot take a list either.",
  ],
  examples: [
    {
      title: "YAML to .env",
      blocks: [
        {
          code:
            "database:\n  host: localhost\n  port: 5432\n  replicas:\n    - eu-west-1\n    - us-east-1\ndebug: false",
        },
        {
          code:
            "database__host=localhost\ndatabase__port=5432\ndatabase__replicas__0=eu-west-1\ndatabase__replicas__1=us-east-1\ndebug=false",
        },
        "Converted back to YAML, the same `.env` gives the original document, the list included.",
      ],
    },
    {
      title: "Types read out of a .env",
      blocks: [
        {
          code:
            "export PORT=8080\nDEBUG=false\nVERSION=1.0\nZIP=\"02134\"\nAPI_KEY=abc123 # rotated monthly\nDATABASE__HOST=localhost",
        },
        {
          code:
            "{\n  \"PORT\": 8080,\n  \"DEBUG\": false,\n  \"VERSION\": \"1.0\",\n  \"ZIP\": \"02134\",\n  \"API_KEY\": \"abc123\",\n  \"DATABASE\": {\n    \"HOST\": \"localhost\"\n  }\n}",
        },
        "`1.0` stays a string because as a number it would print as `1`, and the quotes keep the ZIP code's leading zero.",
      ],
    },
    {
      title: "A null on its way to TOML",
      blocks: [
        { code: "{\"name\": \"api\", \"timeout\": null, \"hosts\": [\"a\", null]}" },
        { code: "name = \"api\"" },
        "The warning says “Nothing was written for timeout, hosts.” The whole list goes, not only its null, since removing one element would renumber the rest.",
      ],
    },
  ],
  problems: [
    {
      title: "`no` in YAML",
      blocks: [
        "The page reads YAML 1.2, where only `true` and `false` are booleans, so `country: no` is the string `\"no\"`. YAML 1.1 readers, PyYAML among them, take `no`, `yes`, `on` and `off` as booleans, `01234` as octal 668 and `12:30` as 750. So the YAML the page writes quotes every string a 1.1 reader would take for something else: the JSON string `\"no\"` is written as `country: \"no\"`, which both versions read as a string. Even in 1.2, `version: 1.10` is the number 1.1.",
      ],
    },
    {
      title: "Tabs in YAML",
      blocks: [
        "YAML indents with spaces only. A tab at the start of a line stops the conversion with “Tabs are not allowed as indentation” and the line and column it was found at.",
      ],
    },
    {
      title: "A TOML key after a table header",
      blocks: [
        "Every key after `[server]` belongs to that table until the next header, so a `name = \"x\"` meant for the top level but written below it is read as `server.name`. The page writes plain keys before any table for that reason, so a document can come back from TOML in a different order.",
      ],
    },
    {
      title: "TOML dates turn into strings",
      blocks: [
        "TOML is the only format here with a date type. `released = 1979-05-27` arrives as the string `\"1979-05-27\"`, and a time gains milliseconds: `1979-05-27T07:32:00Z` becomes `\"1979-05-27T07:32:00.000Z\"`. Written back to TOML, it is a quoted string rather than a date.",
      ],
    },
  ],
  faq: [
    {
      question: "Why does a .env use `__` for nesting?",
      answer:
        "A single underscore is already inside names like `DATABASE_URL`, so splitting on it would break them in two. The double underscore is the separator .NET's configuration reads from environment variables.",
    },
    {
      question: "Why does a .properties value come back as a number?",
      answer:
        "`.properties` has no quoting, so `port=5432` cannot say whether it was a string. The page reads it as a number. A `.env` can quote a value to keep it a string.",
    },
    {
      question: "What happens to a very large integer?",
      answer:
        "Every digit is kept. A JavaScript number cannot hold every integer past 2^53, so `JSON.parse` alone would turn `12345678901234567890` into `12345678901234567000`; the page reads such an integer exactly out of all five formats and writes it back digit for digit. TOML's integers are 64-bit, so one past 9223372036854775807 cannot become TOML and is named in the warning like a null.",
    },
  ],
  references: [
    { title: "YAML 1.2.2 specification", url: "https://yaml.org/spec/1.2.2/" },
    { title: "TOML v1.0.0", url: "https://toml.io/en/v1.0.0" },
    {
      title: "java.util.Properties, Java SE 21 API",
      url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Properties.html",
    },
    {
      title: "Configuration in ASP.NET Core: environment variables",
      url: "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/",
    },
    { title: "RFC 8259, The JSON Data Interchange Format", url: "https://www.rfc-editor.org/rfc/rfc8259" },
  ],
} satisfies PageContent;
