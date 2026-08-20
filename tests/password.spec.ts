import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const VOCABULARY = /vocabulary/;

const mode = (page: Page, label: string) =>
  page.getByRole("radiogroup", { name: "What to generate" }).getByText(label, { exact: true });

const result = (page: Page, noun: string) => page.getByRole("textbox", { name: `Generated ${noun}` });

test("the word lists are not fetched until a passphrase is asked for", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (request) => {
    if (VOCABULARY.test(request.url())) fetched.push(request.url());
  });

  await page.goto(`${BASE}/password`);
  await expect(page.getByRole("heading", { name: "Generate Password" })).toBeVisible();
  await expect(result(page, "password")).not.toHaveValue("");

  expect(fetched).toEqual([]);

  await mode(page, "Passphrase").click();
  await expect(page.getByRole("heading", { name: "Generate Passphrase" })).toBeVisible();
  await expect(result(page, "passphrase")).toHaveValue(/^[a-z]+( [a-z]+){7}$/);
  expect(fetched.length).toBeGreaterThan(0);
});

test("the page says the word lists are coming rather than showing nothing", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(VOCABULARY, async (route) => {
    await held;
    await route.continue();
  });

  await page.goto(`${BASE}/password`);
  await mode(page, "Passphrase").click();

  await expect(page.getByLabel("Words")).toHaveValue("8");
  await expect(page.getByText("Fetching the word lists…")).toBeVisible();
  await expect(result(page, "passphrase")).toHaveCount(0);
  await expect(result(page, "password")).toHaveCount(0);

  release();
  await expect(result(page, "passphrase")).not.toHaveValue("");
  await expect(page.getByText("Fetching the word lists…")).toHaveCount(0);
});

test("the link carries the mode and neither of the two secrets", async ({ page }) => {
  await page.goto(`${BASE}/password`);

  await mode(page, "Passphrase").click();
  await expect(result(page, "passphrase")).not.toHaveValue("");

  await expect.poll(() => Object.keys(hashState(page)).sort()).toEqual([
    "adjectives",
    "casing",
    "mode",
    "nouns",
    "separator",
    "verbs",
    "words",
  ]);

  await mode(page, "Password").click();
  await expect(result(page, "password")).not.toHaveValue("");

  await expect.poll(() => Object.keys(hashState(page)).sort()).toEqual([
    "length",
    "lowercase",
    "mode",
    "numbers",
    "symbols",
    "uppercase",
  ]);
});

test("a shared link opens on the mode it was copied from", async ({ page }) => {
  await page.goto(`${BASE}/password`);

  await mode(page, "Passphrase").click();
  await page.getByRole("combobox", { name: "Separator" }).click();
  await page.getByRole("option", { name: "Dash", exact: true }).click();
  await expect.poll(() => hashState(page).separator).toBe("dash");

  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.getByRole("heading", { name: "Generate Passphrase" })).toBeVisible();
  await expect(result(other, "passphrase")).toHaveValue(/^[a-z]+(-[a-z]+){7}$/);
});

test("nothing on the page reaches another host", async ({ page }) => {
  const offsite: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") offsite.push(url.href);
    return route.continue();
  });

  await page.goto(`${BASE}/password`);
  await mode(page, "Passphrase").click();
  await expect(result(page, "passphrase")).not.toHaveValue("");

  expect(offsite).toEqual([]);
});

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
