import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const regexEditors: any;

async function openRegex(page: Page) {
  await page.goto(`${BASE}/regex`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).regexEditors !== undefined);
}

function replaceDocument(page: Page, which: "pattern" | "subject", text: string) {
  return page.evaluate(({ which, text }) => {
    const view = regexEditors[which];
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }, { which, text });
}

const readPattern = () => regexEditors.pattern.state.doc.toString();

function toggleFlag(page: Page, letter: string) {
  return page.locator("label.mantine-Chip-label", { hasText: new RegExp(`^${letter}$`) }).click();
}

const flagBox = (page: Page, letter: string) => page.getByRole("checkbox", { name: letter, exact: true });

function expectHighlighted(page: Page, selector: string, texts: string[]) {
  return expect.poll(() => page.locator(`.cm-content ${selector}`).allInnerTexts()).toEqual(texts);
}

function decodeHash(url: string): { pattern?: string; flags?: string; text?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("the sample pattern highlights each match and each group inside it", async ({ page }) => {
  await openRegex(page);

  await expect(page.locator(".cm-content .cm-regex-match")).toHaveCount(3);
  await expectHighlighted(page, ".cm-regex-group-0", ["2024", "2024", "2025"]);
  await expectHighlighted(page, ".cm-regex-group-1", ["01", "02", "12"]);
  await expectHighlighted(page, ".cm-regex-group-2", ["15", "29", "31"]);

  await expect(page.getByText("3 matches")).toBeVisible();
  await expect(page.getByText("Group 1 · year")).toBeVisible();
});

test("the highlight follows the pattern as it is typed", async ({ page }) => {
  await openRegex(page);
  await replaceDocument(page, "subject", "one two three");
  await replaceDocument(page, "pattern", "t(w|hr)");

  await expectHighlighted(page, ".cm-regex-match", ["tw", "thr"]);
  await expectHighlighted(page, ".cm-regex-group-0", ["w", "hr"]);
  await expect(page.getByText("2 matches")).toBeVisible();
});

test("the flags change the search", async ({ page }) => {
  await openRegex(page);
  await replaceDocument(page, "subject", "one One");
  await replaceDocument(page, "pattern", "one");

  await expectHighlighted(page, ".cm-regex-match", ["one"]);

  await toggleFlag(page, "i");
  await expectHighlighted(page, ".cm-regex-match", ["one", "One"]);

  await toggleFlag(page, "g");
  await expectHighlighted(page, ".cm-regex-match", ["one"]);
});

test("turning on v turns off u", async ({ page }) => {
  await openRegex(page);

  await toggleFlag(page, "u");
  await toggleFlag(page, "v");

  await expect(flagBox(page, "u")).not.toBeChecked();
  await expect(flagBox(page, "v")).toBeChecked();
});

test("the breakdown says what each piece of the pattern does", async ({ page }) => {
  await openRegex(page);
  await replaceDocument(page, "pattern", "^a+[0-9]$");

  const explanation = page.locator(".mantine-Card-root").last();
  await expect(explanation).toContainText("Start of the text");
  await expect(explanation).toContainText("Repeat one or more times");
  await expect(explanation).toContainText("greedy");
  await expect(explanation).toContainText("A character in the range");
  await expect(explanation).toContainText("End of the text");
});

test("a pattern that does not compile says so and paints nothing", async ({ page }) => {
  await openRegex(page);
  await replaceDocument(page, "pattern", "(unclosed");

  await expect(page.locator(".cm-content .cm-regex-match")).toHaveCount(0);
  await expect(page.getByText(/Invalid regular expression/)).toBeVisible();

  await replaceDocument(page, "pattern", "(closed)");
  await expect(page.getByText(/Invalid regular expression/)).toHaveCount(0);
});

test("the pattern box stays on one line", async ({ page }) => {
  await openRegex(page);
  await replaceDocument(page, "pattern", "ab\ncd");

  await expect.poll(async () => page.evaluate(readPattern)).toBe("abcd");
});

test("the address bar tracks the pattern, the flags and the text", async ({ page }) => {
  await openRegex(page);
  await replaceDocument(page, "pattern", "shared");
  await replaceDocument(page, "subject", "shared text");
  await toggleFlag(page, "i");

  await expect.poll(async () => decodeHash(page.url()).pattern).toBe("shared");
  await expect.poll(async () => decodeHash(page.url()).text).toBe("shared text");
  await expect.poll(async () => decodeHash(page.url()).flags).toBe("gi");

  await page.goto(page.url());
  await page.waitForFunction(() => (window as any).regexEditors !== undefined);
  await expect.poll(async () => page.evaluate(readPattern)).toBe("shared");
  await expect(flagBox(page, "i")).toBeChecked();
  await expectHighlighted(page, ".cm-regex-match", ["shared"]);
});

test("the editors work with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openRegex(page);
  await replaceDocument(page, "pattern", "offline");
  await replaceDocument(page, "subject", "offline still highlights");

  await expectHighlighted(page, ".cm-regex-match", ["offline"]);
  expect(blocked).toEqual([]);
});
