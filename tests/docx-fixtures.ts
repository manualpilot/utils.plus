import { strToU8, zipSync } from "fflate";

export function docx(paragraphs: string[], extra: Record<string, string> = {}, header?: string): Buffer {
  const overrides = Object.keys(extra).filter((name) => name.endsWith(".xml"))
    .map((name) => `<Override PartName="/${name}" ContentType="application/xml"/>`).join("")
    + (header === undefined ? "" : `<Override PartName="/word/header1.xml" ContentType="${HEADER}"/>`);
  const headerReference = header === undefined ? "" : `<w:headerReference w:type="default" r:id="rId1"/>`;
  return Buffer.from(zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${TYPES}">`
        + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
        + `<Default Extension="xml" ContentType="application/xml"/>`
        + `<Override PartName="/word/document.xml" ContentType="${MAIN}"/>${overrides}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS}">`
        + `<Relationship Id="rId1" Type="${OFFICE_DOCUMENT}" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>`
        + paragraphs.join("")
        + `<w:sectPr>${headerReference}<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" `
        + `w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    ),
    ...header === undefined ? {} : {
      "word/_rels/document.xml.rels": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS}">`
          + `<Relationship Id="rId1" Type="${HEADER_RELATIONSHIP}" Target="header1.xml"/></Relationships>`,
      ),
      "word/header1.xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${W}">${paragraph(header)}</w:hdr>`,
      ),
    },
    ...Object.fromEntries(Object.entries(extra).map(([name, text]) => [name, strToU8(text)])),
  }));
}

export function paragraph(text: string, family?: string): string {
  const fonts = family ? `<w:rPr><w:rFonts w:ascii="${family}" w:hAnsi="${family}"/></w:rPr>` : "";
  return `<w:p><w:r>${fonts}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
const RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const HEADER_RELATIONSHIP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header";
const HEADER = "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml";
const MAIN = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
