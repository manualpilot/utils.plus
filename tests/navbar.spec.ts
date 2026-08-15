import { expect, test } from "@playwright/test";
import { utilities } from "../src/utility-registry";

test("every navbar item is a real link", async ({ page }) => {
  await page.goto("/");

  for (const { path } of utilities) {
    await expect(page.locator(`nav a[href="${path}"]`)).toHaveCount(1);
  }
});

test("the first stop of the page is past the navbar", async ({ page }) => {
  await page.goto("/calculator");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip to the utility" })).toBeFocused();

  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");

  expect(new URL(page.url()).hash).toBe("");
});

test("a plain click still routes without a reload", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => ((window as unknown as { stayed?: boolean }).stayed = true));
  await page.locator("nav a[href=\"/time\"]").click();

  await expect(page).toHaveURL(/\/time$/);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});

test("a modifier click opens a second tab and leaves this one alone", async ({ page, context }) => {
  await page.goto("/codec");

  const opened = context.waitForEvent("page");
  await page.locator("nav a[href=\"/time\"]").click({ modifiers: ["ControlOrMeta"] });

  await expect(await opened).toHaveURL(/\/time$/);
  await expect(page).toHaveURL(/\/codec$/);
});
