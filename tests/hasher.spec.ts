import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const KDF_TIMEOUT = 20000;

const digestBox = (page: Page) => page.getByRole("textbox", { name: "Digest" });

async function openHasher(page: Page) {
  await page.goto(`${BASE}/hasher`);
  await expect(page.getByRole("heading", { name: "Hasher" })).toBeVisible();
}

async function selectAlgorithm(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Algorithm" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("the digest follows the input as it is typed", async ({ page }) => {
  await openHasher(page);

  await page.getByPlaceholder("Text to hash").fill("abc");
  await expect(digestBox(page)).toHaveValue(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  await page.getByPlaceholder("Text to hash").fill("abcd");
  await expect(digestBox(page)).not.toHaveValue(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("the output format respells the same digest", async ({ page }) => {
  await openHasher(page);
  await page.getByPlaceholder("Text to hash").fill("abc");

  await page.getByRole("combobox", { name: "Output format" }).click();
  await page.getByRole("option", { name: "Base64", exact: true }).click();
  await expect(digestBox(page)).toHaveValue("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");

  await page.getByRole("combobox", { name: "Output format" }).click();
  await page.getByRole("option", { name: "Hexadecimal (uppercase)" }).click();
  await expect(digestBox(page)).toHaveValue(
    "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
  );
});

test("only the seeded algorithms offer a seed, and it moves the hash", async ({ page }) => {
  await openHasher(page);
  await expect(page.getByLabel("Seed", { exact: true })).toBeHidden();

  await selectAlgorithm(page, "xxHash");
  await page.getByPlaceholder("Text to hash").fill("abc");
  await expect(digestBox(page)).toHaveValue("44bc2cf5ad770999");

  await page.getByLabel("Seed", { exact: true }).fill("42");
  await expect(digestBox(page)).not.toHaveValue("44bc2cf5ad770999");
});

test("a password hash waits for the button and goes stale when the input moves", async ({ page }) => {
  await openHasher(page);
  await selectAlgorithm(page, "Argon2");

  await expect(page.getByRole("combobox", { name: "Output format" })).toBeHidden();

  await expect(digestBox(page)).toHaveValue("");
  await page.getByPlaceholder("Password to hash").fill("hunter2");
  await page.getByRole("textbox", { name: "Salt", exact: true }).fill("somesalt");

  await page.getByRole("button", { name: "Compute" }).click();
  await expect(digestBox(page)).toHaveValue(
    /^\$argon2id\$v=19\$m=19456,t=2,p=1\$c29tZXNhbHQ\$/,
    { timeout: KDF_TIMEOUT },
  );
  await expect(page.getByRole("button", { name: "Compute" })).toBeDisabled();

  await page.getByPlaceholder("Password to hash").fill("hunter3");
  await expect(digestBox(page)).toHaveValue("");
  await expect(page.getByRole("button", { name: "Compute" })).toBeEnabled();
});

test("bcrypt holds its salt to its own alphabet before it will run", async ({ page }) => {
  await openHasher(page);
  await selectAlgorithm(page, "bcrypt");

  await page.getByRole("textbox", { name: "Salt", exact: true }).fill("nope");
  await expect(page.getByText(/bcrypt's base64/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Compute" })).toBeDisabled();

  await page.getByRole("textbox", { name: "Salt", exact: true }).fill("DCq7YPn5Rq63x1Lad4cll.");
  await page.getByLabel("Cost", { exact: true }).fill("6");
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(digestBox(page)).toHaveValue(
    "$2b$06$DCq7YPn5Rq63x1Lad4cll.TV4S6ytwfsfvkgY8jIucDrjc8deX1s.",
    { timeout: KDF_TIMEOUT },
  );
});

test("PBKDF2 names its hash in the string it writes and counts its own iterations", async ({ page }) => {
  await openHasher(page);
  await selectAlgorithm(page, "PBKDF2");

  await page.getByPlaceholder("Password to hash").fill("hunter2");
  await page.getByRole("textbox", { name: "Salt", exact: true }).fill("somesalt");
  await page.getByLabel("Iterations", { exact: true }).fill("1000");

  await page.getByRole("button", { name: "Compute" }).click();
  await expect(digestBox(page)).toHaveValue(
    "$pbkdf2-sha256$i=1000$c29tZXNhbHQ$unR7NQbeRInFLZrE4DCAQXAoAxjwlebIFHBOPWyprZo",
    { timeout: KDF_TIMEOUT },
  );

  await page.getByRole("combobox", { name: "Variant" }).click();
  await page.getByRole("option", { name: "PBKDF2-HMAC-SHA512" }).click();
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(digestBox(page)).toHaveValue(/^\$pbkdf2-sha512\$i=1000\$c29tZXNhbHQ\$/, { timeout: KDF_TIMEOUT });
});

test("the share link carries the algorithm settings, not just the input", async ({ page }) => {
  await openHasher(page);
  await selectAlgorithm(page, "MurmurHash");
  await page.getByPlaceholder("Text to hash").fill("shared");
  await page.getByLabel("Seed", { exact: true }).fill("1234");

  const digest = await digestBox(page).inputValue();
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");

  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.getByRole("combobox", { name: "Algorithm" })).toHaveValue("MurmurHash");
  await expect(other.getByLabel("Seed", { exact: true })).toHaveValue("1234");
  await expect(other.getByRole("textbox", { name: "Digest" })).toHaveValue(digest);
});

test("nothing on the page reaches for another host", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const { hostname } = new URL(request.url());
    if (hostname !== "localhost" && hostname !== "127.0.0.1") foreign.push(request.url());
  });

  await openHasher(page);
  await page.getByPlaceholder("Text to hash").fill("abc");
  await expect(digestBox(page)).toHaveValue(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  await selectAlgorithm(page, "scrypt");
  await page.getByPlaceholder("Password to hash").fill("hunter2");
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(digestBox(page)).toHaveValue(/^\$scrypt\$ln=15,r=8,p=1\$/, { timeout: KDF_TIMEOUT });

  expect(foreign).toEqual([]);
});
