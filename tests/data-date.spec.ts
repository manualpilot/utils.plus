import { expect, test } from "@playwright/test";

const DATED = [
  { path: "/ip-address", publications: "IANA, the five RIRs and the RPKI" },
  { path: "/countries", publications: "Natural Earth" },
  { path: "/phone-number", publications: "Google's libphonenumber" },
  { path: "/unicode", publications: "the Unicode Character Database" },
];

const STAMP = /Current as of \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\.$/;

for (const { path, publications } of DATED) {
  test(`${path} says when its data was read and from whom`, async ({ page }) => {
    await page.goto(path);

    const mark = page.getByRole("button", { name: new RegExp(`^Read from ${escaped(publications)} `) });
    await expect(mark).toBeVisible();

    await mark.hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveText(STAMP);
    await expect(tooltip).toContainText(`Read from ${publications} when the site was built.`);
  });
}

test("a page that computes its answers carries no date", async ({ page }) => {
  await page.goto("/codec");

  await expect(page.getByRole("button", { name: /^Read from / })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View the Codec source on GitHub" })).toBeVisible();
});

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
