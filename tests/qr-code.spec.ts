import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const encoded = (page: Page) => page.getByRole("textbox", { name: "Encoded text" });
const textBox = (page: Page) => page.getByRole("textbox", { name: "Text", exact: true });
const image = (page: Page) => page.getByRole("img", { name: "QR code for the encoded text" });

async function openQrCode(page: Page) {
  await page.goto(`${BASE}/qr-code`);
  await expect(page.getByRole("heading", { name: "Generate QR Code" })).toBeVisible();
}

async function chooseKind(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Content type" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("the code and the text it carries are drawn as the value is typed", async ({ page }) => {
  await openQrCode(page);

  await expect(page.getByText("Type something and its code appears here.")).toBeVisible();
  await expect(image(page)).toHaveCount(0);

  await textBox(page).pressSequentially("hello");
  await expect(encoded(page)).toHaveValue("hello");
  await expect(image(page)).toBeVisible();
  await expect(page.locator(".qr-code")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const first = await image(page).innerHTML();
  await textBox(page).pressSequentially(" again");
  await expect(encoded(page)).toHaveValue("hello again");
  expect(await image(page).innerHTML()).not.toBe(first);
});

test("each kind writes the line its own format is read from", async ({ page }) => {
  await openQrCode(page);

  await chooseKind(page, "URL");
  await page.getByLabel("Web address").fill("example.com/page");
  await expect(encoded(page)).toHaveValue("https://example.com/page");

  await chooseKind(page, "WiFi");
  await page.getByLabel("Network name").fill("Guest");
  await expect(encoded(page)).toHaveValue("WIFI:T:WPA;S:Guest;;");
  await page.getByLabel("Password").fill("hunter2!!");
  await page.getByLabel("Hidden network").check();
  await expect(encoded(page)).toHaveValue("WIFI:T:WPA;S:Guest;P:hunter2!!;H:true;;");

  await chooseKind(page, "Email");
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Subject").fill("Hi there");
  await expect(encoded(page)).toHaveValue("mailto:ada@example.com?subject=Hi%20there");

  await chooseKind(page, "Phone Call");
  await page.getByLabel("Phone number").fill("+44 (0)20 7946 0958");
  await expect(encoded(page)).toHaveValue("tel:+4402079460958");

  await chooseKind(page, "SMS");
  await expect(page.getByLabel("Phone number")).toHaveValue("+44 (0)20 7946 0958");
  await page.getByLabel("Message").fill("on my way");
  await expect(encoded(page)).toHaveValue("SMSTO:+4402079460958:on my way");

  await chooseKind(page, "vCard");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await expect(encoded(page)).toHaveValue(/^BEGIN:VCARD\nVERSION:3.0\nN:Lovelace;Ada;;;\nFN:Ada Lovelace/);
  await expect(image(page)).toBeVisible();
});

test("a field judged wrong as it is typed takes the code away and says which one", async ({ page }) => {
  await openQrCode(page);
  await chooseKind(page, "Email");

  await expect(page.getByText("Enter an address and its code appears here.")).toBeVisible();
  await expect(page.getByText("Enter a valid address")).toHaveCount(0);

  await page.getByLabel("Email address").fill("nobody");
  await expect(page.getByText("Enter a valid address")).toBeVisible();
  await expect(image(page)).toHaveCount(0);
  await expect(page.getByText("The code comes back once what is marked above is put right.")).toBeVisible();

  await page.getByLabel("Email address").fill("nobody@example.com");
  await expect(page.getByText("Enter a valid address")).toHaveCount(0);
  await expect(image(page)).toBeVisible();
});

test("the version and the size are printed beside a code nobody can read", async ({ page }) => {
  await openQrCode(page);
  await textBox(page).fill("utils.plus qr code!!");
  await expect(page.getByText("Version 2 · 25×25 modules · 20 bytes")).toBeVisible();

  await page.getByRole("combobox", { name: "Error correction" }).click();
  await page.getByRole("option", { name: "High (30%)" }).click();
  await expect(page.getByText("Version 3 · 29×29 modules · 20 bytes")).toBeVisible();
});

test("text no code has room for says so, and says a lower level would hold it", async ({ page }) => {
  await openQrCode(page);
  await textBox(page).fill("x".repeat(2500));

  await expect(image(page)).toHaveCount(0);
  await expect(page.getByText("though a lower one would hold it")).toBeVisible();
  await expect(encoded(page)).toHaveValue("x".repeat(2500));

  await textBox(page).fill("x".repeat(3000));
  await expect(page.getByText("This is longer than any QR code has room for")).toBeVisible();
});

test("the code is saved as a file of its own, in either format", async ({ page }) => {
  await openQrCode(page);
  await textBox(page).fill("hello");

  const svg = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG" }).click();
  const saved = await svg;
  expect(saved.suggestedFilename()).toBe("qr-code.svg");

  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG" }).click();
  expect((await png).suggestedFilename()).toBe("qr-code.png");
});

test("the link carries the kind and the fields that kind puts on screen", async ({ page }) => {
  await openQrCode(page);
  await chooseKind(page, "WiFi");
  await page.getByLabel("Network name").fill("Guest");
  await page.getByLabel("Password").fill("correcthorse");
  await expect(page).toHaveURL(/#./);

  const shared = page.url();
  await page.goto(`${BASE}/`);
  await page.goto(shared);
  await expect(page.getByLabel("Network name")).toHaveValue("Guest");
  await expect(page.getByLabel("Password")).toHaveValue("correcthorse");
  await expect(encoded(page)).toHaveValue("WIFI:T:WPA;S:Guest;P:correcthorse;;");
});

test("nothing on the page asks for another host", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) foreign.push(request.url());
  });

  await openQrCode(page);
  await textBox(page).fill("https://utils.plus");
  await expect(image(page)).toBeVisible();
  expect(foreign).toEqual([]);
});
