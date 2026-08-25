import { expect, Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const BASE = process.env.PW_BASE_URL ?? "";

declare const markdownEditor: any;

async function openMarkdown(page: Page) {
  await page.goto(`${BASE}/markdown`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).markdownEditor !== undefined);
}

const readEditor = () => markdownEditor.state.doc.toString();

function replaceDocument(page: Page, text: string) {
  return page.evaluate((text) => {
    markdownEditor.dispatch({ changes: { from: 0, to: markdownEditor.state.doc.length, insert: text } });
  }, text);
}

function select(page: Page, from: number, to: number) {
  return page.evaluate(({ from, to }) => {
    markdownEditor.focus();
    markdownEditor.dispatch({ selection: { anchor: from, head: to } });
  }, { from, to });
}

function chooseView(page: Page, view: string) {
  return page.locator("label", { hasText: view }).click();
}

function decodeHash(url: string): { value?: string; flavour?: string; view?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("the preview renders what the editor holds", async ({ page }) => {
  await openMarkdown(page);
  await expect(page.locator(".markdown-preview h1")).toHaveText("Markdown");

  await replaceDocument(page, "# Hello\n\nSome **bold** words.");

  await expect(page.locator(".markdown-preview h1")).toHaveText("Hello");
  await expect(page.locator(".markdown-preview strong")).toHaveText("bold");
});

test("the format bar marks the selection and the editor can take it back", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "hello world");
  await select(page, 6, 11);

  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect.poll(async () => page.evaluate(readEditor)).toBe("hello **world**");

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => page.evaluate(readEditor)).toBe("hello world");
});

test("the shortcuts mark the selection too", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "hello world");
  await select(page, 6, 11);

  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(async () => page.evaluate(readEditor)).toBe("hello **world**");
});

test("a line marker is a toggle", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "one\ntwo");
  await select(page, 0, 7);

  await page.getByRole("button", { name: "Bullet List" }).click();
  await expect.poll(async () => page.evaluate(readEditor)).toBe("- one\n- two");

  await page.getByRole("button", { name: "Bullet List" }).click();
  await expect.poll(async () => page.evaluate(readEditor)).toBe("one\ntwo");
});

test("the view hands the region to one half or shares it", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Kept");

  await chooseView(page, "Editor");
  await expect(page.locator(".markdown-preview")).toBeHidden();
  await expect(page.locator(".cm-editor").first()).toBeVisible();

  await chooseView(page, "Preview");
  await expect(page.locator(".cm-editor").first()).toBeHidden();
  await expect(page.locator(".markdown-preview h1")).toHaveText("Kept");

  await chooseView(page, "Split");
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await expect.poll(async () => page.evaluate(readEditor)).toBe("# Kept");
});

test("the flavour decides how the document is read", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "~~gone~~");
  await expect(page.locator(".markdown-preview del")).toHaveText("gone");

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "CommonMark" }).click();

  await expect(page.locator(".markdown-preview del")).toHaveCount(0);
  await expect(page.locator(".markdown-preview p")).toHaveText("~~gone~~");
});

test("a script in the document is not run", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    return dialog.dismiss();
  });

  await openMarkdown(page);
  await replaceDocument(page, "<script>alert('xss')</script>\n\n<img src=x onerror=\"alert('xss')\">");

  await expect(page.locator(".markdown-preview img")).toHaveCount(1);
  expect(await page.locator(".markdown-preview img").getAttribute("onerror")).toBeNull();
  expect(dialogs).toEqual([]);
});

const GROUP_MS = 600;

test("a chosen file becomes the document, and the editor can take it back", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Being written");
  await page.waitForTimeout(GROUP_MS);

  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("\ufeff# From a file\n\nSome **bold** words."),
  });

  await expect.poll(async () => page.evaluate(readEditor)).toBe("# From a file\n\nSome **bold** words.");
  await expect(page.locator(".markdown-preview h1")).toHaveText("From a file");
  await expect.poll(async () => decodeHash(page.url()).value).toBe("# From a file\n\nSome **bold** words.");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => page.evaluate(readEditor)).toBe("# Being written");
});

test("a dropped file replaces the document instead of landing at the caret", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Being written");

  const dropped = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["# Dropped\n"], "notes.md", { type: "text/markdown" }));
    return transfer;
  });

  const content = page.locator(".cm-content");
  await content.dispatchEvent("dragover", { dataTransfer: dropped });
  await expect(page.locator(".markdown-editor-pane")).toHaveAttribute("data-dragging", "true");

  await content.dispatchEvent("drop", { dataTransfer: dropped });
  await expect.poll(async () => page.evaluate(readEditor)).toBe("# Dropped\n");
  await expect(page.locator(".markdown-editor-pane")).not.toHaveAttribute("data-dragging", "true");
});

test("a file that is not text is refused and the document is left alone", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Being written");

  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "picture.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe]),
  });

  await expect(page.getByText("That file did not open")).toBeVisible();
  expect(await page.evaluate(readEditor)).toBe("# Being written");
});

function save(page: Page, format: string) {
  return page.getByRole("button", { name: "Download" }).click()
    .then(() => page.getByRole("menuitem", { name: format }).click());
}

test("the document comes down as itself, under the name its heading gives it", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Release Notes\n\nSome **bold** words.");

  const saving = page.waitForEvent("download");
  await save(page, "Markdown");
  const saved = await saving;

  expect(saved.suggestedFilename()).toBe("release-notes.md");
  expect(readFileSync((await saved.path())!).toString()).toBe("# Release Notes\n\nSome **bold** words.");
});

test("the HTML is the preview as a page of its own, styled and sanitised", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Release Notes\n\nSome **bold** words.\n\n<script>alert(1)</script>");

  const saving = page.waitForEvent("download");
  await save(page, "HTML");
  const saved = await saving;

  expect(saved.suggestedFilename()).toBe("release-notes.html");

  const html = readFileSync((await saved.path())!).toString();
  expect(html).toContain("<title>Release Notes</title>");
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("<style>");
  expect(html).not.toMatch(/<link\b/);
  expect(html).not.toContain("<script");
});

function readPdf(path: string) {
  const raw = readFileSync(path);
  let text = 0;

  for (const match of raw.toString("latin1").matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    try {
      text += (inflateSync(raw.subarray(start, end)).toString("latin1").match(/\b(Tj|TJ)\b/g) ?? []).length;
    } catch {
    }
  }

  return { bytes: raw.length, head: raw.subarray(0, 5).toString(), embedded: raw.includes("/FontFile"), text };
}

test("a PDF is written here, as text and not as a picture of the page", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Release Notes\n\nSome **bold** words, and a `codespan` beside them.");

  const saving = page.waitForEvent("download");
  await save(page, "PDF");
  const saved = await saving;

  expect(saved.suggestedFilename()).toBe("release-notes.pdf");

  const pdf = readPdf((await saved.path())!);
  expect(pdf.head).toBe("%PDF-");
  expect(pdf.embedded).toBe(true);
  expect(pdf.text).toBeGreaterThan(0);
  expect(pdf.bytes).toBeLessThan(200_000);
});

test("the writer is fetched when a PDF is asked for and not before", async ({ page }) => {
  const chunks: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/pdfmake/i.test(path)) chunks.push(path);
  });

  await openMarkdown(page);
  await page.waitForTimeout(500);
  expect(chunks).toEqual([]);

  const saving = page.waitForEvent("download");
  await save(page, "PDF");
  await saving;
  expect(chunks.length).toBeGreaterThan(0);
});

test("the address bar tracks the document, the flavour and the view", async ({ page }) => {
  await openMarkdown(page);
  await replaceDocument(page, "# Shared");
  await chooseView(page, "Preview");

  await expect.poll(async () => decodeHash(page.url()).value).toBe("# Shared");
  await expect.poll(async () => decodeHash(page.url()).view).toBe("preview");

  await page.goto(page.url());
  await expect(page.locator(".markdown-preview h1")).toHaveText("Shared");
  await expect(page.getByRole("radio", { name: "Preview" })).toBeChecked();
});

test("the editor and the preview work with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openMarkdown(page);
  await replaceDocument(page, "# Offline");

  await expect(page.locator(".markdown-preview h1")).toHaveText("Offline");
  expect(blocked).toEqual([]);
});
