import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const SECRET = "your-256-bit-secret";

const tokenBox = (page: Page) => page.getByRole("textbox", { name: "Token" });
const keyBox = (page: Page) => page.getByRole("textbox", { name: "Key", exact: true });
const algorithm = (page: Page) => page.getByRole("combobox", { name: "Algorithm" });
const protection = (page: Page) => page.getByRole("combobox", { name: "Protection" });
const encryption = (page: Page) => page.getByRole("combobox", { name: "Encryption" });
const verdict = (page: Page) => page.locator(".mantine-Badge-root");
const row = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name }).first();
const claimName = (page: Page, index: number) => page.getByRole("combobox", { name: `Claim ${index} name` });
const claimValue = (page: Page, index: number) => page.getByRole("textbox", { name: `Claim ${index} value` });

async function openJwt(page: Page) {
  await page.goto(`${BASE}/jwt`);
  await expect(page.getByRole("heading", { name: "JWT", exact: true })).toBeVisible();
}

async function switchTo(page: Page, mode: string) {
  await page.getByText(mode, { exact: true }).click();
}

async function choose(box: ReturnType<typeof algorithm>, option: string) {
  await box.click();
  await box.page().getByRole("option", { name: option, exact: true }).click();
}

test("a page nobody handed a token opens on one it made itself", async ({ page }) => {
  await openJwt(page);

  await expect(tokenBox(page)).toHaveValue(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  await expect(keyBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);
  await expect(row(page, "iss")).toContainText("Issuer");
  await expect(row(page, "iss")).toContainText("\"utils.plus\"");
  await expect(verdict(page)).toHaveText("Signature valid");

  await page.waitForTimeout(SETTLE_MS);
  expect(new URL(page.url()).hash).toBe("");
});

test("the first keystroke makes the page somebody's, token and key together", async ({ page }) => {
  await openJwt(page);
  await expect(keyBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);
  const key = await keyBox(page).inputValue();

  await tokenBox(page).fill(TOKEN);
  await expect.poll(() => hashState(page).token).toBe(TOKEN);
  expect(hashState(page).secret).toBe(key);
});

test("a token comes apart into its header and its claims", async ({ page }) => {
  await openJwt(page);
  await tokenBox(page).fill(TOKEN);

  await expect(row(page, "alg")).toContainText("Algorithm");
  await expect(row(page, "alg")).toContainText("\"HS256\"");
  await expect(row(page, "typ")).toContainText("\"JWT\"");
  await expect(row(page, "sub")).toContainText("Subject");
  await expect(row(page, "sub")).toContainText("\"1234567890\"");
  await expect(row(page, "name")).toContainText("\"John Doe\"");

  await expect(row(page, "iat")).toContainText("Issued at");
  await expect(row(page, "iat")).toContainText(/1516239022.*\d{2}:\d{2}:\d{2} · \d+ years ago/s);
});

test("a token that is not one says which part it fell down on", async ({ page }) => {
  await openJwt(page);

  await tokenBox(page).fill("!!!.a.jwt");
  await expect(page.getByText("The header is not base64url")).toBeVisible();

  await tokenBox(page).fill("not.a.jwt");
  await expect(page.getByText("The header is not JSON")).toBeVisible();

  await tokenBox(page).fill("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0");
  await expect(page.getByText("A JWT is three parts separated by dots, or five when encrypted; this has 2"))
    .toBeVisible();

  await tokenBox(page).fill("a.b.c.d.e.f");
  await expect(page.getByText("A JWT is three parts separated by dots, or five when encrypted; this has 6"))
    .toBeVisible();

  await tokenBox(page).fill("");
  await expect(page.getByText(/is not|three parts/)).toHaveCount(0);
});

test("a secret is what turns the signature into an answer", async ({ page }) => {
  await openJwt(page);
  await tokenBox(page).fill(TOKEN);
  await keyBox(page).fill("");
  await expect(verdict(page)).toHaveText("Signature not checked");

  await keyBox(page).fill("not-the-secret");
  await expect(verdict(page)).toHaveText("Signature invalid");

  await keyBox(page).fill(SECRET);
  await expect(verdict(page)).toHaveText("Signature valid");

  await keyBox(page).fill(`${SECRET} `);
  await expect(verdict(page)).toHaveText("Signature invalid");
});

test("a key it cannot read is a question about the key, not a bad signature", async ({ page }) => {
  await openJwt(page);
  await tokenBox(page).fill(TOKEN);
  await keyBox(page).fill("-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----");

  await expect(page.getByText(/openssl pkcs8 -topk8 converts PKCS#1/)).toBeVisible();
  await expect(verdict(page)).toHaveText("Signature not checked");
});

test("the builder opens on the token that was being decoded", async ({ page }) => {
  await openJwt(page);
  await tokenBox(page).fill(TOKEN);
  await keyBox(page).fill(SECRET);
  await switchTo(page, "Encode");

  await expect(algorithm(page)).toHaveValue("HS256 (SHA-256)");
  await expect(page.getByRole("combobox", { name: "Header 1 name" })).toHaveValue("typ");
  await expect(page.getByRole("textbox", { name: "Header 1 value" })).toHaveValue("JWT");

  await expect(claimName(page, 1)).toHaveValue("sub");
  await expect(claimValue(page, 1)).toHaveValue("\"1234567890\"");
  await expect(claimValue(page, 2)).toHaveValue("John Doe");
  await expect(claimValue(page, 3)).toHaveValue("1516239022");

  await expect(keyBox(page)).toHaveValue(SECRET);
  await expect(tokenBox(page)).toHaveValue(TOKEN);
});

test("the builder is the sample, and says so claim for claim", async ({ page }) => {
  await openJwt(page);
  const sampled = await tokenBox(page).inputValue();
  await switchTo(page, "Encode");

  await expect(algorithm(page)).toHaveValue("EdDSA (Ed25519)");
  await expect(keyBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);
  await expect(page.getByRole("textbox", { name: "Public key" })).toHaveValue(/^-----BEGIN PUBLIC KEY-----\n/);

  await expect(claimName(page, 1)).toHaveValue("iss");
  await expect(claimValue(page, 1)).toHaveValue("utils.plus");
  await expect(claimName(page, 2)).toHaveValue("sub");
  await expect(claimValue(page, 2)).toHaveValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await expect(claimName(page, 3)).toHaveValue("iat");
  await expect(claimName(page, 4)).toHaveValue("exp");

  const issued = Number(await claimValue(page, 3).inputValue());
  expect(Number(await claimValue(page, 4).inputValue()) - issued).toBe(3600);
  expect(Math.abs(issued - Math.floor(Date.now() / 1000))).toBeLessThan(120);

  await expect(tokenBox(page)).toHaveValue(sampled);
});

test("what the builder made goes back to Decode, secret and all", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");
  await expect(keyBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);

  await page.getByRole("button", { name: "Add claim" }).click();
  await claimName(page, 5).fill("role");
  await claimValue(page, 5).fill("admin");

  const built = await tokenBox(page).inputValue();
  const key = await keyBox(page).inputValue();
  await switchTo(page, "Decode");

  await expect(tokenBox(page)).toHaveValue(built);
  await expect(keyBox(page)).toHaveValue(key);
  await expect(row(page, "role")).toContainText("\"admin\"");
  await expect(verdict(page)).toHaveText("Signature valid");

  await switchTo(page, "Encode");
  await expect(claimName(page, 5)).toHaveValue("role");
  await expect(tokenBox(page)).toHaveValue(built);
});

test("an edit in the Decode box is what makes the builder stale", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");
  await expect(tokenBox(page)).toHaveValue(/^[\w-]+\./);

  await switchTo(page, "Decode");
  await tokenBox(page).fill(TOKEN);
  await switchTo(page, "Encode");

  await expect(algorithm(page)).toHaveValue("HS256 (SHA-256)");
  await expect(claimValue(page, 2)).toHaveValue("John Doe");
});

test("a name used twice is the one thing a row can get wrong", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");

  await page.getByRole("button", { name: "Add claim" }).click();
  await expect(claimName(page, 5)).toBeFocused();
  await claimName(page, 5).fill("sub");
  await expect(page.getByText("Already used above")).toBeVisible();

  await claimName(page, 5).fill("");
  await expect(page.getByText("Already used above")).toHaveCount(0);
});

test("a row can be taken back out", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");
  await expect(claimName(page, 4)).toHaveValue("exp");

  await page.getByRole("button", { name: "Remove claim 4" }).click();
  await expect(claimName(page, 4)).toHaveCount(0);
  await switchTo(page, "Decode");
  await expect(row(page, "exp")).toHaveCount(0);
});

test("the builder encrypts as well as signs, and the claims go under the ciphertext", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");
  await expect(keyBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);

  await choose(protection(page), "Encrypted (JWE)");
  await expect(algorithm(page)).toHaveValue("ECDH-ES+A256KW");
  await expect(encryption(page)).toHaveValue("A256GCM");
  await expect(keyBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);
  await expect(page.getByRole("textbox", { name: "Public key" })).toHaveValue(/^-----BEGIN PUBLIC KEY-----\n/);

  const built = await tokenBox(page).inputValue();
  expect(built.split(".")).toHaveLength(5);
  expect(built).not.toContain("utils.plus");

  await switchTo(page, "Decode");
  await expect(row(page, "alg")).toContainText("\"ECDH-ES+A256KW\"");
  await expect(row(page, "enc")).toContainText("Encryption");
  await expect(row(page, "enc")).toContainText("\"A256GCM\"");
  await expect(verdict(page)).toHaveText("Decrypted");
  await expect(row(page, "iss")).toContainText("\"utils.plus\"");
});

test("an encrypted token keeps its claims until the key arrives", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");
  await choose(protection(page), "Encrypted (JWE)");
  await choose(algorithm(page), "A256GCMKW");

  await expect(keyBox(page)).toHaveValue(/^[\w-]{43}$/);
  const key = await keyBox(page).inputValue();
  const built = await tokenBox(page).inputValue();

  await switchTo(page, "Decode");
  await expect(verdict(page)).toHaveText("Decrypted");

  await keyBox(page).fill("");
  await expect(verdict(page)).toHaveText("Not decrypted");
  await expect(row(page, "alg")).toContainText("\"A256GCMKW\"");
  await expect(page.getByText("The key that opens this token is what reads these")).toBeVisible();
  await expect(row(page, "iss")).toHaveCount(0);

  await keyBox(page).fill("AAAA");
  await expect(page.getByText("A256GCMKW takes 32 bytes, and this is 3")).toBeVisible();
  await expect(verdict(page)).toHaveText("Not decrypted");

  await keyBox(page).fill("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await expect(verdict(page)).toHaveText("Wrong key");
  await expect(row(page, "iss")).toHaveCount(0);

  await keyBox(page).fill(key);
  await expect(verdict(page)).toHaveText("Decrypted");
  await expect(row(page, "iss")).toContainText("\"utils.plus\"");

  await tokenBox(page).fill(built);
  await switchTo(page, "Encode");
  await expect(claimName(page, 1)).toHaveValue("iss");
  await expect(claimValue(page, 1)).toHaveValue("utils.plus");
  await expect(page.getByRole("combobox", { name: "Header 1 name" })).toHaveValue("typ");
  await expect(page.getByRole("combobox", { name: "Header 2 name" })).toHaveCount(0);
});

test("a key box that is asked for bytes says so when it is given a phrase", async ({ page }) => {
  await openJwt(page);
  await switchTo(page, "Encode");
  await choose(protection(page), "Encrypted (JWE)");
  await choose(algorithm(page), "A128KW");

  await keyBox(page).fill("hunter2!!");
  await expect(page.getByText("A128KW takes bytes written as base64url, and this is not base64url")).toBeVisible();

  await keyBox(page).fill("AAAAAAAA");
  await expect(page.getByText("A128KW takes 16 bytes, and this is 6")).toBeVisible();
});

test("the link carries the mode's own fields and no others", async ({ page }) => {
  await openJwt(page);
  await tokenBox(page).fill(TOKEN);
  await expect.poll(() => hashState(page).token).toBe(TOKEN);
  expect(hashState(page).claims).toBeUndefined();

  await switchTo(page, "Encode");
  await expect.poll(() => hashState(page).mode).toBe("encode");
  expect(hashState(page).claims).toEqual([["sub", "\"1234567890\""], ["name", "John Doe"], ["iat", "1516239022"]]);
  expect(hashState(page).token).toBeUndefined();
  expect(hashState(page).enc).toBeUndefined();

  await choose(protection(page), "Encrypted (JWE)");
  await expect.poll(() => hashState(page).alg).toBe("ECDH-ES+A256KW");
  expect(hashState(page).enc).toBe("A256GCM");
});

test("nothing on the page asks for another host", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openJwt(page);
  await switchTo(page, "Encode");
  await expect(tokenBox(page)).toHaveValue(/^[\w-]+\.[\w-]+\.[\w-]+$/);

  await switchTo(page, "Decode");
  await expect(verdict(page)).toHaveText("Signature valid");

  await switchTo(page, "Encode");
  await choose(protection(page), "Encrypted (JWE)");
  await expect(tokenBox(page)).toHaveValue(/^[\w-]+\.[\w-]+\.[\w-]+\.[\w-]+\.[\w-]+$/);
  await switchTo(page, "Decode");
  await expect(verdict(page)).toHaveText("Decrypted");
  expect(blocked).toEqual([]);
});

const SETTLE_MS = 1000;

function hashState(page: Page): Record<string, unknown> {
  const payload = new URL(page.url()).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!payload) return {};
  const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
  return JSON.parse(decodeURIComponent(escape(atob(padded))));
}
