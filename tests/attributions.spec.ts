import { expect, test } from "@playwright/test";
import attributions from "../attribution/attributions.json" with { type: "json" };
import { ATTRIBUTIONS_PATH } from "../src/utility-registry";

test("the footer link reaches the page from anywhere", async ({ page }) => {
  await page.goto("/keygen");

  await page.locator(`footer a[href="${ATTRIBUTIONS_PATH}"]`).click();

  await expect(page).toHaveURL(new RegExp(`${ATTRIBUTIONS_PATH}$`));
  await expect(page.getByRole("heading", { name: "Attributions", level: 1 })).toBeVisible();
});

test("the page is not a utility, so it offers no share or reset", async ({ page }) => {
  await page.goto(ATTRIBUTIONS_PATH);

  await expect(page.getByRole("heading", { name: "Attributions", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Reset state")).toHaveCount(0);
});

test("every shipped package is listed with its version and licence", async ({ page }) => {
  await page.goto(ATTRIBUTIONS_PATH);

  const items = page.locator(".mantine-Accordion-item");
  await expect(items).toHaveCount(attributions.packages.length);

  for (const name of ["react", "openpgp", "sshpk", "@mantine/core"]) {
    const pkg = attributions.packages.find((entry) => entry.name === name)!;
    const row = items.filter({ has: page.getByText(pkg.name, { exact: true }) });
    await expect(row).toContainText(pkg.version);
    await expect(row).toContainText(pkg.license);
  }
});

test("the LGPL notice names OpenPGP.js and carries both licence texts", async ({ page }) => {
  await page.goto(ATTRIBUTIONS_PATH);

  await expect(page.getByText(/GNU Lesser General Public License, version 3 or later/)).toBeVisible();
  await expect(page.getByText(/GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/)).toBeVisible();

  await page.getByPlaceholder("Filter by name or licence").fill("openpgp");
  await page.getByRole("button", { name: /openpgp/ }).click();

  await expect(page.getByText(/GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/)).toBeVisible();
});

test("a licence is read when its row is opened and not before", async ({ page }) => {
  const read: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.endsWith(".txt")) read.push(url);
  });

  await page.goto(ATTRIBUTIONS_PATH);
  await expect(page.getByRole("heading", { name: "Attributions", level: 1 })).toBeVisible();
  expect(read.filter((url) => url.includes("openpgp"))).toEqual([]);

  await page.getByPlaceholder("Filter by name or licence").fill("openpgp");
  await page.getByRole("button", { name: /openpgp/ }).click();

  await expect(page.getByText(/GNU LESSER GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/)).toBeVisible();
  expect(read.filter((url) => url.includes("openpgp"))).toHaveLength(1);
});

test("the row says it is reading while the licence is on its way", async ({ page }) => {
  await page.route(/license\/openpgp[^/]*\.txt$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });

  await page.goto(ATTRIBUTIONS_PATH);
  await page.getByPlaceholder("Filter by name or licence").fill("openpgp");
  await page.getByRole("button", { name: /openpgp/ }).click();

  await expect(page.getByText("Reading the licence…")).toBeVisible();
  await expect(page.getByText(/GNU LESSER GENERAL PUBLIC LICENSE/)).toBeVisible();
  await expect(page.getByText("Reading the licence…")).toHaveCount(0);
});

test("the packages come up in a different order each visit", async ({ page }) => {
  const order = async () => {
    await page.goto(ATTRIBUTIONS_PATH);
    await expect(page.locator(".mantine-Accordion-item").first()).toBeVisible();
    return page.locator(".mantine-Accordion-item").allInnerTexts();
  };

  const first = await order();
  expect(first).toHaveLength(attributions.packages.length);
  expect(await order()).not.toEqual(first);
});

test("the order holds still while the filter is typed into", async ({ page }) => {
  await page.goto(ATTRIBUTIONS_PATH);

  const box = page.getByPlaceholder("Filter by name or licence");
  await box.fill("re");
  const narrowed = await page.locator(".mantine-Accordion-item").allInnerTexts();
  await box.fill("rea");
  const further = await page.locator(".mantine-Accordion-item").allInnerTexts();

  expect(narrowed.filter((item) => further.includes(item))).toEqual(further);
});

test("filtering narrows the list to what was typed", async ({ page }) => {
  await page.goto(ATTRIBUTIONS_PATH);

  await page.getByPlaceholder("Filter by name or licence").fill("codemirror");

  const items = page.locator(".mantine-Accordion-item");
  const expected = attributions.packages.filter((pkg) => pkg.name.includes("codemirror")).length;
  await expect(items).toHaveCount(expected);
});

test("nothing on the page reaches another host", async ({ page }) => {
  const offsite: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") offsite.push(url.href);
    return route.continue();
  });

  await page.goto(ATTRIBUTIONS_PATH);
  await expect(page.getByRole("heading", { name: "Attributions", level: 1 })).toBeVisible();

  expect(offsite).toEqual([]);
});
