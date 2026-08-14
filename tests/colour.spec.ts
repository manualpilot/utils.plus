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
