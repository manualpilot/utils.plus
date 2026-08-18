export function formatEdit(kind: FormatKind, doc: string, from: number, to: number): FormatEdit {
  const wrap = WRAPS[kind];
  if (wrap) return wrapEdit(doc, from, to, wrap);

  const prefix = PREFIXES[kind];
  if (prefix) return prefixEdit(doc, from, to, prefix);

  switch (kind) {
    case "link":
      return linkEdit(doc, from, to, "");
    case "image":
      return linkEdit(doc, from, to, "!");
    case "fence":
      return fenceEdit(doc, from, to);
    case "table":
      return blockEdit(doc, from, to, TABLE, "Column");
    default:
      return blockEdit(doc, from, to, "---");
  }
}

export type FormatKind =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "ordered"
  | "task"
  | "link"
  | "image"
  | "fence"
  | "table"
  | "rule";

export interface FormatEdit {
  from: number;
  to: number;
  insert: string;
  selection: [number, number];
}

const WRAPS: Partial<Record<FormatKind, string>> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
};

const LIST = /^(?:[-*+] \[[ xX]\] |[-*+] |\d+\. )/;

const PREFIXES: Partial<Record<FormatKind, LinePrefix>> = {
  h1: { marker: () => "# ", carried: /^#{1,6} /, family: /^#{1,6} +/, level: 1 },
  h2: { marker: () => "## ", carried: /^#{1,6} /, family: /^#{1,6} +/, level: 2 },
  h3: { marker: () => "### ", carried: /^#{1,6} /, family: /^#{1,6} +/, level: 3 },
  quote: { marker: () => "> ", carried: /^> ?/, family: /^> ?/ },
  bullet: { marker: () => "- ", carried: /^[-*+] (?!\[[ xX]\] )/, family: LIST },
  ordered: { marker: (index) => `${index + 1}. `, carried: /^\d+\. /, family: LIST },
  task: { marker: () => "- [ ] ", carried: /^[-*+] \[[ xX]\] /, family: LIST },
};

interface LinePrefix {
  marker: (index: number) => string;
  carried: RegExp;
  family: RegExp;
  level?: number;
}

const TABLE = "| Column | Column |\n| --- | --- |\n| Cell | Cell |";

function wrapEdit(doc: string, from: number, to: number, marker: string): FormatEdit {
  const [start, end] = from === to ? wordAround(doc, from) : [from, to];
  const selected = doc.slice(start, end);
  const width = marker.length;

  if (selected.length >= width * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(width, -width);
    return { from: start, to: end, insert: inner, selection: [start, start + inner.length] };
  }

  if (start >= width && doc.slice(start - width, start) === marker && doc.slice(end, end + width) === marker) {
    return { from: start - width, to: end + width, insert: selected, selection: [start - width, end - width] };
  }

  return {
    from: start,
    to: end,
    insert: `${marker}${selected}${marker}`,
    selection: [start + width, start + width + selected.length],
  };
}

function prefixEdit(doc: string, from: number, to: number, prefix: LinePrefix): FormatEdit {
  const [start, end] = lineRange(doc, from, to);
  const lines = doc.slice(start, end).split("\n");
  const marking = (line: string) => lines.length === 1 || line.trim() !== "";
  const carried = lines.filter(marking).every((line) => carriesPrefix(line, prefix));

  let marked = 0;
  const next = lines.map((line) => {
    if (!marking(line)) return line;
    const indent = line.match(/^\s*/)![0];
    const body = line.slice(indent.length).replace(prefix.family, "");
    return carried ? indent + body : indent + prefix.marker(marked++) + body;
  }).join("\n");

  if (from !== to) return { from: start, to: end, insert: next, selection: [start, start + next.length] };
  const moved = Math.max(start, from + next.split("\n")[0].length - lines[0].length);

  return { from: start, to: end, insert: next, selection: [moved, moved] };
}

function carriesPrefix(line: string, prefix: LinePrefix): boolean {
  const body = line.slice(line.match(/^\s*/)![0].length);
  const carried = prefix.carried.exec(body);
  if (!carried) return false;

  return prefix.level === undefined || carried[0].trim().length === prefix.level;
}

function linkEdit(doc: string, from: number, to: number, mark: string): FormatEdit {
  const selected = doc.slice(from, to);
  const label = mark ? "alt text" : "link text";

  if (selected && URL_LIKE.test(selected)) {
    const at = from + mark.length + 1;
    return { from, to, insert: `${mark}[${label}](${selected})`, selection: [at, at + label.length] };
  }

  const text = selected || label;
  const insert = `${mark}[${text}](${HREF})`;
  const at = selected ? from + mark.length + text.length + 3 : from + mark.length + 1;

  return { from, to, insert, selection: [at, at + (selected ? HREF.length : text.length)] };
}

const URL_LIKE = /^(?:[a-z][a-z\d+.-]*:|[/#])\S*$/i;
const HREF = "https://";

function fenceEdit(doc: string, from: number, to: number): FormatEdit {
  const [start, end] = lineRange(doc, from, to);
  const block = doc.slice(start, end);
  const lines = block.split("\n");

  if (lines.length >= 2 && lines[0].startsWith("```") && /^```\s*$/.test(lines[lines.length - 1])) {
    const inner = lines.slice(1, -1).join("\n");
    return { from: start, to: end, insert: inner, selection: [start, start + inner.length] };
  }

  return { from: start, to: end, insert: `\`\`\`\n${block}\n\`\`\``, selection: [start + 3, start + 3] };
}

function blockEdit(doc: string, from: number, to: number, snippet: string, select?: string): FormatEdit {
  const [start, end] = lineRange(doc, from, to);
  const block = doc.slice(start, end);
  const lead = block.trim() === "" ? "" : `${block}\n\n`;
  const insert = `${lead}${snippet}${end < doc.length ? "\n" : ""}`;
  const at = start + lead.length + (select ? snippet.indexOf(select) : snippet.length);

  return { from: start, to: end, insert, selection: [at, at + (select?.length ?? 0)] };
}

function lineRange(doc: string, from: number, to: number): [number, number] {
  const start = doc.lastIndexOf("\n", from - 1) + 1;
  const searchFrom = to > from && doc[to - 1] === "\n" ? to - 1 : to;
  const end = doc.indexOf("\n", searchFrom);

  return [start, end === -1 ? doc.length : end];
}

function wordAround(doc: string, at: number): [number, number] {
  let start = at;
  let end = at;
  while (start > 0 && WORD.test(doc[start - 1])) start--;
  while (end < doc.length && WORD.test(doc[end])) end++;

  return [start, end];
}

const WORD = /[\p{L}\p{N}_]/u;
