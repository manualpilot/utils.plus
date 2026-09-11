import type { PageContent } from "../page-document.ts";

export default {
  related: ["/json", "/config", "/sql", "/mock", "/diff"],
  howItWorks: [
    "A dropped or chosen file is read into the text pane, exactly as if it had been pasted, and Ctrl+Z takes it back out. The table is read from that text and follows each edit a moment later; the switch in the title row shows both, or either alone.",
    "With Delimiter on Auto the page parses the start of the document under comma, semicolon, tab and pipe, and keeps the one that splits the first 20 records into the same number of fields, two or more. An even split beats an uneven one, and the widest even split wins. Colon is in the list but never guessed. A first line such as `sep=;`, which Excel writes and reads to declare the delimiter, settles it without a guess and is not read as a row. The line above the table says what it decided.",
    "Parsing follows RFC 4180, with any delimiter in place of the comma: a quoted field can hold the delimiter, a line break, or a quote written twice (`\"27\"\" Monitor\"`). CRLF and LF both end a record and blank lines are skipped. Columns are positions rather than names, so two columns with the same title both appear, and a row wider than the header gets a heading such as `Column 4` instead of being cut off.",
    "Clicking a heading sorts the table by that column. Two cells that are both numbers compare as numbers and anything else compares as text in your browser's locale, so `9.99` comes before `12.50`. Sorting reorders the table and never the text. Files up to 8 MB are read; the table draws the first 1,000 rows, and the count above it covers all of them.",
  ],
  examples: [
    {
      title: "A semicolon export with decimal commas",
      blocks: [
        { code: "name;price;stock\n\"Cable; USB-C\";12,50;4\nMouse;24,95;12\nKeyboard;9,99;0" },
        "Auto settles on the semicolon, since the comma splits the header into one field, and reports “3 rows, 3 columns, split on semicolon.” The quoted semicolon stays inside its field:",
        {
          table: [
            ["name", "price", "stock"],
            ["Cable; USB-C", "12,50", "4"],
            ["Mouse", "24,95", "12"],
            ["Keyboard", "9,99", "0"],
          ],
        },
      ],
    },
    {
      title: "A line break inside a field",
      blocks: [
        { code: "id,note\n1,\"first line\nsecond line\"\n2,plain" },
        "Four lines of text are 2 rows and 2 columns. The first note holds both lines; the editor's line numbers count lines, and the table counts records.",
      ],
    },
    {
      title: "Rows of different widths",
      blocks: [
        { code: "a,b,c\n1,2\n3,4,5,6" },
        "The widest row sets the width: 2 rows and 4 columns, the fourth headed `Column 4`, with the warning “1 row is not as wide as the widest one.”",
      ],
    },
  ],
  problems: [
    {
      title: "A space before the opening quote",
      blocks: [
        "A quote only opens a quoted field when it is the field's first character. In `1, \"Smith, John\"` the second field starts with a space, so the quote is an ordinary character and the comma inside it splits the name: the row reads as `1`, ` \"Smith` and ` John\"`, and a `Column 3` appears. Remove the space after the delimiter.",
      ],
    },
    {
      title: "A quote left open",
      blocks: [
        "An unmatched quote takes everything after it into one field, so `1,\"Ada` followed by a line `2,Grace` is one row, not two. The table is still drawn, with the warning “A quote is left open, so the rest of the document is one field.”",
      ],
    },
    {
      title: "Numbers with a decimal comma sort as text",
      blocks: [
        "`12,50` is not a number to the sorter, so the price column in the first example sorts as text: `12,50`, `24,95`, `9,99`. So does `1,200`. The stock column, in plain digits, sorts as `0`, `4`, `12`.",
      ],
    },
    {
      title: "An invisible first character",
      blocks: [
        "Some programs begin a UTF-8 file with a byte order mark, U+FEFF; Excel's “CSV UTF-8” format is one. A reader that keeps it glues it to the first heading, which then looks like `id` and does not equal it. This page drops it before reading.",
      ],
    },
  ],
  faq: [
    {
      question: "Why is the colon never picked automatically?",
      answer:
        "A column of times such as `12:00:01` splits into three fields on every row, which looks exactly like a real delimiter. Choose Colon from the Delimiter list when the file really uses it.",
    },
    {
      question: "Does sorting change the file?",
      answer:
        "No. Sorting reorders a copy of the rows for the table; the text keeps its own order. Changing the delimiter or the header switch clears the sort, since the columns it referred to may no longer exist.",
    },
    {
      question: "Where can I get a CSV file to test with?",
      answer:
        "The [mock data generator](/mock) builds rows from a JSON Schema, Zod or Pydantic model and writes them as CSV with RFC 4180 quoting and CRLF line endings, from a seed, so the same file can be made again.",
    },
  ],
  references: [
    {
      title: "RFC 4180, Common Format and MIME Type for CSV Files",
      url: "https://www.rfc-editor.org/rfc/rfc4180",
    },
    { title: "Model for Tabular Data and Metadata on the Web, W3C", url: "https://www.w3.org/TR/tabular-data-model/" },
    {
      title: "text/tab-separated-values, IANA media type",
      url: "https://www.iana.org/assignments/media-types/text/tab-separated-values",
    },
    { title: "UTF-8, UTF-16, UTF-32 and BOM, Unicode FAQ", url: "https://www.unicode.org/faq/utf_bom.html" },
  ],
} satisfies PageContent;
