import { marked, type Token, type Tokens } from "marked";
import type { Content, ContentText, CustomTableLayout, Margins, TDocumentDefinitions } from "pdfmake/interfaces";
import { type FlavourId, flavourOptions } from "./flavours";

export async function pdfDocument(text: string, flavour: FlavourId, title: string): Promise<Blob> {
  const pdfMake = await writer();
  const tokens = marked.lexer(text, flavourOptions(flavour));
  const pictures = await fetchPictures(tokens);

  const document: TDocumentDefinitions = {
    info: { title },
    pageSize: "A4",
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.35, color: "#1a1b1e" },
    content: blocks(tokens, pictures),
  };

  return pdfMake.createPdf(document).getBlob();
}

async function writer() {
  const [module, roboto, courier] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/fonts/Roboto"),
    import("pdfmake/build/standard-fonts/Courier"),
  ]);

  const pdfMake = (module as unknown as { default?: typeof module }).default ?? module;
  pdfMake.addFontContainer(roboto.default);
  pdfMake.addFontContainer(courier.default);

  return pdfMake;
}

function blocks(tokens: Token[], pictures: Pictures): Content[] {
  return tokens.flatMap((token): Content[] => {
    switch (token.type) {
      case "heading":
        return [{
          text: runs(token.tokens, pictures),
          fontSize: HEADING_SIZES[token.depth - 1] ?? HEADING_SIZES.at(-1),
          bold: true,
          margin: [0, token.depth === 1 ? 0 : 12, 0, 6],
        }];

      case "paragraph":
        return paragraph(token.tokens, pictures);

      case "text": {
        const text = token as Tokens.Text;
        return text.tokens ? paragraph(text.tokens, pictures) : [{ text: text.text, margin: BLOCK_MARGIN }];
      }

      case "code":
        return [{
          table: {
            widths: ["*"],
            body: [[{ text: token.text, font: "Courier", fontSize: 9, preserveLeadingSpaces: true }]],
          },
          layout: CODE_RULE,
          margin: [0, 0, 0, 10],
        }];

      case "blockquote":
        return [{
          table: { widths: ["*"], body: [[{ stack: blocks(token.tokens ?? [], pictures) }]] },
          layout: QUOTE_RULE,
          margin: [0, 0, 0, 10],
        }];

      case "list":
        return [list(token as Tokens.List, pictures)];

      case "table":
        return [table(token as Tokens.Table, pictures)];

      case "hr":
        return [{
          canvas: [{ type: "line", x1: 0, y1: 0, x2: MEASURE, y2: 0, lineWidth: 1, lineColor: RULE }],
          margin: [0, 4, 0, 14],
        }];

      case "html":
      case "space":
        return [];

      default:
        return "tokens" in token && Array.isArray(token.tokens) ? blocks(token.tokens, pictures) : [];
    }
  });
}

function list(token: Tokens.List, pictures: Pictures): Content {
  const items = token.items.map((item): Content => {
    const [first, ...rest] = blocks(item.tokens, pictures).map(tighten);
    if (!item.task) return { stack: [first, ...rest], margin: ITEM_MARGIN };

    const box: ContentText = { text: item.checked ? "[x] " : "[ ] ", font: "Courier" };
    return { stack: [{ text: [box, ...opening(first)] }, ...rest], margin: ITEM_MARGIN };
  });

  return token.ordered
    ? { ol: items, start: token.start || 1, margin: BLOCK_MARGIN }
    : { ul: items, margin: BLOCK_MARGIN };
}

function tighten(block: Content): Content {
  return isText(block) ? { ...block, margin: ITEM_MARGIN } : block;
}

function isText(block: Content | undefined): block is ContentText {
  return typeof block === "object" && !Array.isArray(block) && "text" in block;
}

function paragraph(tokens: Token[] | undefined, pictures: Pictures): Content[] {
  const content: Content[] = [];
  let run: Token[] = [];
  let row: Picture[] = [];

  const flushText = () => {
    if (run.length > 0) content.push({ text: runs(run, pictures), margin: BLOCK_MARGIN });
    run = [];
  };
  const flushRow = () => {
    if (row.length === 1) content.push({ ...row[0], margin: BLOCK_MARGIN });
    else if (row.length > 1) {
      content.push({
        columns: row.map((picture) => ({ width: "auto", stack: [picture] })),
        columnGap: 6,
        margin: BLOCK_MARGIN,
      });
    }
    row = [];
  };

  for (const token of tokens ?? []) {
    const picture = token.type === "image" ? pictures.get(token.href) : undefined;
    if (picture) {
      flushText();
      row.push(picture);
      continue;
    }
    if (token.type === "text" && token.raw.trim() === "") continue;
    flushRow();
    run.push(token);
  }

  flushText();
  flushRow();
  return content;
}

function opening(block: Content | undefined): ContentText[] {
  if (!isText(block)) return [];
  return Array.isArray(block.text) ? block.text as ContentText[] : [{ text: String(block.text) }];
}

function table(token: Tokens.Table, pictures: Pictures): Content {
  const align = token.align.map((alignment) => alignment ?? "left");
  const header = token.header.map((cell, column) => ({
    text: runs(cell.tokens, pictures),
    bold: true,
    alignment: align[column],
  }));
  const body = token.rows.map((row) =>
    row.map((cell, column) => ({ text: runs(cell.tokens, pictures), alignment: align[column] }))
  );

  return {
    table: { headerRows: 1, widths: token.header.map(() => "*"), body: [header, ...body] },
    layout: TABLE_RULES,
    margin: [0, 0, 0, 10],
  };
}

function runs(tokens: Token[] | undefined, pictures: Pictures, style: Style = {}): ContentText[] {
  if (!tokens) return [];

  return tokens.flatMap((token): ContentText[] => {
    switch (token.type) {
      case "strong":
        return runs(token.tokens, pictures, { ...style, bold: true });
      case "em":
        return runs(token.tokens, pictures, { ...style, italics: true });
      case "del":
        return runs(token.tokens, pictures, { ...style, decoration: "lineThrough" });
      case "codespan":
        return [{ ...style, text: token.text, font: "Courier", fontSize: 9.5 }];
      case "link":
        return runs(token.tokens, pictures, { ...style, link: token.href, color: LINK, decoration: "underline" });
      case "br":
        return [{ ...style, text: "\n" }];
      case "image":
        return [{ ...style, text: token.text || token.title || "", italics: true }];
      case "escape":
      case "text":
        return [{ ...style, text: token.text }];
      default:
        return "tokens" in token && Array.isArray(token.tokens)
          ? runs(token.tokens, pictures, style)
          : [{ ...style, text: "raw" in token ? String(token.raw) : "" }];
    }
  });
}

async function fetchPictures(tokens: Token[]): Promise<Pictures> {
  const addresses = new Set<string>();
  const find = (list: Token[]) => {
    for (const token of list) {
      if (token.type === "image") addresses.add(token.href);
      if ("tokens" in token && Array.isArray(token.tokens)) find(token.tokens);
      if (token.type === "list") { for (const item of (token as Tokens.List).items) find(item.tokens); }
      if (token.type === "table") {
        const table = token as Tokens.Table;
        for (const cell of [...table.header, ...table.rows.flat()]) find(cell.tokens);
      }
    }
  };
  find(tokens);

  const found = await Promise.all(
    [...addresses].map(async (address) => [address, await fetchPicture(address)] as const),
  );

  return new Map(found.flatMap(([address, picture]) => picture ? [[address, picture] as const] : []));
}

async function fetchPicture(address: string): Promise<Picture | undefined> {
  try {
    const response = await fetch(address, { signal: AbortSignal.timeout(PICTURE_WAIT) });
    if (!response.ok) return undefined;

    const type = response.headers.get("content-type") ?? "";
    if (type.includes("svg")) {
      const svg = await response.text();
      return { svg, width: drawnWidth(...svgSize(svg)) };
    }
    if (!/image\/(png|jpeg)/.test(type)) return undefined;

    const image = await encode(await response.blob());
    const size = await rasterSize(image);
    return { image, width: drawnWidth(...size) };
  } catch {
    return undefined;
  }
}

function encode(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function drawnWidth(width: number, height: number): number {
  const points = width * POINTS_PER_PIXEL;
  const tall = height * POINTS_PER_PIXEL;
  const scale = Math.min(1, MEASURE / points, PICTURE_HEIGHT / tall);

  return Math.max(1, Math.round(points * scale));
}

function svgSize(svg: string): [number, number] {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  const width = Number.parseFloat(root.getAttribute("width") ?? "");
  const height = Number.parseFloat(root.getAttribute("height") ?? "");
  if (Number.isFinite(width) && Number.isFinite(height)) return [width, height];

  const box = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  return box.length === 4 && box.every(Number.isFinite) ? [box[2], box[3]] : [PICTURE_FALLBACK, PICTURE_FALLBACK];
}

async function rasterSize(source: string): Promise<[number, number]> {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    return [PICTURE_FALLBACK, PICTURE_FALLBACK];
  }

  return [image.naturalWidth, image.naturalHeight];
}

type Picture = ({ image: string } | { svg: string }) & { width: number };

type Pictures = Map<string, Picture>;

type Style = Omit<ContentText, "text">;

const MARGIN = 52;
const MEASURE = 595.28 - MARGIN * 2;

const HEADING_SIZES = [21, 16.5, 14, 12, 11, 10.5];

const PICTURE_HEIGHT = 520;
const PICTURE_WAIT = 5000;

const POINTS_PER_PIXEL = 0.75;

const PICTURE_FALLBACK = 320;

const BLOCK_MARGIN: Margins = [0, 0, 0, 8];
const ITEM_MARGIN: Margins = [0, 0, 0, 2];

const RULE = "#dee2e6";

const CODE_RULE: CustomTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

const QUOTE_RULE: CustomTableLayout = {
  hLineWidth: () => 0,
  vLineWidth: (index) => index === 0 ? 3 : 0,
  vLineColor: () => RULE,
  paddingLeft: () => 10,
  paddingRight: () => 0,
  paddingTop: () => 2,
  paddingBottom: () => 2,
};

const TABLE_RULES: CustomTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
};
const LINK = "#1971c2";
