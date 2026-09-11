import type { Locator, Page } from "@playwright/test";

export function tool(page: Page): Locator {
  return page.locator(".page-tool");
}
