import { expect, Locator, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const showing = (page: Page) => page.locator("[data-country]");

const fact = (page: Page, label: string) => page.locator(`[data-fact="${label}"]`);

test.describe("a browser whose clock is somewhere in particular", () => {
  test.use({ timezoneId: "Europe/Berlin", locale: "en-US" });

  test("opens on the country the clock is set in", async ({ page }) => {
    await open(page);

    await expect(showing(page)).toHaveAttribute("data-country", "DE");
    await expect(page.getByRole("heading", { name: "Germany", exact: true })).toBeVisible();
    await expect(fact(page, "Calling code")).toContainText("+49");

    await page.waitForTimeout(SETTLE_MS);
    expect(new URL(page.url()).hash).toBe("");
  });
});

test.describe("a browser that will not say where it is", () => {
  test.use({ timezoneId: "UTC", locale: "en" });

  test("opens on Australia", async ({ page }) => {
    await open(page);

    await expect(showing(page)).toHaveAttribute("data-country", "AU");
    await expect(page.getByRole("heading", { name: "Australia", exact: true })).toBeVisible();
  });
});

test.describe("the page", () => {
  test.use({ timezoneId: "Australia/Sydney", locale: "en-AU" });

  test("reads a country's data back off the library", async ({ page }) => {
    await open(page);

    await expect(page.getByText("Commonwealth of Australia").first()).toBeVisible();
    await expect(fact(page, "ISO 3166-1 alpha-2")).toContainText("AU");
    await expect(fact(page, "ISO 3166-1 alpha-3")).toContainText("AUS");
    await expect(fact(page, "ISO 3166-1 numeric")).toContainText("036");
    await expect(fact(page, "Internet domain")).toContainText(".au");
    await expect(fact(page, "Capital")).toContainText("Canberra");
    await expect(fact(page, "Area")).toContainText("7,692,024\u00a0km²");
    await expect(fact(page, "Coordinates")).toContainText("27°00′00″S 133°00′00″E");
    await expect(page.getByText("Australian dollar")).toBeVisible();
    await expect(page.getByText("Landlocked")).toHaveCount(0);
  });

  test("is searched by what a country is called anywhere, not only by its label", async ({ page }) => {
    await open(page);

    await pick(page, "cote d'ivoire", "Ivory Coast");
    await expect(showing(page)).toHaveAttribute("data-country", "CI");

    await pick(page, "deutschland", "Germany");
    await expect(showing(page)).toHaveAttribute("data-country", "DE");

    await pick(page, "NPL", "Nepal");
    await expect(showing(page)).toHaveAttribute("data-country", "NP");
    await expect(page.getByText("Landlocked")).toBeVisible();
  });

  test("stays searchable once a country has been picked", async ({ page }) => {
    await open(page);

    const combobox = page.getByRole("combobox", { name: "Country" });
    await expect(combobox).toHaveValue("Australia");

    await combobox.click();
    await expect(page.getByRole("option", { name: "Australia", exact: false })).toBeVisible();

    await pick(page, "Japan", "Japan");
    await expect(combobox).toHaveValue("Japan");

    await pick(page, "Peru", "Peru");
    await expect(showing(page)).toHaveAttribute("data-country", "PE");
  });

  test("puts the best match at the top of the list and highlights it", async ({ page }) => {
    await open(page);

    const combobox = page.getByRole("combobox", { name: "Country" });
    await combobox.click();
    await combobox.fill("uni");

    const options = page.getByRole("option");
    await expect(options.first()).toContainText("United Arab Emirates");
    await expect(options.nth(1)).toContainText("United Kingdom");
    await expect(options.nth(2)).toContainText("United States");

    await expect(options.first()).toBeInViewport();
    await combobox.press("Enter");
    await expect(showing(page)).toHaveAttribute("data-country", "AE");
  });

  test("a land border is the way to the country it names", async ({ page }) => {
    await open(page);

    await pick(page, "Portugal", "Portugal");
    await expect(showing(page)).toHaveAttribute("data-country", "PT");

    await page.getByRole("button", { name: /Spain/ }).click();
    await expect(showing(page)).toHaveAttribute("data-country", "ES");
    await expect(fact(page, "Capital")).toContainText("Madrid");
    await expect(page.getByRole("combobox", { name: "Country" })).toHaveValue(/Spain/);
  });

  test("draws the country, and makes every neighbour on the map the way to that country", async ({ page }) => {
    await open(page);

    await pick(page, "Portugal", "Portugal");
    const map = page.getByRole("img", { name: /^A map of Portugal, bordering Spain/ });
    await expect(map).toBeVisible();
    await expect(map.locator(".country-map-own")).toHaveCount(1);

    await map.locator(".country-map-neighbour").click();
    await expect(showing(page)).toHaveAttribute("data-country", "ES");
    await expect(fact(page, "Capital")).toContainText("Madrid");
  });

  test("makes the countries the frame merely holds the way to them too", async ({ page }) => {
    await open(page);

    await pick(page, "Portugal", "Portugal");
    const map = page.locator("svg.country-map");

    const land = map.locator(".country-map-land[data-reachable]");
    await expect(land.first()).toBeAttached();

    await land.first().dispatchEvent("click");
    await expect(showing(page)).not.toHaveAttribute("data-country", "PT");
    await expect(page.locator("svg.country-map")).toBeVisible();
  });

  test("flies to the country clicked rather than cutting to it", async ({ page }) => {
    await open(page);

    await pick(page, "Portugal", "Portugal");
    const map = page.locator("svg.country-map");
    const flight = page.locator(".country-map-flight");

    const opened = page.evaluate(() =>
      new Promise<string>((resolve) => {
        const group = document.querySelector(".country-map-flight");
        const watch = () => {
          if (!group) return resolve("gone");
          if (group.getAnimations().length > 0) return resolve(getComputedStyle(group).transform);
          requestAnimationFrame(watch);
        };
        watch();
      })
    );

    await map.locator(".country-map-neighbour").click();
    expect(await opened).not.toBe("none");

    await expect(showing(page)).toHaveAttribute("data-country", "ES");
    await expect.poll(() => flight.evaluate((group) => getComputedStyle(group).transform)).toBe("none");
  });

  test("names whatever the pointer is over on the map, with its flag", async ({ page }) => {
    await open(page);

    await pick(page, "Portugal", "Portugal");
    const map = page.locator("svg.country-map");
    const naming = page.locator(".mantine-TooltipFloating-tooltip");

    await expect(naming).toBeHidden();

    await map.locator(".country-map-neighbour").hover();
    await expect(naming).toContainText("Spain");
    await expect(naming).toContainText("\u{1F1EA}\u{1F1F8}");

    await map.locator(".country-map-own").hover();
    await expect(naming).toContainText("Portugal");
    await expect(naming).toContainText("\u{1F1F5}\u{1F1F9}");
  });

  test("says whose boundaries it is drawing", async ({ page }) => {
    await open(page);

    await expect(viewer(page)).toHaveValue("Default");
    await expect(page.getByText("Boundaries as Natural Earth draws them by default")).toBeVisible();
  });

  test("says what the one option that names no country means, while that is the one picked", async ({ page }) => {
    await open(page);

    const mark = page.getByRole("button", { name: /^Default draws each country as the territory it holds/ });
    await mark.hover();
    await expect(page.getByRole("tooltip")).toContainText("this information is provided by Natural Earth");

    const input = await box(viewer(page));
    const icon = await box(mark);
    expect(icon.y + icon.height / 2).toBeCloseTo(input.y + input.height / 2, 0);

    await pickView(page, "China");
    await expect(mark).toHaveCount(0);
    expect((await box(viewer(page))).x).toBe(input.x);

    await pickView(page, "Default");
    await expect(mark).toBeVisible();
  });

  test("redraws the map from whichever point of view is picked, and back again", async ({ page }) => {
    await open(page);

    await pick(page, "Taiwan", "Taiwan");
    await expect(page.locator(".country-map-own")).toHaveCount(1);

    await pickView(page, "China");
    await expect(page.getByText("for the China point of view")).toBeVisible();
    await expect(page.locator(".country-map-own")).toHaveCount(0);
    await expect(page.getByText("this land is inside the shape filed under China")).toBeVisible();

    await pickView(page, "Default");
    await expect(page.getByText("Boundaries as Natural Earth draws them by default")).toBeVisible();
    await expect(page.locator(".country-map-own")).toHaveCount(1);
  });

  test("shows the whole of a dialling plan without putting it in a row", async ({ page }) => {
    await open(page);

    await pick(page, "United States", "United States");

    await expect(fact(page, "Calling code")).toContainText("+1");
    await expect(page.getByText("380 dialling prefixes")).toBeVisible();
    await expect(page.getByText("+1907", { exact: true })).toBeVisible();
    await expect(page.getByText("+1808", { exact: true })).toBeVisible();
  });

  test("says what the data does not carry rather than leaving a blank", async ({ page }) => {
    await open(page);

    await pick(page, "Antarctica", "Antarctica");

    await expect(fact(page, "Capital")).toHaveCount(0);
    await expect(fact(page, "Calling code")).toHaveCount(0);
    await expect(page.getByText("None of its own")).toBeVisible();
    await expect(page.getByText("None recorded")).toBeVisible();
    await expect(fact(page, "ISO 3166-1 alpha-3")).toContainText("ATA");
  });

  test("draws the flags from a font of this site's own rather than from whatever the system has", async ({ page }) => {
    const offsite: string[] = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") offsite.push(url.href);
      return route.continue();
    });

    await open(page);

    const covered = await page.evaluate(async () => {
      await document.fonts.load("16px \"Twemoji Country Flags\"", "\u{1F1E6}\u{1F1FA}");
      return document.fonts.check("16px \"Twemoji Country Flags\"", "\u{1F1E6}\u{1F1FA}");
    });

    expect(covered).toBe(true);
    expect(offsite).toEqual([]);
  });

  test("the link carries the country and the boundaries it is drawn from, and nothing else", async ({ page }) => {
    await open(page);

    await pick(page, "Japan", "Japan");
    await expect.poll(() => hashState(page)).toEqual({ country: "JP", view: "default" });

    await pickView(page, "India");
    await expect.poll(() => hashState(page)).toEqual({ country: "JP", view: "IN" });

    const shared = page.url();
    const other = await page.context().newPage();
    await other.goto(shared);

    await expect(showing(other)).toHaveAttribute("data-country", "JP");
    await expect(other.getByText("日本").first()).toBeVisible();
    await expect(viewer(other)).toHaveValue("India");
    await expect(other.getByText("for the India point of view")).toBeVisible();
  });
});

const SETTLE_MS = 600;

async function open(page: Page) {
  await page.goto(`${BASE}/countries`);
  await expect(showing(page)).toBeVisible();
}

async function pick(page: Page, search: string, option: string) {
  const combobox = page.getByRole("combobox", { name: "Country" });
  await combobox.click();
  await combobox.fill(search);
  await page.getByRole("option", { name: option }).first().click();
}

const viewer = (page: Page) => page.getByRole("combobox", { name: "Point of view" });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error("nothing on screen to measure");
  return found;
}

async function pickView(page: Page, option: string) {
  await viewer(page).click();
  await page.getByRole("option", { name: option }).first().click();
}

function hashState(page: Page): Record<string, string> {
  let b64 = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test.describe("a browser in a country Natural Earth publishes a point of view for", () => {
  test.use({ timezoneId: "Asia/Shanghai", locale: "zh-CN" });

  test("opens on the boundaries that view has, and is told which view it is", async ({ page }) => {
    await open(page);

    await expect(viewer(page)).toHaveValue("China");
    await expect(page.getByText("for the China point of view")).toBeVisible();

    await pick(page, "Taiwan", "Taiwan");
    await expect(page.locator(".country-map-own")).toHaveCount(0);
    await expect(page.getByText("this land is inside the shape filed under China")).toBeVisible();
  });
});
