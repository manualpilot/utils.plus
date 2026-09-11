import type { PageContent } from "../page-document.ts";

export default {
  related: ["/string", "/javascript", "/unicode", "/python"],
  howItWorks: [
    "The pattern goes between the slashes and the flags are the chips beneath it. The slashes and flag letters are drawn by the page, so what you type is the pattern alone, on one line. Every match in the text below is tinted, each capturing group in a colour of its own, with a legend naming the groups.",
    "The search is the browser's own `RegExp`, so it is JavaScript's flavour exactly as your code will run it, run in a background worker so that a slow pattern cannot freeze the page. The explanation comes from a separate parser that takes the pattern apart line by line: each group with its number and name, each quantifier with its range and whether it is greedy or lazy, each class and escape in words. When the pattern will not compile, the engine's error is shown and nothing is painted.",
    "All eight flags are offered: `g`, `i`, `m`, `s`, `u`, `v`, `y` and `d`. The `u` and `v` flags cannot be combined, so turning one on turns the other off. A search stops at 5,000 matches and says so.",
  ],
  examples: [
    {
      title: "Dates with named groups",
      blocks: [
        "The pattern the page opens with, with `g` set, against its four sample lines:",
        { code: "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})" },
        "Three matches: `2024-01-15`, `2024-02-29` and `2025-12-31`, with `20240115` on the third line left alone for having no hyphens. The explanation begins:",
        {
          code:
            "(?<year>\\d{4})  Capturing group 1, named year\n  \\d{4}  Repeat exactly 4 times — greedy, giving back only if the rest fails\n    \\d  A digit — 0 to 9\n-  Literal character",
        },
      ],
    },
    {
      title: "Greedy, lazy and a negated class",
      blocks: [
        { code: "<b>bold</b> and <i>italic</i>" },
        "Three patterns against that line, with `g` set:",
        {
          code:
            "<.+>     1 match    <b>bold</b> and <i>italic</i>\n<.+?>    4 matches  <b>  </b>  <i>  </i>\n<[^>]+>  4 matches  <b>  </b>  <i>  </i>",
        },
        "The greedy `.+` runs to the end of the line and gives back characters only until a `>` follows. The lazy `.+?` takes as little as it can. The negated class finds the same four without backtracking at all, since it cannot run past a `>` in the first place.",
      ],
    },
    {
      title: "An emoji is two characters without `u`",
      blocks: [
        "`^.$` against `😀` finds no matches: without a Unicode flag the engine reads UTF-16 code units, and U+1F600 is two of them. With `u` or `v` set it finds 1 match, the emoji.",
      ],
    },
  ],
  problems: [
    {
      title: "The search is stopped because the pattern backtracks too much",
      blocks: [
        "Catastrophic backtracking. `^(a+)+$` against a run of `a` ending in `!` fails only after trying every way of dividing the run between the two quantifiers, and that number doubles with each `a`. The search runs in a worker of its own, so the page and its editors keep working while it runs; after a second it is stopped, nothing is highlighted, and the page says the pattern backtracks too much on this text. A server has no such limit and would hang on it. Nested quantifiers over the same characters are the thing to remove; `^a+$` gives the same answer at once.",
      ],
    },
    {
      title: "`^` and `$` match nothing in a multi-line text",
      blocks: [
        "Without `m` they match only at the very start and end of the text, so `^\\w+$` against `one` and `two` on separate lines finds nothing; with `m` it finds both. Likewise `.` stops at a line break unless `s` is set, and without `g` or `y` the search stops at the first match.",
      ],
    },
    {
      title: "A pattern from Python or PCRE does not work",
      blocks: [
        "JavaScript has no Python-style named group, possessive quantifier or atomic group, so none of these compiles:",
        { code: "(?P<year>\\d{4})\na++\n(?>a+)" },
        "A JavaScript named group drops the `P`. Worse is `\\A`: without `u` it is an escaped `A`, so `\\Aabc` matches the text `Aabc`. With `u` or `v` set it is an error instead, which is one reason to set one.",
      ],
    },
  ],
  faq: [
    {
      question: "How do I use the pattern in code?",
      answer:
        "Write it between slashes with the flags after, `/\\d{4}-\\d{2}/g`, or pass it as a string, `new RegExp(\"\\\\d{4}-\\\\d{2}\", \"g\")`, where every backslash is doubled because the string literal consumes one. The box takes the pattern as it would appear between the slashes, so paste from a literal, not from a string.",
    },
    {
      question: "What is the difference between the u and v flags?",
      answer:
        "Both read the pattern by code point and allow `\\p{…}` property escapes. The `v` flag adds set operations inside classes: `[\\p{L}--[a-z]]` is any letter except `a` to `z`, and `&&` intersects. A pattern cannot have both, which is why the chips treat them as one switch.",
    },
    {
      question: "Why does the count include matches I cannot see?",
      answer:
        "A pattern that can match nothing, such as `x*`, matches the empty string at every position where there is no `x`: against `ab` with `g` that is 3 matches. They are counted, but an empty match has no text to tint.",
    },
    {
      question: "Can I test Python regular expressions here?",
      answer:
        "No. The engine is the browser's JavaScript one, and Python's `re` differs in syntax and in details such as named groups. The [Python page](/python) runs Python and its standard library in the browser, where `re` can be tried directly.",
    },
  ],
  references: [
    {
      title: "MDN: Regular expressions",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions",
    },
    {
      title: "MDN: RegExp",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp",
    },
    {
      title: "ECMAScript: RegExp objects",
      url: "https://tc39.es/ecma262/multipage/text-processing.html#sec-regexp-regular-expression-objects",
    },
    { title: "ReDoS, Wikipedia", url: "https://en.wikipedia.org/wiki/ReDoS" },
    { title: "regexpp, the parser behind the explanation", url: "https://github.com/eslint-community/regexpp" },
  ],
} satisfies PageContent;
