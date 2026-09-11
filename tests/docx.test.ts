import { blankDocumentBytes } from "@docx-editor.dev/core";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blankDocument, withDefaultFace } from "../src/utilities/docx/blank";
import { documentFonts } from "../src/utilities/docx/fonts";
import { extensionOf, load, MAX_BYTES, refusal, saveName, titleOf } from "../src/utilities/docx/source";
import { noteOf, packagedFamilyOf, reading, standIn } from "../src/utilities/docx/substitutes";

const require = createRequire(import.meta.url);

const FONT_DIRS = [
  join(dirname(require.resolve("@docx-editor.dev/fonts/package.json")), "assets"),
  dirname(require.resolve("@expo-google-fonts/roboto/package.json")),
];

function fontFile(url: string): Buffer | null {
  const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").at(-1) ?? "");
  const stem = name.match(/^Roboto_(\d+\w+?)\.ttf$/);
  const path = stem
    ? join(FONT_DIRS[1], stem[1], name)
    : join(FONT_DIRS[0], name);
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

const bytes = (...values: number[]) => Uint8Array.from(values);
const stylesOf = (docx: Uint8Array) => strFromU8(unzipSync(docx)["word/styles.xml"]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what a family is drawn in", () => {
  it("answers Word's six with the faces built to their widths", () => {
    expect(standIn("Calibri")).toBe("Carlito");
    expect(standIn("Cambria")).toBe("Caladea");
    expect(standIn("Times New Roman")).toBe("Liberation Serif");
    expect(standIn("Arial")).toBe("Liberation Sans");
    expect(standIn("Courier New")).toBe("Liberation Mono");
    expect(standIn("Century Gothic")).toBe("TeX Gyre Adventor");
  });

  it("matches a name whatever its case and spacing, as Word does", () => {
    expect(standIn("CALIBRI")).toBe("Carlito");
    expect(standIn("  times   new roman ")).toBe("Liberation Serif");
  });

  it("answers the families nearest one of the served faces with that face", () => {
    expect(standIn("Helvetica")).toBe("Liberation Sans");
    expect(standIn("Georgia")).toBe("Caladea");
    expect(standIn("Garamond")).toBe("Liberation Serif");
    expect(standIn("Consolas")).toBe("Liberation Mono");
    expect(standIn("Futura")).toBe("TeX Gyre Adventor");
    expect(standIn("Candara")).toBe("Carlito");
  });

  it("reads a family's name past the weight it carries", () => {
    expect(standIn("Calibri Light")).toBe("Carlito");
    expect(standIn("Arial Black")).toBe("Liberation Sans");
    expect(standIn("Helvetica Neue Light")).toBe("Liberation Sans");
    expect(standIn("Sitka Text")).toBe("Caladea");
    expect(standIn("Arial Narrow")).toBe("Roboto");
  });

  it("falls back on what the name says the face is", () => {
    expect(standIn("Source Code Pro")).toBe("Liberation Mono");
    expect(standIn("Noto Sans Mono")).toBe("Liberation Mono");
    expect(standIn("Noto Serif")).toBe("Liberation Serif");
    expect(standIn("PT Sans")).toBe("Roboto");
  });

  it("draws everything nobody listed in Roboto, Word's own current default among them", () => {
    expect(standIn("Aptos")).toBe("Roboto");
    expect(standIn("Aptos Display")).toBe("Roboto");
    expect(standIn("Segoe UI Semibold")).toBe("Roboto");
    expect(standIn("Verdana")).toBe("Roboto");
    expect(standIn("Some Face Nobody Has Heard Of")).toBe("Roboto");
  });

  it("leaves symbols and other scripts to the browser", () => {
    for (const family of ["Symbol", "Wingdings", "Wingdings 2", "Webdings", "Segoe UI Emoji", "Cambria Math"]) {
      expect(standIn(family), family).toBeNull();
    }
    for (const family of ["MS Mincho", "SimSun", "Malgun Gothic", "Noto Sans CJK JP", "Noto Sans Arabic"]) {
      expect(standIn(family), family).toBeNull();
    }
    expect(standIn(String.fromCodePoint(0x5b8b, 0x4f53))).toBeNull();
  });

  it("says which of the four things became of a family", () => {
    expect(reading("Calibri")).toEqual({ family: "Calibri", face: "Carlito", kind: "metric" });
    expect(reading("Calibri Light")).toEqual({ family: "Calibri Light", face: "Carlito", kind: "closest" });
    expect(reading("Century Gothic")).toEqual({ family: "Century Gothic", face: "TeX Gyre Adventor", kind: "closest" });
    expect(reading("roboto")).toEqual({ family: "roboto", face: "Roboto", kind: "own" });
    expect(reading("Carlito")).toEqual({ family: "Carlito", face: "Carlito", kind: "own" });
    expect(reading("Aptos")).toEqual({ family: "Aptos", face: "Roboto", kind: "closest" });
    expect(reading("Wingdings")).toEqual({ family: "Wingdings", face: null, kind: "untouched" });
  });

  it("puts each reading in words", () => {
    expect(noteOf(reading("Calibri"))).toBe("Carlito, with the same widths");
    expect(noteOf(reading("Aptos"))).toBe("Roboto, the closest served here");
    expect(noteOf(reading("Roboto"))).toBe("Served here as it is");
    expect(noteOf(reading("Wingdings"))).toBe("Left to your browser");
  });

  it("names the Word family the fonts package is asked with for each face it ships", () => {
    expect(packagedFamilyOf("Carlito")).toBe("Calibri");
    expect(packagedFamilyOf("TeX Gyre Adventor")).toBe("Century Gothic");
    expect(packagedFamilyOf("Roboto")).toBeNull();
  });
});

describe("the fonts a document is handed", () => {
  it("fetches only the faces the families it names are drawn in, and redirects each family to them", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: URL | string) => {
      const href = String(url);
      asked.push(href.split("/").at(-1)!.split("?")[0]);
      const file = fontFile(href);
      return file ? new Response(new Uint8Array(file)) : new Response(null, { status: 404 });
    });

    let read: ReturnType<typeof reading>[] = [];
    const resolver = documentFonts((readings) => read = readings);
    const answer = await resolver({ families: ["Calibri", "Aptos", "aptos", "Wingdings"], defaultFamily: "Calibri" });

    expect(read.map(({ family, kind }) => `${family}:${kind}`)).toEqual([
      "Calibri:metric",
      "Aptos:closest",
      "Wingdings:untouched",
    ]);
    expect(asked.sort()).toEqual([
      "Carlito-Bold.ttf",
      "Carlito-BoldItalic.ttf",
      "Carlito-Italic.ttf",
      "Carlito-Regular.ttf",
      "Roboto_400Regular.ttf",
      "Roboto_400Regular_Italic.ttf",
      "Roboto_700Bold.ttf",
      "Roboto_700Bold_Italic.ttf",
    ]);

    const faces = answer!.sources!.map(({ request }) => `${request.family} ${request.weight} ${request.style}`);
    expect(faces.sort()).toEqual([
      "Carlito 400 italic",
      "Carlito 400 normal",
      "Carlito 700 italic",
      "Carlito 700 normal",
      "Roboto 400 italic",
      "Roboto 400 normal",
      "Roboto 700 italic",
      "Roboto 700 normal",
    ]);
    for (const { hash } of answer!.sources!) expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const redirects = answer!.substitutions!.map(({ from, to }) => `${from.family} ${from.weight} → ${to.family}`);
    expect(redirects).toContain("Calibri 700 → Carlito");
    expect(redirects).toContain("Aptos 400 → Roboto");
    expect(redirects.some((line) => line.startsWith("Wingdings"))).toBe(false);
    expect(answer).toMatchObject({ defaultFont: { family: "Roboto", sizeHalfPoints: 22 } });
  });

  it("carries on without a face that would not load", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));
    const answer = await documentFonts(() => {})({ families: ["Georgia"], defaultFamily: "Calibri" });

    expect(answer!.sources).toEqual([]);
    expect(answer!.substitutions!.map(({ to }) => to.family)).toEqual(Array(4).fill("Caladea"));
  });
});

describe("a new document", () => {
  it("is the engine's own empty document, set in Roboto", () => {
    const ours = unzipSync(blankDocument());
    const theirs = unzipSync(blankDocumentBytes());

    expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    for (const name of Object.keys(theirs)) {
      if (name !== "word/styles.xml") expect(strFromU8(ours[name]), name).toBe(strFromU8(theirs[name]));
    }
    expect(stylesOf(blankDocumentBytes())).toContain("w:ascii=\"Calibri\"");
    const styles = stylesOf(blankDocument());
    expect(styles).toContain(
      "<w:rFonts w:ascii=\"Roboto\" w:hAnsi=\"Roboto\" w:eastAsia=\"Roboto\" w:cs=\"Roboto\"/>",
    );
    expect(styles).not.toContain("Calibri");
  });

  it("changes the face of the defaults and leaves a style that names its own alone", () => {
    const styles = "<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"Calibri\" w:hAnsi=\"Calibri\"/></w:rPr>"
      + "</w:rPrDefault></w:docDefaults><w:style><w:rPr><w:rFonts w:ascii=\"Consolas\"/></w:rPr></w:style>";

    expect(withDefaultFace(styles, "Roboto")).toBe(
      "<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"Roboto\" w:hAnsi=\"Roboto\"/></w:rPr>"
        + "</w:rPrDefault></w:docDefaults><w:style><w:rPr><w:rFonts w:ascii=\"Consolas\"/></w:rPr></w:style>",
    );
  });
});

describe("a file arriving", () => {
  const zip = (...names: string[]) => zipSync(Object.fromEntries(names.map((name) => [name, strToU8("<x/>")])));
  const docx = zip("[Content_Types].xml", "_rels/.rels", "word/document.xml");
  const compound = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00);

  it("is taken when it is a zip with a Word document inside, which every .docx is", () => {
    expect(refusal(docx, "report.docx")).toBeNull();
  });

  it("names the other zips somebody might take for one", () => {
    expect(refusal(zip("mimetype", "content.xml"), "notes.odt")).toMatch(/^That is an OpenDocument file/);
    expect(refusal(zip("[Content_Types].xml", "xl/workbook.xml"), "sums.docx")).toBe(
      "That is an Excel workbook, not a Word document.",
    );
    expect(refusal(zip("[Content_Types].xml", "ppt/presentation.xml"), "deck")).toBe(
      "That is a PowerPoint presentation, not a Word document.",
    );
    expect(refusal(zip("photo.jpg"), "photos.zip")).toBe("That is a zip archive with no Word document inside it.");
    expect(refusal(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00), "cut.docx")).toBe(
      "That file is a damaged zip archive, so there is no document in it to read.",
    );
  });

  it("tells an encrypted .docx from a Word 97–2003 document by what the file calls itself", () => {
    expect(refusal(compound, "report.docx")).toMatch(/^That document is encrypted with a password/);
    expect(refusal(compound, "template.dotx")).toMatch(/^That document is encrypted with a password/);
    expect(refusal(compound, "report.doc")).toMatch(/^That is a Word 97–2003 \.doc/);
    expect(refusal(compound, "report")).toMatch(/^That is a Word 97–2003 \.doc/);
  });

  it("names Rich Text for what it is, and refuses anything else", () => {
    expect(refusal(new TextEncoder().encode("{\\rtf1\\ansi"), "letter.doc")).toMatch(/Rich Text Format/);
    expect(refusal(new TextEncoder().encode("plain words"), "notes.docx")).toBe(
      "That file is not a Word document: a .docx is a zip archive.",
    );
    expect(refusal(bytes(), "empty.docx")).toBe("That file is empty.");
  });

  it("is read whole, and refused past the ceiling before a byte of it is", async () => {
    const loaded = await load(new File([docx], "report.docx"));
    expect(loaded.name).toBe("report.docx");
    expect(Array.from(loaded.bytes)).toEqual(Array.from(docx));

    const huge = new File([docx], "huge.docx");
    Object.defineProperty(huge, "size", { value: MAX_BYTES + 1 });
    await expect(load(huge)).rejects.toThrow("That file is larger than the 64 MB this opens.");
  });

  it("is saved under the title it has now and the extension it arrived with", () => {
    expect(titleOf("Quarterly report.docx")).toBe("Quarterly report");
    expect(titleOf("template.DOTX")).toBe("template");
    expect(extensionOf("macros.docm")).toBe("docm");
    expect(extensionOf("template.DOTX")).toBe("dotx");
    expect(extensionOf("no extension")).toBe("docx");
    expect(saveName("Quarterly report", "docx")).toBe("Quarterly report.docx");
    expect(saveName("macros.docm", "docm")).toBe("macros.docm");
    expect(saveName("  ", "docx")).toBe("Untitled.docx");
    expect(saveName("Q3/Q4: plans", "dotx")).toBe("Q3-Q4- plans.dotx");
  });
});
