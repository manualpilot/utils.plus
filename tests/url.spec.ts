import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const address = (page: Page) => page.getByRole("textbox", { name: "URL", exact: true });
const part = (page: Page, label: string) => page.getByRole("textbox", { name: label, exact: true });
const name = (page: Page, index: number) => page.getByRole("textbox", { name: `Parameter ${index} name` });
const value = (page: Page, index: number) => page.getByRole("textbox", { name: `Parameter ${index} value` });

async function openUrl(page: Page) {
  await page.goto(`${BASE}/url`);
  await expect(page.getByRole("heading", { name: "URL", exact: true })).toBeVisible();
}

test("the address is taken apart into its components", async ({ page }) => {
  await openUrl(page);

  await expect(part(page, "Scheme")).toHaveValue("https");
  await expect(part(page, "Host")).toHaveValue("example.com");
  await expect(part(page, "Port")).toHaveValue("8443");
  await expect(part(page, "Path")).toHaveValue("/api/v2/search");
  await expect(part(page, "Query")).toHaveValue("q=caf%C3%A9+latte&limit=20&tags=hot,fast");
  await expect(part(page, "Fragment")).toHaveValue("results");
});

test("the builder unescapes what the address escapes, and the address keeps the escapes", async ({ page }) => {
  await openUrl(page);

  await expect(name(page, 1)).toHaveValue("q");
  await expect(value(page, 1)).toHaveValue("café latte");
  await expect(value(page, 2)).toHaveValue("20");
  await expect(value(page, 3)).toHaveValue("hot,fast");

  await value(page, 1).fill("tea & biscuits");
  await expect(address(page)).toHaveValue(/\?q=tea%20%26%20biscuits&limit=20/);
  await expect(value(page, 1)).toHaveValue("tea & biscuits");
});

test("typing a parameter a character at a time survives the trip through the address", async ({ page }) => {
  await openUrl(page);
  await value(page, 2).fill("");
  await value(page, 2).pressSequentially("a b&c=d%e");

  await expect(value(page, 2)).toHaveValue("a b&c=d%e");
  await expect(part(page, "Query")).toHaveValue(/&limit=a%20b%26c%3Dd%25e&/);

  await name(page, 2).fill("");
  await name(page, 2).pressSequentially("100%");
  await expect(name(page, 2)).toHaveValue("100%");
  await expect(part(page, "Query")).toHaveValue(/&100%25=a%20b%26c%3Dd%25e&/);
});

test("a change to the address reaches the components and the builder at once", async ({ page }) => {
  await openUrl(page);
  await address(page).fill("http://user:pw@localhost:3000/x?a=one%20two#end");

  await expect(part(page, "Scheme")).toHaveValue("http");
  await expect(part(page, "Username")).toHaveValue("user");
  await expect(part(page, "Password")).toHaveValue("pw");
  await expect(part(page, "Host")).toHaveValue("localhost");
  await expect(part(page, "Port")).toHaveValue("3000");
  await expect(part(page, "Fragment")).toHaveValue("end");
  await expect(name(page, 1)).toHaveValue("a");
  await expect(value(page, 1)).toHaveValue("one two");
  await expect(name(page, 2)).toHaveCount(0);
});

test("a component writes its own piece back and leaves the rest of the address alone", async ({ page }) => {
  await openUrl(page);

  await part(page, "Host").fill("api.example.com");
  await expect(address(page))
    .toHaveValue("https://api.example.com:8443/api/v2/search?q=caf%C3%A9+latte&limit=20&tags=hot,fast#results");

  await part(page, "Port").fill("");
  await expect(address(page)).toHaveValue(/^https:\/\/api\.example\.com\/api/);
});

test("a parameter is added, edited and removed, and the query follows each time", async ({ page }) => {
  await openUrl(page);

  await page.getByRole("button", { name: "Add parameter" }).click();
  await name(page, 4).fill("sort");
  await value(page, 4).fill("newest first");
  await expect(part(page, "Query")).toHaveValue("q=caf%C3%A9+latte&limit=20&tags=hot,fast&sort=newest%20first");

  await value(page, 2).fill("50");
  await expect(part(page, "Query")).toHaveValue("q=caf%C3%A9+latte&limit=50&tags=hot,fast&sort=newest%20first");

  await page.getByRole("button", { name: "Remove parameter 1" }).click();
  await expect(part(page, "Query")).toHaveValue("limit=50&tags=hot,fast&sort=newest%20first");
  await expect(name(page, 1)).toHaveValue("limit");
});

test("the last parameter takes the question mark with it", async ({ page }) => {
  await openUrl(page);
  await address(page).fill("https://example.com/only?one=1");

  await page.getByRole("button", { name: "Remove parameter 1" }).click();
  await expect(address(page)).toHaveValue("https://example.com/only");
  await expect(page.getByText("This address carries no query")).toBeVisible();

  await page.getByRole("button", { name: "Add parameter" }).click();
  await name(page, 1).fill("two");
  await expect(address(page)).toHaveValue("https://example.com/only?two=");
});

test("a component that cannot be right says so where it was typed", async ({ page }) => {
  await openUrl(page);

  await part(page, "Port").fill("80a");
  await expect(part(page, "Port")).toHaveValue("80a");
  await expect(page.getByText("A port is a number from 0 to 65535")).toBeVisible();

  await part(page, "Port").fill("8080");
  await expect(page.getByText("A port is a number from 0 to 65535")).toBeHidden();
});

test("a percent escape that opens nothing is shown as it was written", async ({ page }) => {
  await openUrl(page);
  await address(page).fill("https://example.com/x?discount=100%zz");

  await expect(value(page, 1)).toHaveValue("100%zz");
  await expect(page.getByText("A percent escape here opens nothing")).toBeVisible();
});

test("the address is what the share link carries", async ({ page }) => {
  await openUrl(page);
  await address(page).fill("https://example.com/shared?a=1");

  await expect(page).toHaveURL(/#./);
  const shared = page.url();

  await page.goto(`${BASE}/codec`);
  await page.goto(shared);
  await expect(address(page)).toHaveValue("https://example.com/shared?a=1");
  await expect(value(page, 1)).toHaveValue("1");
});
