import { expect, test } from "@playwright/test";
import { documentTitle, PAGE_META, robotsTxt, sitemapXml } from "../src/page-meta";
import { utilities } from "../src/utility-registry";

test("the welcome page's head is in the document it was served", async ({ page }) => {
  const response = await page.request.get("/");
  const html = await response.text();

  expect(html).toContain(`<title>${documentTitle(PAGE_META["/"])}</title>`);
  expect(html).toContain(PAGE_META["/"].description);
});

test("the welcome page says what each utility is", async ({ page }) => {
  await page.goto("/");
  const script = page.locator("head script[type=\"application/ld+json\"]");

  await expect(script).toHaveCount(1);
  const graph = JSON.parse((await script.textContent())!)["@graph"];
  const list = graph.find((node: { "@type": string }) => node["@type"] === "ItemList");
  const items: { item: { name: string; url: string } }[] = list.itemListElement;

  expect(items.map((entry) => entry.item.url)).toEqual(utilities.map((utility) => `https://utils.plus${utility.path}`));
  expect(items.map((entry) => entry.item.name)).toEqual(utilities.map((utility) => PAGE_META[utility.path].title));
});

test("the graph is on the page before the application asks for anything", async ({ page }) => {
  const html = await (await page.request.get("/")).text();

  expect(html).not.toContain("application/ld+json");
  expect(html).toMatch(/<script type="module"[^>]*utils-metadata/);
});

test("routing off the welcome page takes its list of utilities with it", async ({ page }) => {
  const graph = page.locator("head script[type=\"application/ld+json\"]");

  await page.goto("/");
  await expect(graph).toHaveCount(1);

  await page.locator("nav a[href=\"/codec\"]").click();
  await expect(graph).toHaveCount(0);
});

test("the sitemap and robots.txt are served", async ({ page }) => {
  expect(await (await page.request.get("/sitemap.xml")).text()).toBe(sitemapXml());
  expect(await (await page.request.get("/robots.txt")).text()).toBe(robotsTxt());
});

test("every utility puts its own description in the head", async ({ page }) => {
  for (const { path, description, keywords } of utilities) {
    await page.goto(path);

    await expect(page).toHaveTitle(documentTitle(PAGE_META[path]));
    await expect(page.locator("head meta[name=\"description\"]")).toHaveAttribute("content", description);
    await expect(page.locator("head meta[name=\"keywords\"]")).toHaveAttribute("content", keywords.join(", "));
    await expect(page.locator("head link[rel=\"canonical\"]")).toHaveAttribute("href", `https://utils.plus${path}`);
  }
});

test("routing to another utility rewrites the head rather than adding to it", async ({ page }) => {
  await page.goto("/codec");
  await page.locator("nav a[href=\"/time\"]").click();

  const time = utilities.find((utility) => utility.path === "/time")!;
  await expect(page.locator("head meta[name=\"description\"]")).toHaveAttribute("content", time.description);
  await expect(page.locator("head meta[name=\"description\"]")).toHaveCount(1);
  await expect(page.locator("head link[rel=\"canonical\"]")).toHaveCount(1);
});

test("a share link is canonical to the utility itself", async ({ page }) => {
  await page.goto("/codec");
  await page.getByPlaceholder("Text to encode").fill("hello");

  await expect(page).toHaveURL(/#./);
  await expect(page.locator("head link[rel=\"canonical\"]")).toHaveAttribute("href", "https://utils.plus/codec");
});

test("an address with no page is kept out of the index", async ({ page }) => {
  await page.goto("/nothing-here");

  await expect(page.locator("head meta[name=\"robots\"]")).toHaveAttribute("content", "noindex, follow");
});
