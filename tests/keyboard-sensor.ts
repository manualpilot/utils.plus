import type { Page } from "@playwright/test";

export function sensorListening(page: Page): Promise<void> {
  return page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve)));
}
