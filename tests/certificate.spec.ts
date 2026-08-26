import { expect, Page, test } from "@playwright/test";
import { ED25519, EXPIRED, INTERMEDIATE, LEAF, LEAF_KEY, ROOT, SSH_ED25519 } from "./certificate-fixtures";

const BASE = process.env.PW_BASE_URL ?? "";

const input = (page: Page) => page.getByRole("textbox", { name: "Input" });
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const fact = (page: Page, label: string) => page.locator(`[data-fact="${label}"] td`).last();
const extension = (page: Page, name: string) => page.locator(`[data-extension="${name}"] td`).last();

async function openCertificate(page: Page) {
  await page.goto(`${BASE}/certificate`);
  await expect(page.getByRole("heading", { name: "Certificate", exact: true })).toBeVisible();
}

async function switchTo(page: Page, mode: string) {
  await page.getByRole("radiogroup").getByText(mode, { exact: true }).click();
}

test("a pasted certificate is read into its names, its dates and its fingerprints", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(LEAF);

  await expect(page.locator("[data-item=\"certificate\"]")).toHaveCount(1);
  await expect(fact(page, "Subject")).toHaveText("C=AU, O=utils.plus, CN=example.test");
  await expect(fact(page, "Issuer")).toHaveText("C=AU, O=utils.plus, CN=utils.plus Test Issuing CA");
  await expect(fact(page, "Not after")).toHaveText("2125-01-01 00:00:00 UTC");
  await expect(fact(page, "Public key")).toHaveText("ECDSA P-256");
  await expect(fact(page, "SHA-256")).toHaveText(
    "A1:84:BE:20:10:39:A6:D9:B3:17:45:23:C0:37:D1:F8:9E:25:2F:E0:06:59:81:B0:C5:DA:01:F3:DB:C8:AB:5B",
  );
  await expect(extension(page, "Subject alternative name")).toHaveText(
    "DNS:example.test, DNS:www.example.test, IP:127.0.0.1",
  );
  await expect(page.getByText(/^Expires in \d+ years$/)).toBeVisible();
});

test("a chain pasted in the wrong order is put back in it and says so", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(`${ROOT}\n${LEAF}\n${INTERMEDIATE}`);

  const chain = page.locator("[data-chain]");
  await expect(chain.locator("[data-link]")).toHaveCount(3);
  await expect(chain.locator("[data-link=\"Leaf\"] td").last()).toHaveText("C=AU, O=utils.plus, CN=example.test");
  await expect(chain.locator("[data-link=\"Root\"] td").last()).toHaveText(
    "C=AU, O=utils.plus, CN=utils.plus Test Root CA",
  );
  await expect(chain.getByText("A server has to send its chain leaf first", { exact: false })).toBeVisible();

  await expect(page.locator("[data-item]").first()).toContainText("example.test");
});

test("a certificate and the key it belongs with are matched to each other", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(`${LEAF}\n${LEAF_KEY}`);

  await expect(page.getByText("Private key matches")).toBeVisible();
  await expect(page.getByText("Matches example.test")).toBeVisible();
});

test("a key that belongs to nothing here is told so, and the certificate is left unbadged", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(`${ED25519}\n${LEAF_KEY}`);

  await expect(page.getByText("Matches nothing here")).toBeVisible();
  await expect(page.getByText("Private key matches")).toHaveCount(0);
});

test("the share link carries the certificate and never the private key", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(`${LEAF}\n${LEAF_KEY}`);
  await expect(page.getByText("Private key matches")).toBeVisible();

  await expect.poll(() => page.evaluate(() => window.location.hash)).not.toBe("");
  const shared = await page.evaluate(() => {
    let b64 = window.location.hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return decodeURIComponent(escape(atob(b64)));
  });

  expect(shared).toContain("BEGIN CERTIFICATE");
  expect(shared).not.toContain("PRIVATE KEY");
  await expect(page.getByText("The private key stays in this tab")).toBeVisible();
});

test("the share link carries the authority's certificate and never its key", async ({ page }) => {
  await openCertificate(page);
  await switchTo(page, "Generate");
  await page.getByRole("combobox", { name: "Certificate kind" }).click();
  await page.getByRole("option", { name: "Certificate signed by a CA" }).click();
  await page.getByRole("textbox", { name: "Issuer certificate" }).fill(ROOT);
  await page.getByRole("textbox", { name: "Issuer private key" }).fill(LEAF_KEY);
  await page.getByLabel("Common name").fill("made.test");

  await expect.poll(() => page.evaluate(() => window.location.hash)).not.toBe("");
  const shared = await page.evaluate(() => {
    let b64 = window.location.hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return decodeURIComponent(escape(atob(b64)));
  });

  expect(shared).toContain("BEGIN CERTIFICATE");
  expect(shared).toContain("made.test");
  expect(shared).not.toContain("PRIVATE KEY");
});

test("a certificate past its window says so in red rather than in a date nobody read", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(EXPIRED);

  await expect(page.getByText(/^Expired \d+ years ago$/)).toBeVisible();
  await expect(page.getByText("Self-issued")).toBeVisible();
});

test("an SSH public key is fingerprinted the way ssh-keygen prints it", async ({ page }) => {
  await openCertificate(page);
  await input(page).fill(SSH_ED25519);

  await expect(fact(page, "Algorithm")).toHaveText("ssh-ed25519");
  await expect(fact(page, "Fingerprint")).toHaveText("SHA256:BXxgus5qjl4w/pnvtrZbtpev9aqqHi4K0v419Cl584w");
});

test("a binary certificate file is opened into the box as PEM", async ({ page }) => {
  await openCertificate(page);
  const der = Buffer.from(LEAF.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, ""), "base64");

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open a file" }).click();
  await (await chooser).setFiles({ name: "leaf.der", mimeType: "", buffer: der });

  await expect(input(page)).toHaveValue(/^-----BEGIN CERTIFICATE-----\n/);
  await expect(fact(page, "Subject")).toHaveText("C=AU, O=utils.plus, CN=example.test");
});

test("everything is read with third-party requests blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openCertificate(page);
  await input(page).fill(`${LEAF}\n${LEAF_KEY}\n${INTERMEDIATE}\n${ROOT}\n${SSH_ED25519}`);

  await expect(page.locator("[data-item]")).toHaveCount(5);
  await expect(page.getByText("Private key matches")).toBeVisible();
  expect(blocked).toEqual([]);
});

test("a self-signed certificate is made, and reads back as its own issuer", async ({ page }) => {
  await openCertificate(page);
  await switchTo(page, "Generate");
  await page.getByLabel("Common name").fill("made.test");
  await page.getByLabel("Organisation").fill("utils.plus");
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(box(page, "Certificate")).toHaveValue(/^-----BEGIN CERTIFICATE-----\n/);
  await expect(box(page, "Private key")).toHaveValue(/^-----BEGIN PRIVATE KEY-----\n/);
  await expect(page.getByText(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)).toBeVisible();

  const certificate = await box(page, "Certificate").inputValue();
  await switchTo(page, "Decode");
  await input(page).fill(certificate);
  await expect(fact(page, "Subject")).toHaveText("O=utils.plus, CN=made.test");
  await expect(fact(page, "Issuer")).toHaveText("O=utils.plus, CN=made.test");
  await expect(extension(page, "Subject alternative name")).toHaveText("DNS:made.test");
});

test("a root is made and then signs one, without anything going through a clipboard", async ({ page }) => {
  await openCertificate(page);
  await switchTo(page, "Generate");
  await page.getByRole("combobox", { name: "Certificate kind" }).click();
  await page.getByRole("option", { name: "Root certificate authority" }).click();
  await page.getByLabel("Common name").fill("utils.plus Test Root");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Certificate")).toHaveValue(/BEGIN CERTIFICATE/);

  await page.getByRole("button", { name: "Use as issuer" }).click();
  await expect(page.getByRole("textbox", { name: "Issuer certificate" })).toHaveValue(/BEGIN CERTIFICATE/);
  await expect(page.getByRole("textbox", { name: "Issuer private key" })).toHaveValue(/BEGIN PRIVATE KEY/);

  await page.getByLabel("Common name").fill("leaf.test");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Certificate chain")).toHaveValue(/BEGIN CERTIFICATE/);

  const chain = await box(page, "Certificate chain").inputValue();
  await switchTo(page, "Decode");
  await input(page).fill(chain);
  const links = page.locator("[data-chain] [data-link]");
  await expect(links).toHaveCount(2);
  await expect(links.first()).toContainText("leaf.test");
  await expect(links.last()).toContainText("utils.plus Test Root");
  const root = page.locator("[data-item]").last();
  await expect(root.locator("[data-extension=\"Basic constraints\"] td").last()).toHaveText("Certificate authority");
});

test("a blank name is not wrong until the button asks for it", async ({ page }) => {
  await openCertificate(page);
  await switchTo(page, "Generate");

  await expect(page.getByText("Required")).toHaveCount(0);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Required")).toBeVisible();
  await expect(page.locator("[data-made]")).toHaveCount(0);

  await page.getByLabel("Common name").fill("not a host");
  await expect(page.getByText("Enter a host name or IP address, or name the hosts below")).toBeVisible();
  await page.getByLabel("Subject alternative names").fill("made.test, -bad.test");
  await expect(page.getByText("Enter host names or IP addresses")).toBeVisible();

  await page.getByLabel("Subject alternative names").fill("made.test");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Certificate")).toHaveValue(/BEGIN CERTIFICATE/);
});

test("a leaf pasted as the issuer is refused, in the words the button would have failed in", async ({ page }) => {
  await openCertificate(page);
  await switchTo(page, "Generate");
  await page.getByLabel("Common name").fill("made.test");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(box(page, "Certificate")).toHaveValue(/BEGIN CERTIFICATE/);
  const certificate = await box(page, "Certificate").inputValue();
  const key = await box(page, "Private key").inputValue();

  await page.getByRole("combobox", { name: "Certificate kind" }).click();
  await page.getByRole("option", { name: "Certificate signed by a CA" }).click();
  await page.getByRole("textbox", { name: "Issuer certificate" }).fill(certificate);
  await page.getByRole("textbox", { name: "Issuer private key" }).fill(key);
  await expect(page.getByText("This certificate is not a certificate authority")).toBeVisible();
});

test("a certificate is made with third-party requests blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openCertificate(page);
  await switchTo(page, "Generate");
  await page.getByLabel("Common name").fill("made.test");
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(box(page, "Certificate")).toHaveValue(/BEGIN CERTIFICATE/);
  expect(blocked).toEqual([]);
});
