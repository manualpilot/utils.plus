import { expect, Page, test } from "@playwright/test";

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

function decodeHash(url: string): { value?: string; indentSize?: string; showCounts?: boolean } {
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
