import { createHash } from "node:crypto";

export function pdf(pages: string[][], options: FixtureOptions = {}): Buffer {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);

  const catalog = add("");
  const tree = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids = pages.map(() => add(""));
  const streams = pages.map((lines) => ({
    id: add(""),
    data: lines
      .map((line, index) => `BT /F1 ${FONT_SIZE} Tf ${MARGIN} ${lineBaseline(index)} Td (${escape(line)}) Tj ET`)
      .join("\n"),
  }));

  kids.forEach((kid, index) => {
    const links = (options.links ?? []).filter((link) => link.page === index).map((link) =>
      add(linkAnnotation(link, kids))
    );
    const annots = links.length ? ` /Annots [${links.map((link) => `${link} 0 R`).join(" ")}]` : "";
    objects[kid - 1] = `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] `
      + `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${streams[index].id} 0 R${annots} >>`;
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  const id = createHash("md5").update(pages.flat().join("\n")).digest();
  const security = options.password === undefined ? null : standardSecurity(options.password, id);
  for (const { id: number, data } of streams) {
    const bytes = Buffer.from(data, "latin1");
    const body = security ? rc4(objectKey(security.key, number), bytes) : bytes;
    objects[number - 1] = `<< /Length ${body.length} >>\nstream\n${body.toString("latin1")}\nendstream`;
  }
  const encrypt = security ? add(security.dictionary) : null;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  const hex = id.toString("hex");
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /ID [<${hex}> <${hex}>]`
    + `${encrypt ? ` /Encrypt ${encrypt} 0 R` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export interface FixtureOptions {
  password?: string;
  links?: Link[];
}

export interface Link {
  page: number;
  rect: [number, number, number, number];
  uri?: string;
  toPage?: number;
}

export function lineBaseline(index: number): number {
  return PAGE.height - 72 - index * LINE_GAP;
}

export const PAGE = { width: 612, height: 792 };
export const MARGIN = 72;
export const FONT_SIZE = 18;
const LINE_GAP = 32;

function linkAnnotation(link: Link, kids: number[]): string {
  const target = link.uri !== undefined
    ? `/A << /S /URI /URI (${escape(link.uri)}) >>`
    : `/Dest [${kids[link.toPage ?? 0]} 0 R /Fit]`;
  return `<< /Type /Annot /Subtype /Link /Rect [${link.rect.join(" ")}] /Border [0 0 0] ${target} >>`;
}

function escape(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}

function standardSecurity(password: string, id: Buffer): { key: Buffer; dictionary: string } {
  const permissions = -44;
  const owner = rc4(md5(padded(password)).subarray(0, 5), padded(password));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);
  const key = md5(Buffer.concat([padded(password), owner, p, id])).subarray(0, 5);
  const user = rc4(key, PADDING);
  return {
    key,
    dictionary: `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> `
      + `/P ${permissions} >>`,
  };
}

function objectKey(key: Buffer, number: number): Buffer {
  const suffix = Buffer.from([number & 0xff, (number >> 8) & 0xff, (number >> 16) & 0xff, 0, 0]);
  return md5(Buffer.concat([key, suffix])).subarray(0, Math.min(key.length + 5, 16));
}

function padded(password: string): Buffer {
  return Buffer.concat([Buffer.from(password, "latin1"), PADDING]).subarray(0, 32);
}

function md5(data: Buffer): Buffer {
  return createHash("md5").update(data).digest();
}

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, index) => index);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

const PADDING = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");
