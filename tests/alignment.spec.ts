import { expect, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

async function mainRegionWidth(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const el = document.querySelector(".main-container")!;
    const styles = getComputedStyle(el);
    return el.getBoundingClientRect().width
      - parseFloat(styles.paddingLeft)
      - parseFloat(styles.paddingRight);
  });
}

async function openNamespacedUuid(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/unique-id`);
  await page.getByRole("combobox", { name: "ID Type" }).click();
  await page.getByRole("option", { name: "UUID Version 3 (MD5 Namespace)" }).click();
  await expect(page.getByLabel("Namespace (UUID)")).toBeVisible();
}

async function triggerNameError(page: import("@playwright/test").Page) {
  await page.getByLabel("Namespace (UUID)").fill("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  await page.keyboard.press("Escape");
  await expect(page.locator(".absolute-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.locator(".absolute-error")).toHaveCount(1);
  await expect(page.getByText("Required")).toBeVisible();
}

async function triggerNamespaceError(page: import("@playwright/test").Page) {
  await page.getByLabel("Name", { exact: true }).fill("example.com");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.locator(".absolute-error")).toHaveCount(1);
  await expect(page.getByText("Required")).toBeVisible();
}

test("a description and an error both leave input boxes bottom-aligned", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openNamespacedUuid(page);
  expect(await mainRegionWidth(page)).toBeGreaterThan(768);

  const idType = (await page.getByRole("combobox", { name: "ID Type" }).boundingBox())!;
  const count = (await page.getByRole("textbox", { name: "Count" }).boundingBox())!;
  expect(Math.abs((idType.y + idType.height) - (count.y + count.height))).toBeLessThan(2);

  await triggerNameError(page);

  await expect(page.locator(".absolute-error").first()).toHaveCSS("position", "absolute");

  const namespace = (await page.getByLabel("Namespace (UUID)").boundingBox())!;
  const name = (await page.getByLabel("Name", { exact: true }).boundingBox())!;
  expect(Math.abs(namespace.y - name.y)).toBeLessThan(2);
  expect(Math.abs((namespace.y + namespace.height) - (name.y + name.height))).toBeLessThan(2);
});

test("settings rows stack once the main region is narrow", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 950 });
  await openNamespacedUuid(page);
  expect(await mainRegionWidth(page)).toBeLessThan(768);

  const idType = (await page.getByRole("combobox", { name: "ID Type" }).boundingBox())!;
  const count = (await page.getByRole("textbox", { name: "Count" }).boundingBox())!;
  expect(count.y).toBeGreaterThan(idType.y + idType.height);
  expect(Math.abs(idType.width - count.width)).toBeLessThan(2);

  await triggerNamespaceError(page);

  const error = (await page.locator(".absolute-error").first().boundingBox())!;
  const nameLabel = (await page.getByText("Name", { exact: true }).first().boundingBox())!;
  expect(nameLabel.y - (error.y + error.height)).toBeGreaterThan(8);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1000);
});
