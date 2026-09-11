import type { PageContent } from "../page-document.ts";

export default {
  related: ["/docx", "/image", "/markdown", "/hex"],
  howItWorks: [
    "Choose or drop a PDF of up to 128 MB. It is read in the tab by PDFium, the engine Chrome shows PDFs with, compiled to WebAssembly and served from this site. The pages are drawn to the width of the pane with the tools above them. With none chosen, text can be selected and copied, a mark can be selected to move it or change its colour, and a link inside the document scrolls to the page it points at.",
    "Highlight, Underline and Strike through work on the document's own text: drag across a line. Draw is a freehand pen, Text puts a box on the page to type in, and Rectangle, Ellipse, Line and Arrow draw what they say. Image places a picture where the page is next clicked, and Signature does the same with a signature.",
    "A signature can be drawn in the box with a mouse or a finger, typed and set in a handwriting face, or taken from a picture of one. It is kept while the page is open, for every document opened on it, and no longer, since a signature left behind in a browser is anybody's to use.",
    "The swatch in the toolbar sets the colour and thickness, or the text size, of the selected mark or of the next one the active tool makes. Delete removes the selected mark, and Ctrl+Z and Ctrl+Shift+Z undo and redo.",
    "Download writes every mark into the file as a standard PDF annotation carrying its own appearance, which is what lets another reader draw it as it was drawn here. The copy keeps the file's name, and a PDF that was locked with a password is saved locked with the same one.",
  ],
  examples: [
    {
      title: "What the swatch changes",
      blocks: [
        "Which marks a colour reaches depends on what is selected and which tool is on:",
        {
          table: [
            ["Selected", "Tool on", "The colour goes to"],
            ["A highlight", "None", "That highlight"],
            ["Nothing", "Rectangle", "The next rectangles"],
            ["A stroke just drawn", "Draw", "That stroke and the next ones"],
            ["A signature", "None", "Nothing, and the swatch is greyed out"],
          ],
        },
        "A signature and a picture are what they were made as, so they take no colour of their own.",
      ],
    },
    {
      title: "Files that are not PDFs",
      blocks: [
        "A PDF says so in its first kilobyte, so anything else is refused before the engine is asked, with a sentence about what it is instead:",
        {
          list: [
            "A `.docx` renamed or dropped by mistake: That is a Word document, not a PDF. DOCX opens those, and Word can save one as a PDF.",
            "A download that failed: That is a web page saved under a PDF's name, which is what a download that failed usually leaves behind.",
            "A `.ps` file: That is a PostScript file, which is what a PDF is usually made from rather than a PDF itself.",
            "A photograph: That is a picture, not a PDF. Open a PDF first and use Image to put the picture on one of its pages.",
          ],
        },
      ],
    },
  ],
  problems: [
    {
      title: "Dragging with Highlight selects nothing",
      blocks: [
        "The page is a scan: a photograph of text rather than text, so there are no letters for a highlight to follow. Draw a rectangle round the passage instead, or a line under it, which work on any page.",
      ],
    },
    {
      title: "The PDF asks for a password",
      blocks: [
        "It was locked with one when it was made, and nothing can be drawn until the password is given. A PDF locked by a security handler other than the standard password one, which some document management systems use, cannot be opened here at all.",
      ],
    },
    {
      title: "A saved signature has gone",
      blocks: [
        "Signatures last as long as the page. Reloading it, going to another tool or opening it in another tab starts with none, and a signature already placed on a document is still in that document's download.",
      ],
    },
  ],
  faq: [
    {
      question: "Is my PDF uploaded?",
      answer:
        "No. It is read, drawn on and saved in the browser tab, and the page fetches nothing but its own code, the engine and the fonts it serves.",
    },
    {
      question: "Is a signature placed here a digital signature?",
      answer:
        "No. It is a mark on the page, ink or a picture: nothing in the file certifies who put it there or that the document has not changed since. Whether a mark like that is enough is for whoever asked for the signature to say.",
    },
    {
      question: "Can I change the text that is already in the PDF?",
      answer:
        "No. Every tool adds a mark on top of the page and leaves the page itself as it was, which is also why a mark can be selected and deleted again afterwards.",
    },
    {
      question: "Why is the file bigger after adding a picture?",
      answer:
        "The picture is stored in the file. A photograph is kept as a JPEG and anything else as a PNG, and one larger than 2400 pixels on its longest side is scaled down to that first.",
    },
  ],
  references: [
    {
      title: "ISO 32000-1:2008, Document management — Portable document format",
      url: "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
    },
    { title: "PDFium, the PDF engine used in Chrome", url: "https://pdfium.googlesource.com/pdfium/" },
    { title: "EmbedPDF, the viewer the page is built on", url: "https://github.com/embedpdf/embed-pdf-viewer" },
    { title: "Dancing Script, the handwriting face", url: "https://github.com/googlefonts/DancingScript" },
  ],
} satisfies PageContent;
