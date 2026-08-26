import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const SAMPLE = "Caf\u00E9 \u2615 \u0430pple.com";

const box = (page: Page) => page.getByRole("textbox", { name: "Text", exact: true });
const points = (page: Page) => page.getByRole("textbox", { name: "Code points", exact: true });
const fact = (page: Page, card: string, label: string) =>
  page.locator(`[data-${card}] [data-fact="${label}"] td`).last();
const row = (page: Page, code: string) => page.locator(`[data-characters] [data-code="${code}"]`);
const finding = (page: Page, kind: string) => page.locator(`[data-finding="${kind}"]`);
const key = (page: Page, points: string) => page.locator(`[data-keyboard] [data-key="${points}"]`);

async function openUnicode(page: Page) {
  await page.goto(`${BASE}/unicode`);
  await expect(page.getByRole("heading", { name: "Unicode Inspector" })).toBeVisible();
}

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

async function choose(page: Page, group: string) {
  await page.getByRole("textbox", { name: "Search" }).fill(group);
  await page.getByRole("option", { name: group, exact: true }).click();
  await page.getByRole("textbox", { name: "Search" }).fill("");
}

const shown = (page: Page) => page.locator("[data-keyboard] [role=option][aria-selected=true]");

function chooseMode(page: Page, mode: string) {
  return page.locator(".mantine-SegmentedControl-label", { hasText: mode }).click();
}

test("the sample is read a code point at a time, names and all", async ({ page }) => {
  await openUnicode(page);

  await expect(box(page)).toHaveValue(SAMPLE);
  await expect(page.locator("[data-characters]")).toContainText("16 code points");

  await expect(row(page, "U+00E9")).toContainText("LATIN SMALL LETTER E WITH ACUTE");
  await expect(row(page, "U+2615")).toContainText("HOT BEVERAGE");
  await expect(row(page, "U+0430")).toContainText("CYRILLIC SMALL LETTER A");

  await expect(fact(page, "counts", "Code points")).toHaveText("16");
  await expect(fact(page, "counts", "UTF-8 bytes")).toHaveText("20");
  await expect(fact(page, "counts", "Scripts")).toContainText("Latin");
  await expect(fact(page, "counts", "Scripts")).toContainText("Cyrillic");
});

test("the sample's own findings are the ones this page exists for", async ({ page }) => {
  await openUnicode(page);

  await expect(finding(page, "homoglyph")).toContainText("U+0430");
  await expect(finding(page, "mixed")).toContainText("Latin, Cyrillic");
  await expect(finding(page, "bidi")).toHaveCount(0);
});

test("an override that is never closed is called what it is", async ({ page }) => {
  await openUnicode(page);
  await box(page).fill("if (x) {\u202E return");

  await expect(finding(page, "bidi")).toContainText("left open");
  await expect(finding(page, "bidi")).toContainText("U+202E");
});

test("clicking a row is what the three cards under the table are about", async ({ page }) => {
  await openUnicode(page);
  await row(page, "U+0430").click();

  await expect(fact(page, "character", "Name")).toHaveText("CYRILLIC SMALL LETTER A");
  await expect(fact(page, "character", "Category")).toHaveText("Lowercase letter (Ll)");
  await expect(fact(page, "character", "Looks like")).toHaveText("a in ASCII");
  await expect(fact(page, "encodings", "UTF-8")).toHaveText("D0 B0");
  await expect(fact(page, "escapes", "JSON, Java, C#")).toHaveText("\\u0430");
  await expect(fact(page, "escapes", "URL")).toHaveText("%D0%B0");
});

test("the arrow keys walk the table, and what they land on is what the cards are about", async ({ page }) => {
  await openUnicode(page);
  await row(page, "U+0043").click();

  await page.keyboard.press("ArrowDown");
  await expect(fact(page, "character", "Name")).toHaveText("LATIN SMALL LETTER A");
  await page.keyboard.press("End");
  await expect(fact(page, "character", "Name")).toHaveText("LATIN SMALL LETTER M");
  await page.keyboard.press("Home");
  await expect(fact(page, "character", "Name")).toHaveText("LATIN CAPITAL LETTER C");
});

test("a character that draws nothing is shown as what it is called", async ({ page }) => {
  await openUnicode(page);
  await box(page).fill("in\u200Bvisible");

  await expect(row(page, "U+200B")).toContainText("ZWSP");
  await expect(finding(page, "invisible")).toContainText("U+200B");

  await row(page, "U+200B").click();
  await expect(fact(page, "character", "Name")).toHaveText("ZERO WIDTH SPACE");
  await expect(fact(page, "character", "Abbreviation")).toHaveText("ZWSP");
});

test("the four normal forms say which one the text is already in", async ({ page }) => {
  await openUnicode(page);
  await box(page).fill("Cafe\u0301");

  await expect(page.locator("[data-form=\"NFD\"]")).toContainText("unchanged");
  await expect(page.locator("[data-form=\"NFC\"]")).toContainText("Caf\u00E9");
  await expect(finding(page, "normalisation")).toContainText("Not in NFC");
});

test("the mode switch rewrites the box into the other spelling of the same characters", async ({ page }) => {
  await openUnicode(page);
  await box(page).fill("Hi\u{1F600}");

  await chooseMode(page, "Code points");
  await expect(points(page)).toHaveValue("U+0048 U+0069 U+1F600");
  await expect(page.getByRole("heading", { name: "Unicode Code Points" })).toBeVisible();
  await expect(row(page, "U+1F600")).toContainText("GRINNING FACE");

  await points(page).fill("48 49 &#233;");
  await expect(row(page, "U+00E9")).toBeVisible();

  await chooseMode(page, "Text");
  await expect(box(page)).toHaveValue("HI\u00E9");
});

test("a token that is not a code point says so rather than being dropped", async ({ page }) => {
  await openUnicode(page);
  await chooseMode(page, "Code points");
  await points(page).fill("0041 zzz");

  await expect(page.getByText("zzz is not a code point")).toBeVisible();
});

test("a key types its character into the box, where the caret is", async ({ page }) => {
  await openUnicode(page);
  await box(page).click();
  await page.keyboard.press("Home");

  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "General Punctuation");
  await key(page, "U+2014").click();

  await expect(box(page)).toHaveValue(`\u2014${SAMPLE}`);
  await expect(row(page, "U+2014")).toContainText("EM DASH");
});

test("a character that draws nothing is typed by the name it is known by", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "General Punctuation");

  await expect(key(page, "U+200B")).toHaveText("ZWSP");
  await expect(key(page, "U+2002")).toHaveText("2002");

  await key(page, "U+200B").click();
  await expect(finding(page, "invisible")).toContainText("U+200B");
});

test("what a key types into a list of code points is a code point", async ({ page }) => {
  await openUnicode(page);
  await chooseMode(page, "Code points");
  await points(page).fill("U+0041");

  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "General Punctuation");
  await key(page, "U+2014").click();

  await expect(points(page)).toHaveValue("U+0041 U+2014 ");
});

test("a block is picked from the same list, and its characters are what the keys become", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "Arrows");

  await expect(key(page, "U+2190")).toBeVisible();
  await key(page, "U+2192").click();
  await expect(box(page)).toHaveValue(`${SAMPLE}\u2192`);
});

test("the keyboard opens on emoji, and types the ones no block could", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();

  await expect(shown(page)).toHaveText("Smileys & Emotion");
  await key(page, "U+1F600").click();
  await expect(box(page)).toHaveValue(`${SAMPLE}\u{1F600}`);

  await choose(page, "Flags");
  await key(page, "U+1F1E6 U+1F1FA").click();
  await expect(box(page)).toHaveValue(`${SAMPLE}\u{1F600}\u{1F1E6}\u{1F1FA}`);
  await expect(row(page, "U+1F1FA")).toContainText("REGIONAL INDICATOR SYMBOL LETTER U");
});

test("an emoji is called what the emoji list calls it, its code points having none", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "Flags");

  await expect(key(page, "U+1F1E6 U+1F1FA")).toHaveAttribute("title", "U+1F1E6 U+1F1FA flag: Australia");
});

test("a flag typed into a list of code points is every code point under it", async ({ page }) => {
  await openUnicode(page);
  await chooseMode(page, "Code points");
  await points(page).fill("");

  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "Flags");
  await key(page, "U+1F1E6 U+1F1FA").click();

  await expect(points(page)).toHaveValue("U+1F1E6 U+1F1FA ");
});

test("the keys are one tab stop with the arrows walking between them", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();

  await choose(page, "General Punctuation");
  await key(page, "U+2013").focus();
  await page.keyboard.press("ArrowRight");
  await expect(key(page, "U+2014")).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(box(page)).toHaveValue(`${SAMPLE}\u2014`);
  await expect(key(page, "U+2014")).toBeFocused();
});

test("the groups are a list beside the keys, and a search takes the rest of them out of it", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();

  const list = page.getByRole("listbox", { name: "Characters" });
  await expect(list.getByRole("group", { name: "Emoji" })).toBeVisible();
  await expect(list.getByRole("option", { name: "Basic Latin", exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "Search" }).fill("arrow");
  await expect(list.getByRole("option", { name: "Arrows", exact: true })).toBeVisible();
  await expect(list.getByRole("option", { name: "Basic Latin", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search" }).fill("punctuation");
  await expect(list.getByRole("option", { name: "General Punctuation", exact: true })).toBeVisible();
  await expect(list.getByRole("group", { name: "Emoji" })).toHaveCount(0);

  await page.getByRole("textbox", { name: "Search" }).fill("arrow");

  await list.getByRole("option", { name: "Arrows", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("option", { name: "Supplemental Arrows-A", exact: true })).toBeFocused();

  await page.getByRole("textbox", { name: "Search" }).fill("Nonsense");
  await expect(page.getByText("Nothing is called that.")).toBeVisible();
});

test("the search looks inside the groups, and narrows the one that is picked", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();

  const list = page.getByRole("listbox", { name: "Characters" });
  await page.getByRole("textbox", { name: "Search" }).fill("australia");
  await list.getByRole("option", { name: "Flags", exact: true }).click();

  await expect(page.locator("[data-keyboard] [data-key]")).toHaveCount(1);
  await key(page, "U+1F1E6 U+1F1FA").click();
  await expect(box(page)).toHaveValue(`${SAMPLE}\u{1F1E6}\u{1F1FA}`);

  await page.getByRole("textbox", { name: "Search" }).fill("2192");
  await list.getByRole("option", { name: "Arrows", exact: true }).click();
  await expect(page.locator("[data-keyboard] [data-key]")).toHaveCount(1);
  await expect(key(page, "U+2192")).toBeVisible();

  await page.getByRole("textbox", { name: "Search" }).fill("arrows");
  await expect(page.locator("[data-keyboard] [data-key]")).toHaveCount(112);
});

test("the keyboard and the group it is showing travel in the link", async ({ page }) => {
  await openUnicode(page);
  await page.getByRole("button", { name: "Show the keyboard" }).click();
  await choose(page, "Currency Symbols");

  await expect.poll(() => hashState(page).group).toBe("Currency Symbols");
  const shared = page.url();
  await page.goto(`${BASE}/`);
  await page.goto(shared);

  await expect(shown(page)).toHaveText("Currency Symbols");
  await expect(key(page, "U+20AC")).toBeVisible();

  await page.getByRole("button", { name: "Hide the keyboard" }).click();
  await expect(page.getByRole("listbox", { name: "Characters" })).toHaveCount(0);
});

test("the state travels in the link, the selected character with it", async ({ page }) => {
  await openUnicode(page);
  await box(page).fill("\u0430pple");
  await row(page, "U+006C").click();
  await expect(fact(page, "character", "Name")).toHaveText("LATIN SMALL LETTER L");

  await expect.poll(() => hashState(page).value).toBe("\u0430pple");
  const shared = page.url();
  await page.goto(`${BASE}/`);
  await page.goto(shared);

  await expect(box(page)).toHaveValue("\u0430pple");
  await expect(fact(page, "character", "Name")).toHaveText("LATIN SMALL LETTER L");
});

test("nothing on the page is asked of another host", async ({ page }) => {
  const foreign: string[] = [];
  page.on("request", (request) => {
    if (!new URL(request.url()).host.startsWith("localhost")) foreign.push(request.url());
  });

  await openUnicode(page);
  await box(page).fill("\u4E2D\u6587 \uD55C\uAE00 \u05D0\u05D1");
  await expect(row(page, "U+4E2D")).toContainText("CJK UNIFIED IDEOGRAPH-4E2D");
  await expect(row(page, "U+D55C")).toContainText("HANGUL SYLLABLE HAN");
  await expect(row(page, "U+05D0")).toContainText("HEBREW LETTER ALEF");

  expect(foreign).toEqual([]);
});
