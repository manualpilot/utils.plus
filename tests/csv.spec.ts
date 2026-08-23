import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const csvEditor: any;

async function openCsv(page: Page) {
  await page.goto(`${BASE}/csv`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).csvEditor !== undefined);
}

const readEditor = () => csvEditor.state.doc.toString();

function replaceDocument(page: Page, text: string) {
  return page.evaluate((text) => {
    csvEditor.dispatch({ changes: { from: 0, to: csvEditor.state.doc.length, insert: text } });
  }, text);
}

function chooseView(page: Page, view: string) {
  return page.locator("label", { hasText: view }).first().click();
}

const headings = (page: Page) => page.locator("thead th");
const bodyRows = (page: Page) => page.locator("tbody tr");

function decodeHash(url: string): { value?: string; delimiter?: string; header?: boolean; view?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("the table is drawn from what the editor holds", async ({ page }) => {
  await openCsv(page);
  await expect(headings(page)).toHaveText(["id", "name", "category", "price", "in stock"]);
  await expect(bodyRows(page)).toHaveCount(5);

  await replaceDocument(page, "city,country\nGeneva,Switzerland\nHampton,United States");

  await expect(headings(page)).toHaveText(["city", "country"]);
  await expect(bodyRows(page)).toHaveCount(2);
});

test("a quoted field keeps the delimiter and the quotes it holds", async ({ page }) => {
  await openCsv(page);
  await expect(page.getByRole("cell", { name: "Cable, USB-C" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "27\" Monitor" })).toBeVisible();
});

test("the first row becomes a row of its own once it is not a header", async ({ page }) => {
  await openCsv(page);
  await expect(bodyRows(page)).toHaveCount(5);

  await page.getByLabel("First row is a header").click();

  await expect(headings(page)).toHaveText(["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"]);
  await expect(bodyRows(page)).toHaveCount(6);
});

test("the delimiter is worked out, and can be told", async ({ page }) => {
  await openCsv(page);
  await replaceDocument(page, "a;b;c\n1;2;3");
  await expect(headings(page)).toHaveText(["a", "b", "c"]);

  await page.getByRole("combobox", { name: "Delimiter" }).click();
  await page.getByRole("option", { name: "Comma" }).click();

  await expect(headings(page)).toHaveText(["a;b;c"]);
});

test("a heading orders the rows by its own column, as numbers where they are numbers", async ({ page }) => {
  await openCsv(page);

  await page.getByRole("button", { name: "price" }).click();
  await expect(bodyRows(page).first().locator("td").nth(3)).toHaveText("12.50");

  await page.getByRole("button", { name: "price" }).click();
  await expect(bodyRows(page).first().locator("td").nth(3)).toHaveText("329.99");
});

test("either half can have the region to itself, and the document survives the switch", async ({ page }) => {
  await openCsv(page);
  await replaceDocument(page, "a,b\n1,2");

  await chooseView(page, "Table");
  await expect(page.locator(".csv-text-pane")).toBeHidden();
  await expect(page.locator(".csv-table-pane")).toBeVisible();

  await chooseView(page, "Text");
  await expect(page.locator(".csv-table-pane")).toBeHidden();
  await expect(page.locator(".csv-text-pane")).toBeVisible();

  await chooseView(page, "Split");
  await expect(page.locator(".csv-text-pane")).toBeVisible();
  await expect(page.locator(".csv-table-pane")).toBeVisible();
  expect(await page.evaluate(readEditor)).toBe("a,b\n1,2");
});

test("a dropped file becomes the document, and one Ctrl+Z takes it back", async ({ page }) => {
  await openCsv(page);

  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "people.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("first,last\nAda,Lovelace\nAlan,Turing\n"),
  });

  await expect(headings(page)).toHaveText(["first", "last"]);
  await expect(bodyRows(page)).toHaveCount(2);

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(headings(page)).toHaveText(["id", "name", "category", "price", "in stock"]);
});

test("a quote nobody closed is said rather than left to look like a short file", async ({ page }) => {
  await openCsv(page);
  await replaceDocument(page, "a,b\n1,\"unclosed\n2,3");
  await expect(page.getByText("A quote is left open")).toBeVisible();
});

test("the address bar tracks the document and the way it is being read", async ({ page }) => {
  await openCsv(page);
  await replaceDocument(page, "x,y\n1,2");

  await expect.poll(async () => decodeHash(page.url()).value).toBe("x,y\n1,2");

  await chooseView(page, "Table");
  await expect.poll(async () => decodeHash(page.url()).view).toBe("table");

  await page.getByLabel("First row is a header").click();
  await expect.poll(async () => decodeHash(page.url()).header).toBe(false);
});

test("a share link opens on the same document and the same view", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openCsv(page);
  await replaceDocument(page, "one|two\n1|2");
  await chooseView(page, "Table");

  await expect.poll(async () => decodeHash(page.url()).view).toBe("table");

  await page.locator("header button").last().click();
  const url = await page.evaluate(() => navigator.clipboard.readText());

  await page.goto(url);
  await page.waitForFunction(() => (window as any).csvEditor !== undefined);
  expect(await page.evaluate(readEditor)).toBe("one|two\n1|2");
  await expect(headings(page)).toHaveText(["one", "two"]);
  await expect(page.locator(".csv-text-pane")).toBeHidden();
});

test("the editor works with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openCsv(page);
  await replaceDocument(page, "offline,yes\n1,2");
  await expect(headings(page)).toHaveText(["offline", "yes"]);
  expect(blocked).toEqual([]);
});
