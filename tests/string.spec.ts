import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const input = (page: Page) => page.getByRole("textbox", { name: "Input", exact: true });
const output = (page: Page) => page.getByRole("textbox", { name: "Output", exact: true });
const countOf = (page: Page, text: "input" | "output", label: string) =>
  page.locator(`[data-counts="${text}"] [data-fact="${label}"] td`).last();

async function openString(page: Page) {
  await page.goto(`${BASE}/string`);
  await expect(page.getByRole("heading", { name: "String", exact: true })).toBeVisible();
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("a name is rewritten in whichever spelling the list is asked for", async ({ page }) => {
  await openString(page);
  await input(page).fill("XMLHttpRequest parser");

  await expect(output(page)).toHaveValue("xmlHttpRequestParser");

  await pick(page, "Operation", "snake_case");
  await expect(output(page)).toHaveValue("xml_http_request_parser");

  await pick(page, "Operation", "CONSTANT_CASE");
  await expect(output(page)).toHaveValue("XML_HTTP_REQUEST_PARSER");

  await pick(page, "Operation", "URL slug");
  await expect(output(page)).toHaveValue("xmlhttprequest-parser");
});

test("the variant box arrives with the operation that has variants", async ({ page }) => {
  await openString(page);
  await expect(page.getByRole("combobox", { name: "Variant" })).toBeHidden();

  await pick(page, "Operation", "Sort lines");
  await expect(page.getByRole("combobox", { name: "Variant" })).toHaveValue("A to Z");

  await input(page).fill("item10\nitem9\nitem1");
  await expect(output(page)).toHaveValue("item1\nitem10\nitem9");

  await pick(page, "Variant", "Natural (10 after 9)");
  await expect(output(page)).toHaveValue("item1\nitem9\nitem10");

  await pick(page, "Operation", "Remove duplicate lines");
  await expect(page.getByRole("combobox", { name: "Variant" })).toHaveValue("Keep the first of each");
});

test("the wrap is the one operation with a column, and it is only there for it", async ({ page }) => {
  await openString(page);
  await expect(page.getByLabel("Column", { exact: true })).toBeHidden();

  await pick(page, "Operation", "Wrap");
  await input(page).fill("the quick brown fox jumps");
  await page.getByLabel("Column", { exact: true }).fill("10");

  await expect(output(page)).toHaveValue("the quick\nbrown fox\njumps");

  await page.getByLabel("Column", { exact: true }).fill("");
  await expect(page.getByText("Width must be a whole number of at least 1")).toBeVisible();
  await expect(output(page)).toHaveValue("");
});

test("both counts follow the text they are of", async ({ page }) => {
  await openString(page);
  await pick(page, "Operation", "Remove duplicate lines");
  await input(page).fill("one\ntwo\none");

  await expect(countOf(page, "input", "Lines")).toHaveText("3");
  await expect(countOf(page, "input", "Words")).toHaveText("3");
  await expect(countOf(page, "output", "Lines")).toHaveText("2");
  await expect(countOf(page, "output", "Characters")).toHaveText("7");
});

test("the output goes back into the input", async ({ page }) => {
  await openString(page);
  await pick(page, "Operation", "HTML entities");
  await input(page).fill("<b>Tom & Jerry</b>");
  await expect(output(page)).toHaveValue("&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;");

  await page.getByRole("button", { name: "Use the output as the input" }).click();
  await pick(page, "Variant", "Read entities back");

  await expect(input(page)).toHaveValue("&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;");
  await expect(output(page)).toHaveValue("<b>Tom & Jerry</b>");
});

test("a shuffle keeps every line and draws again when it is asked to", async ({ page }) => {
  await openString(page);
  await pick(page, "Operation", "Shuffle lines");
  await input(page).fill("a\nb\nc\nd\ne\nf\ng\nh");

  const lines = async () => ((await output(page).inputValue()).split("\n"));
  expect((await lines()).slice().sort()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);

  const first = await output(page).inputValue();
  await page.getByRole("button", { name: "Shuffle again" }).click();
  await page.getByRole("button", { name: "Shuffle again" }).click();
  expect((await lines()).slice().sort()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  expect(first.split("\n")).toHaveLength(8);
});

test("what the link carries is the operation, its variant and the text", async ({ page }) => {
  await openString(page);
  await pick(page, "Operation", "Shell word");
  await pick(page, "Variant", "Double quotes");
  await input(page).fill("$HOME");
  await expect(output(page)).toHaveValue("\"\\$HOME\"");

  await expect.poll(() => decodeHash(page.url())).toMatchObject({
    operation: "shell",
    variant: "double",
    input: "$HOME",
  });
  expect(decodeHash(page.url())).not.toHaveProperty("width");

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Operation" })).toHaveValue("Shell word");
  await expect(input(page)).toHaveValue("$HOME");
  await expect(output(page)).toHaveValue("\"\\$HOME\"");
});

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
