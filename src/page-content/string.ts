import type { PageContent } from "../page-document.ts";

export default {
  related: ["/unicode", "/regex", "/codec", "/diff"],
  howItWorks: [
    "The output follows as you type, and the arrow between the boxes makes it the next input, so trimming, sorting and wrapping one text is three clicks rather than three pastes. Both boxes are counted: characters, graphemes where they differ, characters without spaces, words, lines and UTF-8 bytes.",
    "The five identifier cases rebuild each line from its words. A run of capitals is an acronym up to the capital that starts the next word, so `XMLHttpRequest` is three words, and a run of digits is a word of its own. Whatever sat between the words is dropped. Title and sentence case only change letters, and the headline variant keeps short words such as `of` and `the` lowercase unless they come first or last. A colon, question mark or exclamation mark starts a phrase with a first and last word of its own, so `a tale of two cities: the story so far` becomes `A Tale of Two Cities: The Story so Far`.",
    "The line operations read `\\r\\n`, `\\r` or `\\n`, write `\\n`, and leave a final newline at the end rather than sorting it as an empty line. The Lines count agrees, so `a`, `b` and a final newline count as 2 lines. Sorting uses English collation whatever the browser's language, so a shared link sorts the same way anywhere. Reversing characters goes by grapheme.",
    "JavaScript and C escaping give the body alone, with both quotes escaped (and the backtick, for JavaScript), so it fits between whichever you write. The shell and SQL give the quoted word, because there the quotes are the escaping. HTML decoding reads numeric references from 128 to 159 as Windows-1252, as browsers do.",
  ],
  examples: [
    {
      title: "A column of names in snake_case",
      blocks: [
        { code: "XMLHttpRequest\nuser id\nutf8Decoder\nparse-JSON-response" },
        { code: "xml_http_request\nuser_id\nutf_8_decoder\nparse_json_response" },
        "Each line is converted on its own; camelCase gives `xmlHttpRequest`, `userId`, `utf8Decoder` and `parseJsonResponse`.",
      ],
    },
    {
      title: "One string, three kinds of quoting",
      blocks: [
        { code: "it's $HOME" },
        "Shell word with single quotes, shell word with double quotes, and SQL string, standard:",
        { code: "'it'\\''s $HOME'\n\"it's \\$HOME\"\n'it''s $HOME'" },
        "Inside single quotes nothing is special, so the quote itself closes the string, is escaped, and reopens it. Inside double quotes it is the `$` that needs escaping.",
      ],
    },
    {
      title: "Counting and reversing a decomposed letter and a flag",
      blocks: [
        { code: "noe\u0308l 🇬🇧" },
        "Here the diaeresis is a separate combining mark, U+0308. The counts read 8 characters, 6 graphemes and 15 bytes, and reversing the characters gives:",
        { code: "🇬🇧 le\u0308on" },
        "The mark stays on its `e` and the flag's two regional indicators stay together. The [Unicode inspector](/unicode) lists all eight code points.",
      ],
    },
  ],
  problems: [
    {
      title: "The count disagrees with `length`",
      blocks: [
        "JavaScript's `length` counts UTF-16 code units. The page counts code points as characters, and graphemes too when the two differ. `👍🏽` has a `length` of 4, is 2 characters, 1 grapheme and 8 bytes. A column limited in bytes wants the UTF-8 figure, and a limit someone reads on screen wants graphemes.",
      ],
    },
    {
      title: "An acronym does not survive the round trip",
      blocks: [
        "Converting rebuilds a name from its words and forgets how they were capitalised, so `XMLHttpRequest` to snake_case and back to PascalCase is `XmlHttpRequest`. Likewise `utf8` becomes `utf_8`, because digits are a word of their own.",
      ],
    },
    {
      title: "`file10` sorts before `file9`",
      blocks: [
        "A to Z compares character by character and `1` comes before `9`. Natural (10 after 9) reads runs of digits as numbers: `file1.txt`, `File2.txt`, `file9.txt`, `file10.txt`. Case and accents only break ties, so `apple` sorts next to `Apple` and `Éclair` among the other words starting with `e`.",
      ],
    },
    {
      title: "A MySQL-escaped string breaks elsewhere",
      blocks: [
        "The MySQL variant writes a quote as `\\'` and a backslash as `\\\\`. PostgreSQL, with its default `standard_conforming_strings`, and SQLite treat a backslash as an ordinary character, so there `\\'` ends the string. The standard variant doubles the quote, `'it''s'`, and leaves backslashes alone.",
      ],
    },
  ],
  faq: [
    {
      question: "Why does the C escape use octal rather than hex?",
      answer:
        "Because a C hex escape takes as many hex digits as follow it, so `\\xE9` followed by the letter `a` is read as one escape that overflows a byte. Octal escapes stop after three digits. With the non-ASCII variant, `é` becomes its two UTF-8 bytes, `\\303\\251`, and unescaping reads them back as one letter.",
    },
    {
      question: "Why does sentence case lowercase names?",
      answer:
        "It lowercases the whole line and capitalises the first letter of each sentence, and it has no way to know that `London` or `I` should keep their capitals. Proper nouns and acronyms need putting back by hand afterwards.",
    },
    {
      question: "What does the URL slug do with letters that have no accent to strip?",
      answer:
        "It spells them out. Accents are removed by decomposing the text and dropping the marks, but letters like `ß`, `æ`, `ø` and `þ` do not decompose, so they are written as `ss`, `ae`, `o` and `th`. `Straße & Café: Größe 2.0!` becomes `strasse-cafe-grosse-2-0`.",
    },
  ],
  references: [
    { title: "UAX #29: Unicode Text Segmentation", url: "https://www.unicode.org/reports/tr29/" },
    {
      title: "ECMAScript: String literals",
      url: "https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html#sec-literals-string-literals",
    },
    {
      title: "POSIX Shell Command Language: Quoting",
      url: "https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_02",
    },
    {
      title: "MySQL 8.4 Reference Manual: String Literals",
      url: "https://dev.mysql.com/doc/refman/8.4/en/string-literals.html",
    },
    {
      title: "HTML Standard: Named character references",
      url: "https://html.spec.whatwg.org/multipage/named-characters.html",
    },
  ],
} satisfies PageContent;
