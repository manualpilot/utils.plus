import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

test.use({ timezoneId: "Europe/Berlin" });

const input = (page: Page) => page.getByLabel("Timestamp or epoch");
const zoneCards = (page: Page) => page.getByRole("heading", { level: 4 });
const row = (page: Page, label: string) => page.getByRole("row").filter({ hasText: label }).first();
const card = (page: Page, name: string) =>
  page.locator(".mantine-Card-root").filter({ has: page.getByRole("heading", { name, exact: true }) });
const fact = (page: Page, name: string, label: string) => card(page, name).locator(`[data-fact="${label}"] td`).last();

const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

const chooseMode = (page: Page, mode: string) =>
  page.locator(".mantine-SegmentedControl-label", { hasText: mode }).click();

async function openTime(page: Page) {
  await page.goto(`${BASE}/time`);
  await expect(page.getByRole("heading", { name: "Time", exact: true })).toBeVisible();
}

function hashZones(page: Page): string[] {
  const payload = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!payload) return [];
  const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
  return JSON.parse(decodeURIComponent(escape(atob(padded)))).zones;
}

test("a blank box follows the clock, in the browser's own zone and UTC", async ({ page }) => {
  await openTime(page);

  await expect(input(page)).toHaveValue("");
  await expect(zoneCards(page)).toHaveText(["Instant", "Europe/Berlin", "UTC"]);
  await expect(page.getByText("Local")).toBeVisible();
  await expect(page.getByText("Following the clock").first()).toBeVisible();

  const seconds = () => row(page, "Unix seconds").innerText();
  const first = await seconds();
  await expect.poll(seconds, { timeout: 5000 }).not.toBe(first);
});

test("the clock button pins the second on screen, and the cross pours it back out", async ({ page }) => {
  await openTime(page);

  const shown = await row(page, "Unix milliseconds").innerText();
  await page.getByRole("button", { name: "Pin the current time" }).click();
  await expect(input(page)).toHaveValue(shown.replace(/\D/g, ""));
  await expect(page.getByText("Unix milliseconds").first()).toBeVisible();

  await page.getByRole("button", { name: "Follow the clock" }).click();
  await expect(input(page)).toHaveValue("");
});

test("the calendar opens on what the box says and writes back the offset it was picked in", async ({ page }) => {
  await openTime(page);
  await input(page).fill("2026-02-10T13:34:56+01:00");

  await page.getByRole("button", { name: "Pick a date and time" }).click();
  const picker = page.getByRole("dialog", { name: "Pick a date and time" });
  await expect(picker.getByRole("button", { name: "February 2026", exact: true })).toBeVisible();
  await expect(picker.getByRole("spinbutton").nth(2)).toHaveValue("56");

  await picker.getByRole("button", { name: "12 February 2026" }).click();
  await expect(input(page)).toHaveValue("2026-02-12T13:34:56+01:00");
  await expect(row(page, "Unix seconds")).toContainText("1770899696");

  await picker.getByRole("button", { name: "Use this time" }).click();
  await expect(picker).toBeHidden();
  await input(page).fill("half past four");
  await expect(page.getByText("That is not an epoch or a date this page can read")).toBeVisible();
});

test("the calendar over a blank box holds the second it was opened", async ({ page }) => {
  await openTime(page);
  await page.getByRole("button", { name: "Pick a date and time" }).click();

  const picker = page.getByRole("dialog", { name: "Pick a date and time" });
  const seconds = picker.getByRole("spinbutton").nth(2);
  const held = await seconds.inputValue();

  const shown = () => row(page, "Unix seconds").innerText();
  const first = await shown();
  await expect.poll(shown, { timeout: 5000 }).not.toBe(first);
  await expect(seconds).toHaveValue(held);

  await page.getByRole("heading", { name: "Time", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(input(page)).toHaveValue("");
});

test("the tick over a blank box takes the time the calendar opened on", async ({ page }) => {
  await openTime(page);
  await page.getByRole("button", { name: "Pick a date and time" }).click();

  const picker = page.getByRole("dialog", { name: "Pick a date and time" });
  const fields = picker.getByRole("spinbutton");
  const shown = (await Promise.all([0, 1, 2].map((field) => fields.nth(field).inputValue()))).join(":");

  await picker.getByRole("button", { name: "Use this time" }).click();
  await expect(picker).toBeHidden();
  await expect(input(page)).toHaveValue(new RegExp(`^\\d{4}-\\d{2}-\\d{2}T${shown}\\+0[12]:00$`));
  await expect(page.getByRole("button", { name: "Follow the clock" })).toBeVisible();
});

test("each format is the instant the input named, in the zone its card is for", async ({ page }) => {
  await openTime(page);
  await input(page).fill("1770726896789");

  await expect(row(page, "RFC 1123")).toContainText("Tue, 10 Feb 2026 12:34:56 GMT");
  await expect(row(page, "ISO 8601").first()).toContainText("2026-02-10T13:34:56.789+01:00");
  await expect(page.getByText("2026-02-10T12:34:56.789Z")).toBeVisible();

  await input(page).fill("Tue, 10 Feb 2026 13:34:56 +0100");
  await expect(row(page, "Unix milliseconds")).toContainText("1770726896000");
  await expect(page.getByText("RFC 2822", { exact: true }).first()).toBeVisible();
});

test("an unreadable input says so and takes the times away", async ({ page }) => {
  await openTime(page);
  await input(page).fill("half past four");

  await expect(page.getByText("That is not an epoch or a date this page can read")).toBeVisible();
  await expect(page.locator(".absolute-error")).toHaveCount(1);
  await expect(zoneCards(page)).toHaveCount(0);
});

test("the link carries the zones it was shared from, not the reader's", async ({ browser, page }) => {
  await openTime(page);
  await input(page).fill("1770726896789");

  await page.getByRole("combobox", { name: "Time zones" }).click();
  await page.keyboard.type("Kolkata");
  await page.getByRole("option", { name: "Asia/Kolkata" }).click();
  await page.keyboard.press("Escape");
  await expect(zoneCards(page)).toHaveText(["Instant", "Europe/Berlin", "UTC", "Asia/Kolkata"]);
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");

  const elsewhere = await browser.newContext({ timezoneId: "Australia/Sydney" });
  const other = await elsewhere.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel("Timestamp or epoch")).toHaveValue("1770726896789");
  await expect(other.getByRole("heading", { level: 4 })).toHaveText([
    "Instant",
    "Europe/Berlin",
    "UTC",
    "Asia/Kolkata",
  ]);
  await expect(other.getByText("Local")).toHaveCount(0);
  await elsewhere.close();
});

test("the cards are dragged into an order the link then carries", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await openTime(page);
  await input(page).fill("1770726896789");
  await expect(zoneCards(page)).toHaveText(["Instant", "Europe/Berlin", "UTC"]);

  const handle = page.getByRole("button", { name: "Reorder UTC" });
  const from = (await handle.boundingBox())!;
  const onto = (await page.getByRole("heading", { name: "Europe/Berlin", exact: true }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 20, { steps: 5 });
  await page.mouse.move(from.x + from.width / 2, onto.y, { steps: 20 });
  await page.mouse.up();

  await expect(zoneCards(page)).toHaveText(["Instant", "UTC", "Europe/Berlin"]);
  await expect.poll(() => hashZones(page)).toEqual(["UTC", "Europe/Berlin"]);
});

test("a handle reached by keyboard reorders without a pointer", async ({ page }) => {
  await openTime(page);
  await page.getByRole("button", { name: "Reorder Europe/Berlin" }).focus();

  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("Europe/Berlin");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status")).toContainText("droppable area UTC");
  await page.keyboard.press("Space");

  await expect(zoneCards(page)).toHaveText(["Instant", "UTC", "Europe/Berlin"]);
});

test("one zone has nothing to reorder, so it is offered no handle", async ({ page }) => {
  await openTime(page);
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(2);

  await page.getByRole("combobox", { name: "Time zones" }).press("Backspace");
  await expect(zoneCards(page)).toHaveText(["Instant", "Europe/Berlin"]);
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(0);
});

test("nothing on the page reaches for another host", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const { hostname } = new URL(request.url());
    if (hostname !== "localhost" && hostname !== "127.0.0.1") foreign.push(request.url());
  });

  await openTime(page);
  await input(page).fill("2026-02-10T12:34:56Z");
  await expect(row(page, "Unix seconds")).toContainText("1770726896");

  expect(foreign).toEqual([]);
});

test("a duration is read whichever way it was written", async ({ page }) => {
  await openTime(page);
  await chooseMode(page, "Duration");

  await expect(page.getByRole("heading", { name: "Duration", exact: true }).first()).toBeVisible();
  await expect(box(page, "Duration")).toHaveValue("1h 30m");
  await expect(fact(page, "Duration", "ISO 8601")).toHaveText("PT1H30M");
  await expect(fact(page, "Duration", "Spoken")).toHaveText("1 hour and 30 minutes");
  await expect(fact(page, "Duration", "Clock")).toHaveText("01:30:00");
  await expect(fact(page, "Totals", "Minutes")).toHaveText("90");

  for (const written of ["PT1H30M", "01:30:00", "90:00", "5400"]) {
    await box(page, "Duration").fill(written);
    await expect(fact(page, "Duration", "Compact")).toHaveText("1h 30m");
  }
});

test("a day is the day the calendar had, and twenty-four hours is twenty-four hours", async ({ page }) => {
  await openTime(page);
  await chooseMode(page, "Duration");
  await box(page, "Instant").fill("2026-03-28T12:00:00+01:00");

  await box(page, "Duration").fill("1d");
  await expect(fact(page, "After", "ISO 8601")).toHaveText("2026-03-29T12:00:00+02:00");
  await expect(fact(page, "Before", "ISO 8601")).toHaveText("2026-03-27T12:00:00+01:00");
  await expect(fact(page, "Totals", "Hours")).toHaveText("23");

  await box(page, "Duration").fill("24h");
  await expect(fact(page, "After", "ISO 8601")).toHaveText("2026-03-29T13:00:00+02:00");
  await expect(fact(page, "Totals", "Hours")).toHaveText("24");

  await box(page, "Instant").fill("2026-01-31T12:00:00+01:00");
  await box(page, "Duration").fill("1mo");
  await expect(fact(page, "After", "ISO 8601")).toHaveText("2026-02-28T12:00:00+01:00");
  await expect(card(page, "Totals")).toContainText("Counted from the instant");
});

test("a duration nothing can be made of says so and takes the times away", async ({ page }) => {
  await openTime(page);
  await chooseMode(page, "Duration");
  await box(page, "Duration").fill("half an hour");

  await expect(page.getByText("That is not a duration this page can read")).toBeVisible();
  await expect(page.locator(".absolute-error")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "After" })).toHaveCount(0);

  await box(page, "Duration").fill("1 fortnight");
  await expect(page.getByText("There is no unit of time called fortnight")).toBeVisible();
});

test("the gap between two instants is counted in months and days before hours", async ({ page }) => {
  await openTime(page);
  await chooseMode(page, "Between");

  await expect(page.getByRole("heading", { name: "Time Between" })).toBeVisible();
  await box(page, "From").fill("2026-01-31T00:00:00+01:00");
  await box(page, "To").fill("2026-03-01T00:00:00+01:00");

  await expect(fact(page, "Duration", "Compact")).toHaveText("1mo 1d");
  await expect(fact(page, "Duration", "Spoken")).toHaveText("1 month and 1 day");
  await expect(fact(page, "Duration", "ISO 8601")).toHaveText("P1M1D");
  await expect(fact(page, "Totals", "Days")).toHaveText("29");
  await expect(fact(page, "Endpoints", "From")).toHaveText("2026-01-31T00:00:00+01:00");

  await box(page, "From").fill("2026-03-01T00:00:00+01:00");
  await box(page, "To").fill("2026-01-31T00:00:00+01:00");
  await expect(fact(page, "Duration", "Compact")).toHaveText("-1mo 1d");
  await expect(fact(page, "Duration", "Clock")).toHaveText("-696:00:00");
});

test("the link carries the mode it was shared from, and the instant across the three", async ({ browser, page }) => {
  await openTime(page);
  await input(page).fill("1770726896789");
  await chooseMode(page, "Duration");

  await box(page, "Duration").fill("2mo 3d");
  await expect(box(page, "Instant")).toHaveValue("1770726896789");
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");

  const elsewhere = await browser.newContext({ timezoneId: "Australia/Sydney" });
  const other = await elsewhere.newPage();
  await other.goto(page.url());
  await expect(box(other, "Duration")).toHaveValue("2mo 3d");
  await expect(box(other, "Instant")).toHaveValue("1770726896789");
  await expect(other.locator("[data-fact=\"Compact\"] td").last()).toHaveText("2mo 3d");
  await expect(other.getByRole("combobox", { name: "Zone" })).toHaveValue("Europe/Berlin");
  await elsewhere.close();
});
