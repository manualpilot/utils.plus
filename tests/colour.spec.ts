import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const box = (page: Page, label: string) => page.getByLabel(label, { exact: true });

async function openColour(page: Page) {
  await page.goto(`${BASE}/colour`);
  await expect(page.getByRole("heading", { name: "Colour", exact: true })).toBeVisible();
}

async function readBoxes(page: Page): Promise<Record<string, string>> {
  const entries = await Promise.all(
    ["Hex", "CSS name", "RGB", "HSL", "HSV", "CMYK", "LAB", "LCH", "OKLAB", "OKLCH"].map(
      async (label) => [label, await box(page, label).inputValue()] as const,
    ),
  );
  return Object.fromEntries(entries);
}

test("opens on one colour, written out in every format", async ({ page }) => {
  await openColour(page);

  expect(await readBoxes(page)).toEqual({
    "Hex": "#ff7043",
    "CSS name": "",
    "RGB": "rgb(255, 112, 67)",
    "HSL": "hsl(14, 100%, 63%)",
    "HSV": "hsv(14, 74%, 100%)",
    "CMYK": "cmyk(0%, 56%, 74%, 0%)",
    "LAB": "lab(65.13% 53.75 52.1)",
    "LCH": "lch(65.13% 74.85 44.11)",
    "OKLAB": "oklab(71.24% 0.1461 0.1132)",
    "OKLCH": "oklch(71.24% 0.1848 37.77)",
  });

  await expect(box(page, "CSS name")).toHaveAttribute("placeholder", "≈ tomato");
});

test("a colour typed into any box moves every other box and the picker", async ({ page }) => {
  await openColour(page);

  await box(page, "HSL").fill("hsl(210, 100%, 50%)");
  const shown = await readBoxes(page);
  expect(shown.Hex).toBe("#0080ff");
  expect(shown.RGB).toBe("rgb(0, 128, 255)");
  expect(shown.OKLCH).toBe("oklch(61.52% 0.2108 256.1)");

  await expect(page.getByRole("slider", { name: "Hue" })).toHaveAttribute("aria-valuenow", "209.882");
  const preview = page.getByLabel("Selected colour").locator(".mantine-ColorSwatch-colorOverlay");
  await expect(preview).toHaveCSS("background-color", "rgb(0, 128, 255)");
});

test("the box being typed in keeps what was typed, and the rest keep the colour", async ({ page }) => {
  await openColour(page);

  await box(page, "LCH").fill("rebeccapurple");
  expect(await readBoxes(page)).toMatchObject({ "Hex": "#663399", "CSS name": "rebeccapurple" });
  await expect(box(page, "LCH")).toHaveValue("rebeccapurple");

  await box(page, "LCH").blur();
  await expect(box(page, "LCH")).toHaveValue("lch(32.39% 61.24 308.86)");
});

test("half-typed text is wrong where it is typed, and takes nothing else with it", async ({ page }) => {
  await openColour(page);

  await box(page, "RGB").fill("rgb(255, 112,");
  await expect(page.getByText("Cannot read that as a colour")).toBeVisible();
  await expect(box(page, "Hex")).toHaveValue("#ff7043");

  await box(page, "RGB").fill("");
  await expect(page.getByText("Cannot read that as a colour")).toBeHidden();
  await expect(box(page, "Hex")).toHaveValue("#ff7043");

  await box(page, "RGB").blur();
  await expect(box(page, "RGB")).toHaveValue("rgb(255, 112, 67)");
});

test("opacity reaches the formats that can carry it, and the link", async ({ page }) => {
  await openColour(page);

  await box(page, "Hex").fill("#ff704380");
  await box(page, "Hex").blur();

  expect(await readBoxes(page)).toMatchObject({
    "Hex": "#ff704380",
    "RGB": "rgba(255, 112, 67, 0.5)",
    "HSL": "hsla(14, 100%, 63%, 0.5)",
    "LCH": "lch(65.13% 74.85 44.11 / 0.5)",
    "CMYK": "cmyk(0%, 56%, 74%, 0%)",
    "CSS name": "",
  });

  await expect(page).toHaveURL(/#/);
  await page.reload();
  await expect(box(page, "Hex")).toHaveValue("#ff704380");
});

test("dragging the colour out of a hue and back finds the same hue there", async ({ page }) => {
  await openColour(page);

  const hue = page.getByRole("slider", { name: "Hue" });
  const before = await hue.getAttribute("aria-valuenow");

  const area = (await page.getByRole("slider", { name: "Saturation and brightness" }).boundingBox())!;
  await page.mouse.move(area.x + area.width - 5, area.y + 5);
  await page.mouse.down();
  await page.mouse.move(area.x + 2, area.y + 5, { steps: 12 });
  await page.mouse.up();

  const saturation = Number((await box(page, "HSV").inputValue()).match(/, (\d+)%/)![1]);
  expect(saturation).toBeLessThan(5);
  await expect(hue).toHaveAttribute("aria-valuenow", before!);
});

test("a swatch and the sliders write to the boxes", async ({ page }) => {
  await openColour(page);

  await page.getByRole("button", { name: "#fa5252" }).click();
  await expect(box(page, "Hex")).toHaveValue("#fa5252");
  await expect(box(page, "RGB")).toHaveValue("rgb(250, 82, 82)");

  await page.getByRole("slider", { name: "Hue" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(box(page, "HSL")).toHaveValue("hsl(18, 94%, 65%)");
});

test("reads the pair against WCAG, and says which levels it misses", async ({ page }) => {
  await openColour(page);

  await expect(box(page, "Background")).toHaveValue("#ffffff");
  await expect(page.locator("[data-contrast]")).toHaveAttribute("data-contrast", "2.74:1");
  for (const level of ["aa", "aa-large", "aaa", "aaa-large", "non-text"]) {
    await expect(page.locator(`[data-level="${level}"]`)).toHaveAttribute("data-passes", "false");
  }
  await expect(page.getByText("Fails every level.", { exact: false })).toBeVisible();

  await box(page, "Background").fill("black");
  await expect(page.locator("[data-contrast]")).toHaveAttribute("data-contrast", "7.65:1");
  for (const level of ["aa", "aa-large", "aaa", "aaa-large", "non-text"]) {
    await expect(page.locator(`[data-level="${level}"]`)).toHaveAttribute("data-passes", "true");
  }
});

test("the background box takes every notation too, and rides the link", async ({ page }) => {
  await openColour(page);

  await box(page, "Background").fill("oklch(62.59% 0.1641 250.29)");
  await expect(box(page, "Background")).toHaveValue("oklch(62.59% 0.1641 250.29)");
  await box(page, "Background").blur();
  await expect(box(page, "Background")).toHaveValue("#228be6");
  await expect(box(page, "Hex")).toHaveValue("#ff7043");

  await expect(page).toHaveURL(/#/);
  await page.reload();
  await expect(box(page, "Background")).toHaveValue("#228be6");
  await expect(box(page, "Hex")).toHaveValue("#ff7043");
});

test("the swap reads the pair the other way round", async ({ page }) => {
  await openColour(page);

  await page.getByRole("button", { name: "Swap the colour and the background" }).click();
  await expect(box(page, "Hex")).toHaveValue("#ffffff");
  await expect(box(page, "Background")).toHaveValue("#ff7043");
  await expect(page.locator("[data-contrast]")).toHaveAttribute("data-contrast", "2.74:1");
});

test("a palette swatch is a colour to take, and every row is rebuilt around it", async ({ page }) => {
  await openColour(page);

  const complement = page.locator("[data-palette=\"complementary\"]");
  await expect(complement.getByRole("button")).toHaveCount(2);
  await expect(complement.getByRole("button", { name: "Take #00b5d7 as the colour" })).toBeVisible();

  await complement.getByRole("button", { name: "Take #00b5d7 as the colour" }).click();
  await expect(box(page, "Hex")).toHaveValue("#00b5d7");
  await expect(complement.locator("[data-base]")).toHaveAttribute("aria-label", "Take #00b5d7 as the colour");
  await expect(complement.getByRole("button", { name: "Take #e68466 as the colour" })).toBeVisible();
});

test("the ramp steps evenly through the colour and marks where it sits", async ({ page }) => {
  await openColour(page);

  const ramp = page.locator("[data-palette=\"tones\"]");
  await expect(ramp.getByRole("button")).toHaveCount(9);
  await expect(ramp.locator("[data-base]")).toHaveCount(1);
  await expect(ramp.locator("[data-base]")).toHaveAttribute("aria-label", "Take #ff8762 as the colour");
});

test("shows the pair through each kind of colour vision", async ({ page }) => {
  await openColour(page);

  await expect(page.locator("[data-vision]")).toHaveCount(5);
  await expect(page.locator("[data-vision=\"typical\"]")).toContainText("#ff7043");
  await expect(page.locator("[data-vision=\"protanopia\"]")).toContainText("#97883d");
  await expect(page.locator("[data-vision=\"deuteranopia\"]")).toContainText("#bba83f");
  await expect(page.locator("[data-vision=\"tritanopia\"]")).toContainText("#ff5066");
  await expect(page.locator("[data-vision=\"achromatopsia\"]")).toContainText("#9c9c9c");

  await box(page, "Background").fill("#228be6");
  await box(page, "Background").blur();
  const chip = page.locator("[data-vision=\"achromatopsia\"] .colour-vision-chip");
  await expect(chip).toHaveCSS("background-color", "rgb(136, 136, 136)");
});

test("says so when something between the page and the screen is repainting it", async ({ page }) => {
  await page.clock.install();
  await openColour(page);

  const banner = page.locator("[data-interference]");
  await expect(banner).toBeHidden();

  await page.addStyleTag({ content: ".contrast-preview { background-color: rgb(24, 26, 27) !important; }" });

  await page.clock.runFor(9_000);
  await expect(banner).toBeHidden();

  await page.clock.runFor(2_000);
  await expect(banner).toHaveAttribute("data-interference", "repaint");
  await expect(banner).toContainText("Dark Reader");
  await expect(box(page, "Hex")).toHaveValue("#ff7043");
});

test("catches a filter over the page, and takes the banner off when it goes", async ({ page }) => {
  await page.clock.install();
  await openColour(page);

  await page.evaluate(() => document.documentElement.style.setProperty("filter", "invert(1) hue-rotate(180deg)"));
  await page.clock.runFor(11_000);
  await expect(page.locator("[data-interference]")).toHaveAttribute("data-interference", "filter");

  await page.evaluate(() => document.documentElement.style.removeProperty("filter"));
  await page.clock.runFor(60_000);
  await expect(page.locator("[data-interference]")).toBeHidden();
});

test("checks nothing while the tab is in the background, and checks on the way back", async ({ page }) => {
  await page.clock.install();
  await openColour(page);

  const filter = (value: string | null) =>
    page.evaluate((rule) => {
      if (rule) document.documentElement.style.setProperty("filter", rule);
      else document.documentElement.style.removeProperty("filter");
    }, value);

  const visibility = (state: "hidden" | "visible") =>
    page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", { value, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);

  await filter("invert(1)");
  await page.clock.runFor(11_000);
  await expect(page.locator("[data-interference]")).toBeVisible();

  await visibility("hidden");
  await filter(null);
  await page.clock.runFor(120_000);
  await expect(page.locator("[data-interference]")).toBeVisible();

  await visibility("visible");
  await page.clock.runFor(1);
  await expect(page.locator("[data-interference]")).toBeHidden();
});
