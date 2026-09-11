import { strToU8, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import article from "../src/page-content/pdf";
import { fitWithin, LONGEST_SIDE, PLACED_BOX } from "../src/utilities/pdf/image";
import { followable } from "../src/utilities/pdf/links";
import { SIGNATURE_FACE } from "../src/utilities/pdf/signature";
import { load, MAX_BYTES, refusal, saveName, unreadableMessage } from "../src/utilities/pdf/source";
import { colourOf, colourPatch, styleOf, styleTarget } from "../src/utilities/pdf/tools";
import { pdf } from "./pdf-fixtures";

const require = createRequire(import.meta.url);
const text = (value: string) => new TextEncoder().encode(value);

describe("what is refused before the engine is asked", () => {
  it("takes a PDF, and one whose header sits behind a mail gateway's junk", () => {
    expect(refusal(pdf([["Hello"]]))).toBeNull();
    expect(refusal(text(`${"x".repeat(900)}%PDF-1.7\n`))).toBeNull();
  });

  it("looks for the header in the first kilobyte and no further, as readers do", () => {
    expect(refusal(text(`${"x".repeat(1100)}%PDF-1.7\n`))).toBe("That file is not a PDF: a PDF begins with %PDF-.");
  });

  it("says what each near miss is", () => {
    expect(refusal(new Uint8Array())).toBe("That file is empty.");
    expect(refusal(zipSync({ "word/document.xml": strToU8("<w:document/>") }))).toBe(
      "That is a Word document, not a PDF. DOCX opens those, and Word can save one as a PDF.",
    );
    expect(refusal(zipSync({ "notes.txt": strToU8("hi") }))).toBe("That is a zip archive, not a PDF.");
    expect(refusal(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2]))).toBe(
      "That file is a damaged zip archive, not a PDF.",
    );
    expect(refusal(text("%!PS-Adobe-3.0\n"))).toBe(
      "That is a PostScript file, which is what a PDF is usually made from rather than a PDF itself.",
    );
    expect(refusal(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe(
      "That is a picture, not a PDF. Open a PDF first and use Image to put the picture on one of its pages.",
    );
    expect(refusal(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "That is a picture, not a PDF. Open a PDF first and use Image to put the picture on one of its pages.",
    );
    expect(refusal(text("\n  <!DOCTYPE html><html><body>404</body></html>"))).toBe(
      "That is a web page saved under a PDF's name, which is what a download that failed usually leaves behind. "
        + "Download the PDF again.",
    );
  });

  it("refuses a file larger than the page opens without reading it", async () => {
    const file = new File([], "huge.pdf");
    Object.defineProperty(file, "size", { value: MAX_BYTES + 1 });
    await expect(load(file)).rejects.toThrow("That file is larger than the 128 MB this opens.");
  });

  it("keeps the file's own name, and names one that came without", async () => {
    await expect(load(new File([new Uint8Array(pdf([["a"]]))], "minutes.pdf"))).resolves.toMatchObject({
      name: "minutes.pdf",
    });
    await expect(load(new File([new Uint8Array(pdf([["a"]]))], ""))).resolves.toMatchObject({ name: "Untitled.pdf" });
  });
});

describe("what the engine's refusals say", () => {
  it("puts the two PDFium codes a person can act on into sentences, and the rest into one", () => {
    expect(unreadableMessage(3, null)).toBe(
      "That file starts like a PDF but is too damaged for anything to be read out of it.",
    );
    expect(unreadableMessage(5, null)).toMatch(/^That PDF is encrypted by a security handler other than/);
    expect(unreadableMessage(1, "Unknown error")).toBe("That PDF could not be opened (Unknown error).");
    expect(unreadableMessage(undefined, null)).toBe("That PDF could not be opened.");
  });
});

describe("the name a download goes under", () => {
  it("is the file's own, as a .pdf", () => {
    expect(saveName("Lease agreement.pdf")).toBe("Lease agreement.pdf");
    expect(saveName("scan.PDF")).toBe("scan.pdf");
    expect(saveName("notes")).toBe("notes.pdf");
    expect(saveName("a/b:c.pdf")).toBe("a-b-c.pdf");
    expect(saveName("  .pdf ")).toBe("Untitled.pdf");
  });
});

describe("where a picture is put", () => {
  it("is scaled down into the box and never up, keeping its shape", () => {
    expect(fitWithin({ width: 1200, height: 630 }, PLACED_BOX)).toEqual({ width: 240, height: 126 });
    expect(fitWithin({ width: 100, height: 50 }, PLACED_BOX)).toEqual({ width: 100, height: 50 });
    expect(fitWithin({ width: 4000, height: 3000 }, { width: LONGEST_SIDE, height: LONGEST_SIDE })).toEqual({
      width: 2400,
      height: 1800,
    });
  });
});

describe("what the swatch changes", () => {
  it("offers a colour to every mark that has one to change, and none to a picture or a signature", () => {
    expect(styleOf("highlight")).toBe("markup");
    expect(styleOf("ink")).toBe("ink");
    expect(styleOf("lineArrow")).toBe("shape");
    expect(styleOf("freeText")).toBe("text");
    expect(styleOf("stamp")).toBeNull();
    expect(styleOf("signatureInk")).toBeNull();
    expect(styleOf(null)).toBeNull();
  });

  it("writes the field each kind is drawn with, and leaves a shape's fill alone", () => {
    expect(colourPatch("markup", "#597CE2")).toEqual({ strokeColor: "#597CE2", color: "#597CE2" });
    expect(colourPatch("ink", "#597CE2")).toEqual({ strokeColor: "#597CE2", color: "#597CE2" });
    expect(colourPatch("shape", "#597CE2")).toEqual({ strokeColor: "#597CE2" });
    expect(colourPatch("text", "#597CE2")).toEqual({ fontColor: "#597CE2" });
    expect(colourOf("shape", { color: "transparent", strokeColor: "#E44234" })).toBe("#E44234");
    expect(colourOf("text", { fontColor: "#000000", strokeColor: "#E44234" })).toBe("#000000");
  });

  it("reaches the marks the article says it does", () => {
    expect(styleTarget("highlight", null)).toEqual({ kind: "markup", selection: true, tool: false });
    expect(styleTarget(null, "square")).toEqual({ kind: "shape", selection: false, tool: true });
    expect(styleTarget("ink", "ink")).toEqual({ kind: "ink", selection: true, tool: true });
    expect(styleTarget("signatureStamp", null)).toBeNull();
    const table = article.examples[0].blocks.find((block) => typeof block === "object" && "table" in block);
    expect(table).toMatchObject({ table: expect.arrayContaining([["A highlight", "None", "That highlight"]]) });
  });
});

describe("which links in a document are followed", () => {
  it("opens web and mail addresses and nothing a PDF could use against the page", () => {
    expect(followable("https://example.com/terms")).toBe("https://example.com/terms");
    expect(followable(" mailto:ann@example.com ")).toBe("mailto:ann@example.com");
    expect(followable("javascript:alert(1)")).toBeNull();
    expect(followable("file:///etc/passwd")).toBeNull();
    expect(followable("data:text/html,<p>hi</p>")).toBeNull();
    expect(followable("terms.html")).toBeNull();
  });
});

describe("the article's words", () => {
  it("quote the refusals word for word", () => {
    const quoted = article.examples[1].blocks.flatMap((block) =>
      typeof block === "object" && "list" in block ? block.list : []
    );
    const sentences = [
      refusal(zipSync({ "word/document.xml": strToU8("<w:document/>") })),
      refusal(text("<html>")),
      refusal(text("%!PS")),
      refusal(Uint8Array.from([0xff, 0xd8, 0xff])),
    ];
    for (const [index, sentence] of sentences.entries()) {
      const said = quoted[index].slice(quoted[index].indexOf(": ") + 2);
      expect(sentence!.startsWith(said)).toBe(true);
    }
  });
});

describe("the typed signature's face", () => {
  it("is the family the served package declares, or the pad draws in a fallback", () => {
    const css = readFileSync(
      join(dirname(require.resolve("@fontsource-variable/dancing-script/package.json")), "index.css"),
      "utf8",
    );
    expect(css).toContain(`font-family: '${SIGNATURE_FACE}'`);
  });
});
