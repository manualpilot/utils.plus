import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const fact = (page: Page, label: string) => page.locator(`[data-fact="${label}"] td`).last();

const status = (page: Page, which: string) => page.locator(`[data-hex="${which}"]`);

const dump = (page: Page) => page.evaluate(() => window.hexEditor!.state.doc.toString());

const caretByte = (page: Page, perRow: number) =>
  page.evaluate((perRow) => {
    const view = window.hexEditor!;
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    const column = view.state.selection.main.head - line.from;
    let index = 0;
    while (index + 1 < perRow && (index + 1) * 3 + Math.floor((index + 1) / 8) <= column) index++;
    return (line.number - 1) * perRow + index;
  }, perRow);

async function openHex(page: Page) {
  await page.goto(`${BASE}/hex`);
  await expect(page.getByText("Click to choose any file")).toBeVisible();
}

async function choose(page: Page, name: string, buffer: Buffer, mimeType = "application/octet-stream") {
  await page.locator("input[type=\"file\"]").setInputFiles({ name, mimeType, buffer });
  await expect(page.locator(".cm-line").first()).toBeVisible();
}

async function clickByte(page: Page, offset: number, column: "hex" | "text" = "hex", perRow = 16) {
  const width = await page.evaluate(() => window.hexEditor!.defaultCharacterWidth);
  const index = offset % perRow;
  const row = Math.floor(offset / perRow);
  const target = column === "hex" ? page.locator(".cm-line").nth(row) : page.locator(".cm-hex-text").nth(row);

  const at = column === "hex" ? index * 3 + Math.floor(index / 8) : index + 2;
  await target.click({ position: { x: width * (at + 0.5), y: 4 } });
}

test("a chosen file is laid out byte by byte, and read for what it is", async ({ page }) => {
  await openHex(page);
  await choose(page, "note.txt", Buffer.from("Hello, hex!"), "text/plain");

  await expect(fact(page, "Name")).toHaveText("note.txt");
  await expect(fact(page, "Looks like")).toHaveText("Text (UTF-8)");
  await expect(fact(page, "Size")).toHaveText("11 bytes");

  await expect(dump(page)).resolves.toBe("48 65 6c 6c 6f 2c 20 68  65 78 21" + " ".repeat(15));
  await expect(page.locator(".cm-line")).toHaveCount(1);
  await expect(page.locator(".cm-hex-text")).toHaveText("Hello, hex!     ");
  await expect(page.locator(".cm-lineNumbers .cm-gutterElement").last()).toHaveText("0000");
});

test("a file with no glyph for a byte draws a full stop and says so in the inspector", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from([0x00, 0x41, 0xff, 0x0a]));

  await expect(page.locator(".cm-hex-text")).toHaveText(".A..            ");

  await expect(fact(page, "UInt8")).toHaveText("0");
  await clickByte(page, 2);
  await expect(fact(page, "UInt8")).toHaveText("255");
  await expect(fact(page, "Int8")).toHaveText("-1");
  await expect(fact(page, "Binary")).toHaveText("11111111");
});

test("typing a pair of digits writes one byte and steps to the next", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from([0x00, 0x00, 0x00]));

  await clickByte(page, 0);
  await page.keyboard.press("4");
  await expect(dump(page)).resolves.toContain("40 00 00");
  await expect(caretByte(page, 16)).resolves.toBe(0);

  await page.keyboard.press("1");
  await expect(dump(page)).resolves.toContain("41 00 00");
  await expect(caretByte(page, 16)).resolves.toBe(1);
  await expect(page.locator(".cm-hex-text")).toHaveText("A..             ");
  await expect(fact(page, "Changed")).toHaveText("1 byte written");
  await expect(page.locator(".cm-content .cm-hex-changed").first()).toHaveText("41");
});

test("the text column types characters, and Put it back undoes the lot", async ({ page }) => {
  await openHex(page);
  await choose(page, "note.txt", Buffer.from("cat"), "text/plain");

  await clickByte(page, 0, "text");
  await expect(page.getByRole("radio", { name: "Type text" })).toBeChecked();
  await page.keyboard.type("bat");
  await expect(dump(page)).resolves.toContain("62 61 74");
  await expect(fact(page, "Changed")).toHaveText("1 byte written");

  await page.getByRole("button", { name: "Put it back" }).click();
  await expect(dump(page)).resolves.toContain("63 61 74");
  await expect(page.getByRole("button", { name: "Put it back" })).toBeHidden();
});

test("a selection is drawn out, filled, and deleted", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from([1, 2, 3, 4, 5, 6]));

  await clickByte(page, 1);
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(status(page, "selection")).toHaveText("3 bytes selected");
  await expect(page.locator(".cm-content .cm-hex-selected").first()).toHaveText("02 03 04");

  await page.getByRole("textbox", { name: "Fill the selection with" }).fill("ff");
  await page.getByRole("button", { name: "Fill 3 bytes" }).click();
  await expect(dump(page)).resolves.toContain("01 ff ff ff 05 06");

  await clickByte(page, 0);
  await page.keyboard.press("Shift+ArrowRight");
  await page.getByRole("button", { name: "Delete 2 bytes" }).click();
  await expect(dump(page)).resolves.toContain("ff ff 05 06");
  await expect(fact(page, "Size")).toHaveText("4 bytes — it arrived as 6 bytes");
});

test("bytes are inserted where the caret is and at the end", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from([1, 2]));

  await clickByte(page, 1);
  await page.getByRole("textbox", { name: "Insert bytes" }).fill("aa bb");
  await page.getByRole("button", { name: "Insert" }).click();
  await expect(dump(page)).resolves.toContain("01 aa bb 02");

  await page.getByRole("combobox", { name: "At", exact: true }).click();
  await page.getByRole("option", { name: "The end" }).click();
  await page.getByRole("textbox", { name: "Insert bytes" }).fill("ff");
  await page.getByRole("button", { name: "Insert" }).click();
  await expect(dump(page)).resolves.toContain("01 aa bb 02 ff");
});

test("a blank field is only Required once it has been asked for", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from([1, 2]));

  await expect(page.getByText("Required")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Insert bytes" }).fill("zz");
  await expect(page.getByText("Pairs of hex digits, spaced however you like.")).toBeVisible();

  await page.getByRole("textbox", { name: "Insert bytes" }).fill("");
  await expect(page.getByText("Required")).toHaveCount(0);
  await page.getByRole("button", { name: "Insert" }).click();
  await expect(page.getByText("Required")).toBeVisible();
});

test("a run of bytes is found, stepped through and gone to", async ({ page }) => {
  await openHex(page);
  await choose(page, "note.txt", Buffer.from("the cat sat on the mat"), "text/plain");

  await page.getByRole("combobox", { name: "As", exact: true }).click();
  await page.getByRole("option", { name: "Text" }).click();
  await page.getByRole("textbox", { name: "Looking for" }).fill("at");

  await expect(status(page, "matches")).toContainText("3 matches");
  await expect(status(page, "selection")).toHaveText("2 bytes selected");
  await expect(status(page, "offset")).toHaveText("Offset 0005 (5)");

  await page.getByRole("button", { name: "Next match" }).click();
  await expect(status(page, "offset")).toHaveText("Offset 0009 (9)");
  await page.getByRole("button", { name: "Previous match" }).click();
  await expect(status(page, "offset")).toHaveText("Offset 0005 (5)");

  await page.getByRole("textbox", { name: "Go to offset" }).fill("0x10");
  await page.getByRole("button", { name: "Go there" }).click();
  await expect(status(page, "offset")).toHaveText("Offset 0010 (16)");
  await expect(caretByte(page, 16)).resolves.toBe(16);
});

test("the edited file is what comes back down", async ({ page }) => {
  await openHex(page);
  await choose(page, "note.txt", Buffer.from("cat"), "text/plain");

  await clickByte(page, 0, "text");
  await page.keyboard.type("b");
  await page.getByRole("textbox", { name: "File name" }).fill("edited.bin");

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const saved = await saving;
  expect(saved.suggestedFilename()).toBe("edited.bin");

  await page.reload();
  await page.locator("input[type=\"file\"]").setInputFiles((await saved.path())!);
  await expect(dump(page)).resolves.toContain("62 61 74");
  await expect(page.locator("[data-fact=\"Changed\"]")).toHaveCount(0);
});

test("the row width and the case of the digits lay the document out again", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from([0xab, 0xcd, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));

  await expect(page.locator(".cm-line")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Bytes per row" }).click();
  await page.getByRole("option", { name: "8", exact: true }).click();
  await expect(page.locator(".cm-line")).toHaveCount(2);
  await expect(dump(page)).resolves.toBe("ab cd ef 01 02 03 04 05\n06" + " ".repeat(21));

  await page.getByRole("switch", { name: "Uppercase hex" }).click();
  await expect(dump(page)).resolves.toContain("AB CD EF");
  await expect(page.locator(".cm-lineNumbers .cm-gutterElement").last()).toHaveText("0008");
});

test("only how the bytes are read crosses the share link", async ({ page }) => {
  await openHex(page);
  await choose(page, "note.txt", Buffer.from("hello"), "text/plain");

  await expect.poll(() => new URL(page.url()).hash).toBe("");

  await page.getByRole("combobox", { name: "Bytes per row" }).click();
  await page.getByRole("option", { name: "8", exact: true }).click();
  await page.getByRole("switch", { name: "Uppercase hex" }).click();
  await expect.poll(() => new URL(page.url()).hash).not.toBe("");

  const link = page.url();
  await page.goto(`${BASE}/`);
  await page.goto(link);
  await expect(page.getByText("Click to choose any file")).toBeVisible();
  await choose(page, "note.txt", Buffer.from("hello"), "text/plain");

  await expect(dump(page)).resolves.toContain("68 65 6C 6C 6F");
  await expect(page.getByRole("textbox", { name: "Go to offset" })).toHaveValue("");
  expect(decodeHash(link)).toEqual({ perRow: 8, upper: true });
});

test("a big file is only ever drawn a screenful at a time", async ({ page }) => {
  await openHex(page);
  await choose(page, "big.bin", Buffer.alloc(1024 * 1024, 0xab));

  await expect(fact(page, "Size")).toHaveText("1.0 MiB");
  expect(await page.evaluate(() => window.hexEditor!.state.doc.lines)).toBe(65536);
  expect(await page.locator(".cm-line").count()).toBeLessThan(80);

  await page.getByRole("textbox", { name: "Go to offset" }).fill("0xffff0");
  await page.getByRole("button", { name: "Go there" }).click();
  await expect(status(page, "offset")).toHaveText("Offset 0ffff0 (1048560)");
  expect(await page.locator(".cm-line").count()).toBeLessThan(80);
});

test("moving the caret does not re-render the cards that are not about it", async ({ page }) => {
  await openHex(page);
  await choose(page, "raw.bin", Buffer.from(Array.from({ length: 4096 }, (_, at) => at % 256)));
  await clickByte(page, 0);

  await page.evaluate(() => {
    const cardOf = (heading: string) => {
      const title = [...document.querySelectorAll("h4")].find((node) => node.textContent === heading);
      return title?.closest(".mantine-Card-root") ?? null;
    };
    (window as unknown as { __churn: Record<string, number> }).__churn = {};
    for (const heading of ["File", "Find", "Edit", "Save"]) {
      const card = cardOf(heading);
      if (!card) continue;
      const churn = (window as unknown as { __churn: Record<string, number> }).__churn;
      churn[heading] = 0;
      new MutationObserver((records) => {
        churn[heading] += records.length;
      }).observe(card, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  });

  for (let at = 0; at < 8; at++) await page.keyboard.press("ArrowRight");
  await expect(caretByte(page, 16)).resolves.toBe(8);

  const churn = await page.evaluate(() => (window as unknown as { __churn: Record<string, number> }).__churn);
  expect(churn).toEqual({ File: 0, Find: 0, Edit: 0, Save: 0 });
});

test("nothing about a file leaves the tab", async ({ page }) => {
  const outside: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE || "http://localhost:5173") && !url.startsWith("blob:") && !url.startsWith("data:")) {
      outside.push(url);
    }
    return route.continue();
  });

  await openHex(page);
  await choose(page, "note.txt", Buffer.from("nothing here is uploaded"), "text/plain");
  await clickByte(page, 0, "text");
  await page.keyboard.type("N");

  expect(outside).toEqual([]);
});

function decodeHash(url: string): Record<string, unknown> {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}
