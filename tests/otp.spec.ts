import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const mode = (page: Page, label: string) =>
  page.getByRole("radiogroup", { name: "Which one-time password" }).getByText(label, { exact: true });

const code = (page: Page) => page.locator(".otp-code");

const uriBox = (page: Page) => page.getByRole("textbox", { name: "URI" });

const SEED = "12345678901234567890";

async function typeSecret(page: Page, secret: string, format = "Text") {
  await page.getByRole("combobox", { name: "Secret Format" }).click();
  await page.getByRole("option", { name: format }).click();
  await page.getByRole("textbox", { name: "Secret" }).fill(secret);
}

test("a counter and a moment each produce the code their RFC publishes", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await expect(page.getByRole("heading", { name: "Time-Based OTP" })).toBeVisible();

  await typeSecret(page, SEED);
  await page.getByLabel("Digits").fill("8");
  await page.getByLabel("Time", { exact: true }).fill("59");
  await expect(code(page)).toHaveText("94287082");
  await expect(page.getByText("HMAC-SHA-1, 8 digits")).toBeVisible();
  await expect(page.getByText("1 · 0x1")).toBeVisible();

  await mode(page, "HOTP").click();
  await expect(page.getByRole("heading", { name: "Counter-Based OTP" })).toBeVisible();
  await page.getByLabel("Digits").fill("6");
  await page.getByRole("textbox", { name: "Counter" }).fill("3");
  await expect(code(page)).toHaveText("969429");

  await mode(page, "OCRA").click();
  await expect(page.getByLabel("Suite")).toHaveValue("OCRA-1:HOTP-SHA1-6:QN08");
  await page.getByLabel("Question").fill("00000000");
  await expect(code(page)).toHaveText("237653");
});

test("the fields a suite asks for are the ones on screen", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await mode(page, "OCRA").click();

  await expect(uriBox(page)).toHaveCount(0);
  await expect(page.getByLabel("Issuer")).toHaveCount(0);
  await expect(page.getByLabel("Label")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show the QR code" })).toHaveCount(0);

  await expect(page.getByLabel("PIN or password")).toHaveCount(0);
  await expect(page.getByLabel("Session information")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Algorithm" })).toHaveCount(0);

  await page.getByLabel("Suite").fill("OCRA-1:HOTP-SHA256-8:C-QN08-PSHA1");
  await expect(page.getByRole("textbox", { name: "Counter" })).toBeVisible();
  await expect(page.getByLabel("PIN or password")).toBeVisible();

  await typeSecret(page, `${SEED}123456789012`);
  await page.getByLabel("Question").fill("12345678");
  await page.getByLabel("PIN or password").fill("1234");
  await expect(code(page)).toHaveText("65347737");

  await page.getByLabel("Suite").fill("OCRA-1:HOTP-SHA256-8");
  await expect(page.getByText("A suite is three parts")).toBeVisible();
  await expect(page.getByLabel("Question")).toHaveCount(0);
  await expect(code(page)).toHaveCount(0);
});

test("a blank secret says so once a code is asked for, and never before", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await expect(page.getByText("Required")).toHaveCount(0);

  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByText("Required")).toBeVisible();

  await page.getByRole("button", { name: "Generate a secret" }).click();
  await expect(page.getByRole("textbox", { name: "Secret" })).toHaveValue(/^[A-Z2-7]{32}$/);
  await expect(page.getByText("Required")).toHaveCount(0);
  await expect(code(page)).toHaveText(/^\d{6}$/);

  await page.getByRole("textbox", { name: "Secret" }).fill("JBSWY3DP1");
  await expect(page.getByText("\"1\" is not a Base32 character")).toBeVisible();
  await expect(code(page)).toHaveCount(0);
});

test("Next steps the counter on to the code after this one", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await mode(page, "HOTP").click();
  await typeSecret(page, SEED);

  const counter = page.getByRole("textbox", { name: "Counter" });
  await expect(counter).toHaveValue("0");
  await expect(code(page)).toHaveText("755224");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(counter).toHaveValue("1");
  await expect(code(page)).toHaveText("287082");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(code(page)).toHaveText("359152");

  await mode(page, "TOTP").click();
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
});

test("the bar runs down at the clock's own speed rather than stepping or lurching", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);
  await page.getByLabel("Period").fill("5");

  const track = (await page.locator(".otp-countdown").boundingBox())?.width ?? 0;
  await expect(page.getByText(/Good for another [45] seconds/)).toBeVisible();

  const widths: number[] = [];
  for (let reading = 0; reading < 6; reading++) {
    const seen = await page.evaluate(() => ({
      width: document.querySelector(".otp-countdown-bar")?.getBoundingClientRect().width ?? 0,
      said: Number(/Good for another (\d+)/.exec(document.body.textContent ?? "")?.[1]),
    }));
    widths.push(seen.width);
    expect(Math.abs((seen.width / track) * PERIOD - seen.said)).toBeLessThan(1.2);
    await page.waitForTimeout(150);
  }

  const step = (track * 0.15) / PERIOD;
  for (const [index, width] of widths.slice(1).entries()) {
    expect(widths[index] - width).toBeGreaterThan(step * 0.5);
    expect(widths[index] - width).toBeLessThan(step * 3);
  }
});

const PERIOD = 5;

test("the code copies as the digits alone", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${BASE}/otp`);

  await typeSecret(page, SEED);
  await page.getByLabel("Time", { exact: true }).fill("59");
  await expect(code(page)).toHaveText("287082");

  await page.getByRole("button", { name: "Copy the code" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("287082");
});

test("the link carries the secret and only the fields the mode is showing", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);
  await page.getByLabel("Period").fill("60");
  await page.getByLabel("Issuer").fill("");

  await expect(async () => {
    const state = JSON.parse(atob(page.url().split("#")[1] ?? ""));
    expect(state).toMatchObject({ mode: "totp", secret: SEED, format: "text", period: 60, digits: 6 });
    expect(state).toMatchObject({ issuer: "", label: "local" });
    expect(state).not.toHaveProperty("suite");
    expect(state).not.toHaveProperty("counter");
  }).toPass();

  const shared = page.url();
  await page.goto("about:blank");
  await page.goto(shared);
  await expect(page.getByLabel("Period")).toHaveValue("60");
  await expect(page.getByLabel("Issuer")).toHaveValue("");
  await expect(page.getByLabel("Time", { exact: true })).toHaveValue("");
  await expect(code(page)).toHaveText(/^\d{6}$/);
});

test("the clock pins the second on screen and the calendar writes one in epoch seconds", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);
  const box = page.getByLabel("Time", { exact: true });
  const countdown = page.getByText(/Good for another/);

  await box.fill("1770726896");
  await page.getByRole("button", { name: "Pick a date and time" }).click();
  const picker = page.getByRole("dialog", { name: "Pick a date and time" });
  await expect(picker.getByRole("spinbutton").nth(2)).toHaveValue("56");

  const nextDay = await page.evaluate(() =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(1770813296000)
  );
  await picker.getByRole("button", { name: nextDay }).click();
  await expect(box).toHaveValue("1770813296");
  await picker.getByRole("button", { name: "Use this time" }).click();
  await expect(picker).toBeHidden();

  await expect(countdown).toHaveCount(0);
  await page.getByRole("button", { name: "Follow the clock" }).click();
  await expect(box).toHaveValue("");
  await expect(countdown).toBeVisible();

  await page.getByRole("button", { name: "Pin the current time" }).click();
  expect(Math.abs(Number(await box.inputValue()) - Date.now() / 1000)).toBeLessThan(5);
  await expect(countdown).toHaveCount(0);
});

const SEED_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("the URI and the boxes above it are one state written twice", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  const uri = uriBox(page);

  await expect(page.getByLabel("Issuer")).toHaveValue("utils.plus");
  await expect(page.getByLabel("Label")).toHaveValue("local");

  await typeSecret(page, SEED);
  await expect(uri).toHaveValue(
    `otpauth://totp/utils.plus:local?secret=${SEED_BASE32}&issuer=utils.plus&algorithm=SHA1&digits=6&period=30`,
  );

  await page.getByLabel("Issuer").fill("ACME Co");
  await page.getByLabel("Label").fill("john.doe@email.com");
  await expect(uri).toHaveValue(/^otpauth:\/\/totp\/ACME%20Co:john\.doe@email\.com\?.*issuer=ACME%20Co/);

  await uri.fill("otpauth://totp/Bank:me?secret=JBSWY3DPEHPK3PXP&issuer=Bank&algorithm=SHA256&digits=8&period=60");
  await expect(page.getByLabel("Issuer")).toHaveValue("Bank");
  await expect(page.getByLabel("Label")).toHaveValue("me");
  await expect(page.getByRole("textbox", { name: "Secret" })).toHaveValue("JBSWY3DPEHPK3PXP");
  await expect(page.getByRole("combobox", { name: "Secret Format" })).toHaveValue("Base32");
  await expect(page.getByRole("combobox", { name: "Algorithm" })).toHaveValue("SHA-256");
  await expect(page.getByLabel("Digits")).toHaveValue("8");
  await expect(page.getByLabel("Period")).toHaveValue("60");
});

test("editing the URI leaves a secret written another way as it was", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);
  const secret = page.getByRole("textbox", { name: "Secret" });
  const format = page.getByRole("combobox", { name: "Secret Format" });

  await uriBox(page).fill(`otpauth://totp/utils.plus:local?secret=${SEED_BASE32}&digits=8`);
  await expect(page.getByLabel("Digits")).toHaveValue("8");
  await expect(secret).toHaveValue(SEED);
  await expect(format).toHaveValue("Text");

  await uriBox(page).fill("otpauth://totp/utils.plus:local?secret=JBSWY3DPEHPK3PXP&digits=8");
  await expect(secret).toHaveValue("JBSWY3DPEHPK3PXP");
  await expect(format).toHaveValue("Base32");
});

test("a URI of the other kind is the mode it names", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await uriBox(page).fill(`otpauth://hotp/Bank:me?secret=${SEED_BASE32}&issuer=Bank&counter=41`);

  await expect(page.getByRole("heading", { name: "Counter-Based OTP" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Counter" })).toHaveValue("41");
  await expect(page.getByLabel("Period")).toHaveCount(0);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(uriBox(page)).toHaveValue(/counter=42/);
});

test("a parameter can be emptied and typed afresh", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);
  const uri = uriBox(page);
  const written = `otpauth://totp/utils.plus:local?secret=${SEED_BASE32}&issuer=utils.plus&algorithm=SHA1&digits=6`;

  await uri.fill(`${written}&period=`);
  await expect(uri).toHaveValue(/period=$/);
  await expect(page.getByLabel("Period")).toHaveValue("30");

  await uri.fill(`${written}&period=90`);
  await expect(page.getByLabel("Period")).toHaveValue("90");

  await uri.fill("utils.plus:local");
  await expect(page.getByText("A URI here opens otpauth://totp/ or otpauth://hotp/")).toBeVisible();
  await expect(page.getByLabel("Period")).toHaveValue("90");

  await page.getByLabel("Digits").fill("8");
  await expect(uri).toHaveValue(`${written.replace("digits=6", "digits=8")}&period=90`);
});

test("the URI copies as the one line it shows", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);

  await page.getByRole("button", { name: "Copy the URI" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `otpauth://totp/utils.plus:local?secret=${SEED_BASE32}&issuer=utils.plus&algorithm=SHA1&digits=6&period=30`,
  );
});

test("the QR code is the URI a camera can be shown", async ({ page }) => {
  await page.goto(`${BASE}/otp`);
  await typeSecret(page, SEED);
  await page.getByRole("button", { name: "Show the QR code" }).click();

  const dialog = page.getByRole("dialog", { name: "Scan to enrol" });
  await expect(dialog.getByRole("img", { name: "QR code for the URI" })).toBeVisible();
  await expect(dialog.locator(".qr-code")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(dialog.getByText(`otpauth://totp/utils.plus:local?secret=${SEED_BASE32}`, { exact: false }))
    .toBeVisible();

  await expect(dialog.getByText("There is no secret in this URI")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("textbox", { name: "Secret" }).fill("");
  await page.getByRole("button", { name: "Show the QR code" }).click();
  await expect(dialog.getByText("There is no secret in this URI")).toBeVisible();
});

test("nothing on the page asks for another host", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) foreign.push(request.url());
  });

  await page.goto(`${BASE}/otp`);
  await page.getByRole("button", { name: "Generate a secret" }).click();
  await page.getByRole("button", { name: "Show the QR code" }).click();
  await expect(page.getByRole("img", { name: "QR code for the URI" })).toBeVisible();
  await page.keyboard.press("Escape");

  await mode(page, "OCRA").click();
  await page.getByLabel("Question").fill("00000000");
  await expect(code(page)).toHaveText(/^\d{6}$/);
  expect(foreign).toEqual([]);
});
