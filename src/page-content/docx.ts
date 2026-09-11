import type { PageContent } from "../page-document.ts";

export default {
  related: ["/markdown", "/hex", "/diff", "/image"],
  howItWorks: [
    "Choose or drop a Word document of up to 64 MB, a `.docx`, `.docm`, `.dotx` or `.dotm`, or start a New document. The file is read in the tab and never sent anywhere, which is the point of opening somebody's contract here rather than in a converter that uploads it.",
    "A document opens to be read. The View and Edit switch beside the title makes it writable, and the editor has the controls Word users expect, from styles and fonts to tables, images and page setup. The engine is docx-editor, which reads the package into a tree, lays it out as pages and writes the tree back.",
    "Download writes the document out under the title shown in its title bar and the extension it arrived with. Parts of the package the editor has no model of are carried through a save unchanged, and the fonts a document names are still the names in the saved file.",
    "Word's own fonts come with Windows and Office under licences that do not let a website serve them, so a document is drawn and measured in seven that can be. Calibri, Cambria, Times New Roman, Arial and Courier New become Carlito, Caladea and Liberation Serif, Sans and Mono, drawn to the same character widths, so lines and pages break where Word breaks them. Other fonts get the nearest served face: Georgia becomes Caladea, Helvetica Liberation Sans, Consolas Liberation Mono, and Futura TeX Gyre Adventor. Anything else, Aptos included, is drawn in Roboto, which a new document starts in too. Symbol fonts and other scripts are left to the browser. The Fonts button lists what became of each.",
  ],
  examples: [
    {
      title: "What the Fonts list says about a letter",
      blocks: [
        "A document with its body in Calibri, headings in Calibri Light, a quotation in Georgia, a code sample in Consolas and a tick from Wingdings lists:",
        {
          table: [
            ["Font", "Drawn in"],
            ["Calibri", "Carlito, with the same widths"],
            ["Calibri Light", "Carlito, the closest served here"],
            ["Georgia", "Caladea, the closest served here"],
            ["Consolas", "Liberation Mono, the closest served here"],
            ["Wingdings", "Left to your browser"],
          ],
        },
        "Only the first line keeps Word's line breaks exactly. Calibri Light is read past its weight to Calibri, and Carlito is close to it without being built to its widths.",
      ],
    },
    {
      title: "Files that look like Word documents and are not",
      blocks: [
        "A `.docx` is a zip, so the page reads the first bytes and, for a zip, the names inside it, before the editor is asked. What it says for four near misses:",
        {
          list: [
            "`Minutes 1998.doc`: That is a Word 97–2003 .doc, which is a different format from .docx.",
            "`Salaries.docx` saved with a password: That document is encrypted with a password, which wraps the whole file in another format.",
            "`notes.odt`: That is an OpenDocument file, which LibreOffice writes.",
            "An Excel workbook renamed `budget.docx`: That is an Excel workbook, not a Word document.",
          ],
        },
        "Each message goes on to say how to get a `.docx` out of the file.",
      ],
    },
  ],
  problems: [
    {
      title: "Lines break in different places from Word",
      blocks: [
        "The paragraph is in a font without a same-width stand-in. Aptos, which Microsoft designed to replace Calibri as Office's default, is drawn in Roboto, and a paragraph a few characters wider can run to another line and push a page break down. Only the fonts the Fonts list marks with the same widths keep Word's layout exactly. The saved file still names the original, so Word lays it out as before.",
      ],
    },
    {
      title: "A .doc or a password-protected document will not open",
      blocks: [
        "Both are the older compound file format. Word 97–2003 files need saving as `.docx` in Word or LibreOffice first. A password encrypts the whole package, so clear it under File › Info › Protect Document › Encrypt with Password and save again.",
      ],
    },
    {
      title: "There is no way to add a comment or track changes",
      blocks: [
        "Comments, tracked changes and suggesting belong to a paid module of the editor that is not open source and is not used here. Tracked changes already in a document are shown and kept when it is saved, but cannot be accepted or rejected.",
      ],
    },
  ],
  faq: [
    {
      question: "Is my document uploaded?",
      answer:
        "No. It is read in the browser tab, edited there, and the download is written there. The page fetches only its own code and the font files it serves.",
    },
    {
      question: "Does saving change the fonts in my file?",
      answer:
        "No. Carlito stands in for Calibri only while the document is on screen; the saved file still says Calibri, and Word uses Calibri when it opens it.",
    },
    {
      question: "What font does a new document use?",
      answer:
        "Roboto at 11 points: it is the editor's own empty document with its default font changed from Calibri to Roboto and nothing else.",
    },
    {
      question: "Why is a .docm saved as .docm?",
      answer:
        "The extension says what the file is, a `.docm` carrying macros and a `.dotx` or `.dotm` being a template, so a file goes back out under the one it arrived with and a new document as `.docx`.",
    },
  ],
  references: [
    {
      title: "ECMA-376, Office Open XML File Formats",
      url: "https://ecma-international.org/publications-and-standards/standards/ecma-376/",
    },
    { title: "docx-editor, the engine behind the page", url: "https://github.com/eigenpal/docx-editor" },
    { title: "Carlito, metric-compatible with Calibri", url: "https://github.com/googlefonts/carlito" },
    { title: "Liberation Fonts", url: "https://github.com/liberationfonts/liberation-fonts" },
    { title: "Aptos, Microsoft Typography", url: "https://learn.microsoft.com/en-us/typography/font-list/aptos" },
    { title: "HarfBuzz, the text shaping engine", url: "https://harfbuzz.github.io/" },
  ],
} satisfies PageContent;
