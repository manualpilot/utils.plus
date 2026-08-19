import { expect, Page, test } from "@playwright/test";
import { utilities } from "../src/utility-registry";

const BASE = process.env.PW_BASE_URL ?? "";

const search = (page: Page) => page.getByPlaceholder("Search utilities");
const topMatch = (page: Page) => page.locator("[data-action][data-selected]");

test("the shortcut opens the search from any page, and Escape gives the page back", async ({ page }) => {
  await page.goto(`${BASE}/codec`);
  await expect(search(page)).toBeHidden();

  await page.keyboard.press("Meta+Space");
  await expect(search(page)).toBeHidden();

  await page.keyboard.press("Control+Space");
  await expect(search(page)).toBeFocused();
  await expect(page.locator("[data-action]")).toHaveCount(utilities.length);

  await page.keyboard.press("Escape");
  await expect(search(page)).toBeHidden();
  await expect(page).toHaveURL(/\/codec$/);
});

test("a keyword no name says finds the page, and Enter goes there", async ({ page }) => {
  await page.goto(`${BASE}/codec`);

  await page.keyboard.press("Control+Space");
  await search(page).fill("bcrypt");
  await expect(topMatch(page)).toContainText("Hasher");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/hasher$/);
  await expect(search(page)).toBeHidden();
});

test("a mistyped name still reaches its utility", async ({ page }) => {
  await page.goto(`${BASE}/`);

  await page.keyboard.press("Control+Space");
  await search(page).fill("colur");
  await expect(topMatch(page)).toContainText("Colour");

  await search(page).fill("qqqqzzzz");
  await expect(page.getByText("No utility goes by that.")).toBeVisible();
});

test("the editor keeps the shortcut, and hands it back when the caret leaves", async ({ page }) => {
  await page.goto(`${BASE}/json`);
  await page.locator(".cm-content").click();
  await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/);

  await page.keyboard.press("Control+Space");
  await expect(search(page)).toBeHidden();
  await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/);

  await page.getByRole("heading", { name: "JSON" }).click();
  await page.keyboard.press("Control+Space");
  await expect(search(page)).toBeFocused();
});

test("the calculator's own keyboard does not take the shortcut", async ({ page }) => {
  await page.goto(`${BASE}/calculator`);

  const display = page.getByRole("status", { name: "Display" });
  const shown = await display.textContent();

  await page.keyboard.press("Control+Space");
  await expect(search(page)).toBeFocused();
  await expect(display).toHaveText(shown ?? "");
});

test("a focused input is no bar to the shortcut", async ({ page }) => {
  await page.goto(`${BASE}/codec`);

  const input = page.getByRole("textbox").first();
  await input.click();
  await page.keyboard.press("Control+Space");

  await expect(search(page)).toBeFocused();
});
