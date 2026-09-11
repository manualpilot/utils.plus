import { expect, type Locator, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { docx, paragraph } from "./docx-fixtures";
import { tool } from "./tool";

const BASE = process.env.PW_BASE_URL ?? "";

const surface = (page: Page) => page.locator(".docx-paginated-surface");

async function openDocx(page: Page) {
  await page.goto(`${BASE}/docx`);
  await expect(page.getByText("Click to choose a Word document")).toBeVisible();
}

async function choose(page: Page, name: string, buffer: Buffer) {
  await page.locator(".file-dropzone input[type=\"file\"]").setInputFiles({ name, mimeType: "", buffer });
}

async function mode(page: Page, which: "View" | "Edit") {
  await page.locator(".mantine-SegmentedControl-label", { hasText: which }).click();
}

async function download(page: Page): Promise<{ name: string; parts: Record<string, Uint8Array> }> {
  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the document" }).click();
  const saved = await saving;
  return { name: saved.suggestedFilename(), parts: unzipSync(readFileSync((await saved.path())!)) };
}

test("a new document opens for writing, in Roboto, and goes back out as a .docx holding what was typed", async ({ page }) => {
  await openDocx(page);
  await page.getByRole("button", { name: "New document" }).click();

  await expect(page.getByRole("radio", { name: "Edit" })).toBeChecked();
  await expect(page.locator(".docx-page").first()).toBeVisible();
  await page.locator(".docx-page").first().click({ position: { x: 200, y: 120 } });
  await page.keyboard.type("Written on utils+");
  await expect(surface(page)).toContainText("Written on utils+");

  const { name, parts } = await download(page);
  expect(name).toBe("Untitled.docx");
  expect(textOf(strFromU8(parts["word/document.xml"]))).toContain("Written on utils+");
  expect(strFromU8(parts["word/styles.xml"])).toMatch(/<w:rPrDefault>[\s\S]*w:ascii="Roboto"[\s\S]*<\/w:rPrDefault>/);
});

test("an edited document comes back down with the edit and with everything the editor does not model", async ({ page }) => {
  const kept = "<data xmlns=\"urn:utils-plus\">carried through as it arrived</data>";
  await openDocx(page);
  await choose(page, "Minutes.docx", docx([paragraph("Present: Ann, Bo.")], { "customXml/item1.xml": kept }));
  await expect(surface(page)).toContainText("Present: Ann, Bo.");

  await mode(page, "Edit");
  await surface(page).getByText("Present: Ann, Bo.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Apologies: Cy.");

  const { name, parts } = await download(page);
  expect(name).toBe("Minutes.docx");
  expect(textOf(strFromU8(parts["word/document.xml"]))).toContain("Apologies: Cy.");
  expect(strFromU8(parts["customXml/item1.xml"])).toBe(kept);
});

test("a document opens to be read, and the switch is what makes it writable", async ({ page }) => {
  await openDocx(page);
  await choose(page, "letter.docx", docx([paragraph("Dear Sir or Madam,")]));
  await expect(surface(page)).toContainText("Dear Sir or Madam,");

  await expect(page.getByRole("radio", { name: "View" })).toBeChecked();
  expect(await page.evaluate(() => window.docxEditor!.snapshot().editable)).toBe(false);
  await surface(page).getByText("Dear Sir or Madam,").click();
  await page.keyboard.type("typed while reading");
  await expect(surface(page)).not.toContainText("typed while reading");

  await mode(page, "Edit");
  await expect.poll(() => page.evaluate(() => window.docxEditor!.snapshot().editable)).toBe(true);
});

test("every font a document names is drawn in a served face, and the list says which", async ({ page }) => {
  await openDocx(page);
  await choose(
    page,
    "fonts.docx",
    docx([
      paragraph("Set in Calibri", "Calibri"),
      paragraph("Set in Aptos", "Aptos"),
      paragraph("Set in Consolas", "Consolas"),
      paragraph("abc", "Wingdings"),
    ]),
  );
  await expect(surface(page)).toContainText("Set in Consolas");

  await page.getByRole("button", { name: "Fonts" }).click();
  const row = (family: string) => page.locator(`[data-font="${family}"] td`).last();
  await expect(row("Calibri")).toHaveText("Carlito, with the same widths");
  await expect(row("Aptos")).toHaveText("Roboto, the closest served here");
  await expect(row("Consolas")).toHaveText("Liberation Mono, the closest served here");
  await expect(row("Wingdings")).toHaveText("Left to your browser");

  const unloaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.querySelectorAll<HTMLElement>(".docx-page [style*=\"font-family\"]")]
      .filter((run) => /Set in/.test(run.textContent ?? ""))
      .map((run) => run.style.fontFamily.split(",")[0].trim().replace(/^"|"$/g, ""))
      .filter((family) => ![...document.fonts].some((face) => face.family === family && face.status === "loaded"));
  });
  expect(unloaded).toEqual([]);
  expect(await page.evaluate(() => [...document.fonts].some((face) => /^(Calibri|Aptos|Consolas)$/.test(face.family))))
    .toBe(false);
});

test("a document naming no fonts says it is all in Roboto", async ({ page }) => {
  await openDocx(page);
  await choose(page, "plain.docx", docx([paragraph("Nothing named.")]));
  await expect(surface(page)).toContainText("Nothing named.");

  await page.getByRole("button", { name: "Fonts" }).click();
  await expect(page.locator("[data-docx=\"fonts\"]")).toHaveText(
    "The document names no fonts of its own, so all of it is drawn in Roboto.",
  );
});

test("fonts are fetched when a document asks for them and not before", async ({ page }) => {
  const faces: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const name = url.pathname.split("/").at(-1)!;
    if (/\.(ttf|otf|wasm)$/.test(name) && !url.searchParams.has("import")) faces.push(name);
  });

  await openDocx(page);
  await page.waitForTimeout(500);
  expect(faces).toEqual([]);

  await page.getByRole("button", { name: "New document" }).click();
  await expect(page.locator(".docx-page").first()).toBeVisible();
  await expect.poll(() => faces.filter((name) => name.startsWith("Roboto")).length).toBe(4);
  expect(faces.some((name) => /Carlito|Caladea|Liberation|Adventor/.test(name))).toBe(false);
});

test("a file that is not a Word document is refused, and says what it is instead", async ({ page }) => {
  await openDocx(page);

  await choose(page, "old.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]));
  await expect(tool(page).getByRole("alert")).toContainText("That is a Word 97–2003 .doc");

  await choose(page, "locked.docx", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]));
  await expect(tool(page).getByRole("alert")).toContainText("That document is encrypted with a password");
  await expect(page.locator(".docx-pane")).toHaveCount(0);
});

test("a zip the engine cannot read a document out of is taken back off the page with a reason", async ({ page }) => {
  await openDocx(page);
  await choose(page, "broken.docx", broken());

  await expect(tool(page).getByRole("alert")).toContainText("That file is a zip, but no Word document could be read");
  await expect(page.locator(".docx-pane")).toHaveCount(0);
  await expect(page.getByText("Click to choose a Word document")).toBeVisible();
});

test("a saved document still names its own fonts and keeps the changes it was tracking", async ({ page }) => {
  const tracked = "<w:p><w:r><w:t xml:space=\"preserve\">The fee is </w:t></w:r>"
    + "<w:del w:id=\"1\" w:author=\"Ann\" w:date=\"2026-01-01T00:00:00Z\"><w:r><w:delText>400</w:delText></w:r></w:del>"
    + "<w:ins w:id=\"2\" w:author=\"Ann\" w:date=\"2026-01-01T00:00:00Z\"><w:r><w:t>450</w:t></w:r></w:ins></w:p>";
  await openDocx(page);
  await choose(
    page,
    "fee.docx",
    docx([paragraph("Set in Calibri", "Calibri"), paragraph("Set in Aptos", "Aptos"), tracked]),
  );
  await expect(surface(page)).toContainText("450");

  await mode(page, "Edit");
  await surface(page).getByText("Set in Calibri").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" and edited");

  const saved = strFromU8((await download(page)).parts["word/document.xml"]);
  expect(textOf(saved)).toContain("and edited");
  expect(saved).toMatch(/w:ascii="Calibri"/);
  expect(saved).toMatch(/w:ascii="Aptos"/);
  expect(saved).not.toMatch(/Carlito|Roboto/);
  expect(saved).toMatch(/<w:del\b[^>]*w:author="Ann"[\s\S]*400[\s\S]*<\/w:del>/);
  expect(saved).toMatch(/<w:ins\b[^>]*w:author="Ann"[\s\S]*450[\s\S]*<\/w:ins>/);
});

test("nothing about a document leaves the tab", async ({ page }) => {
  const outside: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE || "http://localhost:5173") && !url.startsWith("blob:") && !url.startsWith("data:")) {
      outside.push(url);
    }
    return route.continue();
  });

  await openDocx(page);
  await choose(page, "fonts.docx", docx([paragraph("Georgia", "Georgia"), paragraph("Calibri", "Calibri")]));
  await expect(surface(page)).toContainText("Calibri");
  await mode(page, "Edit");
  await surface(page).getByText("Georgia").click();
  await page.keyboard.type(" and more");
  await download(page);

  expect(outside).toEqual([]);
});

test("the link carries whether the document is read or written, and nothing of the document", async ({ page }) => {
  await openDocx(page);
  await choose(page, "letter.docx", docx([paragraph("Private words")]));
  await expect(surface(page)).toContainText("Private words");
  await expect.poll(() => new URL(page.url()).hash).toBe("");

  await mode(page, "Edit");
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");
  const link = page.url();
  expect(decodeHash(link)).toEqual({ mode: "edit" });

  await page.goto(`${BASE}/`);
  await page.goto(link);
  await expect(page.getByText("Click to choose a Word document")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Edit" })).toBeChecked();
});

test("the paper opens dark with light text, header included, and white is a click and a link away", async ({ page }) => {
  await openDocx(page);
  await choose(page, "letter.docx", docx([paragraph("Body words")], {}, "Running head"));
  await expect(surface(page)).toContainText("Running head");
  const header = page.locator(".docx-hf:not(.docx-hf--placeholder)").first();
  const body = surface(page).getByText("Body words");
  const toggle = page.getByRole("button", { name: "Dark paper" });

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle.locator(".tabler-icon-sun")).toBeVisible();
  await expect(page.locator(".docx-page").first()).toHaveCSS("background-color", "rgb(51, 51, 51)");
  for (const text of [body, header]) {
    await expect(async () => {
      const { lightest, darkest } = await tones(page, text);
      expect(lightest).toBeGreaterThan(200);
      expect(darkest).toBeGreaterThan(30);
    }).toPass();
  }
  await expect.poll(() => new URL(page.url()).hash).toBe("");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle.locator(".tabler-icon-moon")).toBeVisible();
  await expect(page.locator(".docx-page").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(async () => {
    const { lightest, darkest } = await tones(page, body);
    expect(lightest).toBe(255);
    expect(darkest).toBeLessThan(60);
  }).toPass();

  await expect.poll(() => decodeHash(page.url())).toEqual({ paper: "white" });
  const link = page.url();
  await page.getByRole("button", { name: "Close the document" }).click();
  await expect.poll(() => decodeHash(page.url())).toEqual({});

  await page.goto(`${BASE}/`);
  await page.goto(link);
  await choose(page, "letter.docx", docx([paragraph("Body words")]));
  await expect(surface(page)).toContainText("Body words");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".docx-page").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("closing the document puts the page back as it was found", async ({ page }) => {
  await openDocx(page);
  await choose(page, "letter.docx", docx([paragraph("Short letter")]));
  await expect(surface(page)).toContainText("Short letter");

  await page.getByRole("button", { name: "Close the document" }).click();
  await expect(page.locator(".docx-pane")).toHaveCount(0);
  await expect(page.getByText("Click to choose a Word document")).toBeVisible();
  expect(await page.evaluate(() => window.docxEditor)).toBeUndefined();
});

function textOf(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("");
}

async function tones(page: Page, target: Locator): Promise<{ lightest: number; darkest: number }> {
  const png = (await target.screenshot()).toString("base64");
  return page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let lightest = 0;
    let darkest = 255;
    for (let i = 0; i < data.length; i += 4) {
      const luma = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      lightest = Math.max(lightest, luma);
      darkest = Math.min(darkest, luma);
    }
    return { lightest, darkest };
  }, png);
}

function broken(): Buffer {
  const parts = unzipSync(docx([paragraph("unread")]));
  delete parts["[Content_Types].xml"];
  return Buffer.from(zipSync(parts));
}

function decodeHash(url: string): Record<string, unknown> {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}
