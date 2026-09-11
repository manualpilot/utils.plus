import type { PageContent } from "../page-document.ts";

export default {
  related: ["/string", "/codec", "/hex", "/regex"],
  howItWorks: [
    "Every code point in the box is read into a table of character, code point, name, category and script, beside counts of code points, graphemes, UTF-16 units and UTF-8 bytes and the text in all four normal forms. Pick a row for that character's block, the version it arrived in, its decomposition, its bytes in UTF-8, UTF-16 and UTF-32, and eight escapes, from `\\u{E9}` to `%C3%A9`; escaping a whole text is the [string tool's](/string) job.",
    "The switch beside the title reads the box as code points instead and rewrites what is in it, so `Ca` becomes `U+0043 U+0061` and a list of code points becomes the text. A code point may be written `U+0041`, `0041`, `0x41`, `\\u{41}` or `&#x41;`, separated by spaces or commas; `&#65;` is the one spelling read as decimal.",
    "A Findings card appears when the text holds something a reader cannot see: bidirectional controls, lookalikes of ASCII characters, characters that draw nothing, control characters, more than one script, unassigned or private use code points, or text not in NFC. Each finding names the code points it is about.",
    "Names and properties are read from the Unicode Character Database, and emoji names from Unicode's emoji list, as published for the version the site was last built with; the mark beside the title gives the build date. The keyboard, hidden until asked for, types characters from Unicode's blocks and emoji groups at the caret.",
  ],
  examples: [
    {
      title: "The sample the page opens with",
      blocks: [
        { code: "Café ☕ \u0430pple.com" },
        "Two findings: “Characters that can be taken for ASCII”, naming U+0430, and “Written in 2 scripts”, Latin and Cyrillic. The `а` is CYRILLIC SMALL LETTER A, which its row says looks like `a` in ASCII; its UTF-8 is `D0 B0` where the Latin letter's is `61`.",
      ],
    },
    {
      title: "A list of code points written five ways",
      blocks: [
        "In Code points mode:",
        { code: "U+0048 0x69 \\u{200B} &#x21; &#233;" },
        {
          code:
            "H     U+0048  LATIN CAPITAL LETTER H\ni     U+0069  LATIN SMALL LETTER I\nZWSP  U+200B  ZERO WIDTH SPACE\n!     U+0021  EXCLAMATION MARK\né     U+00E9  LATIN SMALL LETTER E WITH ACUTE",
        },
        "The zero width space draws nothing, so its row shows the abbreviation and it is reported under “Characters that draw nothing”. Switching back to Text keeps it in the box.",
      ],
    },
    {
      title: "One emoji, every way it is stored and escaped",
      blocks: [
        { code: "😀" },
        {
          code:
            "Code point        U+1F600\nUTF-8             F0 9F 98 80\nUTF-16            D83D DE00\nUTF-32            0001F600\nJavaScript, Rust  \\u{1F600}\nJSON, Java, C#    \\uD83D\\uDE00\nC, Python         \\U0001F600\nPython name       \\N{GRINNING FACE}\nCSS               \\01F600\nHTML, XML         &#x1F600;\nURL               %F0%9F%98%80",
        },
      ],
    },
  ],
  problems: [
    {
      title: "Two strings that look identical are not equal",
      blocks: [
        "An accented letter can be stored composed, `é` as U+00E9, or decomposed, `e` followed by U+0301 COMBINING ACUTE ACCENT. Both draw the same, but `Café` is 4 code points one way and 5 the other, and they compare as different. A decomposed text gets a “Not in NFC” finding, and the Normalisation card has the NFC form to copy.",
      ],
    },
    {
      title: "A space that is not a space",
      blocks: [
        "Copied text often brings NO-BREAK SPACE, ZERO WIDTH SPACE or ZERO WIDTH NO-BREAK SPACE (the byte order mark) with it. All three are reported as drawing nothing, and the table shows them as NBSP, ZWSP and BOM. Tools disagree about them: JavaScript's `\\s` and `trim()` treat NBSP and BOM as whitespace but not ZWSP.",
      ],
    },
    {
      title: "Code that reads differently from how it runs",
      blocks: [
        "A RIGHT-TO-LEFT OVERRIDE, U+202E, reverses the display of what follows it until it is closed or the paragraph ends, while a compiler reads the characters in the order they are stored. That is the Trojan Source attack. An override or isolate that is never closed is reported as “Bidirectional controls left open”; `if (isAdmin) {` followed by U+202E and ` return` is one.",
      ],
    },
  ],
  faq: [
    {
      question: "Which version of Unicode does the page use?",
      answer:
        "Whichever the site was pinned to when it was last built, read from the Unicode Character Database and the confusables table of UTS #39; the mark beside the title gives the build date. Each character's “Since” row gives the version it was added in, and a character newer than the data shows as unassigned, with no name.",
    },
    {
      question: "What is the difference between NFC and NFKC?",
      answer:
        "NFC gives canonically equivalent text one spelling, composing a letter and its accents into one code point where one exists. NFKC also replaces compatibility characters with what they stand for: `ﬁ` becomes `fi`, `①` becomes `1` and the full-width `Ａ` becomes `A`. NFC is the form to store; NFKC loses distinctions, which suits comparing identifiers and search keys.",
    },
    {
      question: "Why does JSON escape an emoji as two `\\u` sequences?",
      answer:
        "The `\\u` escape of JSON, Java and C# is four hex digits, one UTF-16 code unit, and anything above U+FFFF takes two units, a surrogate pair. So U+1F600 is `\\uD83D\\uDE00`. JavaScript and Rust accept `\\u{1F600}` with the code point itself, and C and Python take the eight-digit `\\U0001F600`.",
    },
  ],
  references: [
    { title: "Unicode Character Database", url: "https://www.unicode.org/ucd/" },
    { title: "UAX #15: Unicode Normalization Forms", url: "https://www.unicode.org/reports/tr15/" },
    { title: "UTS #39: Unicode Security Mechanisms", url: "https://www.unicode.org/reports/tr39/" },
    { title: "UAX #9: Unicode Bidirectional Algorithm", url: "https://www.unicode.org/reports/tr9/" },
    { title: "Trojan Source: Invisible Vulnerabilities", url: "https://trojansource.codes/" },
  ],
} satisfies PageContent;
