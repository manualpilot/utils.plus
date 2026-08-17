import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const cell = (page: Page, unit: string) => page.locator(`.converter-unit[data-unit="${unit}"]`);

test("one metre reads across the whole table", async ({ page }) => {
  await open(page);

  await expect(cell(page, "ft")).toContainText("3.28083989501");
  await expect(cell(page, "in")).toContainText("39.3700787402");
  await expect(cell(page, "km")).toContainText("0.001");
  await expect(cell(page, "m")).toHaveAttribute("data-source", "true");
  await expect(cell(page, "m")).toContainText("1");
});

test("the amount converts as it is typed", async ({ page }) => {
  await open(page);

  await page.getByLabel("Amount").fill("26.2");
  await expect(cell(page, "mi")).toContainText("0.0162799252366");

  await page.getByLabel("Amount").fill("2e3");
  await expect(cell(page, "km")).toContainText("2");
});

test("a category brings its own units with it", async ({ page }) => {
  await open(page);

  await pick(page, "Category", "Temperature");

  await expect(page.getByRole("combobox", { name: "Unit" })).toHaveValue("Celsius (°C)");
  await expect(cell(page, "m")).toHaveCount(0);
  await expect(cell(page, "f")).toContainText("33.8");

  await page.getByLabel("Amount").fill("-40");
  await expect(cell(page, "f")).toContainText("-40");
  await expect(cell(page, "k")).toContainText("233.15");
});

test("the unit the amount is entered in is the one everything else is read from", async ({ page }) => {
  await open(page);

  await pick(page, "Unit", "Mile (mi)");

  await expect(cell(page, "km")).toContainText("1.609344");
  await expect(cell(page, "mi")).toHaveAttribute("data-source", "true");
  await expect(cell(page, "m")).not.toHaveAttribute("data-source", "true");
});

test("text that is not a number says so and takes the values off", async ({ page }) => {
  await open(page);

  await page.getByLabel("Amount").fill("five");

  await expect(page.getByText("Enter a number")).toBeVisible();
  await expect(cell(page, "ft")).toContainText("—");

  await page.getByLabel("Amount").fill("");
  await expect(page.getByText("Enter a number")).toHaveCount(0);
  await expect(cell(page, "ft")).toContainText("—");
});

test("the link carries the category, the unit and the amount", async ({ page }) => {
  await open(page);

  await pick(page, "Category", "Data");
  await pick(page, "Unit", "Gibibyte (GiB)");
  await page.getByLabel("Amount").fill("32");
  await expect.poll(() => hashState(page).amount).toBe("32");

  const shared = page.url();
  const other = await page.context().newPage();
  await other.goto(shared);

  await expect(other.getByLabel("Amount")).toHaveValue("32");
  await expect(other.getByRole("combobox", { name: "Unit" })).toHaveValue("Gibibyte (GiB)");
  await expect(cell(other, "gb")).toContainText("34.359738368");
});

async function open(page: Page) {
  await page.goto(`${BASE}/converter`);
  await expect(page.getByLabel("Amount")).toHaveValue("1");
}

async function pick(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
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
