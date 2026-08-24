import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const RECORDING = {
  log: {
    version: "1.2",
    creator: { name: "WebInspector", version: "537.36" },
    pages: [{ id: "page_1", title: "https://shop.example.com/", startedDateTime: "2024-03-02T10:00:00.000Z" }],
    entries: [
      {
        pageref: "page_1",
        startedDateTime: "2024-03-02T10:00:00.000Z",
        time: 120,
        request: {
          method: "GET",
          url: "https://shop.example.com/",
          httpVersion: "http/2.0",
          headers: [{ name: "Accept", value: "text/html" }],
          queryString: [],
          cookies: [{ name: "session", value: "abc123" }],
          headersSize: 300,
          bodySize: 0,
        },
        response: {
          status: 200,
          statusText: "OK",
          headers: [{ name: "Content-Type", value: "text/html" }],
          cookies: [],
          content: { size: 34, mimeType: "text/html", text: "<!doctype html><title>Shop</title>" },
          redirectURL: "",
          headersSize: 200,
          bodySize: 1400,
        },
        cache: {},
        timings: { blocked: 1, dns: 8, connect: 30, ssl: 20, send: 1, wait: 70, receive: 10 },
        serverIPAddress: "93.184.216.34",
      },
      {
        pageref: "page_1",
        startedDateTime: "2024-03-02T10:00:01.000Z",
        time: 480,
        request: {
          method: "POST",
          url: "https://api.example.com/v2/cart?currency=EUR",
          httpVersion: "http/1.1",
          headers: [{ name: "Authorization", value: "Bearer token" }],
          queryString: [{ name: "currency", value: "EUR" }],
          cookies: [],
          postData: { mimeType: "application/json", text: "{\"sku\":\"A-1\"}" },
          headersSize: 420,
          bodySize: 13,
        },
        response: {
          status: 201,
          statusText: "Created",
          headers: [{ name: "Content-Encoding", value: "gzip" }],
          cookies: [{ name: "cart", value: "9f2" }],
          content: { size: 90, mimeType: "application/json", text: "{\"id\":42}" },
          redirectURL: "",
          headersSize: 180,
          bodySize: 70,
        },
        cache: {},
        timings: { blocked: 2, send: 1, wait: 460, receive: 17 },
      },
      {
        startedDateTime: "2024-03-02T10:00:02.000Z",
        time: 40,
        request: { method: "GET", url: "https://cdn.example.com/logo.png", headers: [], queryString: [], cookies: [] },
        response: {
          status: 200,
          statusText: "OK",
          headers: [{ name: "Content-Type", value: "image/png" }],
          cookies: [],
          content: {
            size: 95,
            mimeType: "image/png",
            encoding: "base64",
            text: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          },
          redirectURL: "",
          headersSize: 120,
          bodySize: 95,
        },
        cache: {},
        timings: { wait: 30, receive: 10 },
      },
      {
        startedDateTime: "2024-03-02T10:00:03.000Z",
        time: 20,
        request: {
          method: "GET",
          url: "https://shop.example.com/missing.css",
          headers: [],
          queryString: [],
          cookies: [],
        },
        response: {
          status: 404,
          statusText: "Not Found",
          headers: [{ name: "Content-Type", value: "text/plain" }],
          cookies: [],
          content: { size: 9, mimeType: "text/plain", text: "not found" },
          redirectURL: "",
          headersSize: 90,
          bodySize: 9,
        },
        cache: {},
        timings: { wait: 20 },
      },
    ],
  },
};

const cards = (page: Page) => page.locator("[data-har-entry]");

const fact = (page: Page, label: string) => page.locator(`[data-fact="${label}"] td`).last();

const condition = (page: Page, at: number) => page.locator("[data-har-condition]").nth(at);

async function openHar(page: Page) {
  await page.goto(`${BASE}/har`);
  await expect(page.getByText("Click to choose a .har file")).toBeVisible();
}

async function choose(page: Page, recording: unknown = RECORDING, name = "recording.har") {
  await page.locator("input[type=\"file\"]").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(typeof recording === "string" ? recording : JSON.stringify(recording)),
  });
}

async function fill(page: Page, at: number, field: string, comparator: string, value: string) {
  const row = condition(page, at);
  await row.getByLabel("Field", { exact: true }).click();
  await page.getByRole("option", { name: field, exact: true }).click();
  await row.getByLabel("Comparator", { exact: true }).click();
  await page.getByRole("option", { name: comparator, exact: true }).click();
  await row.getByLabel("Value", { exact: true }).fill(value);
}

test("a chosen recording is read into a card per request", async ({ page }) => {
  await openHar(page);
  await choose(page);

  await expect(fact(page, "Name")).toHaveText("recording.har");
  await expect(fact(page, "Requests")).toHaveText("4");
  await expect(fact(page, "Recorded by")).toHaveText("WebInspector 537.36");
  await expect(fact(page, "Recording")).toHaveText("3.02 s");

  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator("[data-har-count]")).toHaveText("4 requests");

  const first = cards(page).first();
  await expect(first.locator("[data-har-method]")).toHaveText("GET");
  await expect(first.locator("[data-har-status]")).toHaveText("200");
  await expect(first.locator("[data-har-target]")).toHaveText("/");
  await expect(cards(page).nth(1).locator("[data-har-target]")).toHaveText("/v2/cart?currency=EUR");
});

test("a card opens onto the whole of the request", async ({ page }) => {
  await openHar(page);
  await choose(page);

  const card = cards(page).nth(1);
  await expect(card.getByRole("tab", { name: "Overview" })).toHaveCount(0);
  await card.getByRole("button").first().click();

  await expect(fact(page, "URL")).toHaveText("https://api.example.com/v2/cart?currency=EUR");
  await expect(fact(page, "Status")).toHaveText("201 Created");
  await expect(fact(page, "Offset")).toHaveText("+1.00 s");

  await card.getByRole("tab", { name: "Request" }).click();
  await expect(card.getByText("Authorization")).toBeVisible();
  await expect(card.getByText("currency", { exact: true })).toBeVisible();
  await expect(card.locator(".har-body")).toContainText("\"sku\": \"A-1\"");

  await card.getByRole("tab", { name: "Response" }).click();
  await expect(card.getByText("Content-Encoding")).toBeVisible();
  await expect(card.locator(".har-body")).toContainText("\"id\": 42");

  await card.getByRole("tab", { name: "Timings" }).click();
  await expect(card.locator("[data-har-phase=\"Wait\"]")).toContainText("460 ms");

  await card.getByRole("button").first().click();
  await expect(card.getByRole("tab", { name: "Overview" })).toHaveCount(0);
});

test("the handshake is drawn beside the connect it was measured inside, not twice", async ({ page }) => {
  await openHar(page);
  await choose(page);

  const card = cards(page).first();
  await card.getByRole("button").first().click();
  await card.getByRole("tab", { name: "Timings" }).click();

  await expect(card.locator("[data-har-phase=\"Connect\"]")).toContainText("10 ms");
  await expect(card.locator("[data-har-phase=\"TLS\"]")).toContainText("20 ms");
  await expect(card.locator("[data-har-timings] > *")).toHaveCount(7);
});

test("a picture is shown rather than spelled out as the base64 of one", async ({ page }) => {
  await openHar(page);
  await choose(page);

  const card = cards(page).nth(2);
  await card.getByRole("button").first().click();
  await card.getByRole("tab", { name: "Response" }).click();

  const image = card.locator("img.har-image");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
});

test("a condition narrows the list, and every condition has to hold", async ({ page }) => {
  await openHar(page);
  await choose(page);

  await fill(page, 0, "Status", "is at least", "400");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator("[data-har-count]")).toHaveText("1 of 4 requests match");
  await expect(cards(page).first().locator("[data-har-status]")).toHaveText("404");

  await page.getByRole("button", { name: "Add condition" }).click();
  await expect(condition(page, 1).getByLabel("Value", { exact: true })).toBeFocused();
  await fill(page, 1, "Host", "contains", "api.");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("No request matches every condition above.")).toBeVisible();

  await condition(page, 0).getByRole("button", { name: "Remove this condition" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator("[data-har-target]")).toHaveText("/v2/cart?currency=EUR");
});

test("a pattern filters, and a half-written one says so rather than widening the list", async ({ page }) => {
  await openHar(page);
  await choose(page);

  await fill(page, 0, "URL", "matches regex", "\\.(png|css)$");
  await expect(cards(page)).toHaveCount(2);

  await condition(page, 0).getByLabel("Value", { exact: true }).fill("(unclosed");
  await expect(condition(page, 0).locator(".absolute-error")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test("a header is searched by name or by value, across every one an exchange carries", async ({ page }) => {
  await openHar(page);
  await choose(page);

  await fill(page, 0, "Response header", "contains", "gzip");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator("[data-har-target]")).toHaveText("/v2/cart?currency=EUR");

  await fill(page, 0, "Request cookie", "contains", "session");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator("[data-har-target]")).toHaveText("/");
});

test("a comparator the new field cannot be asked with falls back to that field's own", async ({ page }) => {
  await openHar(page);
  await choose(page);

  await fill(page, 0, "URL", "matches regex", "example");
  const row = condition(page, 0);
  await row.getByLabel("Field", { exact: true }).click();
  await page.getByRole("option", { name: "Status", exact: true }).click();
  await expect(row.getByLabel("Comparator", { exact: true })).toHaveValue("is");
});

test("the link carries the question and not the recording", async ({ page }) => {
  await openHar(page);
  await choose(page);
  await fill(page, 0, "Status", "is at least", "400");

  await expect(page).toHaveURL(/#./);
  const shared = page.url();

  await page.goto(`${BASE}/`);
  await page.goto(shared);
  await expect(page.getByText("Click to choose a .har file")).toBeVisible();
  await choose(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(condition(page, 0).getByLabel("Value", { exact: true })).toHaveValue("400");
});

test("a file that is not a HAR says so, and a recording can be closed again", async ({ page }) => {
  await openHar(page);
  await choose(page, "{ not json", "notes.txt");

  await expect(page.getByText("That file is not JSON, so it is not a HAR.")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);

  await choose(page, { log: { version: "1.2", creator: { name: "x", version: "1" } } });
  await expect(page.getByText("That JSON has no log.entries, so it is not a HAR.")).toBeVisible();

  await choose(page);
  await expect(cards(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Close this recording" }).click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("Click to choose a .har file")).toBeVisible();
});

test("nothing about a recording leaves the tab", async ({ page }) => {
  const outside: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE || "http://localhost:5173") && !url.startsWith("blob:") && !url.startsWith("data:")) {
      outside.push(url);
    }
    return route.continue();
  });

  await openHar(page);
  await choose(page);
  await cards(page).first().getByRole("button").first().click();
  await fill(page, 0, "URL", "contains", "example");

  expect(outside).toEqual([]);
});
