import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_SIZE, lineBaseline, MARGIN, PAGE, pdf } from "./pdf-fixtures";
import { tool } from "./tool";

const BASE = process.env.PW_BASE_URL ?? "";

const LETTER = [["The quick brown fox jumps", "over the lazy dog.", "Signed:"], ["Second page"]];
const PICTURE = join(import.meta.dirname, "../src/images/og-image.png");

const INK = 15;
const FREETEXT = 3;
const HIGHLIGHT = 9;
const SQUARE = 5;
const STAMP = 13;

async function openPdf(page: Page) {
  await page.goto(`${BASE}/pdf`);
  await expect(page.getByText("Click to choose a PDF")).toBeVisible();
}

async function choose(page: Page, name: string, buffer: Buffer) {
  await page.locator(".file-dropzone input[type=\"file\"]").setInputFiles({ name, mimeType: "", buffer });
}

async function opened(page: Page, name: string, buffer: Buffer) {
  await choose(page, name, buffer);
  await expect(page.locator(".pdf-page").first()).toBeVisible();
}

async function fitPage(page: Page) {
  await page.getByRole("button", { name: "Zoom level" }).click();
  await page.getByRole("menuitem", { name: "Fit page" }).click();
  await expect(async () => {
    const box = (await page.locator(".pdf-page").first().boundingBox())!;
    expect(box.height).toBeLessThanOrEqual((await page.locator(".pdf-viewport").boundingBox())!.height);
  }).toPass();
}

async function at(page: Page, x: number, y: number, pageNumber = 1): Promise<{ x: number; y: number }> {
  const box = (await page.locator(`.pdf-page[data-page="${pageNumber}"]`).boundingBox())!;
  const scale = box.width / PAGE.width;
  return { x: box.x + x * scale, y: box.y + (PAGE.height - y) * scale };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function marks(page: Page): Promise<Mark[]> {
  return page.evaluate(() => {
    const registry = window.pdfRegistry;
    if (!registry) return [];
    const provides = <T>(id: string) => (registry.getPlugin(id) as unknown as { provides(): T }).provides();
    const documents = provides<{ getActiveDocumentId(): string }>("document-manager");
    const annotation = provides<{
      forDocument(id: string): { getAnnotations(): { object: Record<string, unknown>; commitState: string }[] };
    }>("annotation");
    return annotation.forDocument(documents.getActiveDocumentId()).getAnnotations().map(({ object, commitState }) => ({
      synced: commitState === "synced",
      type: object.type as number,
      subject: object.subject as string | undefined,
      contents: object.contents as string | undefined,
      stroke: object.strokeColor as string | undefined,
    }));
  });
}

interface Mark {
  synced: boolean;
  type: number;
  subject?: string;
  contents?: string;
  stroke?: string;
}

async function settled(page: Page, count: number) {
  await expect.poll(async () => {
    const all = await marks(page);
    return all.length === count && all.every(({ synced }) => synced);
  }).toBe(true);
}

async function download(page: Page): Promise<{ name: string; bytes: Buffer }> {
  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF" }).click();
  const saved = await saving;
  return { name: saved.suggestedFilename(), bytes: readFileSync((await saved.path())!) };
}

function subtypes(bytes: Buffer): string[] {
  return [...new Set(bytes.toString("latin1").match(/\/Subtype\s*\/\w+/g)?.map((match) => match.split("/")[2]))];
}

test("a PDF opens with the tools out, every page drawn and counted, and a drag with none chosen marks nothing", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));

  await expect(page.locator(".pdf-page")).toHaveCount(2);
  await expect(page.locator("[data-pdf=\"pages\"]")).toHaveText("Page 1 of 2");
  await expect(page.getByRole("button", { name: "Draw", exact: true })).toHaveAttribute("aria-pressed", "false");

  await drag(page, await at(page, 200, 400), await at(page, 400, 300));
  await page.waitForTimeout(500);
  expect(await marks(page)).toEqual([]);
});

test("marks drawn, typed, highlighted and outlined go into the file and come back when it is opened", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await drag(page, await at(page, 300, 560), await at(page, 420, 520));
  await expect.poll(async () => (await marks(page)).map(({ type }) => type)).toEqual([INK]);

  await page.getByRole("button", { name: "Text", exact: true }).click();
  const box = await at(page, 300, 450);
  await page.mouse.click(box.x, box.y);
  await expect(page.locator("[contenteditable=\"true\"]")).toBeFocused();
  await page.keyboard.type("Approved");
  const away = await at(page, 560, 60);
  await page.mouse.click(away.x, away.y);

  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  const line = lineBaseline(0) + FONT_SIZE / 3;
  await drag(page, await at(page, MARGIN + 2, line), await at(page, MARGIN + 200, line));

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await drag(page, await at(page, 80, 300), await at(page, 200, 220));

  await expect.poll(async () => (await marks(page)).map(({ type }) => type).sort())
    .toEqual([FREETEXT, SQUARE, HIGHLIGHT, INK].sort());
  expect((await marks(page)).find(({ type }) => type === FREETEXT)?.contents).toBe("Approved");

  const { name, bytes } = await download(page);
  expect(name).toBe("letter.pdf");
  expect(subtypes(bytes)).toEqual(expect.arrayContaining(["Ink", "FreeText", "Highlight", "Square"]));

  await page.getByRole("button", { name: "Close the PDF" }).click();
  await opened(page, "letter.pdf", bytes);
  await expect.poll(async () => (await marks(page)).map(({ type }) => type).sort())
    .toEqual([FREETEXT, SQUARE, HIGHLIGHT, INK].sort());
  expect((await marks(page)).find(({ type }) => type === FREETEXT)?.contents).toBe("Approved");
});

test("a picture is chosen first and then placed where the page is clicked", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  const image = page.getByRole("button", { name: "Image", exact: true });
  const chooser = page.waitForEvent("filechooser");
  await image.click();
  await (await chooser).setFiles(PICTURE);
  await expect(image).toHaveAttribute("aria-pressed", "true");

  const where = await at(page, 300, 200);
  await page.mouse.move(where.x, where.y);
  await page.mouse.click(where.x, where.y);
  await expect.poll(async () => (await marks(page)).map(({ type }) => type)).toEqual([STAMP]);
  await expect(image).toHaveAttribute("aria-pressed", "false");

  expect(subtypes((await download(page)).bytes)).toEqual(expect.arrayContaining(["Stamp", "Image"]));
});

test("a signature is drawn, asked for when missing, placed with a click, and kept for the next page", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  await page.getByRole("button", { name: "Signature", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New signature" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Place signature" }).click();
  await expect(dialog.getByText("Draw a signature in the box first.")).toBeVisible();

  const pad = (await dialog.locator(".pdf-signature-pad canvas").boundingBox())!;
  await page.mouse.move(pad.x + 40, pad.y + 80);
  await page.mouse.down();
  for (let step = 1; step <= 20; step++) {
    await page.mouse.move(pad.x + 40 + step * 12, pad.y + 80 + Math.sin(step) * 25);
  }
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Place signature" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Signature", exact: true })).toHaveAttribute("aria-pressed", "true");

  const first = await at(page, 150, 640);
  await page.mouse.move(first.x, first.y);
  await page.mouse.click(first.x, first.y);
  await expect.poll(async () => await marks(page)).toEqual([
    expect.objectContaining({ type: INK, subject: "Signature" }),
  ]);

  await page.getByRole("button", { name: "Signature", exact: true }).click();
  await page.getByRole("menuitem", { name: "Signature 1" }).click();
  const second = await at(page, 400, 200);
  await page.mouse.move(second.x, second.y);
  await page.mouse.click(second.x, second.y);
  await expect.poll(async () => (await marks(page)).filter(({ subject }) => subject === "Signature")).toHaveLength(2);

  await page.locator(".pdf-toolbar input[accept=\".pdf,application/pdf\"]").setInputFiles({
    name: "next.pdf",
    mimeType: "",
    buffer: pdf([["Next"]]),
  });
  await expect(page.locator(".pdf-page")).toHaveCount(1);
  await page.getByRole("button", { name: "Signature", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Signature 1" })).toBeVisible();
});

test("a typed signature is set in the handwriting face this site serves", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  await page.getByRole("button", { name: "Signature", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New signature" });
  await dialog.getByRole("tab", { name: "Type" }).click();
  await dialog.locator(".pdf-signature-pad input[type=\"text\"]").fill("Ann Other");
  expect(await page.evaluate(() => document.fonts.check("48px 'Dancing Script Variable'"))).toBe(true);
  await expect(async () => {
    await dialog.getByRole("button", { name: "Place signature" }).click();
    await expect(dialog).toBeHidden();
  }).toPass();

  const where = await at(page, 150, 640);
  await page.mouse.move(where.x, where.y);
  await page.mouse.click(where.x, where.y);
  await expect.poll(async () => await marks(page)).toEqual([
    expect.objectContaining({ type: STAMP, subject: "Signature" }),
  ]);
});

test("the swatch recolours the mark just drawn and the ones the tool draws next", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  await expect(page.getByRole("button", { name: "Colour and size" })).toBeDisabled();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await drag(page, await at(page, 80, 300), await at(page, 200, 220));
  await expect.poll(async () => (await marks(page)).map(({ stroke }) => stroke)).toEqual(["#E44234"]);

  await page.getByRole("button", { name: "Colour and size" }).click();
  await page.getByRole("button", { name: "Blue" }).click();
  await expect.poll(async () => (await marks(page)).map(({ stroke }) => stroke)).toEqual(["#597CE2"]);
  await page.keyboard.press("Escape");

  await drag(page, await at(page, 300, 300), await at(page, 400, 220));
  await expect.poll(async () => (await marks(page)).map(({ stroke }) => stroke)).toEqual(["#597CE2", "#597CE2"]);
});

test("Delete takes the selected mark off, and undo and redo put it back and take it away again", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await drag(page, await at(page, 80, 300), await at(page, 200, 220));
  await settled(page, 1);

  await page.keyboard.press("Delete");
  await settled(page, 0);
  await page.keyboard.press("Control+z");
  await settled(page, 1);
  await page.keyboard.press("Control+Shift+z");
  await settled(page, 0);
  await page.getByRole("button", { name: "Undo" }).click();
  await settled(page, 1);
});

test("a locked PDF asks for its password, says when it is wrong, and is saved locked", async ({ page }) => {
  await openPdf(page);
  await choose(page, "salary.pdf", pdf([["Salary: 100"]], { password: "s3cret" }));
  const password = page.getByRole("textbox", { name: "Password" });
  await expect(password).toBeVisible();

  await page.getByRole("button", { name: "Open" }).click();
  await expect(tool(page).getByText("Required")).toBeVisible();

  await password.fill("wrong");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(tool(page).getByText("That is not the password this PDF was locked with.")).toBeVisible();

  await password.fill("s3cret");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.locator(".pdf-page")).toHaveCount(1);
  expect((await download(page)).bytes.toString("latin1")).toMatch(/\/Encrypt\s+\d+\s+0\s+R/);
});

test("a file that is not a PDF is refused, and says what it is instead", async ({ page }) => {
  await openPdf(page);

  await choose(page, "page.pdf", Buffer.from("<!DOCTYPE html><html><body>Not found</body></html>"));
  await expect(tool(page).getByRole("alert")).toContainText("That is a web page saved under a PDF's name");

  await choose(page, "minutes.pdf", Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  await expect(tool(page).getByRole("alert")).toContainText("That file is a damaged zip archive, not a PDF.");
  await expect(page.locator(".pdf-pane")).toHaveCount(0);
});

test("a damaged PDF is taken back off the page with a reason", async ({ page }) => {
  await openPdf(page);
  await choose(page, "broken.pdf", Buffer.from("%PDF-1.7\nthis was a PDF once\n"));

  await expect(tool(page).getByRole("alert")).toContainText(
    "That file starts like a PDF but is too damaged for anything to be read out of it.",
  );
  await expect(page.locator(".pdf-pane")).toHaveCount(0);
  await expect(page.getByText("Click to choose a PDF")).toBeVisible();
});

test("a link to a page scrolls to it, and a link to an address opens in a tab of its own", async ({ page, context }) => {
  await context.route("https://example.com/**", (route) => route.fulfill({ body: "elsewhere" }));
  const rect = (y: number): [number, number, number, number] => [MARGIN, y - 4, MARGIN + 240, y + FONT_SIZE];
  await openPdf(page);
  await opened(
    page,
    "contents.pdf",
    pdf([["Go to the appendix", "Read the terms"], ["Middle"], ["Appendix"]], {
      links: [
        { page: 0, rect: rect(lineBaseline(0)), toPage: 2 },
        { page: 0, rect: rect(lineBaseline(1)), uri: "https://example.com/terms" },
      ],
    }),
  );
  await fitPage(page);

  const opening = context.waitForEvent("page");
  const terms = await at(page, MARGIN + 60, lineBaseline(1) + 4);
  await page.mouse.click(terms.x, terms.y);
  expect((await opening).url()).toBe("https://example.com/terms");
  await page.waitForTimeout(500);
  expect(context.pages()).toHaveLength(2);
  await expect(page.getByRole("button", { name: "Delete this mark" })).toHaveCount(0);

  const appendix = await at(page, MARGIN + 60, lineBaseline(0) + 4);
  await page.mouse.click(appendix.x, appendix.y);
  await expect(page.locator("[data-pdf=\"pages\"]")).toHaveText("Page 3 of 3");
});

test("text selected with no tool chosen is copied as text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);

  const line = lineBaseline(0) + FONT_SIZE / 3;
  await drag(page, await at(page, MARGIN + 1, line), await at(page, MARGIN + 150, line));
  await page.getByRole("button", { name: "Copy" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^The quick/);
});

test("nothing about a document leaves the tab", async ({ page }) => {
  const outside: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE || "http://localhost:4173") && !url.startsWith("blob:") && !url.startsWith("data:")) {
      outside.push(url);
    }
    return route.continue();
  });

  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));
  await fitPage(page);
  await page.getByRole("button", { name: "Signature", exact: true }).click();
  await page.getByRole("tab", { name: "Type" }).click();
  await page.locator(".pdf-signature-pad input[type=\"text\"]").fill("Ann Other");
  await page.getByRole("button", { name: "Cancel" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await (await chooser).setFiles(PICTURE);
  const where = await at(page, 300, 300);
  await page.mouse.move(where.x, where.y);
  await page.mouse.click(where.x, where.y);
  await download(page);

  expect(outside).toEqual([]);
});

test("the engine is fetched when a document is chosen and not before", async ({ page }) => {
  const engines: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith(".wasm") && !url.searchParams.has("import")) engines.push(url.pathname);
  });

  await openPdf(page);
  await page.waitForTimeout(500);
  expect(engines).toEqual([]);

  await opened(page, "letter.pdf", pdf(LETTER));
  expect(engines.filter((path) => /pdfium/.test(path))).toHaveLength(1);
});

test("the link carries nothing of the document, however much of it is marked", async ({ page }) => {
  await openPdf(page);
  await opened(page, "private.pdf", pdf([["Private words"]]));
  await fitPage(page);

  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await drag(page, await at(page, 80, 300), await at(page, 200, 220));
  await settled(page, 1);
  await page.waitForTimeout(500);
  expect(new URL(page.url()).hash).toBe("");
});

test("closing the PDF puts the page back as it was found", async ({ page }) => {
  await openPdf(page);
  await opened(page, "letter.pdf", pdf(LETTER));

  await page.getByRole("button", { name: "Close the PDF" }).click();
  await expect(page.locator(".pdf-pane")).toHaveCount(0);
  await expect(page.getByText("Click to choose a PDF")).toBeVisible();
  expect(await page.evaluate(() => window.pdfRegistry)).toBeUndefined();
});

test("the screen is claimed for a document and not for the card asking for one", async ({ page }) => {
  const articleTop = async () => (await page.locator("article.page-article").boundingBox())!.y;
  const { height } = page.viewportSize()!;
  await openPdf(page);
  expect(await articleTop()).toBeLessThan(height);

  await opened(page, "letter.pdf", pdf(LETTER));
  expect(await articleTop()).toBeGreaterThan(height);

  await page.getByRole("button", { name: "Close the PDF" }).click();
  await expect(page.getByText("Click to choose a PDF")).toBeVisible();
  expect(await articleTop()).toBeLessThan(height);
});
