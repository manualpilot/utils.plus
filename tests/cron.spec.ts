import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

test.use({ timezoneId: "Europe/Berlin" });

const expression = (page: Page) => page.getByRole("textbox", { name: "Expression" });
const field = (page: Page, label: string) => page.getByRole("combobox", { name: label, exact: true });
const description = (page: Page) => page.getByRole("heading", { level: 4 }).first();

async function openCron(page: Page) {
  await page.goto(`${BASE}/cron`);
  await expect(page.getByRole("heading", { name: "Cron", exact: true })).toBeVisible();
}

test("the expression and the field row are two views of the same thing", async ({ page }) => {
  await openCron(page);

  await expect(expression(page)).toHaveValue("0 9 * * MON-FRI");
  await expect(field(page, "Minute")).toHaveValue("0");
  await expect(field(page, "Day of week")).toHaveValue("MON-FRI");
  await expect(description(page)).toHaveText("At 09:00 on Monday through Friday");

  await field(page, "Hour").fill("14");
  await expect(expression(page)).toHaveValue("0 14 * * MON-FRI");
  await expect(description(page)).toHaveText("At 14:00 on Monday through Friday");

  await expression(page).fill("*/15 9-17 * * *");
  await expect(field(page, "Hour")).toHaveValue("9-17");
  await expect(description(page)).toHaveText("Every 15 minutes past hours 9 through 17");
});

test("a field cleared to nothing keeps its place in the row", async ({ page }) => {
  await openCron(page);
  await field(page, "Hour").fill("");

  await expect(field(page, "Minute")).toHaveValue("0");
  await expect(field(page, "Hour")).toHaveValue("");
  await expect(field(page, "Day of week")).toHaveValue("MON-FRI");
  await expect(page.getByText("Unix cron takes 5 fields; this has 4")).toBeVisible();
  await expect(page.getByText("Next runs")).toBeHidden();

  await field(page, "Hour").fill("6");
  await expect(expression(page)).toHaveValue("0 6 * * MON-FRI");
});

test("a shorthand is read, and shows the fields it stands for", async ({ page }) => {
  await openCron(page);
  await expression(page).fill("@daily");

  await expect(description(page)).toHaveText("At 00:00");
  await expect(page.getByText("the same as 0 0 * * *")).toBeVisible();
  await expect(field(page, "Hour")).toHaveValue("0");

  await field(page, "Hour").fill("6");
  await expect(expression(page)).toHaveValue("0 6 * * *");

  await expression(page).fill("@reboot");
  await expect(description(page)).toHaveText("When cron starts");
  await expect(page.getByText("Next runs")).toBeHidden();
});

test("switching flavour rewrites the expression rather than breaking it", async ({ page }) => {
  await openCron(page);
  await expression(page).fill("0 9 * * 1-5");

  await page.getByRole("combobox", { name: "Flavour" }).click();
  await page.getByRole("option", { name: "Quartz (6 or 7 fields)" }).click();

  await expect(expression(page)).toHaveValue("0 0 9 ? * MON-FRI");
  await expect(description(page)).toHaveText("At 09:00 on Monday through Friday");
});

test("the runs are worked out in the zone the reader picked, not just written in it", async ({ page }) => {
  await openCron(page);
  await expression(page).fill("0 0 1 1 *");

  const firstRun = page.getByRole("row").first();
  await expect(page.getByText("Europe/Berlin")).toBeHidden();
  await expect(firstRun).toContainText("Jan 01");
  await expect(firstRun).toContainText("00:00:00");

  await page.getByText("Local", { exact: true }).click();

  await expect(page.getByText("Europe/Berlin")).toBeVisible();
  await expect(firstRun).toContainText("Jan 01");
  await expect(firstRun).toContainText("00:00:00");
});

test("the link carries the expression, the flavour and the zone", async ({ page }) => {
  await openCron(page);
  await expression(page).fill("0 0 12 ? * FRIL");

  await expect(page.getByText("Unix cron takes 5 fields; this has 6")).toBeVisible();
  await page.getByRole("combobox", { name: "Flavour" }).click();
  await page.getByRole("option", { name: "Quartz (6 or 7 fields)" }).click();
  await expect(description(page)).toHaveText("At 12:00 on the last Friday of the month");

  await expect.poll(() => hashState(page).expression).toBe("0 0 12 ? * FRIL");
  const shared = page.url();

  const other = await page.context().newPage();
  await other.goto(shared);
  await expect(other.getByRole("textbox", { name: "Expression" })).toHaveValue("0 0 12 ? * FRIL");
  await expect(other.getByRole("heading", { level: 4 }).first()).toHaveText(
    "At 12:00 on the last Friday of the month",
  );
});

function hashState(page: Page): Record<string, string> {
  const payload = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!payload) return {};
  const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
  try {
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch {
    return {};
  }
}
