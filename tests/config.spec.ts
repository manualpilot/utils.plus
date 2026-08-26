import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const configEditors: any;

async function openConfig(page: Page) {
  await page.goto(`${BASE}/config`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).configEditors !== undefined);
}

const readDocument = (which: "source" | "target") => configEditors[which].state.doc.toString();

const documentOf = (page: Page, which: "source" | "target") => page.evaluate(readDocument, which);

function replaceDocument(page: Page, which: "source" | "target", text: string) {
  return page.evaluate(({ which, text }) => {
    const view = configEditors[which];
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }, { which, text });
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function convert(page: Page) {
  await page.getByRole("button", { name: /^Convert to / }).click();
  await page.getByRole("button", { name: "Replace", exact: true }).click();
}

function decodeHash(url: string): { from?: string; to?: string; indent?: string; source?: string; output?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("opens on the two samples, which are the same document twice", async ({ page }) => {
  await openConfig(page);

  await expect(page.getByText("YAML — source")).toBeVisible();
  await expect(page.getByText("JSON — result")).toBeVisible();
  expect(await documentOf(page, "source")).toContain("database:");
  expect(JSON.parse(await documentOf(page, "target"))).toMatchObject({ database: { port: 5432 } });
});

test("converts the source into the pane beside it", async ({ page }) => {
  await openConfig(page);

  await replaceDocument(page, "source", "greeting: hello\ncount: 3\n");
  await convert(page);

  expect(JSON.parse(await documentOf(page, "target"))).toEqual({ greeting: "hello", count: 3 });
});

test("carries a nested document all the way out to a flat format and back", async ({ page }) => {
  await openConfig(page);

  await choose(page, "To", ".env");
  await replaceDocument(page, "source", "database:\n  host: localhost\n  port: 5432\n");
  await convert(page);
  expect(await documentOf(page, "target")).toBe("database__host=localhost\ndatabase__port=5432\n");

  await page.getByRole("button", { name: "Swap" }).click();
  await convert(page);
  expect(await documentOf(page, "target")).toBe("database:\n  host: localhost\n  port: 5432\n");
});

test("says where a document it cannot read stopped making sense, and writes nothing", async ({ page }) => {
  await openConfig(page);

  const before = await documentOf(page, "target");
  await replaceDocument(page, "source", "a: 1\na: 2\n");
  await page.getByRole("button", { name: /^Convert to / }).click();

  await expect(page.getByText("Nothing was written")).toBeVisible();
  await expect(page.getByText(/line 2, column 1/)).toBeVisible();
  expect(await documentOf(page, "target")).toBe(before);
});

test("names the keys the target format had no way to hold", async ({ page }) => {
  await openConfig(page);

  await choose(page, "To", "TOML");
  await replaceDocument(page, "source", "kept: 1\ndropped: null\n");
  await convert(page);

  await expect(page.getByText(/TOML has no way to hold everything/)).toBeVisible();
  await expect(page.getByText(/Nothing was written for dropped/)).toBeVisible();
  expect(await documentOf(page, "target")).toBe("kept = 1\n");
});

test("the indent only appears for a format with something to indent", async ({ page }) => {
  await openConfig(page);

  const indent = page.getByRole("combobox", { name: "Indent", exact: true });
  await expect(indent).toBeVisible();

  await choose(page, "To", ".properties");
  await expect(indent).toHaveCount(0);

  await choose(page, "To", "YAML");
  await expect(indent).toBeVisible();
});

test("picking the format the other pane has trades the two over", async ({ page }) => {
  await openConfig(page);

  await choose(page, "To", "YAML");

  await expect(page.getByText("JSON — source")).toBeVisible();
  await expect(page.getByText("YAML — result")).toBeVisible();
});

test("the link carries both documents, and the indent only where it shows", async ({ page }) => {
  await openConfig(page);

  await choose(page, "To", "TOML");
  await replaceDocument(page, "source", "a: 1\n");

  await expect.poll(() => decodeHash(page.url()).source).toBe("a: 1\n");
  const state = decodeHash(page.url());
  expect(state.from).toBe("yaml");
  expect(state.to).toBe("toml");
  expect(state.indent).toBeUndefined();

  await page.goto(page.url());
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).configEditors !== undefined);
  expect(await documentOf(page, "source")).toBe("a: 1\n");
  await expect(page.getByText("TOML — result")).toBeVisible();
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

  await openConfig(page);
  await replaceDocument(page, "source", "offline: true\n");
  await convert(page);

  expect(JSON.parse(await documentOf(page, "target"))).toEqual({ offline: true });
  expect(blocked).toEqual([]);
});
