import { expect, type Request, test } from "@playwright/test";
import { tool } from "./tool";

const heading = (page: Parameters<typeof tool>[0]) => tool(page).getByRole("heading", { level: 1 });

const PAGES = [
  { path: "/codec", heading: "Codec" },
  { path: "/attributions", heading: "Attributions" },
];

test("nothing the shell loads names a page's module, which only its manifest does", async ({ page, request }) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".js")) scripts.push(response.text());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const bodies = await Promise.all(scripts);
  expect(bodies.length).toBeGreaterThan(0);
  for (const { path } of PAGES) {
    const { module } = await (await request.get(`${path}/manifest.json`)).json();
    const file = module.split("/").at(-1);
    for (const body of bodies) expect(body).not.toContain(file);
  }
});

for (const { path, heading: text } of PAGES) {
  test(`${path} is loaded off the manifest beside its document`, async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (request) => asked.push(new URL(request.url()).pathname));
    await page.goto(path);
    await expect(heading(page)).toHaveText(text);

    const manifest = asked.indexOf(`${path}/manifest.json`);
    const module = asked.findIndex((asset) => new RegExp(`^/assets${path}-[^/]+\\.js$`).test(asset));
    expect(manifest).toBeGreaterThanOrEqual(0);
    expect(module).toBeGreaterThan(manifest);
  });
}

test("a utility's stylesheets arrive with it", async ({ page, request }) => {
  const { css } = await (await request.get("/csv/manifest.json")).json();
  expect(css.length).toBeGreaterThan(0);

  await page.goto("/csv");
  await expect(heading(page)).toBeVisible();
  for (const href of css) await expect(page.locator(`link[rel="stylesheet"][href="${href}"]`)).toHaveCount(1);
});

test("a utility's manifest is asked for once a tab", async ({ page }) => {
  const manifests: string[] = [];
  page.on("request", (request: Request) => {
    const { pathname } = new URL(request.url());
    if (pathname.endsWith("/manifest.json")) manifests.push(pathname);
  });

  await page.goto("/codec");
  await expect(heading(page)).toHaveText("Codec");
  await page.locator(`nav a[href="/json"]`).click();
  await expect(heading(page)).toHaveText("JSON");
  await page.locator(`nav a[href="/codec"]`).click();
  await expect(heading(page)).toHaveText("Codec");

  expect(manifests).toEqual(["/codec/manifest.json", "/json/manifest.json"]);
});

test("a manifest from another build loads the page afresh, and only once", async ({ page }) => {
  await page.route("**/codec/manifest.json", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), build: "another build" } });
  });

  await page.goto("/codec");
  await expect(heading(page)).toHaveText("Codec");

  const navigation = await page.evaluate(() =>
    (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type
  );
  expect(navigation).toBe("reload");
});
