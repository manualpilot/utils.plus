import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const showing = (page: Page) => page.locator("[data-region]");

const fact = (page: Page, label: string) => page.locator(`[data-fact="${label}"]`);

const box = (page: Page) => page.getByRole("textbox", { name: "Phone number" });
const picker = (page: Page) => page.getByRole("combobox", { name: "Country" });

test.describe("a browser whose clock is somewhere in particular", () => {
  test.use({ timezoneId: "Europe/Berlin", locale: "en-US" });

  test("opens on the country the clock is set in", async ({ page }) => {
    await open(page);

    await expect(picker(page)).toHaveValue("Germany");
    await expect(page.getByText("Dialling code +49")).toBeVisible();

    await expect(showing(page)).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    expect(new URL(page.url()).hash).toBe("");
  });
});

test.describe("the page", () => {
  test.use({ timezoneId: "Australia/Sydney", locale: "en-AU" });

  test("reads a national number against the country showing", async ({ page }) => {
    await open(page);
    await box(page).fill("0412 345 678");

    await expect(showing(page)).toHaveAttribute("data-region", "AU");
    await expect(page.getByText("Valid", { exact: true })).toBeVisible();
    await expect(page.getByText("Mobile", { exact: true })).toBeVisible();
    await expect(fact(page, "E.164")).toContainText("+61412345678");
    await expect(fact(page, "International")).toContainText("+61 412 345 678");
    await expect(fact(page, "National")).toContainText("0412 345 678");
    await expect(fact(page, "RFC 3966")).toContainText("tel:+61412345678");
    await expect(page.locator("[data-fact^=\"Dialling from\"]")).toHaveCount(0);
    await expect(fact(page, "National number")).toContainText("412345678");
    await expect(fact(page, "Region")).toContainText("AU — Australia");
    await expect(fact(page, "National destination code")).toContainText("412");
    await expect(fact(page, "Area code")).toHaveCount(0);
    await expect(fact(page, "Carrier selection code")).toHaveCount(0);
  });

  test("takes the country from a leading plus, whichever one was showing", async ({ page }) => {
    await open(page);
    await expect(picker(page)).toHaveValue("Australia");

    await box(page).fill("+44 20 7183 8750");

    await expect(picker(page)).toHaveValue("United Kingdom");
    await expect(showing(page)).toHaveAttribute("data-region", "GB");
    await expect(page.getByText("Dialling code +44")).toBeVisible();
    await expect(fact(page, "Area code")).toContainText("20");
    await expect(fact(page, "National")).toContainText("020 7183 8750");
  });

  test("reads a shared calling code down to the region the whole number names", async ({ page }) => {
    await open(page);

    await box(page).fill("+1 416 555 0199");
    await expect(picker(page)).toHaveValue("Canada");

    await box(page).fill("+1 202 555 0173");
    await expect(picker(page)).toHaveValue("United States");
    await expect(showing(page)).toHaveAttribute("data-region", "US");
  });

  test("writes the picked country back into a number that carries a plus", async ({ page }) => {
    await open(page);
    await box(page).fill("+61 2 9374 4000");
    await expect(picker(page)).toHaveValue("Australia");

    await pick(page, "Japan", "Japan");

    await expect(box(page)).toHaveValue("+81 29 374 4000");
    await expect(showing(page)).toHaveAttribute("data-region", "JP");
  });

  test("leaves a national number alone when the country is picked", async ({ page }) => {
    await open(page);
    await box(page).fill("0412 345 678");

    await pick(page, "New Zealand", "New Zealand");

    await expect(box(page)).toHaveValue("0412345678");
    await expect(page.getByText("Dialling code +64")).toBeVisible();
  });

  test("formats the number as it is typed and leaves the caret where the typing left it", async ({ page }) => {
    await open(page);
    await box(page).click();
    await page.keyboard.type("0412345678");

    await expect(box(page)).toHaveValue("0412 345 678");
    expect(await caret(page)).toBe(12);

    await box(page).press("Backspace");
    await box(page).press("Backspace");
    await box(page).press("Backspace");
    await expect(box(page)).toHaveValue("0412 345");
    expect(await caret(page)).toBe(8);

    await box(page).press("Backspace");
    await expect(box(page)).toHaveValue("0412 34");
  });

  test("moves the caret past a separator the next digit brings with it", async ({ page }) => {
    await open(page);
    await box(page).click();
    await page.keyboard.type("+61");

    await expect(box(page)).toHaveValue("+61");
    expect(await caret(page)).toBe(3);

    await page.keyboard.type("2");
    await expect(box(page)).toHaveValue("+61 2");
    expect(await caret(page)).toBe(5);
  });

  test("keeps the caret in place when a digit is typed into the middle", async ({ page }) => {
    await open(page);
    await box(page).click();
    await page.keyboard.type("0412345678");

    for (let step = 0; step < 8; step++) await box(page).press("ArrowLeft");
    await page.keyboard.type("9");

    const value = await box(page).inputValue();
    expect(value.replace(/\D/g, "")).toBe("04129345678");
    expect(value.slice(0, await caret(page)).replace(/\D/g, "")).toBe("04129");
  });

  test("takes its own separators back when a number turns out to be spelled in letters", async ({ page }) => {
    await open(page);
    await pick(page, "United States", "United States");
    await box(page).click();
    await page.keyboard.type("1-800-FLOWERS");

    await expect(box(page)).toHaveValue("1800FLOWERS");
    await expect(page.getByText("Not a valid number")).toBeVisible();
    await expect(fact(page, "E.164")).toContainText("+11800");
  });

  test("leaves a pasted number spelled in letters exactly as it came", async ({ page }) => {
    await open(page);
    await pick(page, "United States", "United States");
    await box(page).fill("1-800-FLOWERS");

    await expect(box(page)).toHaveValue("1-800-FLOWERS");
    await expect(fact(page, "E.164")).toContainText("+11800");
  });

  test("is searched by name, code or dialling code", async ({ page }) => {
    await open(page);

    await pick(page, "NZ", "New Zealand");
    await expect(page.getByText("Dialling code +64")).toBeVisible();

    await pick(page, "+81", "Japan");
    await expect(page.getByText("Dialling code +81")).toBeVisible();
  });

  test("stays searchable once a country has been picked", async ({ page }) => {
    await open(page);

    await expect(picker(page)).toHaveValue("Australia");
    await pick(page, "Peru", "Peru");
    await expect(picker(page)).toHaveValue("Peru");
    await pick(page, "Kenya", "Kenya");
    await expect(page.getByText("Dialling code +254")).toBeVisible();
  });

  test("says what is wrong with what was typed, and only once it exists", async ({ page }) => {
    await open(page);

    await expect(page.getByText("Not a phone number")).toHaveCount(0);

    await box(page).fill("nonsense");
    await expect(page.getByText("Not a phone number")).toBeVisible();
    await expect(showing(page)).toHaveCount(0);

    await box(page).fill("+999 999 999 999");
    await expect(page.getByText("No country has that calling code")).toBeVisible();
  });

  test("says which way a number that is not valid failed", async ({ page }) => {
    await open(page);
    await box(page).fill("+61 2 93");

    await expect(page.getByText("Not a valid number")).toBeVisible();
    await expect(page.getByText("Too short", { exact: true })).toBeVisible();
  });

  test("reads a short code as the emergency number it is", async ({ page }) => {
    await open(page);
    await box(page).fill("000");

    await expect(page.locator("[data-short-number]")).toBeVisible();
    await expect(page.getByText("Emergency")).toBeVisible();
    await expect(page.getByText("Toll free")).toBeVisible();
    await expect(page.getByText("Short code in Australia")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Formats" })).toHaveCount(0);
    await expect(fact(page, "E.164")).toHaveCount(0);
    await expect(page.locator("[data-place]")).toHaveCount(0);

    await box(page).fill("611");
    await expect(page.locator("[data-short-number]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Formats" })).toBeVisible();
  });

  test("reads where the number is, who was given the range and what the clock says there", async ({ page }) => {
    await open(page);
    await box(page).fill("+86 138 0013 8000");

    await expect(page.locator("[data-place]")).toBeVisible();
    await expect(fact(page, "Location")).toContainText("Beijing");
    await expect(fact(page, "Carrier")).toContainText("China Mobile");
    await expect(fact(page, "Time zone")).toContainText("Asia/Shanghai");

    await box(page).fill("+61 2 9374 4000");
    await expect(fact(page, "Time zone")).toContainText("Australia/Sydney");
    await expect(fact(page, "Location")).toHaveCount(0);
  });

  test("asks after no place until the number is one", async ({ page }) => {
    await open(page);
    await box(page).fill("+86 138 0013");

    await expect(page.getByText("Not a valid number")).toBeVisible();
    await expect(page.locator("[data-place]")).toHaveCount(0);
  });

  test("puts the formats and the parts abreast, and stacks them once the region is narrow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page);
    await box(page).fill("+44 20 7183 8750");

    const formats = () => page.getByRole("heading", { name: "Formats" }).boundingBox();
    const parts = () => page.getByRole("heading", { name: "Parts" }).boundingBox();

    const [wideFormats, wideParts] = [(await formats())!, (await parts())!];
    expect(Math.abs(wideFormats.y - wideParts.y)).toBeLessThan(2);
    expect(wideParts.x).toBeGreaterThan(wideFormats.x);

    await page.setViewportSize({ width: 1000, height: 1000 });
    expect(await mainRegionWidth(page)).toBeLessThan(768);

    const [narrowFormats, narrowParts] = [(await formats())!, (await parts())!];
    expect(narrowParts.y).toBeGreaterThan(narrowFormats.y);
    expect(Math.abs(narrowParts.x - narrowFormats.x)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1000);
  });

  test("prompts with a real number from the country showing", async ({ page }) => {
    await open(page);

    await expect(box(page)).toHaveAttribute("placeholder", "0412 345 678");
    await pick(page, "United States", "United States");
    await expect(box(page)).toHaveAttribute("placeholder", "(201) 555-0123");
  });

  test("parses and draws its flags without asking any other host", async ({ page }) => {
    const offsite: string[] = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") offsite.push(url.href);
      return route.continue();
    });

    await open(page);
    await box(page).fill("+61 2 9374 4000");
    await expect(showing(page)).toHaveAttribute("data-region", "AU");
    await expect(page.locator("[data-place]")).toBeVisible();

    const covered = await page.evaluate(async () => {
      await document.fonts.load("16px \"Twemoji Country Flags\"", "\u{1F1E6}\u{1F1FA}");
      return document.fonts.check("16px \"Twemoji Country Flags\"", "\u{1F1E6}\u{1F1FA}");
    });

    expect(covered).toBe(true);
    expect(offsite).toEqual([]);
  });

  test("the link carries the region and the number, and the region even without one", async ({ page }) => {
    await open(page);

    await pick(page, "Japan", "Japan");
    await expect.poll(() => hashState(page)).toEqual({ region: "JP" });

    await box(page).fill("090-1234-5678");
    await expect.poll(() => hashState(page)).toEqual({ region: "JP", number: "090-1234-5678" });

    const shared = page.url();
    const other = await page.context().newPage();
    await other.goto(shared);

    await expect(showing(other)).toHaveAttribute("data-region", "JP");
    await expect(fact(other, "E.164")).toContainText("+819012345678");
  });
});

const SETTLE_MS = 600;

async function open(page: Page) {
  await page.goto(`${BASE}/phone-number`);
  await expect(picker(page)).toBeVisible();
}

async function pick(page: Page, search: string, option: string) {
  const combobox = picker(page);
  await combobox.click();
  await combobox.fill(search);
  await page.getByRole("option", { name: option }).first().click();
}

function caret(page: Page): Promise<number> {
  return box(page).evaluate((node: HTMLInputElement) => node.selectionStart ?? -1);
}

function mainRegionWidth(page: Page): Promise<number> {
  return page.locator(".main-container").evaluate((node) => node.getBoundingClientRect().width);
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
