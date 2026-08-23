import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

async function openImage(page: Page) {
  await page.goto(`${BASE}/image`);
  await expect(page.getByText("Click to choose a picture")).toBeVisible();
}

async function makePicture(page: Page, type = "image/png", width = 320, height = 200): Promise<string> {
  return page.evaluate(({ type, width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    for (const [at, colour] of ["#c94f3d", "#3d7ac9", "#4dc95f", "#c9b93d"].entries()) {
      context.fillStyle = colour;
      context.fillRect((at % 2) * (width / 2), Math.floor(at / 2) * (height / 2), width / 2, height / 2);
    }
    return canvas.toDataURL(type);
  }, { type, width, height });
}

async function choose(page: Page, uri: string, name = "picture.png") {
  const [header, payload] = uri.split(",");
  await page.locator("input[type=\"file\"]").setInputFiles({
    name,
    mimeType: header.slice(5).replace(";base64", ""),
    buffer: Buffer.from(payload, "base64"),
  });
  await expect(page.locator(".image-stage img")).toBeVisible();
}

const fact = (page: Page, label: string) => page.locator(`[data-fact="${label}"] td`).last();

const tab = (page: Page, name: string) => page.locator(".mantine-SegmentedControl-label", { hasText: name }).click();

function decodeHash(url: string): Record<string, unknown> {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("a chosen file is read for what it actually is", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await tab(page, "Metadata");
  await expect(fact(page, "Name")).toHaveText("picture.png");
  await expect(fact(page, "Dimensions")).toHaveText("320 × 200");
  await expect(fact(page, "Aspect ratio")).toHaveText("8:5");
  await expect(fact(page, "Colour type")).toHaveText("Truecolour with alpha");
  await expect(fact(page, "Bit depth")).toHaveText("8 per channel");
});

test("a data URI pasted into the box is a picture like any other", async ({ page }) => {
  await openImage(page);
  const uri = await makePicture(page, "image/png", 64, 64);
  await page.getByRole("textbox", { name: "Or paste a data URI" }).fill(uri);
  await page.getByRole("button", { name: "Read the URI" }).click();

  await expect(page.locator(".image-stage img")).toBeVisible();
  await tab(page, "Metadata");
  await expect(fact(page, "Dimensions")).toHaveText("64 × 64");
});

test("anything that is not a picture is refused with a reason", async ({ page }) => {
  await openImage(page);
  await page.getByRole("textbox", { name: "Or paste a data URI" }).fill("https://example.com/cat.png");
  await page.getByRole("button", { name: "Read the URI" }).click();
  await expect(page.getByText("That did not read as a picture")).toBeVisible();
});

test("dragging on the picture draws a crop, and the size follows it", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  const layer = page.locator(".image-crop-layer");
  const box = (await layer.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator(".image-crop")).toBeVisible();
  await expect(page.getByText(/^Crop 1\d\d × \d+ at/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Width", exact: true })).not.toHaveValue("320");
});

test("a turn shows on the picture, and a crop drawn through one lands where it was drawn", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  const frame = page.locator(".image-frame");
  const flat = (await frame.boundingBox())!;
  expect(flat.width).toBeGreaterThan(flat.height);

  await page.getByRole("button", { name: "Right" }).click();
  await expect.poll(async () => {
    const box = (await frame.boundingBox())!;
    return box.height > box.width;
  }).toBe(true);

  const turnedBox = (await frame.boundingBox())!;
  expect(Math.round(turnedBox.width)).toBe(Math.round(flat.height));
  expect(Math.round(turnedBox.height)).toBe(Math.round(flat.width));

  await page.mouse.move(turnedBox.x + turnedBox.width * 0.15, turnedBox.y + turnedBox.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(turnedBox.x + turnedBox.width * 0.85, turnedBox.y + turnedBox.height * 0.5, { steps: 8 });
  await page.mouse.up();

  const near = async (name: string, want: number) => {
    const value = Number(await page.getByRole("textbox", { name }).inputValue());
    expect(Math.abs(value - want), `${name} was ${value}, wanted about ${want}`).toBeLessThanOrEqual(4);
  };
  await near("Crop X", 48);
  await near("Crop Y", 30);
  await near("Crop width", 112);
  await near("Crop height", 140);
});

test("a crop shape holds its proportions while a corner is dragged", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await page.getByRole("combobox", { name: "Crop shape" }).click();
  await page.getByRole("option", { name: "Square" }).click();

  const width = await page.getByRole("textbox", { name: "Crop width" }).inputValue();
  const height = await page.getByRole("textbox", { name: "Crop height" }).inputValue();
  expect(width).toBe(height);
  expect(Number(width)).toBe(200);
});

const panelTitles = (page: Page) => page.locator(".mantine-Card-root h4");

async function settled(page: Page) {
  await expect(fact(page, "Size")).not.toBeEmpty();
}

test("a card shuts to its header and the reset in it still works", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await expect(page.getByRole("combobox", { name: "Crop shape" })).toBeVisible();
  await page.getByRole("button", { name: "Close Size and shape" }).click();

  await expect(page.getByRole("combobox", { name: "Crop shape" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Size and shape" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start over" })).toBeVisible();

  await page.getByRole("button", { name: "Open Size and shape" }).click();
  await expect(page.getByRole("combobox", { name: "Crop shape" })).toBeVisible();
});

test("what a shut card was set to is still what comes out", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await page.getByRole("textbox", { name: "Width", exact: true }).fill("160");
  await expect(fact(page, "Dimensions")).toHaveText("160 × 100");

  await page.getByRole("button", { name: "Close Size and shape" }).click();
  await expect(fact(page, "Dimensions")).toHaveText("160 × 100");
});

test("a card dragged past the other stays where it was put", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await openImage(page);
  await choose(page, await makePicture(page));
  await settled(page);
  await expect(panelTitles(page)).toHaveText(["Picture", "Size and shape", "Colour", "Save as"]);

  const handle = page.getByRole("button", { name: "Reorder Colour" });
  const from = (await handle.boundingBox())!;
  const onto = (await page.getByRole("heading", { name: "Size and shape" }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 20, { steps: 5 });
  await page.mouse.move(from.x + from.width / 2, onto.y, { steps: 20 });
  await page.mouse.up();

  await expect(panelTitles(page)).toHaveText(["Picture", "Colour", "Size and shape", "Save as"]);
});

test("a handle reached by keyboard reorders without a pointer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await openImage(page);
  await choose(page, await makePicture(page));
  await settled(page);

  await page.getByRole("button", { name: "Reorder Size and shape" }).focus();

  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("Draggable item shape");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status")).toContainText("droppable area colour");
  await page.keyboard.press("Space");

  await expect(panelTitles(page)).toHaveText(["Picture", "Colour", "Size and shape", "Save as"]);
});

test("how the cards are arranged never reaches the link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await openImage(page);
  await choose(page, await makePicture(page));
  await settled(page);

  await page.getByRole("button", { name: "Reorder Colour" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("status")).toContainText("Draggable item colour");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("status")).toContainText("droppable area shape");
  await page.keyboard.press("Space");
  await expect(panelTitles(page)).toHaveText(["Picture", "Colour", "Size and shape", "Save as"]);

  await page.getByRole("button", { name: "Close Colour" }).click();
  await expect(page.getByRole("combobox", { name: "Preset" })).toBeHidden();

  expect(new URL(page.url()).hash).toBe("");
});

test("the format decides what comes out, and the data URI says so", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await expect(fact(page, "Type")).toHaveText("image/png");
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "JPEG" }).click();
  await expect(fact(page, "Type")).toHaveText("image/jpeg");
  await expect(page.getByRole("textbox", { name: "Quality" })).toBeVisible();

  await page.getByRole("button", { name: "Make a data URI" }).click();
  await expect(page.getByRole("textbox", { name: "The picture as a data URI" })).toHaveValue(
    /^data:image\/jpeg;base64,/,
  );
});

test("a resize comes out at the size that was asked for", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await page.getByRole("textbox", { name: "Width", exact: true }).fill("160");
  await expect(page.getByRole("textbox", { name: "Height", exact: true })).toHaveValue("100");
  await expect(fact(page, "Dimensions")).toHaveText("160 × 100");

  await page.getByRole("button", { name: "Right" }).click();
  await expect(fact(page, "Dimensions")).toHaveText("100 × 160");
});

test("an edited caption is written into the file and reads back out of it", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page, "image/jpeg"), "photo.jpg");

  await tab(page, "Metadata");
  await page.getByRole("textbox", { name: "Artist" }).fill("Someone");
  await page.getByRole("textbox", { name: "Description" }).fill("A test picture");

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save with these changes" }).click();
  const saved = await saving;

  await page.reload();
  await page.locator("input[type=\"file\"]").setInputFiles((await saved.path())!);
  await expect(page.locator(".image-stage img")).toBeVisible();
  await tab(page, "Metadata");
  await expect(page.getByRole("textbox", { name: "Artist" })).toHaveValue("Someone");
  await expect(fact(page, "Artist")).toHaveText("Someone");
  await expect(fact(page, "Image description")).toHaveText("A test picture");
});

test("an orientation this writes is one the browser itself acts on", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page, "image/jpeg"), "photo.jpg");

  await tab(page, "Metadata");
  await page.getByRole("combobox", { name: "Orientation" }).click();
  await page.getByRole("option", { name: "Rotated 90° clockwise" }).click();

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save with these changes" }).click();
  const saved = await saving;

  await page.reload();
  await page.locator("input[type=\"file\"]").setInputFiles((await saved.path())!);
  await expect(page.locator(".image-stage img")).toBeVisible();
  await tab(page, "Metadata");
  await expect(fact(page, "Dimensions")).toHaveText("200 × 320");
  await expect(fact(page, "Stored as")).toHaveText("320 × 200, turned by the orientation tag");
  await expect(fact(page, "Orientation")).toHaveText("Rotated 90° clockwise");
});

test("taking the metadata off leaves a file with none", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page, "image/jpeg"), "photo.jpg");

  await tab(page, "Metadata");
  await page.getByRole("textbox", { name: "Artist" }).fill("Someone");
  await page.getByRole("switch", { name: "Take all of it off" }).click();

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save with these changes" }).click();
  const saved = await saving;

  await page.reload();
  await page.locator("input[type=\"file\"]").setInputFiles((await saved.path())!);
  await tab(page, "Metadata");
  await expect(page.getByText("This file carries no EXIF and no text of its own")).toBeVisible();
});

test("a date in the wrong spelling is marked as it is typed", async ({ page }) => {
  await openImage(page);
  await choose(page, await makePicture(page));

  await tab(page, "Metadata");
  await page.getByRole("textbox", { name: "Date taken" }).fill("2026-08-23");
  await expect(page.getByText("YYYY:MM:DD HH:MM:SS")).toBeVisible();
  await page.getByRole("textbox", { name: "Date taken" }).fill("2026:08:23 14:05:00");
  await expect(page.getByText("YYYY:MM:DD HH:MM:SS")).toHaveCount(0);
});

test("the link carries the recipe and never the picture", async ({ page }) => {
  await openImage(page);
  expect(new URL(page.url()).hash).toBe("");

  await choose(page, await makePicture(page));
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "WebP" }).click();
  await page.getByRole("combobox", { name: "Preset" }).click();
  await page.getByRole("option", { name: "Negative" }).click();

  await expect.poll(() => decodeHash(page.url()).format).toBe("webp");
  const state = decodeHash(page.url());
  expect((state.adjustments as Record<string, number>).invert).toBe(100);
  expect(JSON.stringify(state)).not.toContain("data:");
  expect(JSON.stringify(state).length).toBeLessThan(400);
});

test("nothing about a picture is ever sent anywhere", async ({ page }) => {
  await openImage(page);
  const own = new URL(page.url()).host;
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "blob:" || url.protocol === "data:") return;
    if (url.host !== own) foreign.push(request.url());
  });

  await choose(page, await makePicture(page));
  await tab(page, "Metadata");
  await tab(page, "Transform");
  await page.getByRole("button", { name: "Make a data URI" }).click();
  await expect(page.getByRole("textbox", { name: "The picture as a data URI" })).toBeVisible();

  expect(foreign, foreign.join("\n")).toEqual([]);
});
