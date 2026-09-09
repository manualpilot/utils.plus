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

test("the navbar scrolls to its last link without moving the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto("/");

  const last = page.locator(`nav a[href="${utilities[utilities.length - 1].path}"]`);
  await expect(last).not.toBeInViewport();

  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();

  expect(await page.evaluate(() => window.scrollY)).toBe(0);
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

test("the navbar collapses at a width that has room for it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/codec");

  const link = page.locator("nav a[href=\"/time\"]");
  await expect(link).toBeVisible();

  await page.getByRole("button", { name: "Hide the navigation" }).click();
  await expect(link).toBeHidden();

  await page.getByRole("button", { name: "Show the navigation" }).click();
  await expect(link).toBeVisible();
});

test("a collapsed navbar stays collapsed on the next page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/codec");

  await page.getByRole("button", { name: "Hide the navigation" }).click();
  await page.getByText("utils+").click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Show the navigation" })).toBeVisible();
  await expect(page.locator("nav a[href=\"/time\"]")).toBeHidden();
});

test("a collapsed navbar is out of the tab order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/codec");

  await page.getByRole("button", { name: "Hide the navigation" }).click();
  await expect(page.locator("nav a[href=\"/time\"]")).toBeHidden();

  const focused = await page.evaluate(() => {
    const link = document.querySelector("nav a[href=\"/time\"]") as HTMLElement;
    link.focus();
    return document.activeElement === link;
  });
  expect(focused).toBe(false);
});

test("a narrow window's navbar opens and closes on the link it was opened for", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto("/codec");

  const link = page.locator("nav a[href=\"/time\"]");
  await expect(link).toBeHidden();

  await page.getByRole("button", { name: "Open the navigation" }).click();
  await expect(link).toBeVisible();

  await link.click();
  await expect(page).toHaveURL(/\/time$/);
  await expect(link).toBeHidden();
});
