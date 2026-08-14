import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const diffEditors: any;

async function openDiff(page: Page) {
  await page.goto(`${BASE}/diff`);
  await expect(page.locator(".cm-editor")).toHaveCount(2);
  await page.waitForFunction(() => (window as any).diffEditors !== undefined);
}

function setDocuments(page: Page, left: string, right: string) {
  return page.evaluate(({ left, right }) => {
    for (const [view, text] of [[diffEditors.left, left], [diffEditors.right, right]] as const) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    }
  }, { left, right });
}

const readDocuments = () => ({
  left: diffEditors.left.state.doc.toString(),
  right: diffEditors.right.state.doc.toString(),
});

const clickDiff = (page: Page) => page.getByRole("button", { name: "Diff" }).click();

test("both editors are there, side by side", async ({ page }) => {
  await openDiff(page);

  await expect(page.getByText("Original", { exact: true })).toBeVisible();
  await expect(page.getByText("Changed", { exact: true })).toBeVisible();

  const boxes = await page.locator(".cm-editor").evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().left)
  );
  expect(boxes[1]).toBeGreaterThan(boxes[0]);
});

test("nothing is marked until the diff is asked for", async ({ page }) => {
  await openDiff(page);

  await expect(page.locator(".cm-diff-removed")).toHaveCount(0);
  await expect(page.locator(".cm-diff-added")).toHaveCount(0);

  await clickDiff(page);
  await expect(page.locator(".cm-diff-removed")).not.toHaveCount(0);
});

test("a removed line goes red and an added line goes green", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "same\ngone\n", "same\nnew\nextra\n");
  await clickDiff(page);

  await expect(page.locator(".cm-diff-removed")).toHaveText(["gone"]);
  await expect(page.locator(".cm-diff-added")).toHaveText(["new", "extra"]);
  await expect(page.getByText("1 line removed, 2 lines added")).toBeVisible();
});

test("the word that changed is marked inside the line", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "jumps over the lazy dog\n", "leaps over the lazy dog\n");
  await clickDiff(page);

  await expect(page.locator(".cm-diff-removed-text")).toHaveText(["jumps"]);
  await expect(page.locator(".cm-diff-added-text")).toHaveText(["leaps"]);
});

test("matching documents say so and are left unmarked", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "one\ntwo\n", "one\ntwo\n");
  await clickDiff(page);

  await expect(page.getByText("The documents are identical")).toBeVisible();
  await expect(page.locator(".cm-diff-removed")).toHaveCount(0);
  await expect(page.locator(".cm-diff-added")).toHaveCount(0);
});

test("editing either side drops the marks until the diff is asked for again", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "same\ngone\n", "same\nnew\n");
  await clickDiff(page);
  await expect(page.locator(".cm-diff-removed")).toHaveCount(1);

  await page.locator(".cm-content").first().click();
  await page.keyboard.type("edited", { delay: 0 });

  await expect(page.locator(".cm-diff-removed")).toHaveCount(0);
  await expect(page.locator(".cm-diff-added")).toHaveCount(0);
  await expect(page.getByText("1 line removed, 1 line added")).toHaveCount(0);
});

test("swap exchanges the two documents", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "on the left\n", "on the right\n");

  await page.getByRole("button", { name: "Swap" }).click();

  await expect
    .poll(async () => await page.evaluate(readDocuments))
    .toEqual({ left: "on the right\n", right: "on the left\n" });
});

test("a swap can be undone", async ({ page }) => {
  await openDiff(page);
  const before = await page.evaluate(readDocuments);

  await page.getByRole("button", { name: "Swap" }).click();
  await expect
    .poll(async () => (await page.evaluate(readDocuments)).left)
    .toBe(before.right);

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+z");

  await expect
    .poll(async () => (await page.evaluate(readDocuments)).left)
    .toBe(before.left);
});

test("picking a language colours the code", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "const answer = 42;\n", "const answer = 43;\n");

  await expect(page.locator(".cm-line span")).toHaveCount(0);

  await selectLanguage(page, "JavaScript");

  await expect(page.locator(".cm-line span").first()).toBeVisible();
});

test("the language survives being switched back to plain text", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "const answer = 42;\n", "const answer = 43;\n");

  await selectLanguage(page, "JavaScript");
  await expect(page.locator(".cm-line span").first()).toBeVisible();

  await selectLanguage(page, "Plain Text");
  await expect(page.locator(".cm-line span")).toHaveCount(0);

  expect(await page.evaluate(readDocuments)).toEqual({
    left: "const answer = 42;\n",
    right: "const answer = 43;\n",
  });
});

test("the address bar tracks both documents and the language", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "tracked left\n", "tracked right\n");

  await expect.poll(() => hashState(page).left).toBe("tracked left\n");
  await expect.poll(() => hashState(page).right).toBe("tracked right\n");
  await expect.poll(() => hashState(page).language).toBe("text");
});

test("a link copied with a diff showing brings the marks back", async ({ page }) => {
  await openDiff(page);
  await setDocuments(page, "same\ngone\n", "same\nnew\n");
  await clickDiff(page);
  await expect.poll(() => hashState(page).diffed).toBe(true);

  const shared = page.url();
  const other = await page.context().newPage();
  await other.goto(shared);

  await expect(other.locator(".cm-diff-removed")).toHaveText(["gone"]);
  await expect(other.locator(".cm-diff-added")).toHaveText(["new"]);
});

test("the editors and every language work with third-party requests blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openDiff(page);

  for (const [language, snippet] of SNIPPETS) {
    await setDocuments(page, snippet, snippet);
    await selectLanguage(page, "Plain Text");
    await expect(page.locator(".cm-line span")).toHaveCount(0);

    await selectLanguage(page, language);
    await expect(page.locator(".cm-line span").first()).toBeVisible();
  }

  await setDocuments(page, "same\ngone\n", "same\nnew\n");
  await clickDiff(page);
  await expect(page.locator(".cm-diff-removed")).toHaveText(["gone"]);
  expect(blocked).toEqual([]);
});

const SNIPPETS: [string, string][] = [
  ["Python", "# a comment\nname = \"value\"\n"],
  ["TypeScript", "// a comment\nconst name: string = \"value\";\n"],
  ["Shell", "# a comment\nname=\"value\"\n"],
  ["YAML", "# a comment\nname: \"value\"\n"],
];

async function selectLanguage(page: Page, language: string) {
  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: language, exact: true }).click();
}

function hashState(page: Page): Record<string, any> {
  let b64 = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}
