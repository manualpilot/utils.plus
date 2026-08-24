import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

async function openSearch(page: Page) {
  await page.goto(`${BASE}/json`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+f");
  await expect(page.locator(".cm-search")).toBeVisible();
}

async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return box;
}

test("Replace keeps a row of its own below Find", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSearch(page);

  const find = await boxOf(page, ".cm-search input[name=search]");
  const replace = await boxOf(page, ".cm-search input[name=replace]");

  expect(replace.y).toBeGreaterThan(find.y + find.height);
  expect(replace.x).toBeCloseTo(find.x, 0);
});

test("the panel is drawn in Mantine's own controls and not the browser's", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSearch(page);

  const drawn = await page.evaluate(() => {
    const field = getComputedStyle(document.querySelector(".cm-search input[name=search]")!);
    const button = getComputedStyle(document.querySelector(".cm-search button[name=next]")!);
    const check = getComputedStyle(document.querySelector(".cm-search input[name=case]")!);
    return {
      font: field.fontFamily,
      radius: field.borderRadius,
      gradient: button.backgroundImage,
      accent: check.accentColor,
    };
  });

  expect(drawn.font).toContain("Roboto");
  expect(drawn.radius).not.toBe("0px");
  expect(drawn.gradient).toBe("none");
  expect(drawn.accent).not.toBe("auto");
});

test("a match is tinted in the site's own orange, and the current one is ringed", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSearch(page);
  await page.locator(".cm-search input[name=search]").fill("hello");
  await page.locator(".cm-search button[name=next]").click();

  const match = await page.evaluate(() => {
    const tint = getComputedStyle(document.querySelector(".cm-searchMatch")!);
    const current = getComputedStyle(document.querySelector(".cm-searchMatch-selected")!);
    return { background: tint.backgroundColor, ring: current.outlineStyle };
  });

  expect(match.background).toMatch(/^rgba\(255, 112, 67,/);
  expect(match.ring).toBe("solid");
});
