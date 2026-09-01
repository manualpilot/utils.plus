import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const addressBox = (page: Page) => page.getByRole("textbox", { name: "Address", exact: true });
const prefixBox = (page: Page) => page.getByRole("textbox", { name: "Prefix length" });
const containsBox = (page: Page) => page.getByRole("textbox", { name: "Is inside this block?" });
const splitBox = (page: Page) => page.getByRole("textbox", { name: "Into blocks of" });
const fact = (page: Page, card: string, label: string) =>
  page.locator(`[data-${card}] [data-fact="${label}"] td`).last();

async function openIpAddress(page: Page) {
  await page.goto(`${BASE}/ip-address`);
  await expect(page.getByRole("heading", { name: "IPv4 Address" })).toBeVisible();
}

test("the sample block is read into its mask, its range and its host count", async ({ page }) => {
  await openIpAddress(page);

  await expect(addressBox(page)).toHaveValue("192.168.1.130/26");
  await expect(prefixBox(page)).toHaveValue("26");

  await expect(fact(page, "block", "CIDR")).toHaveText("192.168.1.128/26");
  await expect(fact(page, "block", "Netmask")).toHaveText("255.255.255.192");
  await expect(fact(page, "block", "Wildcard")).toHaveText("0.0.0.63");
  await expect(fact(page, "block", "Broadcast")).toHaveText("192.168.1.191");
  await expect(fact(page, "block", "First host")).toHaveText("192.168.1.129");
  await expect(fact(page, "block", "Last host")).toHaveText("192.168.1.190");
  await expect(fact(page, "block", "Usable hosts")).toHaveText("62");

  await expect(fact(page, "address", "Integer")).toHaveText("3232235906");
  await expect(fact(page, "address", "Binary")).toHaveText("11000000.10101000.00000001.10000010");
  await expect(fact(page, "address", "Reverse DNS")).toHaveText("130.1.168.192.in-addr.arpa");
  await expect(page.locator("[data-overview]")).toContainText("Private-Use");
});

test("the prefix field rewrites the suffix on the address", async ({ page }) => {
  await openIpAddress(page);
  await prefixBox(page).fill("24");

  await expect(addressBox(page)).toHaveValue("192.168.1.130/24");
  await expect(fact(page, "block", "CIDR")).toHaveText("192.168.1.0/24");
  await expect(fact(page, "block", "Usable hosts")).toHaveText("254");
});

test("an IPv6 address pasted into the IPv4 mode moves the mode rather than erroring", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("2001:db8:abcd:12::1/64");

  await expect(page.getByRole("heading", { name: "IPv6 Address" })).toBeVisible();
  await expect(fact(page, "address", "Expanded")).toHaveText("2001:0db8:abcd:0012:0000:0000:0000:0001");
  await expect(fact(page, "block", "CIDR")).toHaveText("2001:db8:abcd:12::/64");
  await expect(fact(page, "block", "Netmask")).toHaveText("ffff:ffff:ffff:ffff::");
  await expect(fact(page, "block", "Total addresses")).toHaveText("18,446,744,073,709,551,616");
  await expect(fact(page, "block", "Last address")).toHaveText("2001:db8:abcd:12:ffff:ffff:ffff:ffff");
  await expect(page.locator("[data-block] [data-fact=\"First host\"]")).toHaveCount(0);
  await expect(page.locator("[data-block] [data-fact=\"Broadcast\"]")).toHaveCount(0);
});

test("a whole number is read as the address it is stored as, and read back out as one", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("3232235906");

  await expect(page.locator("[data-overview]")).toContainText("192.168.1.130");
  await expect(fact(page, "address", "Hexadecimal")).toHaveText("0xc0a80182");
});

test("a half-written address says so, and says nothing about a box nobody has filled in", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("192.168.1.256");

  await expect(page.getByText("Four numbers 0 to 255 separated by dots", { exact: false })).toBeVisible();
  await expect(page.locator("[data-overview]")).toHaveCount(0);

  await addressBox(page).fill("");
  await expect(page.getByText("Four numbers 0 to 255 separated by dots", { exact: false })).toHaveCount(0);
});

test("an address or a block is tested against the one on the page", async ({ page }) => {
  await openIpAddress(page);

  await containsBox(page).fill("192.168.1.140");
  await expect(page.locator("[data-contains] [data-verdict]")).toHaveText("Inside");
  await expect(fact(page, "contains", "Offset from the network")).toHaveText("12");

  await containsBox(page).fill("192.168.1.200");
  await expect(page.locator("[data-contains] [data-verdict]")).toHaveText("Outside");

  await containsBox(page).fill("192.168.1.144/28");
  await expect(page.locator("[data-contains] [data-verdict]")).toHaveText("Inside");
  await containsBox(page).fill("192.168.1.0/24");
  await expect(page.locator("[data-contains] [data-verdict]")).toHaveText("Outside");
});

test("a block splits into equal ones, and says how many were left off the list", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("10.0.0.0/8");
  await splitBox(page).fill("24");

  await expect(page.locator("[data-split]")).toContainText("65,536 blocks of /24");
  await expect(page.locator("[data-split]")).toContainText("first 64 are listed");
  await expect(page.locator("[data-split] tbody tr")).toHaveCount(64);
  await expect(page.locator("[data-split] tbody tr").first()).toContainText("10.0.0.0/24");
  await expect(page.locator("[data-split] tbody tr").first()).toContainText("10.0.0.0 – 10.0.0.255");
});

test("the link carries the family, the address and both of the questions asked about it", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("2001:db8::/48");
  await containsBox(page).fill("2001:db8:0:1::/64");
  await splitBox(page).fill("52");
  await expect(page.locator("[data-contains] [data-verdict]")).toHaveText("Inside");

  await expect(page).toHaveURL(/#./);
  const shared = page.url();

  await page.goto(`${BASE}/`);
  await page.goto(shared);
  await expect(page.getByRole("heading", { name: "IPv6 Address" })).toBeVisible();
  await expect(addressBox(page)).toHaveValue("2001:db8::/48");
  await expect(containsBox(page)).toHaveValue("2001:db8:0:1::/64");
  await expect(splitBox(page)).toHaveValue("/52");
});

test("the registries say who administers the block and who it was delegated to", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("8.8.8.8");

  await expect(fact(page, "registry", "Administered by")).toHaveText("Administered by ARIN");
  await expect(fact(page, "registry", "IANA block")).toHaveText("8.0.0.0/8");
  await expect(fact(page, "registry", "Delegated to")).toHaveText("ARIN");
  await expect(fact(page, "registry", "Country")).toContainText("US");
  await expect(fact(page, "registry", "Delegated block")).toHaveText("8.8.8.0 – 8.8.8.255");
});

test("a signed authorisation names the AS allowed to originate the prefix", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("8.8.8.8");

  await expect(page.locator("[data-origin] [data-verdict]")).toHaveText("Authorised origin");
  await expect(page.locator("[data-origin]")).toContainText("AS15169");
  await expect(page.locator("[data-origin] tbody tr").first()).toContainText("8.8.8.0/24");
  await expect(page.locator("[data-origin] tbody tr").first()).toContainText("up to /24");
});

test("an address nobody has signed for says so rather than leaving the card empty", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("192.168.1.1");

  await expect(page.locator("[data-origin] [data-verdict]")).toHaveText("No ROA published");
  await expect(page.locator("[data-origin]")).toContainText("says nothing about who may originate it");
});

test("an authorisation signed far above the address is still found", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("23.1.253.0");

  await expect(page.locator("[data-origin] [data-verdict]")).toHaveText("Authorised origin");
  await expect(page.locator("[data-origin] tbody tr").first()).toContainText("23.0.0.0/12");
  await expect(page.locator("[data-origin]")).toContainText("AS20940");
});

test("an IPv6 address is read against the same three registries", async ({ page }) => {
  await openIpAddress(page);
  await addressBox(page).fill("2001:4860:4860::8888");

  await expect(page.getByRole("heading", { name: "IPv6 Address" })).toBeVisible();
  await expect(fact(page, "registry", "IANA block")).toHaveText("2001:4800::/23");
  await expect(fact(page, "registry", "Delegated to")).toHaveText("ARIN");
  await expect(page.locator("[data-origin] tbody tr").first()).toContainText("2001:4860::/32");
});

test("the AS mode answers from IANA's ranges and the registries' delegations", async ({ page }) => {
  await openIpAddress(page);
  await page.getByRole("radiogroup").getByText("AS", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "AS Number" })).toBeVisible();

  await expect(fact(page, "registry", "IANA range")).toHaveText("AS13312 – AS15359");
  await expect(fact(page, "registry", "Delegated to")).toHaveText("ARIN");
  await expect(fact(page, "registry", "Country")).toContainText("US");
  await expect(page.locator("[data-overview] [data-verdict]")).toHaveText("Delegated to a registry");

  await page.getByRole("textbox", { name: "AS number" }).fill("AS64512");
  await expect(page.locator("[data-overview] [data-verdict]")).toHaveText("Reserved, never delegated");
  await expect(page.locator("[data-overview]")).toContainText("RFC 6996");
});

test("the link carries the AS mode and the number asked about", async ({ page }) => {
  await openIpAddress(page);
  await page.getByRole("radiogroup").getByText("AS", { exact: true }).click();
  await page.getByRole("textbox", { name: "AS number" }).fill("AS3333");
  await expect(page).toHaveURL(/#./);
  const shared = page.url();

  await page.goto(`${BASE}/`);
  await page.goto(shared);
  await expect(page.getByRole("heading", { name: "AS Number" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "AS number" })).toHaveValue("AS3333");
});

test("every registry answer arrives with third-party requests blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openIpAddress(page);
  await addressBox(page).fill("8.8.8.8");
  await expect(fact(page, "registry", "Delegated to")).toHaveText("ARIN");
  await expect(page.locator("[data-origin]")).toContainText("AS15169");
  expect(blocked).toEqual([]);
});
