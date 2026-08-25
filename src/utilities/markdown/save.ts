import type { TablerIcon } from "@tabler/icons-react";
import { download } from "../../common/download";
import { IconFileTypeHtml, IconFileTypePdf, IconMarkdown } from "../../icons";
import type { FlavourId } from "./flavours";
import { pdfDocument } from "./pdf";
import { renderMarkdown } from "./render";

export const SAVE_FORMATS = [
  { value: "markdown", label: "Markdown", note: "The document as it is written", Icon: IconMarkdown },
  { value: "html", label: "HTML", note: "The preview as a page of its own", Icon: IconFileTypeHtml },
  { value: "pdf", label: "PDF", note: "Typeset in this tab", Icon: IconFileTypePdf },
] as const satisfies readonly SaveFormat[];

export type SaveKind = typeof SAVE_FORMATS[number]["value"];

interface SaveFormat {
  value: string;
  label: string;
  note: string;
  Icon: TablerIcon;
}

export async function saveDocument(kind: SaveKind, text: string, flavour: FlavourId) {
  const title = documentTitle(text);

  if (kind === "markdown") {
    download(fileName(title, "md"), new Blob([text], { type: "text/markdown;charset=utf-8" }));
    return;
  }

  if (kind === "pdf") {
    download(fileName(title, "pdf"), await pdfDocument(text, flavour, title));
    return;
  }

  download(
    fileName(title, "html"),
    new Blob([standaloneDocument(title, renderMarkdown(text, flavour))], { type: "text/html;charset=utf-8" }),
  );
}

export function documentTitle(text: string): string {
  const lines = text.split("\n");

  for (const [index, line] of lines.entries()) {
    const atx = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (atx) return plainText(atx[1]) || FALLBACK_TITLE;

    const underlined = line.trim() !== "" && /^ {0,3}(=+|-+)\s*$/.test(lines[index + 1] ?? "");
    if (underlined) return plainText(line) || FALLBACK_TITLE;
  }

  return FALLBACK_TITLE;
}

export function fileName(title: string, extension: string): string {
  const stem = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_STEM)
    .replace(/-+$/, "");

  return `${stem || "document"}.${extension}`;
}

export function standaloneDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
<style>
${DOCUMENT_STYLE}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function plainText(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const FALLBACK_TITLE = "Markdown";

const MAX_STEM = 64;

const DOCUMENT_STYLE = `:root { color-scheme: light; background: #ffffff; }
body {
  box-sizing: border-box;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  max-width: 46rem;
  background: #ffffff;
  color: #1a1b1e;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  text-align: left;
  overflow-wrap: break-word;
}
h1,
h2,
h3,
h4,
h5,
h6 { margin: 2rem 0 1rem; line-height: 1.3; font-weight: 700; }
h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.25rem; }
h4, h5, h6 { font-size: 1rem; }
h1, h2 { padding-bottom: 0.3em; border-bottom: 1px solid #dee2e6; }
p,
ul,
ol,
blockquote,
table,
pre { margin: 0 0 1rem; }
ul, ol { padding-left: 1.5rem; }
a { color: #1971c2; }
code {
  padding: 0.15em 0.35em;
  border-radius: 3px;
  background: #f1f3f5;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9em;
}
pre {
  padding: 1rem;
  border-radius: 6px;
  background: #f1f3f5;
  overflow-x: auto;
}
pre code { padding: 0; background: none; }
blockquote {
  padding: 0 1rem;
  border-left: 4px solid #dee2e6;
  color: #495057;
}
table { border-collapse: collapse; width: 100%; }
th, td { padding: 0.4rem 0.75rem; border: 1px solid #dee2e6; text-align: left; }
thead th { background: #f8f9fa; }
img { max-width: 100%; }
hr { height: 1px; margin: 2rem 0; border: 0; background: #dee2e6; }
/* A checkbox is the marker on a task list item, and a bullet beside it is a second marker for the same item. */
li:has(> input[type="checkbox"]) { list-style: none; }
@page { margin: 18mm; }
@media print {
  /* The margin is the paper's now, and the measure is what the paper leaves. */
  body { padding: 0; max-width: none; }
  /* A scroll container on paper is a line cut off at the edge of the sheet, so a long one wraps instead. */
  pre { overflow: visible; white-space: pre-wrap; word-break: break-word; }
  /* A browser leaves a background off the paper unless it is asked to put it on, so what stands the block apart
     there is a rule around it rather than a fill nobody may print. */
  pre { background: none; border: 1px solid #dee2e6; }
  code { background: none; padding: 0; }
  thead th { background: none; }
  /* A control the platform draws for itself is one nobody can be sure of on paper, so the mark is a letter there. */
  li > input[type="checkbox"] { display: none; }
  li:has(> input[type="checkbox"])::before { content: "\\2610  "; }
  li:has(> input[type="checkbox"]:checked)::before { content: "\\2611  "; }
  /* A heading at the foot of a page is a heading away from what it heads, and a broken table is one with no header. */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 { break-after: avoid; }
  pre,
  blockquote,
  table,
  img { break-inside: avoid; }
}`;
