import { expect, Page, test } from "@playwright/test";

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
