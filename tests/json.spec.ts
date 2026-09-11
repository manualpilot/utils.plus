import { expect, Page, test } from "@playwright/test";
import { tool } from "./tool";

const BASE = process.env.PW_BASE_URL ?? "";

declare const editorView: any;

async function openJson(page: Page) {
  await page.goto(`${BASE}/json`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).editorView !== undefined);
}

const readEditor = () => {
  const head = editorView.state.selection.main.head;
  const line = editorView.state.doc.lineAt(head);
  return {
    value: editorView.state.doc.toString(),
    position: { lineNumber: line.number, column: head - line.from + 1 },
  };
};

function placeCaret(page: Page, lineNumber: number, column: number) {
  return page.evaluate(({ lineNumber, column }) => {
    editorView.focus();
    const line = editorView.state.doc.line(lineNumber);
    editorView.dispatch({ selection: { anchor: line.from + column - 1 } });
  }, { lineNumber, column });
}

interface HashState {
  value?: string;
  indentSize?: string;
  showCounts?: boolean;
  mode?: string;
  query?: string;
  output?: string;
}

function decodeHash(url: string): HashState {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

for (const delay of [0, 5, 10, 30, 100]) {
  test(`typing at delay=${delay}ms keeps the caret where it was typed`, async ({ page }) => {
    await openJson(page);
    await placeCaret(page, 2, 1);

    await page.keyboard.type("0123456789", { delay });

    const result = await page.evaluate(readEditor);
    expect(result.value.split("\n")[1]).toBe("0123456789  \"hello\": \"world\"");
    expect(result.position).toMatchObject({ lineNumber: 2, column: 11 });
  });
}

test("transform buttons still rewrite the document", async ({ page }) => {
  await openJson(page);

  await page.getByRole("button", { name: "Minify" }).click();
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe("{\"hello\":\"world\"}");

  await page.getByRole("button", { name: "Format" }).click();
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe("{\n  \"hello\": \"world\"\n}");

  await page.getByRole("button", { name: "Escape", exact: true }).click();
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe(JSON.stringify("{\n  \"hello\": \"world\"\n}"));

  await page.getByRole("button", { name: "Unescape" }).click();
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe("{\n  \"hello\": \"world\"\n}");
});

test("sort keys rewrites the document alphabetically", async ({ page }) => {
  await openJson(page);

  await page.evaluate(() => {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: "{\"b\":{\"d\":1,\"c\":2},\"a\":[{\"z\":1,\"y\":2}],\"A\":3}",
      },
    });
  });

  await page.getByRole("button", { name: "Sort Keys" }).click();
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe(
      "{\n  \"A\": 3,\n  \"a\": [\n    {\n      \"y\": 2,\n      \"z\": 1\n    }\n  ],\n  \"b\": {\n    \"c\": 2,\n    \"d\": 1\n  }\n}",
    );
});

test("a transform can be undone", async ({ page }) => {
  await openJson(page);

  await page.getByRole("button", { name: "Minify" }).click();
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe("{\"hello\":\"world\"}");

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+z");

  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe("{\n  \"hello\": \"world\"\n}");
});

test("format honours the indent select after typing", async ({ page }) => {
  await openJson(page);
  await placeCaret(page, 3, 2);

  await page.keyboard.type("   ", { delay: 0 });

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "4 Spaces" }).click();
  await page.getByRole("button", { name: "Format" }).click();

  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toBe("{\n    \"hello\": \"world\"\n}");
});

test("the editor works with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host) return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openJson(page);
  await placeCaret(page, 2, 1);
  await page.keyboard.type("\"offline\": 1,", { delay: 0 });

  const result = await page.evaluate(readEditor);
  expect(result.value.split("\n")[1]).toBe("\"offline\": 1,  \"hello\": \"world\"");
  expect(blocked).toEqual([]);
});

test("parse errors are marked in the document", async ({ page }) => {
  await openJson(page);

  await page.evaluate(() => {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: "{ \"unclosed\": " },
    });
  });

  await expect(page.locator(".cm-lint-marker-error").first()).toBeVisible();
});

test("parse error marks clear once the document parses", async ({ page }) => {
  await openJson(page);

  await page.evaluate(() => {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: "{ \"unclosed\": " },
    });
  });
  await expect(page.locator(".cm-lint-marker-error").first()).toBeVisible();

  await page.evaluate(() => {
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: "{ \"closed\": 1 }" },
    });
  });

  await expect(page.locator(".cm-lint-marker-error")).toHaveCount(0);
});

test("the address bar tracks text typed into the editor", async ({ page }) => {
  await openJson(page);
  await placeCaret(page, 2, 1);

  await page.keyboard.type("\"live\": 1,", { delay: 0 });

  await expect
    .poll(async () => decodeHash(page.url()).value)
    .toContain("\"live\": 1,");

  await page.getByRole("button", { name: "Minify" }).click();
  await expect
    .poll(async () => decodeHash(page.url()).value)
    .toBe("{\"live\":1,\"hello\":\"world\"}");
});

test("share link captures text typed into the editor", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openJson(page);
  await placeCaret(page, 2, 1);

  await page.keyboard.type("\"typed\": 1,", { delay: 0 });

  await page.locator("header button").last().click();
  const url = await page.evaluate(() => navigator.clipboard.readText());

  expect(decodeHash(url).value).toContain("\"typed\": 1,");

  await page.goto(url);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).editorView !== undefined);
  await expect
    .poll(async () => (await page.evaluate(readEditor)).value)
    .toContain("\"typed\": 1,");
});

const COUNTS = ".cm-container-count";

const setDocument = (page: Page, text: string) =>
  page.evaluate((text) => {
    editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: text } });
  }, text);

const countsShown = (page: Page) =>
  page.locator(COUNTS).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-count")));

test("the document shows what every container holds", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "{\n  \"a\": [\n    1,\n    2,\n    3\n  ],\n  \"b\": {\n    \"c\": 1\n  }\n}");

  await expect.poll(() => countsShown(page)).toEqual(["2 keys", "3 elements", "1 key"]);

  await setDocument(page, "[\n  {\n    \"x\": 1,\n    \"y\": 2\n  }\n]");
  await expect.poll(() => countsShown(page)).toEqual(["1 element", "2 keys"]);

  await setDocument(page, "{ \"a\": 1, \"b\": 2 }");
  await expect.poll(() => countsShown(page)).toEqual(["2 keys"]);
});

test("a container closed on its own line is labelled before the comma after it", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "{\n  \"a\": [1, 2],\n  \"b\": 3\n}");
  await expect.poll(() => countsShown(page)).toEqual(["2 keys", "2 elements"]);

  const line = await page.evaluate(() =>
    [...document.querySelectorAll(".cm-line")[1].childNodes].map((node) => {
      const element = node instanceof HTMLElement ? node : null;
      if (element?.classList.contains("cm-container-count")) return `«${element.dataset.count}»`;
      return node.textContent ?? "";
    }).join("")
  );

  expect(line).toBe("  \"a\": [1, 2]«2 elements»,");
});

test("the pill sits just past the brace, on the same line", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "[\n  1,\n  2\n]");

  const drawn = await page.evaluate(() => {
    const pill = document.querySelector(".cm-container-count")!;
    const style = getComputedStyle(pill);
    const line = document.querySelectorAll(".cm-line")[0].getBoundingClientRect();
    return {
      box: pill.getBoundingClientRect(),
      line: { left: line.left, top: line.top, bottom: line.bottom, height: line.height },
      radius: parseFloat(style.borderTopLeftRadius),
      background: style.backgroundColor,
    };
  });

  expect(drawn.box.left).toBeGreaterThan(drawn.line.left);
  expect(drawn.box.top).toBeGreaterThanOrEqual(drawn.line.top);
  expect(drawn.box.bottom).toBeLessThanOrEqual(drawn.line.bottom);

  expect(drawn.radius).toBeGreaterThanOrEqual(drawn.box.height / 2);
  expect(drawn.background).not.toBe("rgba(0, 0, 0, 0)");
});

test("the count cannot be selected or copied with the text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openJson(page);

  const text = "[\n  7,\n  8,\n  9\n]";
  await setDocument(page, text);
  await expect.poll(() => countsShown(page)).toEqual(["3 elements"]);

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+c");

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  expect(await page.evaluate(() => window.getSelection()?.toString())).not.toContain("element");
});

test("the Show Counts box turns the pills off and on", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "[\n  1,\n  2\n]");
  await expect.poll(() => countsShown(page)).toEqual(["2 elements"]);

  const box = page.getByRole("checkbox", { name: "Show Counts" });
  await expect(box).toBeChecked();

  await box.uncheck();
  await expect.poll(() => countsShown(page)).toEqual([]);
  expect((await page.evaluate(readEditor)).value).toBe("[\n  1,\n  2\n]");

  await box.check();
  await expect.poll(() => countsShown(page)).toEqual(["2 elements"]);
});

test("the Show Counts box travels in the share link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openJson(page);
  await page.getByRole("checkbox", { name: "Show Counts" }).uncheck();

  await expect.poll(async () => decodeHash(page.url()).showCounts).toBe(false);

  await page.locator("header button").last().click();
  const url = await page.evaluate(() => navigator.clipboard.readText());

  await page.goto(url);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).editorView !== undefined);

  await expect(page.getByRole("checkbox", { name: "Show Counts" })).not.toBeChecked();
  await expect.poll(() => countsShown(page)).toEqual([]);
});

declare const jsonResult: any;

const readResult = (page: Page) => page.evaluate(() => (window as any).jsonResult?.state.doc.toString() ?? null);

const caretAt = (page: Page, offset: number) =>
  page.evaluate((offset) => {
    editorView.focus();
    editorView.dispatch({ selection: { anchor: offset } });
  }, offset);

const modeTab = (page: Page, name: string) =>
  page.locator(".mantine-SegmentedControl-label", { hasText: name }).click();

const valueOf = async (page: Page) => (await page.evaluate(readEditor)).value;

test("format keeps a number JavaScript cannot hold and both entries under one key", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "{\"id\":12345678901234567890,\"a\":1,\"a\":2}");

  await page.getByRole("button", { name: "Format" }).click();
  await expect.poll(() => valueOf(page)).toBe("{\n  \"id\": 12345678901234567890,\n  \"a\": 1,\n  \"a\": 2\n}");
});

test("repair turns near-JSON into JSON and says what it fixed", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "{a: 1, // note\n b: 'x',}");

  await page.getByRole("button", { name: "Transform" }).click();
  await page.getByRole("menuitem", { name: /^Repair/ }).click();

  await expect.poll(() => valueOf(page)).toBe("{\n  \"a\": 1,\n  \"b\": \"x\"\n}");
  await expect(page.getByText(/^Repaired: 1 comment removed, 1 trailing comma removed/)).toBeVisible();
});

test("a transform that cannot run says why, until the document changes", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "{\"a\": ");

  await page.getByRole("button", { name: "Minify" }).click();
  await expect(page.getByText(/^Not valid JSON at line 1, column \d+$/)).toBeVisible();
  expect(await valueOf(page)).toBe("{\"a\": ");

  await caretAt(page, 6);
  await page.keyboard.type("1}", { delay: 0 });
  await expect(page.getByText(/^Not valid JSON/)).toBeHidden();
});

test("expand embedded JSON opens up a string holding a document", async ({ page }) => {
  await openJson(page);
  await setDocument(page, JSON.stringify({ body: JSON.stringify({ a: 1 }) }));

  await page.getByRole("button", { name: "Transform" }).click();
  await page.getByRole("menuitem", { name: /^Expand embedded JSON/ }).click();

  await expect.poll(() => valueOf(page)).toBe("{\n  \"body\": {\n    \"a\": 1\n  }\n}");
  await expect(page.getByText("Expanded 1 embedded document")).toBeVisible();
});

test("an array becomes JSON Lines and back, with no fault marked in between", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "[{\"a\":1},{\"b\":2}]");

  await page.getByRole("button", { name: "Transform" }).click();
  await page.getByRole("menuitem", { name: /^Array to JSON Lines/ }).click();
  await expect.poll(() => valueOf(page)).toBe("{\"a\":1}\n{\"b\":2}\n");

  await page.waitForTimeout(LINT_SETTLE_MS);
  await expect(page.locator(".cm-lint-marker-error")).toHaveCount(0);

  await page.getByRole("button", { name: "Transform" }).click();
  await page.getByRole("menuitem", { name: /^JSON Lines to array/ }).click();
  await expect.poll(() => valueOf(page)).toBe("[\n  {\n    \"a\": 1\n  },\n  {\n    \"b\": 2\n  }\n]");
});

const LINT_SETTLE_MS = 1500;

test("fold shows a level at a time, and the folded lines keep their counts", async ({ page }) => {
  await openJson(page);
  await setDocument(page, "{\n  \"a\": {\n    \"x\": 1,\n    \"y\": 2\n  },\n  \"b\": [\n    1\n  ]\n}");

  await page.getByRole("button", { name: "Fold" }).click();
  await page.getByRole("menuitem", { name: "Show 1 level" }).click();
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(2);
  await expect.poll(() => countsShown(page)).toEqual(["2 keys", "2 keys", "1 element"]);

  await page.getByRole("button", { name: "Fold" }).click();
  await page.getByRole("menuitem", { name: "Collapse all" }).click();
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(1);

  await page.getByRole("button", { name: "Fold" }).click();
  await page.getByRole("menuitem", { name: "Expand all" }).click();
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(0);
  expect(await valueOf(page)).toBe("{\n  \"a\": {\n    \"x\": 1,\n    \"y\": 2\n  },\n  \"b\": [\n    1\n  ]\n}");
});

test("the status bar names the path at the caret, and copies it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openJson(page);
  const text = "{\"users\": [{\"name\": \"x\"}, {\"first name\": \"y\"}]}";
  await setDocument(page, text);

  await caretAt(page, text.indexOf("y\""));
  await expect(page.getByTestId("caret-path")).toHaveText("$.users[1]['first name']");

  await page.getByRole("button", { name: "Copy the path at the caret" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("$.users[1]['first name']");
});

const QUERY_DOCUMENT = "{\"users\": [{\"name\": \"x\"}, {\"name\": \"y\"}]}";

async function openQuery(page: Page) {
  await openJson(page);
  await setDocument(page, QUERY_DOCUMENT);
  await modeTab(page, "Query");
  await page.getByLabel("JSONPath").fill("$.users[*].name");
}

test("a query shows its matches beside the document, and follows it as it is typed", async ({ page }) => {
  await openQuery(page);

  await expect.poll(() => readResult(page)).toBe("[\n  \"x\",\n  \"y\"\n]");
  await expect(tool(page).getByText("2 matches")).toBeVisible();

  await setDocument(page, "{\"users\": [{\"name\": \"z\"}]}");
  await expect.poll(() => readResult(page)).toBe("[\n  \"z\"\n]");
  await expect(page.getByText("1 match", { exact: true })).toBeVisible();

  await page.getByRole("combobox", { name: "Result" }).click();
  await page.getByRole("option", { name: "Paths" }).click();
  await expect.poll(() => readResult(page)).toBe("[\n  \"$['users'][0]['name']\"\n]");
});

test("the result is for reading, and cannot be typed into", async ({ page }) => {
  await openQuery(page);
  await expect(page.locator(".cm-content[aria-label=\"Query result\"]")).toHaveAttribute("contenteditable", "false");
});

test("a query that does not read says where, and the result waits for it", async ({ page }) => {
  await openQuery(page);
  await page.getByLabel("JSONPath").fill("$.users[");

  await expect(page.getByText(/^expected a name, an index, a slice, \* or a filter at column 9$/)).toBeVisible();
  await expect(page.getByText("Nothing to show until the query reads")).toBeVisible();
});

test("switching mode keeps the document's editor and its history", async ({ page }) => {
  await openJson(page);
  await page.evaluate(() => {
    (window as any).firstView = editorView;
  });
  await placeCaret(page, 2, 1);
  await page.keyboard.type("\"kept\": 1,", { delay: 0 });

  await modeTab(page, "Query");
  await expect.poll(() => readResult(page)).not.toBeNull();
  await modeTab(page, "Edit");
  await expect.poll(() => readResult(page)).toBeNull();

  expect(await page.evaluate(() => (window as any).firstView === editorView)).toBe(true);
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => valueOf(page)).toBe("{\n  \"hello\": \"world\"\n}");
});

test("the link carries the query and the mode, and leaves the indent off while Query is showing", async ({ page }) => {
  await openQuery(page);

  await expect.poll(() => decodeHash(page.url())).toMatchObject({ mode: "query", query: "$.users[*].name" });
  expect(decodeHash(page.url()).indentSize).toBeUndefined();

  await page.reload();
  await page.waitForFunction(() => (window as any).editorView !== undefined);
  await expect(page.getByLabel("JSONPath")).toHaveValue("$.users[*].name");
  await expect.poll(() => readResult(page)).toBe("[\n  \"x\",\n  \"y\"\n]");
});
