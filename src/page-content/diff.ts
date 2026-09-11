import type { PageContent } from "../page-document.ts";

export default {
  related: ["/json", "/config", "/string", "/markdown"],
  howItWorks: [
    "Put the original text in the left pane and the changed text in the right, then press Diff. Nothing is compared until you ask, and typing in either pane afterwards clears the marks, since they describe text that is no longer there. Swap exchanges the two documents as an ordinary edit, so Ctrl+Z undoes it.",
    "The comparison runs twice. The first pass is Myers' algorithm over whole lines, the algorithm GNU `diff` is built on and Git's default: it finds the fewest lines to delete and insert, tints removed lines red on the left and added lines green on the right, and counts both. The second pass pairs the first removed line of each block of changes with its first added line, the second with the second, and compares each pair again by words, runs of whitespace and single punctuation marks. That is what puts the mark on `30` and `45` rather than on the whole line.",
    "Word marks are left off a pair with less than 35 per cent of its characters in common, because the pairing was then only by position, and off lines longer than 2,000 characters. Two documents that would need more than 2,000 lines deleted or inserted to align are not aligned at all: everything between the matching first and last lines is marked, and the summary says so.",
    "Both documents and the language chosen for colouring are kept in the page's address, so a copied link reopens the same comparison with its marks.",
  ],
  examples: [
    {
      title: "A changed setting and a new one",
      blocks: [
        { code: "timeout = 30\nretries = 3\nhost = \"db.internal\"" },
        { code: "timeout = 45\nretries = 3\nhost = \"db.example.com\"\nlog = \"debug\"" },
        {
          code:
            "2 lines removed, 3 lines added\n\nOriginal, line 1: 30\nOriginal, line 3: internal\nChanged, line 1: 45\nChanged, line 3: example.com\nChanged, line 4: the whole line, no words marked",
        },
        "The new `log` line has no removed line opposite it, so it is tinted green with no words picked out.",
      ],
    },
    {
      title: "An argument added to a function",
      blocks: [
        {
          code:
            "function total(items) {\n  let sum = 0;\n  for (const item of items) sum += item.price;\n  return sum;\n}",
        },
        {
          code:
            "function total(items, tax) {\n  let sum = 0;\n  for (const item of items) sum += item.price * item.qty;\n  return sum * (1 + tax);\n}",
        },
        {
          code:
            "3 lines removed, 3 lines added\n\nChanged, line 1: \", tax\"\nChanged, line 3: \" * item.qty\"\nChanged, line 4: \" * (1 + tax)\"",
        },
        "The three lines on the left are tinted but carry no word marks, because nothing was taken out of them: every change is an insertion.",
      ],
    },
    {
      title: "A moved line",
      blocks: [
        { code: "moved\na\nb\nc" },
        { code: "a\nb\nc\nmoved" },
        "Reported as “1 line removed, 1 line added”: `moved` is marked on line 1 of the original and line 4 of the changed text, and the three lines between are left alone. A line diff has no notion of a move, only of a deletion in one place and an insertion in another.",
      ],
    },
  ],
  problems: [
    {
      title: "Two files that differ only in line endings",
      blocks: [
        "The editors read `\\r\\n`, `\\r` and `\\n` all as the end of a line, so a Windows file and its Unix copy come out as “The documents are identical”. A byte-level comparison still sees them differ; open both in [the hex viewer](/hex) and look for `0d 0a` against `0a`.",
      ],
    },
    {
      title: "Changes in whitespace you cannot see",
      blocks: [
        "There is no option to ignore whitespace. `value` against `value` followed by three spaces is a changed line with the three spaces tinted, and a tab replaced by four spaces marks both. Re-indenting a file marks every line it touched.",
      ],
    },
    {
      title: "A changed line with no word marks",
      blocks: [
        "Lines are paired by position within a block of changes, so a line inserted just above an edited one throws the pairing off. With `old line here` changed to `old line there` and a new line added above it, the old line is paired with the inserted one, which has too little in common to mark, and `old line there` is left with no partner, so neither change is pointed at within its line.",
      ],
    },
    {
      title: "Minified files",
      blocks: [
        "A minified file is one very long line, so it is marked as a whole and never word by word. Pretty-print both copies first, for JSON with [the JSON formatter](/json), and the changes land on lines of their own.",
      ],
    },
  ],
  faq: [
    {
      question: "Why don't the marks update as I type?",
      answer:
        "They describe the two documents as they were when Diff was pressed. Any edit clears them on both sides, rather than leaving marks that point at text which has since moved, and pressing Diff again compares what is there now.",
    },
    {
      question: "Can it ignore whitespace or letter case?",
      answer:
        "No. Every character counts, including trailing spaces and the difference between a tab and spaces, which are tinted like any other change. Normalise both texts first if those differences are noise to you.",
    },
    {
      question: "Does the language setting change the comparison?",
      answer:
        "No. It only adds syntax colouring to both panes. The comparison is the same text-based line and word diff in every language.",
    },
    {
      question: "How large can the documents be?",
      answer:
        "There is no fixed size. What is capped is the work: if aligning them would take more than 2,000 lines deleted or inserted, the page marks the whole differing middle instead, and lines over 2,000 characters get no word marks. Long files with a few changes are compared in full.",
    },
  ],
  references: [
    {
      title: "Eugene W. Myers, An O(ND) Difference Algorithm and Its Variations (1986)",
      url: "https://link.springer.com/article/10.1007/BF01840446",
    },
    {
      title: "James Coglan, The Myers diff algorithm",
      url: "https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/",
    },
    { title: "GNU diffutils manual", url: "https://www.gnu.org/software/diffutils/manual/diffutils.html" },
    {
      title: "CodeMirror EditorState.lineSeparator",
      url: "https://codemirror.net/docs/ref/#state.EditorState^lineSeparator",
    },
  ],
} satisfies PageContent;
