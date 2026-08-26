import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const key = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const display = (page: Page) => page.getByLabel("Display", { exact: true });
const expression = (page: Page) => page.getByLabel("Expression");

const choose = (page: Page, label: string) => page.getByText(label, { exact: true }).click();

async function openCalculator(page: Page) {
  await page.goto(`${BASE}/calculator`);
  await expect(page.getByRole("heading", { name: "Calculator", exact: true })).toBeVisible();
}

async function tap(page: Page, ...names: string[]) {
  for (const name of names) await key(page, name).click();
}

test("opens on the programmer pad, in hexadecimal, sixty-four bits wide", async ({ page }) => {
  await openCalculator(page);

  await expect(display(page)).toHaveText("0");
  await expect(page.getByRole("radio", { name: "HEX" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "64-bit" })).toBeChecked();
  await expect(key(page, "Bit 63")).toBeVisible();
});

test("a number typed on the pad is shown in every base at once", async ({ page }) => {
  await openCalculator(page);
  await tap(page, "D", "E", "A", "D");

  await expect(display(page)).toHaveText("DEAD");
  await expect(page.getByText("DEC 57005")).toBeVisible();
  await expect(page.getByText("OCT 157255")).toBeVisible();
});

test("a digit the base has no room for is a key that says so", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");

  await expect(key(page, "A")).toBeDisabled();
  await expect(key(page, "9")).toBeEnabled();

  await choose(page, "OCT");
  await expect(key(page, "9")).toBeDisabled();
});

test("works a sum through the keypad, saying what is waiting and then what it answered", async ({ page }) => {
  await openCalculator(page);
  await tap(page, "F", "F", "Add");

  await expect(expression(page)).toHaveText("FF +");
  await expect(display(page)).toHaveText("FF");

  await tap(page, "1", "Equals");
  await expect(display(page)).toHaveText("100");
  await expect(expression(page)).toHaveText("FF + 1 =");
});

test("gathers the expression until equals, and says what a second equals did again", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");

  await tap(page, "1", "2", "Add", "3", "4", "Subtract", "5");
  await expect(expression(page)).toHaveText("12 + 34 −");
  await expect(display(page)).toHaveText("5");

  await tap(page, "Equals");
  await expect(display(page)).toHaveText("41");
  await expect(expression(page)).toHaveText("12 + 34 − 5 =");

  await tap(page, "Equals");
  await expect(display(page)).toHaveText("36");
  await expect(expression(page)).toHaveText("41 − 5 =");

  await tap(page, "7");
  await expect(expression(page)).toHaveText("");
});

test("a closing bracket joins the expression rather than working the group out", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");
  await tap(page, "2", "Multiply", "Open bracket", "3", "Add", "4", "Close bracket");

  await expect(expression(page)).toHaveText("2 × (3 + 4)");
  await expect(display(page)).toHaveText("4");

  await tap(page, "Add", "1");
  await expect(expression(page)).toHaveText("2 × (3 + 4) +");

  await tap(page, "Equals");
  await expect(display(page)).toHaveText("15");
  await expect(expression(page)).toHaveText("2 × (3 + 4) + 1 =");
});

test("masks and shifts the way the labels say", async ({ page }) => {
  await openCalculator(page);

  await tap(page, "C", "AND", "A", "Equals");
  await expect(display(page)).toHaveText("8");

  await tap(page, "Clear", "1", "Shift left by", "4", "Equals");
  await expect(display(page)).toHaveText("10");

  await tap(page, "Clear", "1", "Rotate right");
  await expect(display(page)).toHaveText("8000 0000 0000 0000");
});

test("the bits are the number itself, and a click flips one", async ({ page }) => {
  await openCalculator(page);

  await key(page, "Bit 3").click();
  await expect(display(page)).toHaveText("8");

  await key(page, "Bit 0").click();
  await expect(display(page)).toHaveText("9");
  await expect(key(page, "Bit 3")).toHaveText("1");
  await expect(key(page, "Bit 2")).toHaveText("0");

  await tap(page, "Clear", "F");
  await expect(key(page, "Bit 2")).toHaveText("1");
  await expect(key(page, "Bit 4")).toHaveText("0");
});

test("narrowing the word narrows what is on screen", async ({ page }) => {
  await openCalculator(page);
  await tap(page, "1", "2", "3", "4");

  await choose(page, "8-bit");
  await expect(display(page)).toHaveText("34");
  await expect(key(page, "Bit 7")).toBeVisible();
  await expect(key(page, "Bit 8")).toBeHidden();
});

test("the keyboard reaches the same keys the pad does", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");

  await page.keyboard.type("12+34");
  await expect(expression(page)).toHaveText("12 +");

  await page.keyboard.press("Enter");
  await expect(display(page)).toHaveText("46");

  await page.keyboard.type("789");
  await page.keyboard.press("Backspace");
  await expect(display(page)).toHaveText("78");

  await page.keyboard.press("Escape");
  await expect(display(page)).toHaveText("0");
});

test("a keystroke can only do what the key it presses says", async ({ page }) => {
  await openCalculator(page);

  await page.keyboard.type("dead");
  await expect(display(page)).toHaveText("DEAD");
  await expect(key(page, "D")).toHaveAttribute("aria-keyshortcuts", "d");

  await page.keyboard.press("Escape");
  await page.keyboard.type("7%2=");
  await expect(display(page)).toHaveText("1");

  await choose(page, "Scientific");
  await expect(key(page, "Modulo")).toBeHidden();
  await page.keyboard.type("200+10%");
  await expect(display(page)).toHaveText("20");

  await page.keyboard.press("Escape");
  await page.keyboard.type("30s");
  await expect(display(page)).toHaveText("0.5");

  await key(page, "Second function").click();
  await page.keyboard.type("1s");
  await expect(display(page)).toHaveText("90");
});

test("a digit the base has no room for is not a keystroke either", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");

  await page.keyboard.type("1a2");
  await expect(display(page)).toHaveText("12");
});

test("a key clicked with the mouse does not become what Enter means", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");
  await tap(page, "7", "Add", "2");

  await page.keyboard.press("Enter");
  await expect(display(page)).toHaveText("9");

  await tap(page, "Clear");
  await key(page, "Bit 3").click();
  await page.keyboard.press("Enter");
  await expect(display(page)).toHaveText("8");
});

test("each pad is one tab stop, and the arrow keys move about it", async ({ page }) => {
  await openCalculator(page);

  await key(page, "Backspace").focus();
  await page.keyboard.press("ArrowRight");
  await expect(key(page, "Open bracket")).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(key(page, "OR")).toBeFocused();

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await expect(key(page, "Backspace")).toBeFocused();

  await page.keyboard.press("End");
  await expect(key(page, "Flip 16-bit words")).toBeFocused();

  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(expression(page)).toHaveText("0 AND");
});

test("the arrow keys walk the bit grid, and a key there flips the bit", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "8-bit");

  await key(page, "Bit 7").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(key(page, "Bit 5")).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(display(page)).toHaveText("20");
  await expect(key(page, "Bit 5")).toHaveText("1");
});

test("a key the arrow keys cannot land on is one nothing can press", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");

  await key(page, "Clear").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(key(page, "Clear")).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(key(page, "Divide")).toBeFocused();
});

test("the scientific pad takes the number over and answers in the unit that is set", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");
  await tap(page, "3", "0");

  await choose(page, "Scientific");
  await expect(display(page)).toHaveText("30");

  await key(page, "Sine").click();
  await expect(display(page)).toHaveText("0.5");

  await expect(page.getByText("DEG", { exact: true })).toBeVisible();
  await key(page, "Switch to radians").click();
  await expect(page.getByText("RAD", { exact: true })).toBeVisible();
  await expect(key(page, "Switch to degrees")).toBeVisible();
});

test("the second function swaps which operation a key presses", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "Scientific");

  await expect(key(page, "Sine")).toBeVisible();
  await key(page, "Second function").click();

  await expect(key(page, "Arcsine")).toBeVisible();
  await expect(key(page, "Sine")).toBeHidden();
  await expect(page.getByText("2nd", { exact: true })).toBeVisible();

  await tap(page, "1", "Arcsine");
  await expect(display(page)).toHaveText("90");
});

test("says which key could not be done rather than answering anyway", async ({ page }) => {
  await openCalculator(page);
  await tap(page, "8", "Divide", "0", "Equals");

  await expect(display(page)).toHaveText("Error");
  await expect(page.getByText("Cannot divide by zero")).toBeVisible();

  await key(page, "Clear").click();
  await expect(display(page)).toHaveText("0");
  await expect(page.getByText("Cannot divide by zero")).toBeHidden();
});

test("a dialog over the page owns the keys pressed inside it", async ({ page }) => {
  await openCalculator(page);
  await tap(page, "4", "2");

  await page.getByRole("button", { name: "Reset state" }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeHidden();
  await expect(display(page)).toHaveText("42");
});

test("reads the word beside it as a float, and takes a number typed at it", async ({ page }) => {
  await openCalculator(page);

  const value = page.getByLabel("Value", { exact: true });
  await expect(value).toHaveValue("0");

  await value.fill("0.1");
  await expect(display(page)).toHaveText("3FB9 9999 9999 999A");
  await expect(page.locator("[data-fact=\"Exact\"]")).toContainText(
    "0.1000000000000000055511151231257827021181583404541015625",
  );
  await expect(page.locator("[data-fact=\"Hex float\"]")).toContainText("0x1.999999999999Ap-4");

  await key(page, "Bit 63").click();
  await expect(value).toHaveValue("-0.1");

  await page.getByRole("button", { name: "Next float up" }).click();
  await expect(display(page)).toHaveText("BFB9 9999 9999 9999");

  await value.fill("nonsense");
  await expect(page.getByText("Cannot read that as a number")).toBeVisible();
  await expect(display(page)).toHaveText("BFB9 9999 9999 9999");
});

test("follows the word size, and says nothing at the one size the standard names no format for", async ({ page }) => {
  await openCalculator(page);

  await expect(page.getByText("binary64 · double")).toBeVisible();
  await expect(key(page, "Bit 63")).toHaveAttribute("data-bit-field", "sign");
  await expect(key(page, "Bit 62")).toHaveAttribute("data-bit-field", "exponent");
  await expect(key(page, "Bit 51")).toHaveAttribute("data-bit-field", "significand");

  await choose(page, "32-bit");
  await expect(page.getByText("binary32 · single")).toBeVisible();
  await expect(key(page, "Bit 30")).toHaveAttribute("data-bit-field", "exponent");
  await expect(key(page, "Bit 22")).toHaveAttribute("data-bit-field", "significand");

  await choose(page, "8-bit");
  await expect(page.getByLabel("Value", { exact: true })).toBeHidden();
  await expect(key(page, "Bit 7")).not.toHaveAttribute("data-bit-field");
});

test("keeps a record of what equals answered, and lets one entry or all of them go", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");

  const history = page.getByRole("toolbar", { name: "History" });
  await expect(history).toBeHidden();

  await tap(page, "1", "2", "Add", "3", "4", "Equals");
  await tap(page, "5", "Multiply", "6", "Equals");
  await expect(history.getByText("5 × 6 =")).toBeVisible();
  await expect(history.getByText("12 + 34 =")).toBeVisible();

  await key(page, "Remove 5 × 6 = 30").click();
  await expect(history.getByText("5 × 6 =")).toBeHidden();
  await expect(display(page)).toHaveText("30");

  await tap(page, "7", "Add", "8", "Equals");
  await expect(history.getByText("7 + 8 =")).toBeVisible();

  await key(page, "Remove 7 + 8 = 15").focus();
  await page.keyboard.press("Delete");
  await expect(history.getByText("7 + 8 =")).toBeHidden();
  await expect(display(page)).toHaveText("15");

  await expect(key(page, "Remove 12 + 34 = 46")).toBeFocused();

  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(history).toBeHidden();
});

test("the address bar carries the number, the pending work and the settings", async ({ page }) => {
  await openCalculator(page);
  await choose(page, "DEC");
  await tap(page, "2", "Multiply", "Open bracket", "3", "Add", "4");

  await expect.poll(() => hashState(page).entry).toBe("4");
  expect(hashState(page)).toMatchObject({ mode: "programmer", base: 10, bits: 64 });

  const shared = await page.context().newPage();
  await shared.goto(page.url());
  await expect(expression(shared)).toHaveText("2 × (3 +");
  await expect(display(shared)).toHaveText("4");

  await key(shared, "Equals").click();
  await expect(display(shared)).toHaveText("14");
});

function hashState(page: Page): Record<string, string | number> {
  let b64 = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}
