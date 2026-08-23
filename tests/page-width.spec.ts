import { expect, test } from "@playwright/test";

const CAP = 1140;

const container = "#main-content";

test("the width toggle lifts the cap and puts it back", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto("/codec");

  const capped = await page.locator(container).evaluate((el) => el.clientWidth);
  expect(capped).toBe(CAP);

  await page.getByRole("button", { name: "Use the full width" }).click();

  const expanded = await page.locator(container).evaluate((el) => el.clientWidth);
  expect(expanded).toBeGreaterThan(capped);

  const region = await page.locator(".main-region").evaluate((el) => {
    const style = getComputedStyle(el);
    return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  });
  expect(expanded).toBe(Math.round(region));

  await page.getByRole("button", { name: "Use the default width" }).click();
  expect(await page.locator(container).evaluate((el) => el.clientWidth)).toBe(capped);
});

test("the choice follows the reader to the next utility", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto("/codec");

  await page.getByRole("button", { name: "Use the full width" }).click();
  await page.locator("nav a[href=\"/time\"]").click();

  await expect(page.getByRole("button", { name: "Use the default width" })).toBeVisible();
  expect(await page.locator(container).evaluate((el) => el.clientWidth)).toBeGreaterThan(CAP);
});

test("a window with no room to spare is not offered the toggle", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/codec");

  await expect(page.getByRole("button", { name: "Use the full width" })).toBeHidden();

  await page.setViewportSize({ width: 1800, height: 900 });
  await expect(page.getByRole("button", { name: "Use the full width" })).toBeVisible();
});
