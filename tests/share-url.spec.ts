import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

test("an untouched utility keeps a clean URL", async ({ page }) => {
  await openCodec(page);

  await page.waitForTimeout(SETTLE_MS);
  expect(new URL(page.url()).hash).toBe("");
});

test("the address bar tracks the input", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("hello");
  await expect.poll(() => hashState(page).input).toBe("hello");

  await page.getByPlaceholder("Text to encode").fill("hello again");
  await expect.poll(() => hashState(page).input).toBe("hello again");
});

test("the tracked URL restores the state on its own", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("copy me");
  await page.getByText("Decode", { exact: true }).click();
  await expect.poll(() => hashState(page).mode).toBe("decode");

  const shared = page.url();
  const other = await page.context().newPage();
  await other.goto(shared);
  await expect(other.getByPlaceholder(/to decode$/)).toHaveValue("copy me");
  expect(new URL(other.url()).hash).not.toBe("");
});

test("reloading the tracked URL keeps the state", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("survives");
  await expect.poll(() => hashState(page).input).toBe("survives");

  await page.reload();
  await expect(page.getByPlaceholder("Text to encode")).toHaveValue("survives");
});

test("moving to another utility drops the fragment", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("codec only");
  await expect.poll(() => hashState(page).input).toBe("codec only");

  await page.getByText("Unique ID", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Generate Unique ID" })).toBeVisible();

  await page.waitForTimeout(SETTLE_MS);
  expect(new URL(page.url()).hash).toBe("");
});

test("coming back to a tracked URL restores it", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("before leaving");
  await expect.poll(() => hashState(page).input).toBe("before leaving");

  await page.getByText("JSON", { exact: true }).click();
  await expect(page.locator(".cm-editor").first()).toBeVisible();

  await page.goBack();
  await expect(page.getByPlaceholder("Text to encode")).toHaveValue("before leaving");
});

test("the link carries only the settings the current view uses", async ({ page }) => {
  await page.goto(`${BASE}/hasher`);
  await page.getByPlaceholder("Text to hash").fill("abc");

  await expect.poll(() => Object.keys(hashState(page)).sort()).toEqual([
    "algorithm",
    "format",
    "input",
    "variant",
  ]);

  await page.getByRole("combobox", { name: "Algorithm" }).click();
  await page.getByRole("option", { name: "Argon2", exact: true }).click();

  await expect.poll(() => Object.keys(hashState(page)).sort()).toEqual([
    "algorithm",
    "input",
    "iterations",
    "memory",
    "parallelism",
    "salt",
    "variant",
  ]);
});

test("resetting puts the utility back to how it opens and drops the fragment", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("throw me away");
  await page.getByText("Decode", { exact: true }).click();
  await expect.poll(() => hashState(page).input).toBe("throw me away");

  await resetState(page);

  await expect(page.getByPlaceholder("Text to encode")).toHaveValue("");
  await page.waitForTimeout(SETTLE_MS);
  expect(new URL(page.url()).hash).toBe("");
});

test("a reset asked for and called off leaves the state alone", async ({ page }) => {
  await openCodec(page);

  await page.getByPlaceholder("Text to encode").fill("keep me");
  await expect.poll(() => hashState(page).input).toBe("keep me");

  await page.getByRole("button", { name: "Reset state" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByPlaceholder("Text to encode")).toHaveValue("keep me");
  expect(hashState(page).input).toBe("keep me");
});

test("resetting restores a document that lives outside React", async ({ page }) => {
  await page.goto(`${BASE}/json`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).editorView !== undefined);

  await page.locator(".cm-content").click();
  await page.keyboard.type("typed over the sample", { delay: 0 });
  await expect.poll(() => hashState(page).value).toContain("typed over the sample");

  await resetState(page);

  await page.waitForFunction(() => (window as any).editorView !== undefined);
  await expect
    .poll(() => page.evaluate(() => (window as any).editorView.state.doc.toString()))
    .toBe("{\n  \"hello\": \"world\"\n}");
  expect(new URL(page.url()).hash).toBe("");
});

const SETTLE_MS = 1000;

async function resetState(page: Page) {
  await page.getByRole("button", { name: "Reset state" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
}

async function openCodec(page: Page) {
  await page.goto(`${BASE}/codec`);
  await expect(page.getByPlaceholder("Text to encode")).toBeVisible();
}

function hashState(page: Page): Record<string, string> {
  let b64 = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}
