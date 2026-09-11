import { expect, test } from "@playwright/test";
import { documentTitle, PAGE_META, robotsTxt, sitemapXml, utilityPaths } from "../src/page-meta";
import { utilities } from "../src/utility-registry";

test("the welcome page's head is in the document it was served", async ({ page }) => {
  const response = await page.request.get("/");
  const html = await response.text();

  expect(html).toContain(`<title>${documentTitle(PAGE_META["/"])}</title>`);
  expect(html).toContain(PAGE_META["/"].description);
});

test("the document says what the page is before any script has run", async ({ page }) => {
  const html = await (await page.request.get("/")).text();

  expect(html).toContain(`<h1>${PAGE_META["/"].title}</h1>`);
  expect(html).toContain(`<p class="page-lede">${PAGE_META["/"].description}</p>`);
});

test("the welcome page links every utility before any script has run", async ({ page }) => {
  const html = await (await page.request.get("/")).text();

  for (const path of utilityPaths()) expect(html, path).toContain(`<a href="${path}">`);
});

test("the application clears the fallback and leaves the page one heading", async ({ page }) => {
  await page.goto("/codec");

  await expect(page.locator(".page-fallback")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Codec");
});

test("the welcome page's graph names every utility and goes as the router leaves it", async ({ page }) => {
  const html = await (await page.request.get("/")).text();
  expect(html).toContain("application/ld+json");

  await page.goto("/");
  const script = page.locator("head script[type=\"application/ld+json\"]");
  await expect(script).toHaveCount(1);
  const graph = JSON.parse((await script.textContent())!)["@graph"];
  const list = graph.find((node: { "@type": string }) => node["@type"] === "ItemList");
  const items: { item: { name: string; url: string } }[] = list.itemListElement;

  expect(items.map((entry) => entry.item.url)).toEqual(utilities.map((utility) => `https://utils.plus${utility.path}`));
  expect(items.map((entry) => entry.item.name)).toEqual(utilities.map((utility) => PAGE_META[utility.path].title));

  await page.locator("nav a[href=\"/cron\"]").click();
  await expect(script).toHaveCount(1);
  await expect.poll(() => script.textContent()).toContain("\"FAQPage\"");
  expect(await script.textContent()).not.toContain("\"ItemList\"");
});

test("a utility's article is drawn under the tool and its links route in place", async ({ page }) => {
  await page.goto("/cron");
  const article = page.locator("article.page-article");

  await expect(article.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(article.getByRole("heading", { name: "Frequently asked questions" })).toBeVisible();

  await page.evaluate(() => ((window as unknown as { stayed: boolean }).stayed = true));
  await article.getByRole("link", { name: PAGE_META["/time"].title }).click();
  await expect(page).toHaveURL(/\/time$/);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
  await expect(page.locator("head link[rel=\"canonical\"]")).toHaveAttribute("href", "https://utils.plus/time");
});

test("a link clicked at the foot of a page opens the next at its top", async ({ page }) => {
  await page.goto("/cron");
  await expect(page.locator("article.page-article")).toBeVisible();

  await page.locator("footer").getByRole("link", { name: "Hasher", exact: true }).click();
  await expect(page).toHaveURL(/\/hasher$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("the header names the page it is on and leads home", async ({ page }) => {
  await page.goto("/cron");
  const trail = page.getByRole("navigation", { name: "Breadcrumb" });

  await expect(trail.locator("[aria-current=\"page\"]")).toHaveText("Cron");
  await trail.getByRole("link", { name: "utils+" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(trail.locator("[aria-current=\"page\"]")).toHaveCount(0);
});

test("the footer links every utility", async ({ page }) => {
  await page.goto("/cron");
  const footer = page.locator("footer");

  for (const path of utilityPaths()) await expect(footer.locator(`a[href="${path}"]`)).toHaveCount(1);

  await page.goto("/");
  await expect(page.locator("footer a[href=\"/cron\"]")).toHaveCount(0);
  for (const path of utilityPaths()) await expect(page.locator(`main a[href="${path}"]`)).toHaveCount(1);
});

test("every document tells Dark Reader to leave it alone", async ({ page }) => {
  for (const path of ["/", "/colour"]) {
    const html = await (await page.request.get(path)).text();
    expect(html, path).toContain("<meta name=\"darkreader-lock\" />");
  }

  await page.goto("/codec");
  await page.locator("nav a[href=\"/colour\"]").click();
  await expect(page.locator("head meta[name=\"darkreader-lock\"]")).toHaveCount(1);
});

test("the sitemap, robots.txt and the card picture are served", async ({ page }) => {
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap.replace(/\n {4}<lastmod>[^<]*<\/lastmod>/g, "")).toBe(sitemapXml());
  expect(await (await page.request.get("/robots.txt")).text()).toBe(robotsTxt());

  const image = await page.request.get("/og-image.png");
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("every utility puts its own description in the head", async ({ page }) => {
  for (const { path, description } of utilities) {
    await page.goto(path);

    await expect(page).toHaveTitle(documentTitle(PAGE_META[path]));
    await expect(page.locator("head meta[name=\"description\"]")).toHaveAttribute("content", description);
    await expect(page.locator("head meta[name=\"keywords\"]")).toHaveCount(0);
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
