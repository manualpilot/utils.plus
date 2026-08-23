import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const curlEditor: any;

async function openCurl(page: Page) {
  await page.goto(`${BASE}/curl`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).curlEditor !== undefined);
}

const readCommand = (page: Page) => page.evaluate(() => curlEditor.state.doc.toString());

function replaceCommand(page: Page, text: string) {
  return page.evaluate((text) => {
    curlEditor.dispatch({ changes: { from: 0, to: curlEditor.state.doc.length, insert: text } });
  }, text);
}

function decodeHash(url: string): { command?: string; wrapped?: boolean } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("the builder is drawn from the command the editor holds", async ({ page }) => {
  await openCurl(page);

  await expect(page.getByLabel("URL 1", { exact: true })).toHaveValue("https://httpbin.org/post");
  await expect(page.getByRole("combobox", { name: "Method" })).toHaveValue("POST");
  await expect(page.getByLabel("Header 1", { exact: true })).toHaveValue("Content-Type: application/json");
  await expect(page.getByLabel("Header 2", { exact: true })).toHaveValue("Authorization: Bearer s3cr3t");
  await expect(page.getByLabel("Data 1", { exact: true })).toHaveValue("{\"name\":\"widget\",\"quantity\":3}");
  await expect(page.getByRole("switch", { name: "Ask for compression" })).toBeVisible();
});

test("a command typed into the editor reaches the fields", async ({ page }) => {
  await openCurl(page);

  await replaceCommand(page, "curl -X DELETE https://example.com/items/7 -H 'Accept: */*' -k");

  await expect(page.getByLabel("URL 1", { exact: true })).toHaveValue("https://example.com/items/7");
  await expect(page.getByRole("combobox", { name: "Method" })).toHaveValue("DELETE");
  await expect(page.getByLabel("Header 1", { exact: true })).toHaveValue("Accept: */*");
  await expect(page.getByRole("switch", { name: "Skip certificate checks" })).toBeVisible();
  await expect(page.getByLabel("Header 2", { exact: true })).toHaveCount(0);
});

test("a field written in reaches the command", async ({ page }) => {
  await openCurl(page);

  await page.getByLabel("Header 1", { exact: true }).fill("Content-Type: text/plain");

  expect(await readCommand(page)).toContain("-H 'Content-Type: text/plain'");
  expect(await readCommand(page)).toContain("-H 'Authorization: Bearer s3cr3t'");
});

test("an argument is chosen from the list and given a value", async ({ page }) => {
  await openCurl(page);

  await page.getByRole("combobox", { name: "Argument to add" }).fill("Credentials");
  await page.getByRole("option", { name: /Credentials/ }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("textbox", { name: "Credentials" }).fill("alice:hunter2");
  expect(await readCommand(page)).toContain("-u alice:hunter2");
});

test("a repeat is added and removed in its own fieldset", async ({ page }) => {
  await openCurl(page);

  await page.getByRole("button", { name: "Add header" }).click();
  await page.getByLabel("Header 3", { exact: true }).fill("Accept: application/json");
  expect(await readCommand(page)).toContain("-H 'Accept: application/json'");

  await page.getByLabel("Remove header 1", { exact: true }).click();
  await expect(page.getByLabel("Header 2", { exact: true })).toHaveValue("Accept: application/json");
  expect(await readCommand(page)).not.toContain("Content-Type");
});

test("a flag switched off leaves the command", async ({ page }) => {
  await openCurl(page);

  await page.getByRole("switch", { name: "Ask for compression" }).click();

  expect(await readCommand(page)).not.toContain("--compressed");
  await expect(page.getByRole("switch", { name: "Ask for compression" })).toHaveCount(0);
});

test("a bundle of single-letter flags survives an edit made elsewhere", async ({ page }) => {
  await openCurl(page);
  expect(await readCommand(page)).toContain("-sS");

  await page.getByLabel("Header 1", { exact: true }).fill("Accept: */*");

  expect(await readCommand(page)).toContain("-sS");
});

test("a flag chosen from the list joins the bundle rather than trailing the command", async ({ page }) => {
  await openCurl(page);

  await page.getByRole("combobox", { name: "Argument to add" }).fill("Follow redirects");
  await page.getByRole("option", { name: "Follow redirects (-L, --location)" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();

  expect(await readCommand(page)).toContain("-sSL");
});

test("the layout switch rewrites the command it is showing", async ({ page }) => {
  await openCurl(page);
  expect(await readCommand(page)).toContain("\\\n");

  await page.locator("label", { hasText: "One line" }).first().click();

  const command = await readCommand(page);
  expect(command).not.toContain("\n");
  expect(command).toContain("curl https://httpbin.org/post -X POST");
});

test("a command that is not one is kept, and the builder stands aside", async ({ page }) => {
  await openCurl(page);

  await replaceCommand(page, "curl https://example.com | jq .");

  await expect(page.getByText("One command at a time")).toBeVisible();
  await expect(page.getByLabel("URL 1", { exact: true })).toHaveCount(0);
  expect(await readCommand(page)).toBe("curl https://example.com | jq .");
});

test("an option the builder has no field for is carried through anyway", async ({ page }) => {
  await openCurl(page);

  await replaceCommand(page, "curl https://example.com --tr-encoding -H 'A: b'");
  await expect(page.getByRole("button", { name: "Remove --tr-encoding" })).toBeVisible();

  await page.getByLabel("Header 1", { exact: true }).fill("A: c");
  expect(await readCommand(page)).toContain("--tr-encoding");
});

test("the address carries the command and the layout", async ({ page }) => {
  await openCurl(page);
  expect(decodeHash(page.url()).command).toBeUndefined();

  await page.getByLabel("URL 1", { exact: true }).fill("https://example.com/shared");

  await expect.poll(() => decodeHash(page.url()).command).toContain("https://example.com/shared");
  expect(decodeHash(page.url()).wrapped).toBe(true);
});

test("the page works with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openCurl(page);
  await replaceCommand(page, "curl https://offline.example -H 'A: b'");
  await expect(page.getByLabel("Header 1", { exact: true })).toHaveValue("A: b");
  expect(blocked).toEqual([]);
});

const ANSWER = { id: 7, name: "widget" };

test("a command sent from the page shows what came back", async ({ page }) => {
  await openCurl(page);

  await page.route("https://api.example.com/**", (route) =>
    route.fulfill({
      status: 201,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify(ANSWER),
    }));

  await replaceCommand(page, "curl https://api.example.com/v1/items");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByLabel("Response body")).toHaveText(JSON.stringify(ANSWER));
  await expect(page.getByText(/^201\b/)).toBeVisible();
  await expect(page.locator("[data-fact='content-type']")).toContainText("application/json");
});

test("a request the browser will not make is explained", async ({ page }) => {
  await openCurl(page);

  await page.route("https://api.example.com/**", (route) => route.abort());

  await replaceCommand(page, "curl https://api.example.com/v1/items");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByText(/almost always CORS/)).toBeVisible();
  await expect(page.getByLabel("Response body")).toHaveCount(0);
});

test("what a browser cannot do is on screen before anything is sent", async ({ page }) => {
  await openCurl(page);

  await replaceCommand(page, "curl -k https://example.com --resolve example.com:443:127.0.0.1");

  await expect(page.getByText("A browser will not skip its certificate checks for a page that asks")).toBeVisible();
  await expect(page.getByText("The browser makes the connection and takes no instructions about it")).toBeVisible();
});

test("Send says what is missing rather than doing nothing", async ({ page }) => {
  await openCurl(page);

  await replaceCommand(page, "curl -X POST");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByText("The command has no URL to send to")).toBeVisible();
});
