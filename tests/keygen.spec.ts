import { expect, Page, test } from "@playwright/test";
import { resolve } from "node:path";

const OPENPGP = `/@fs${resolve(import.meta.dirname, "../node_modules/openpgp/dist/openpgp.min.mjs")}`;

const BASE = process.env.PW_BASE_URL ?? "";

const SLOW = 60000;

const privateBox = (page: Page) => page.getByRole("textbox", { name: "Private key" });
const publicBox = (page: Page) => page.getByRole("textbox", { name: "Public key" });
const secretBox = (page: Page) => page.getByRole("textbox", { name: "Secret" });
const certificateBox = (page: Page) => page.getByRole("textbox", { name: "Certificate", exact: true });
const serverBox = (page: Page) => page.getByRole("textbox", { name: "Server configuration" });
const clientBox = (page: Page) => page.getByRole("textbox", { name: "Client configuration" });

const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const json = async (page: Page, name: string) =>
  JSON.parse(await box(page, name).inputValue()) as Record<string, unknown>;

const SERVER_KEY = "AAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAUE=";
const SERVER_PUBLIC = "pOCSkrZRwni5dyxWn1+puxPZBrRqtoyd+dwrRAn4ogk=";

async function openKeygen(page: Page) {
  await page.goto(`${BASE}/keygen`);
  await expect(page.getByRole("heading", { name: "Keygen" })).toBeVisible();
}

async function choose(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("an SSH key pair arrives with the comment on its public half", async ({ page }) => {
  await openKeygen(page);
  await page.getByLabel("Comment").fill("me@example.com");

  await page.getByRole("button", { name: "Generate" }).click();
  await expect(privateBox(page)).toHaveValue(/^-----BEGIN OPENSSH PRIVATE KEY-----\n/, { timeout: SLOW });
  await expect(publicBox(page)).toHaveValue(/^ssh-ed25519 \S+ me@example\.com$/);
  await expect(page.getByText(/^SHA256:/)).toBeVisible();
});

test("the algorithm decides what the second field asks for", async ({ page }) => {
  await openKeygen(page);
  await expect(page.getByRole("combobox", { name: "Curve" })).toHaveCount(0);

  await choose(page, "Algorithm", "ECDSA");
  await expect(page.getByRole("combobox", { name: "Curve" })).toBeVisible();

  await choose(page, "Algorithm", "RSA");
  await expect(page.getByRole("combobox", { name: "Key size" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Curve" })).toHaveCount(0);
});

test("each SSH algorithm writes its own kind of key", { tag: "@slow" }, async ({ page }) => {
  await openKeygen(page);

  await choose(page, "Algorithm", "ECDSA");
  await choose(page, "Curve", "NIST P-384");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(publicBox(page)).toHaveValue(/^ecdsa-sha2-nistp384 /, { timeout: SLOW });

  await choose(page, "Algorithm", "RSA");
  await choose(page, "Key size", "2048 bits");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(publicBox(page)).toHaveValue(/^ssh-rsa /, { timeout: SLOW });
});

test("changing a setting takes the key that no longer matches it away", async ({ page }) => {
  await openKeygen(page);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(publicBox(page)).toBeVisible({ timeout: SLOW });

  await page.getByLabel("Comment").fill("someone else");
  await expect(publicBox(page)).toHaveCount(0);
});

test("a PGP key needs a name, and carries it once given", { tag: "@slow" }, async ({ page }) => {
  await openKeygen(page);
  await choose(page, "Key kind", "PGP key");

  await expect(page.getByText("Required")).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Required")).toBeVisible();

  await page.getByLabel("Name").fill("Ada Lovelace");
  await expect(page.getByText("Required")).toHaveCount(0);

  await page.getByLabel("Email").fill("not an address");
  await expect(page.getByText("Enter a valid address")).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(privateBox(page)).toHaveCount(0);

  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(privateBox(page)).toHaveValue(/^-----BEGIN PGP PRIVATE KEY BLOCK-----/, { timeout: SLOW });
  await expect(publicBox(page)).toHaveValue(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/);

  const armoredKey = await publicBox(page).inputValue();
  const key = await page.evaluate(async ({ armoredKey, module }) => {
    const openpgp = await import(module);
    const parsed = await openpgp.readKey({ armoredKey });
    return { fingerprint: parsed.getFingerprint().toUpperCase(), userIDs: parsed.getUserIDs() };
  }, { armoredKey, module: OPENPGP });

  expect(key.userIDs).toEqual(["Ada Lovelace <ada@example.com>"]);
  await expect(page.getByText(key.fingerprint)).toBeVisible();
});

test(
  "a TLS certificate needs a host to be issued to, and carries it once given",
  { tag: "@slow" },
  async ({ page }) => {
    await openKeygen(page);
    await choose(page, "Key kind", "TLS certificate");

    await expect(page.getByText("Required")).toHaveCount(0);
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Required")).toBeVisible();

    await page.getByLabel("Common name").fill("not a host");
    await expect(page.getByText("Enter a host name or IP address")).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(certificateBox(page)).toHaveCount(0);

    await page.getByLabel("Common name").fill("localhost");
    await page.getByLabel("Subject alternative names").fill("localhost, -bad.test");
    await expect(page.getByText("Enter host names or IP addresses")).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(certificateBox(page)).toHaveCount(0);

    await page.getByLabel("Subject alternative names").fill("localhost, 127.0.0.1");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(privateBox(page)).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/, { timeout: SLOW });
    await expect(certificateBox(page)).toHaveValue(/^-----BEGIN CERTIFICATE-----\n/);
    await expect(page.getByText(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)).toBeVisible();

    await choose(page, "Algorithm", "ECDSA");
    await expect(certificateBox(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(certificateBox(page)).toHaveValue(/^-----BEGIN CERTIFICATE-----\n/, { timeout: SLOW });
  },
);

test("a JWK arrives on its own, and as a set once more than one is asked for", async ({ page }) => {
  await openKeygen(page);
  await choose(page, "Key kind", "JSON Web Key");

  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Private key")).toBeVisible();
  const key = await json(page, "Private key");
  const published = await json(page, "Public key");

  expect(key).toMatchObject({ kty: "OKP", crv: "Ed25519", use: "sig", alg: "EdDSA" });
  await expect(page.getByText(key.kid as string, { exact: true })).toBeVisible();
  const { d, ...withoutPrivateHalf } = key;
  expect(published).toEqual(withoutPrivateHalf);
  expect(d).toBeTruthy();

  await page.getByRole("textbox", { name: "Count" }).fill("3");
  await expect(box(page, "Private key")).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByRole("heading", { name: "JSON Web Key Set" })).toBeVisible();

  const set = await json(page, "Private key set");
  expect((set.keys as Record<string, string>[]).map((each) => each.kid)).toHaveLength(3);
  expect(new Set((set.keys as Record<string, string>[]).map((each) => each.kid)).size).toBe(3);
});

test("the key ID says what each key is named, and an HMAC key has no half to hand out", async ({ page }) => {
  await openKeygen(page);
  await choose(page, "Key kind", "JSON Web Key");

  await choose(page, "Key ID", "None");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Private key")).toBeVisible();
  expect(await json(page, "Private key")).not.toHaveProperty("kid");

  await choose(page, "Key ID", "Random UUID");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Private key")).toBeVisible();
  expect((await json(page, "Private key")).kid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);

  await choose(page, "Algorithm", "HS256 (SHA-256)");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Key")).toBeVisible();
  expect(await json(page, "Key")).toMatchObject({ kty: "oct", alg: "HS256" });
  await expect(box(page, "Public key")).toHaveCount(0);

  await page.getByRole("textbox", { name: "Count" }).fill("");
  await expect(page.getByText("Enter a count of 1 to 8")).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Key")).toHaveCount(0);
});

test("an encryption algorithm writes a key that says it is for encrypting", async ({ page }) => {
  await openKeygen(page);
  await choose(page, "Key kind", "JSON Web Key");

  await choose(page, "Algorithm", "ECDH-ES (direct agreement)");
  await expect(page.getByRole("combobox", { name: "Curve" })).toBeVisible();
  await choose(page, "Curve", "X25519");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Private key")).toBeVisible();
  expect(await json(page, "Private key")).toMatchObject({ kty: "OKP", crv: "X25519", use: "enc", alg: "ECDH-ES" });

  await choose(page, "Algorithm", "A256GCMKW (AES-GCM key wrap)");
  await expect(page.getByRole("combobox", { name: "Curve" })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Key")).toBeVisible();
  expect(await json(page, "Key")).toMatchObject({ kty: "oct", use: "enc", alg: "A256GCMKW" });
  await expect(box(page, "Public key")).toHaveCount(0);

  await choose(page, "Algorithm", "ES256 (P-256)");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Public key")).toBeVisible();
  expect(await json(page, "Public key")).toMatchObject({ kty: "EC", crv: "P-256", use: "sig", alg: "ES256" });
});

test("WireGuard writes both ends of one tunnel, around whichever server it is given", async ({ page }) => {
  await openKeygen(page);
  await choose(page, "Key kind", "WireGuard keys");

  await expect(page.getByRole("combobox", { name: "Algorithm" })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(serverBox(page)).toHaveValue(/^\[Interface\]\nPrivateKey = \S+\n\n\[Peer\]\nPublicKey = \S+\n$/);
  await expect(clientBox(page)).toHaveValue(/^\[Interface\]\nPrivateKey = \S+\n\n\[Peer\]\nPublicKey = \S+\n$/);

  await page.getByLabel("Server private key").fill(SERVER_KEY);
  await expect(serverBox(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(serverBox(page)).toHaveValue(new RegExp(`PrivateKey = ${SERVER_KEY.replace(/\+/g, "\\+")}\n`));
  await expect(clientBox(page)).toHaveValue(new RegExp(`PublicKey = ${SERVER_PUBLIC.replace(/\+/g, "\\+")}\n`));

  await page.getByLabel("Server private key").fill("not a key");
  await expect(page.getByText("Enter a 44-character base64 key")).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(serverBox(page)).toHaveCount(0);
});

test("a random secret is there without being asked for, and follows its settings", async ({ page }) => {
  await openKeygen(page);
  await choose(page, "Key kind", "Random secret");

  await expect(secretBox(page)).toHaveValue(/^[0-9a-f]{64}$/);

  const first = await secretBox(page).inputValue();
  await page.getByRole("button", { name: "Regenerate secret" }).click();
  await expect(secretBox(page)).not.toHaveValue(first);

  await choose(page, "Encoding", "Base32");
  await expect(secretBox(page)).toHaveValue(/^[A-Z2-7]+=*$/);

  await page.getByRole("textbox", { name: "Size" }).fill("8");
  await choose(page, "Encoding", "Hexadecimal (uppercase)");
  await expect(secretBox(page)).toHaveValue(/^[0-9A-F]{16}$/);
});

test("every algorithm works with third-party requests blocked", { tag: "@slow" }, async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openKeygen(page);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(publicBox(page)).toHaveValue(/^ssh-ed25519 /, { timeout: SLOW });

  await choose(page, "Key kind", "PGP key");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(publicBox(page)).toHaveValue(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/, { timeout: SLOW });

  await choose(page, "Key kind", "TLS certificate");
  await page.getByLabel("Common name").fill("localhost");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(certificateBox(page)).toHaveValue(/^-----BEGIN CERTIFICATE-----\n/, { timeout: SLOW });

  await choose(page, "Key kind", "JSON Web Key");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Public key")).toHaveValue(/"kty": "OKP"/, { timeout: SLOW });

  await choose(page, "Key kind", "WireGuard keys");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(serverBox(page)).toHaveValue(/^\[Interface\]\n/, { timeout: SLOW });

  expect(blocked).toEqual([]);
});
