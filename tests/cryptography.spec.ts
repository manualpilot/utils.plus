import { expect, Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = process.env.PW_BASE_URL ?? "";

const SLOW = 60000;

const MESSAGE = "Meet me at the usual place";

const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

const tab = (page: Page, group: string, label: string) =>
  page.getByRole("radiogroup", { name: group }).getByText(label, { exact: true });

async function openCryptography(page: Page) {
  await page.goto(`${BASE}/cryptography`);
  await expect(page.getByRole("heading", { name: "Cryptography" })).toBeVisible();
}

async function choose(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function generate(page: Page, ...names: string[]) {
  for (const name of names) await page.getByRole("button", { name, exact: true }).click();
}

async function keyed(page: Page, nonce = "IV") {
  await generate(page, "Generate a random key", `Generate a random ${nonce}`);
}

test("nothing is generated until it is asked for, and the page says what it is waiting for", async ({ page }) => {
  await openCryptography(page);
  await expect(box(page, "Key")).toHaveValue("");
  await expect(box(page, "IV")).toHaveValue("");

  await box(page, "Message").fill(MESSAGE);
  await expect(box(page, "Ciphertext")).toHaveAttribute("placeholder", "Waiting for the key and the IV");

  await generate(page, "Generate a random key");
  await expect(box(page, "Ciphertext")).toHaveAttribute("placeholder", "Waiting for the IV");

  await generate(page, "Generate a random IV");
  await expect(box(page, "Ciphertext")).not.toHaveValue("");
});

test("a message goes out sealed and the other direction gives it back", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  await box(page, "Message").fill(MESSAGE);

  const sealed = box(page, "Ciphertext");
  await expect(sealed).not.toHaveValue("");
  const armoured = await sealed.inputValue();

  await tab(page, "Direction", "Decrypt").click();
  await expect(box(page, "Ciphertext")).toHaveValue(armoured);
  await expect(box(page, "Message")).toHaveValue(MESSAGE);
});

const ALGORITHMS = [
  "AES-GCM",
  "AES-CTR",
  "AES-CBC",
  "ChaCha20-Poly1305",
  "XChaCha20-Poly1305",
  "NaCl secretbox",
  "NaCl box",
];

for (const algorithm of ALGORITHMS) {
  test(`${algorithm} carries a message there and back`, async ({ page }) => {
    await openCryptography(page);
    await choose(page, "Algorithm", algorithm);
    if (algorithm === "NaCl box") {
      await generate(
        page,
        "Generate a secret key",
        "Generate a keypair to try this against",
        "Generate a random nonce",
      );
    } else {
      await keyed(page, algorithm === "AES-CTR" ? "counter block" : algorithm.startsWith("AES") ? "IV" : "nonce");
    }
    await box(page, "Message").fill(MESSAGE);
    await expect(box(page, "Ciphertext")).not.toHaveValue("");

    await tab(page, "Direction", "Decrypt").click();
    await expect(box(page, "Message")).toHaveValue(MESSAGE);
  });
}

test("a generated key and nonce are the lengths the cipher takes", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  await expect(box(page, "Key")).toHaveValue(/^[0-9a-f]{64}$/);
  await expect(box(page, "IV")).toHaveValue(/^[0-9a-f]{24}$/);

  await choose(page, "Key size", "128 bits");
  await generate(page, "Generate a random key");
  await expect(box(page, "Key")).toHaveValue(/^[0-9a-f]{32}$/);

  await choose(page, "Algorithm", "XChaCha20-Poly1305");
  await generate(page, "Generate a random key", "Generate a random nonce");
  await expect(box(page, "Key")).toHaveValue(/^[0-9a-f]{64}$/);
  await expect(box(page, "Nonce")).toHaveValue(/^[0-9a-f]{48}$/);
});

test("a key that no longer fits the cipher says so and is left where it is", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  const written = await box(page, "Key").inputValue();

  await choose(page, "Key size", "128 bits");
  await expect(page.getByText("Needs 16 bytes, and this is 32")).toBeVisible();
  await expect(box(page, "Key")).toHaveValue(written);

  await choose(page, "Algorithm", "ChaCha20-Poly1305");
  await choose(page, "Algorithm", "AES-GCM");
  await expect(page.getByRole("combobox", { name: "Key size" })).toHaveValue("128 bits");
});

test("an encoding is how a key is written down and never which key it is", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  const written = await box(page, "Key").inputValue();

  await choose(page, "Key encoding", "Base64");
  await expect(box(page, "Key")).toHaveValue(/^[A-Za-z0-9+/]{43}=$/);

  await choose(page, "Key encoding", "Hex");
  await expect(box(page, "Key")).toHaveValue(written);
});

test("a key of the wrong length is wrong the moment it is typed", async ({ page }) => {
  await openCryptography(page);
  await box(page, "Key").fill("deadbeef");
  await expect(page.getByText("Needs 32 bytes, and this is 4")).toBeVisible();
});

test("a ciphertext that was sealed under another key says so rather than showing nothing", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  await box(page, "Message").fill(MESSAGE);
  await expect(box(page, "Ciphertext")).not.toHaveValue("");

  await tab(page, "Direction", "Decrypt").click();
  await expect(box(page, "Message")).toHaveValue(MESSAGE);

  await box(page, "Key").fill("00".repeat(32));
  await expect(page.getByText(/did not decrypt/)).toBeVisible();
  await expect(box(page, "Message")).toHaveValue("");
});

test("the nonce it was sealed with is read off the front of the ciphertext", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  const iv = await box(page, "IV").inputValue();
  await box(page, "Message").fill(MESSAGE);
  await expect(box(page, "Ciphertext")).not.toHaveValue("");

  await tab(page, "Direction", "Decrypt").click();
  await expect(page.getByText(`It is ${iv}.`)).toBeVisible();
});

test("a file is encrypted to a file and comes back byte for byte", async ({ page }) => {
  await openCryptography(page);
  await keyed(page);
  await tab(page, "Input source", "File").click();
  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("nothing is uploaded"),
  });

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const sealed = await saving;
  expect(sealed.suggestedFilename()).toBe("notes.txt.enc");

  await tab(page, "Direction", "Decrypt").click();
  await page.locator("input[type=\"file\"]").setInputFiles({
    name: sealed.suggestedFilename(),
    mimeType: "application/octet-stream",
    buffer: readFileSync((await sealed.path())!),
  });

  const opening = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const opened = await opening;
  expect(opened.suggestedFilename()).toBe("notes.txt");
  expect(readFileSync((await opened.path())!).toString()).toBe("nothing is uploaded");
});

test("OpenPGP seals to a password and reads the same message back", async ({ page }) => {
  await openCryptography(page);
  await choose(page, "Algorithm", "OpenPGP");
  await choose(page, "Encrypted to", "A password");
  await box(page, "Password").fill("correct horse");
  await box(page, "Message").fill(MESSAGE);

  await expect(box(page, "Ciphertext")).toHaveValue(/^-----BEGIN PGP MESSAGE-----/, { timeout: SLOW });

  await tab(page, "Direction", "Decrypt").click();
  await expect(box(page, "Message")).toHaveValue(MESSAGE, { timeout: SLOW });
});

test("a key made on /keygen opens what it was encrypted to, with third-party requests blocked", {
  tag: "@slow",
}, async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await page.goto(`${BASE}/keygen`);
  await choose(page, "Key kind", "PGP key");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Public key")).toHaveValue(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/, { timeout: SLOW });
  const publicKey = await box(page, "Public key").inputValue();
  const privateKey = await box(page, "Private key").inputValue();

  await openCryptography(page);
  await choose(page, "Algorithm", "OpenPGP");
  await box(page, "Recipient public key").fill(publicKey);
  await box(page, "Message").fill(MESSAGE);
  await expect(box(page, "Ciphertext")).toHaveValue(/^-----BEGIN PGP MESSAGE-----/, { timeout: SLOW });

  await tab(page, "Direction", "Decrypt").click();
  await box(page, "Private key").fill(privateKey);
  await expect(box(page, "Message")).toHaveValue(MESSAGE, { timeout: SLOW });

  expect(blocked).toEqual([]);
});
