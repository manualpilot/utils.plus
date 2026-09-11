import type { PageContent } from "../page-document.ts";

export default {
  related: ["/diff", "/string", "/url"],
  howItWorks: [
    "The preview is redrawn a moment after you stop typing. Split, Editor and Preview decide which halves are showing, and the hidden half stays loaded, so the undo history survives a switch. Open file, or dropping a file on the editor, replaces the whole document with a UTF-8 text file of up to 1 MB, as one step that Ctrl+Z takes back.",
    "The formatting bar wraps the selection, or the word under the caret, in bold, italic, strikethrough or inline code, and a second press takes the markers off. The heading, quote and list buttons apply to every selected line. Ctrl+B, Ctrl+I, Ctrl+E and Ctrl+K (Cmd on a Mac) give bold, italic, code and a link.",
    "The Flavour menu sets how the text is read:",
    {
      table: [
        ["Flavour", "Tables, strikethrough, task lists, bare URLs as links", "A single newline", "Fenced code"],
        ["GitHub Flavored (default)", "yes", "a space", "yes"],
        ["GitHub Flavored, Hard Breaks", "yes", "a line break", "yes"],
        ["CommonMark", "no", "a space", "yes"],
        ["Original Markdown", "no", "a space", "no"],
      ],
    },
    "Raw HTML is allowed, as Markdown intends, but what the parser produces goes through DOMPurify before it is shown: scripts, `on…` attributes, `javascript:` links, stylesheets, `style` attributes and forms are removed, and links open in a new tab. That matters because the document is kept in the page's address, so a shared link shows somebody else's text.",
    "Download saves the Markdown itself, the preview as a standalone HTML page with its styles inside it, or a PDF typeset in the tab with text you can select and search. Each file is named after the first heading: `# Release notes: v2.0` becomes `release-notes-v2-0.md`.",
  ],
  examples: [
    {
      title: "Where a heading and a list begin",
      blocks: [
        { code: "#Notes\nShopping:\n- eggs\n- milk" },
        "In GitHub Flavored and CommonMark:",
        { code: "<p>#Notes\nShopping:</p>\n<ul>\n<li>eggs</li>\n<li>milk</li>\n</ul>" },
        "In Original Markdown:",
        { code: "<h1>Notes</h1>\n<p>Shopping:\n- eggs\n- milk</p>" },
        "CommonMark wants a space after the `#` but lets a list interrupt a paragraph. The original rules were the other way round on both counts.",
      ],
    },
    {
      title: "A table and a strikethrough",
      blocks: [
        { code: "| Key | Value |\n| --- | --- |\n| a | 1 |\n\n~~old~~ new" },
        "GitHub Flavored draws a table with a `Key` and a `Value` column and strikes through `old`. CommonMark and Original Markdown leave the table as one paragraph of pipes and print the tildes as they are. The `| --- |` row is required: without it even GitHub Flavored sees a paragraph.",
      ],
    },
    {
      title: "What the sanitiser takes out",
      blocks: [
        { code: "<b onclick=\"x()\">hi</b> <script>alert(1)</script> [link](javascript:alert(1))" },
        { code: "<p><b>hi</b>  <a>link</a></p>" },
        "The bold survives; the handler, the script and the link's address do not.",
      ],
    },
  ],
  problems: [
    {
      title: "Line breaks disappear",
      blocks: [
        "A single newline inside a paragraph is a space in every flavour but GitHub Flavored, Hard Breaks. To break a line anywhere, end it with two spaces or a backslash; `one`, two spaces, a newline and `two` puts the words on separate lines in all four flavours.",
      ],
    },
    {
      title: "The next line joins the quote or the list item",
      blocks: [
        "A line straight after a quoted line or a list item carries on that block even without a `>` or an indent. This is called lazy continuation and every flavour does it: `> quoted line` followed by `continues here` is one quote. Leave a blank line to end the block.",
      ],
    },
    {
      title: "A code fence turns into inline code",
      blocks: [
        "Original Markdown has no fenced code blocks, so three backticks become an inline code span that runs the lines together. Indent the code by four spaces after a blank line, which works in every flavour.",
      ],
    },
    {
      title: "A picture is missing from the PDF",
      blocks: [
        "The preview asks the browser to show each picture, but the PDF writer has to fetch it. A picture that is not PNG, JPEG or SVG, whose host does not allow cross-origin reads, or that takes longer than five seconds is replaced by its alt text in italics.",
      ],
    },
  ],
  faq: [
    {
      question: "Which flavour should I pick?",
      answer:
        "GitHub Flavored for a README or anything else GitHub will render; it is the default. CommonMark for a tool that follows the plain specification without GitHub's additions. Original Markdown only to check how John Gruber's 2004 rules treat a document.",
    },
    {
      question: "Can I use HTML inside the Markdown?",
      answer:
        "Yes. Elements such as `details`, `kbd` and `sub` render in the preview and in the HTML download, after DOMPurify has removed scripts, event handlers and `javascript:` links. An `iframe`, `style` or `form` is removed as well.",
    },
    {
      question: "How is the PDF made?",
      answer:
        "It is written in the tab by pdfmake, from the same parser and flavour as the preview, with no print dialog. The text is set in embedded Roboto, code in Courier, and it stays selectable and searchable rather than being an image of the page. Inline HTML tags such as `kbd` are dropped and their text kept; a block of HTML is left out.",
    },
    {
      question: "Why won't my file open?",
      answer:
        "The page opens UTF-8 text up to 1 MB. A file that is not valid UTF-8, such as Windows-1252 text with accented letters or a picture dropped by mistake, is refused with a message, and the current document is left as it was. [The hex viewer](/hex) shows which bytes are to blame.",
    },
  ],
  references: [
    { title: "CommonMark Spec, version 0.31.2", url: "https://spec.commonmark.org/0.31.2/" },
    { title: "GitHub Flavored Markdown Spec", url: "https://github.github.com/gfm/" },
    { title: "John Gruber, Markdown: Syntax", url: "https://daringfireball.net/projects/markdown/syntax" },
    { title: "marked, advanced usage and options", url: "https://marked.js.org/using_advanced" },
    { title: "DOMPurify", url: "https://github.com/cure53/DOMPurify" },
  ],
} satisfies PageContent;
