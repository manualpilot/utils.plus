import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const schemaEditors: any;

async function openSchema(page: Page) {
  await page.goto(`${BASE}/schema`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).schemaEditors !== undefined);
}

const readDocument = (which: "source" | "second") => schemaEditors[which].state.doc.toString();

function replaceDocument(page: Page, which: "source" | "second", text: string) {
  return page.evaluate(({ which, text }) => {
    const view = schemaEditors[which];
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }, { which, text });
}

const documentOf = (page: Page, which: "source" | "second") => page.evaluate(readDocument, which);

async function chooseLanguage(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const problems = (page: Page) => page.locator(".schema-problem");

function decodeHash(
  url: string,
): { mode?: string; language?: string; target?: string; direction?: string; schema?: string; payload?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("the sample opens with its one fault marked in the payload and listed under it", async ({ page }) => {
  await openSchema(page);

  await expect(problems(page)).toHaveCount(1);
  await expect(problems(page).first()).toContainText("/address/postcode");
  await expect(problems(page).first()).toContainText("Must match /^[0-9]{4,6}$/");
  await expect(page.locator(".cm-content .cm-schema-problem")).toHaveText(["\"SW1Y\""]);
  await expect(page.locator(".cm-content .cm-schema-problem-line")).toHaveCount(1);
  await expect(page.getByText("1 problem")).toBeVisible();
});

test("fixing the payload clears the mark and the list with it", async ({ page }) => {
  await openSchema(page);

  const fixed = await documentOf(page, "second").then((text) => text.replace("SW1Y", "12345"));
  await replaceDocument(page, "second", fixed);

  await expect(page.getByText("The payload matches the schema")).toBeVisible();
  await expect(problems(page)).toHaveCount(0);
  await expect(page.locator(".cm-content .cm-schema-problem")).toHaveCount(0);
});

test("a payload that is not JSON is reported where it stopped making sense", async ({ page }) => {
  await openSchema(page);
  await replaceDocument(page, "second", "{\n  \"a\": 1,\n  \"b\":\n}");

  await expect(page.getByText("The payload is not JSON")).toBeVisible();
  await expect(page.getByText(/Line 4, column 1 — Expected a value/)).toBeVisible();
});

test("clicking a problem puts the caret on what it is about", async ({ page }) => {
  await openSchema(page);
  await problems(page).first().click();

  await expect.poll(async () =>
    page.evaluate(() => {
      const { from, to } = schemaEditors.second.state.selection.main;
      return schemaEditors.second.state.doc.sliceString(from, to);
    })
  ).toBe("\"SW1Y\"");
});

test("a schema in any of the three languages says the same thing about the payload", async ({ page }) => {
  await openSchema(page);

  for (const language of ["Zod", "Pydantic"]) {
    await chooseLanguage(page, "Schema", language);
    await expect(problems(page)).toHaveCount(1);
    await expect(problems(page).first()).toContainText("/address/postcode");
  }

  await chooseLanguage(page, "Schema", "JSON Schema");
  await expect.poll(() => documentOf(page, "source")).toContain("\"$schema\"");
});

test("a generated payload replaces the pane, but only once the replacement is agreed to", async ({ page }) => {
  await openSchema(page);
  const before = await documentOf(page, "second");

  await page.getByRole("button", { name: "Generate payload" }).click();
  await expect(page.getByText("Replace what is there?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await documentOf(page, "second")).toBe(before);

  await page.getByRole("button", { name: "Generate payload" }).click();
  await page.getByRole("button", { name: "Replace" }).click();

  await expect.poll(() => documentOf(page, "second")).toContain("\"street\": \"\"");
  expect(JSON.parse(await documentOf(page, "second"))).toEqual({
    id: "",
    name: "",
    email: "",
    age: 0,
    role: "viewer",
    tags: [""],
    address: { street: "", city: "", postcode: "" },
  });
});

test("swapping the panes turns the payload into the input and the schema into what is written", async ({ page }) => {
  await openSchema(page);
  await page.getByRole("button", { name: "Swap" }).click();

  await expect(page.getByRole("button", { name: "Generate JSON Schema" })).toBeVisible();
  await page.getByRole("button", { name: "Generate JSON Schema" }).click();
  await page.getByRole("button", { name: "Replace" }).click();

  await expect.poll(() => documentOf(page, "source")).toContain("\"title\": \"Root\"");
  const written = JSON.parse(await documentOf(page, "source"));
  expect(written.properties.id).toEqual({ type: "string", format: "uuid" });
  expect(written.required).toContain("address");
});

test("conversion writes the schema into the other language", async ({ page }) => {
  await openSchema(page);
  await page.getByText("Conversion", { exact: true }).click();

  await page.getByRole("button", { name: "Convert to Zod" }).click();
  await page.getByRole("button", { name: "Replace" }).click();
  await expect.poll(() => documentOf(page, "second")).toContain("export const User = z.object({");
  expect(await documentOf(page, "second")).toContain("id: z.uuid(),");

  await chooseLanguage(page, "To", "Pydantic");
  await page.getByRole("button", { name: "Convert to Pydantic" }).click();
  await page.getByRole("button", { name: "Replace" }).click();
  await expect.poll(() => documentOf(page, "second")).toContain("class User(BaseModel):");
  expect(await documentOf(page, "second")).toContain("id: UUID");
});

test("swapping a conversion trades the two languages and their documents with them", async ({ page }) => {
  await openSchema(page);
  await page.getByText("Conversion", { exact: true }).click();
  await page.getByRole("button", { name: "Swap" }).click();

  await expect(page.getByRole("button", { name: "Convert to JSON Schema" })).toBeVisible();
  await expect.poll(() => documentOf(page, "source")).toContain("import { z } from \"zod\";");
});

test("a schema that cannot be read is said so, and nothing is written over", async ({ page }) => {
  await openSchema(page);
  await chooseLanguage(page, "Schema", "Zod");
  await replaceDocument(page, "source", "const = ;");

  await expect(page.getByText("The schema could not be read")).toBeVisible();

  const before = await documentOf(page, "second");
  await page.getByRole("button", { name: "Generate payload" }).click();
  await expect(page.getByText("Nothing was written")).toBeVisible();
  expect(await documentOf(page, "second")).toBe(before);
});

test("the address bar tracks the mode, the language and both documents", async ({ page }) => {
  await openSchema(page);
  await replaceDocument(page, "second", "{ \"id\": 1 }");

  await expect.poll(async () => decodeHash(page.url()).payload).toBe("{ \"id\": 1 }");
  await expect.poll(async () => decodeHash(page.url()).mode).toBe("validate");

  await page.getByText("Conversion", { exact: true }).click();
  await expect.poll(async () => decodeHash(page.url()).mode).toBe("convert");
  await expect.poll(async () => decodeHash(page.url()).target).toBe("zod");
  await expect.poll(async () => decodeHash(page.url()).payload).toBeUndefined();

  await page.goto(page.url());
  await page.waitForFunction(() => (window as any).schemaEditors !== undefined);
  await expect(page.getByRole("button", { name: "Convert to Zod" })).toBeVisible();
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

  await openSchema(page);
  await chooseLanguage(page, "Schema", "Pydantic");
  await replaceDocument(page, "second", "{}");

  await expect(problems(page).first()).toContainText("Missing required property");
  expect(blocked).toEqual([]);
});
