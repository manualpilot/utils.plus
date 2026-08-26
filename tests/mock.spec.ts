import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const mockEditors: any;

async function openMock(page: Page) {
  await page.goto(`${BASE}/mock`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).mockEditors !== undefined);
  await expect.poll(() => documentOf(page, "output")).not.toBe("");
}

const readDocument = (which: "schema" | "output") => mockEditors[which].state.doc.toString();

const documentOf = (page: Page, which: "schema" | "output") => page.evaluate(readDocument, which);

function replaceSchema(page: Page, text: string) {
  return page.evaluate((text) => {
    const view = mockEditors.schema;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }, text);
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const rowsOf = async (page: Page) => JSON.parse(await documentOf(page, "output"));

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

test("opens on a batch built from the sample schema", async ({ page }) => {
  await openMock(page);

  expect(await documentOf(page, "schema")).toContain("\"title\": \"Customer\"");
  const rows = await rowsOf(page);
  expect(rows).toHaveLength(10);
  expect(rows[0]).toMatchObject({
    id: expect.stringMatching(/^[0-9a-f]{8}-/),
    email: expect.stringContaining("@"),
  });
});

test("redraws the batch as the row count moves, keeping the rows already drawn", async ({ page }) => {
  await openMock(page);

  const ten = await rowsOf(page);
  await page.getByRole("textbox", { name: "Rows", exact: true }).fill("25");
  await expect.poll(async () => (await rowsOf(page)).length).toBe(25);
  expect((await rowsOf(page)).slice(0, 10)).toEqual(ten);
});

test("the same seed is the same batch, and a new one is a different batch", async ({ page }) => {
  await openMock(page);

  const first = await documentOf(page, "output");
  const seed = page.getByRole("textbox", { name: "Seed", exact: true });

  await seed.fill("another");
  await expect.poll(() => documentOf(page, "output")).not.toBe(first);

  await seed.fill("utils");
  await expect.poll(() => documentOf(page, "output")).toBe(first);
});

test("the dice writes a seed into the box and the batch follows it", async ({ page }) => {
  await openMock(page);

  const before = await documentOf(page, "output");
  await page.getByRole("button", { name: "New seed" }).click();

  await expect(page.getByRole("textbox", { name: "Seed", exact: true })).not.toHaveValue("utils");
  await expect.poll(() => documentOf(page, "output")).not.toBe(before);
});

test("a schema typed into the pane is what the batch is built from", async ({ page }) => {
  await openMock(page);

  await replaceSchema(
    page,
    "{\"type\":\"object\",\"title\":\"Widget\",\"properties\":{\"sku\":{\"type\":\"string\",\"pattern\":\"^W-[0-9]{4}$\"}},"
      + "\"required\":[\"sku\"]}",
  );

  await expect.poll(async () => (await rowsOf(page))[0]).toEqual({ sku: expect.stringMatching(/^W-\d{4}$/) });
});

test("the locale decides the names and the bank details", async ({ page }) => {
  await openMock(page);
  await replaceSchema(
    page,
    "{\"type\":\"object\",\"properties\":{\"fullName\":{\"type\":\"string\"},\"iban\":{\"type\":\"string\"}},"
      + "\"required\":[\"fullName\",\"iban\"]}",
  );

  await choose(page, "Locale", "Japan");
  await expect.poll(async () => (await rowsOf(page))[0].fullName).toMatch(/[^\x00-\x7F]/);

  await choose(page, "Locale", "Germany");
  await expect.poll(async () => (await rowsOf(page))[0].iban).toMatch(/^DE\d{20}$/);
});

test("the output format rewrites the same batch as a different file", async ({ page }) => {
  await openMock(page);

  await choose(page, "Output", "CSV");
  await expect.poll(() => documentOf(page, "output")).toContain("id,fullName,email");

  await choose(page, "Output", "SQL");
  await expect.poll(() => documentOf(page, "output")).toContain("INSERT INTO \"customer\"");

  await choose(page, "Output", "NDJSON");
  const ndjson = await documentOf(page, "output");
  expect(ndjson.trimEnd().split("\n")).toHaveLength(10);
});

test("switching the schema language shows that language rather than the last one", async ({ page }) => {
  await openMock(page);

  await choose(page, "Schema", "Zod");
  expect(await documentOf(page, "schema")).toContain("z.object");
  await expect.poll(async () => (await rowsOf(page))[0].email).toContain("@");

  await choose(page, "Schema", "Pydantic");
  expect(await documentOf(page, "schema")).toContain("BaseModel");
});

test("says what it could not do rather than writing a value that fails the schema", async ({ page }) => {
  await openMock(page);

  await replaceSchema(
    page,
    "{\"type\":\"object\",\"properties\":{\"ref\":{\"type\":\"string\",\"pattern\":\"(?=x)y\"}},\"required\":[\"ref\"]}",
  );

  await expect(page.getByText("Some of the schema could not be honoured")).toBeVisible();
});

test("says nothing was generated when the schema cannot be read", async ({ page }) => {
  await openMock(page);

  await replaceSchema(page, "{ this is not a schema");
  await expect(page.getByText("Nothing was generated")).toBeVisible();
});

test("checks a number and names the digit that would have held", async ({ page }) => {
  await page.goto(`${BASE}/mock`);
  await page.getByText("Check", { exact: true }).click();

  const number = page.getByRole("textbox", { name: "Number", exact: true });

  await number.fill("4242 4242 4242 4242");
  await expect(page.locator("[data-verdict='Payment card']")).toContainText("Visa");
  await expect(page.locator("[data-verdict='Payment card']")).toContainText("Valid");

  await number.fill("4242424242424243");
  await expect(page.locator("[data-verdict='Payment card']")).toContainText("Fails");
  await expect(page.locator("[data-verdict='Payment card']")).toContainText("2 is what would hold");

  await number.fill("GB82 WEST 1234 5698 7654 32");
  await expect(page.locator("[data-verdict='IBAN']")).toContainText("United Kingdom");
  await expect(page.locator("[data-verdict='IBAN']")).toContainText("Valid");

  await number.fill("978-0-306-40615-7");
  await expect(page.locator("[data-verdict='ISBN']")).toContainText("Valid");

  await number.fill("nonsense");
  await expect(page.getByText("Nothing recognised")).toBeVisible();
});

test("carries the batch in the link, and the link alone rebuilds it", async ({ page }) => {
  await openMock(page);

  await page.getByRole("textbox", { name: "Seed", exact: true }).fill("shared");
  await choose(page, "Locale", "France");
  await page.getByRole("textbox", { name: "Rows", exact: true }).fill("4");

  await expect.poll(() => decodeHash(page.url()).seed).toBe("shared");
  expect(decodeHash(page.url())).toMatchObject({ mode: "generate", locale: "fr-FR", count: 4 });

  const expected = await documentOf(page, "output");
  await page.goto(page.url());
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).mockEditors !== undefined);

  await expect.poll(() => documentOf(page, "output")).toBe(expected);
});

test("the link carries the checked number and not the settings of the half not showing", async ({ page }) => {
  await page.goto(`${BASE}/mock`);
  await page.getByText("Check", { exact: true }).click();
  await page.getByRole("textbox", { name: "Number", exact: true }).fill("4242424242424242");

  await expect.poll(() => decodeHash(page.url()).value).toBe("4242424242424242");
  const state = decodeHash(page.url());
  expect(state).toMatchObject({ mode: "check" });
  expect(state.locale).toBeUndefined();
  expect(state.seed).toBeUndefined();
  expect(state.schema).toBeUndefined();
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

  await openMock(page);
  await replaceSchema(
    page,
    "{\"type\":\"object\",\"properties\":{\"offline\":{\"type\":\"boolean\"}},\"required\":[\"offline\"]}",
  );

  await expect.poll(async () => typeof (await rowsOf(page))[0].offline).toBe("boolean");
  expect(blocked).toEqual([]);
});
