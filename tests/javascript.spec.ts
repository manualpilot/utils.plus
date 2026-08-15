import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const BOOT = 60000;

declare const javascriptEditor: any;

async function openJavaScript(page: Page) {
  await page.goto(`${BASE}/javascript`);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await page.waitForFunction(() => (window as any).javascriptEditor !== undefined);
}

function setScript(page: Page, code: string) {
  return page.evaluate((code) => {
    javascriptEditor.dispatch({ changes: { from: 0, to: javascriptEditor.state.doc.length, insert: code } });
  }, code);
}

const output = (page: Page) => page.getByRole("log", { name: "Script output" });
const variables = (page: Page) => page.getByRole("tree", { name: "Variables" });
const run = (page: Page) => page.getByRole("button", { name: "Run" }).click();

const transcript = (page: Page) => page.getByRole("log", { name: "REPL output" });
const prompt = (page: Page) => page.getByRole("textbox", { name: "JavaScript prompt" });

async function openRepl(page: Page) {
  await openJavaScript(page);
  await switchTo(page, "REPL");
  await expect(prompt(page)).toBeFocused();
}

async function enter(page: Page, text: string) {
  await prompt(page).fill(text);
  await prompt(page).press("Enter");
}

const outputText = (page: Page) => output(page).textContent();

const switchTo = (page: Page, mode: string) => page.getByText(mode, { exact: true }).click();

const setLanguage = (page: Page, name: string) => page.getByLabel("Language").getByText(name, { exact: true }).click();

function decodeHash(url: string): { mode?: string; language?: string; code?: string; line?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

async function runScript(page: Page, code: string) {
  await setScript(page, code);
  await run(page);
}

test("a script runs and its output is what the engine printed", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "console.log('hello from', 2 + 3);\n");

  await expect(output(page)).toHaveText("hello from 5", { timeout: BOOT });
  await expect(page.getByText(/^Finished in /).first()).toBeVisible();
});

test("a finished run leaves its stats under the output", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "console.log('one');\nconsole.log('two');\n");

  await expect(page.getByText(/^Finished in \d+\.\d\ds · 2 lines$/)).toBeVisible({ timeout: BOOT });
  await expect(outputText(page)).resolves.toBe("one\ntwo\n");

  await runScript(page, "const quiet = 1;\n");
  await expect(page.getByText(/^Finished in \d+\.\d\ds · no output$/)).toBeVisible({ timeout: 10000 });
});

test("console.error lands in the same output as console.log", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "console.log('out');\nconsole.error('err');\n");

  await expect.poll(() => outputText(page), { timeout: BOOT }).toBe("out\nerr\n");
});

test("a second run reuses the engine the first one started", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "console.log('first');\n");
  await expect(output(page)).toHaveText("first", { timeout: BOOT });

  await runScript(page, "console.log('second');\n");
  await expect(output(page)).toHaveText("second", { timeout: 10000 });
});

test("a run starts on nothing the run before it left behind", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "let kept = 1;\nconsole.log('set');\n");
  await expect(output(page)).toHaveText("set", { timeout: BOOT });

  await runScript(page, "console.log(typeof kept);\n");
  await expect(output(page)).toHaveText("undefined", { timeout: 10000 });
});

test("a script that declares a name can be run twice", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "const only = 1;\nconsole.log(only);\n");
  await expect(output(page)).toHaveText("1", { timeout: BOOT });

  await run(page);
  await expect(output(page)).toHaveText("1", { timeout: 10000 });
  await expect(output(page)).not.toContainText("redeclaration");
});

test("a stack opens on the line of the script that threw", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "function boom() {\n  throw new TypeError('nope');\n}\n\nboom();\n");

  const text = output(page);
  await expect(text).toContainText("TypeError: nope", { timeout: BOOT });
  await expect(text).toContainText("at boom (<script>:2");
  await expect(text).toContainText("at <eval> (<script>:5");
  await expect(text).not.toContainText("runtime.js");
});

test("a script that cannot be parsed says so", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "const broken = (;\n");

  await expect(output(page)).toContainText("SyntaxError", { timeout: BOOT });
});

test("output written before a failure survives it", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "console.log('before');\nthrow new Error('after');\n");

  await expect(output(page)).toContainText("before", { timeout: BOOT });
  await expect(output(page)).toContainText("Error: after");
});

test("output arrives while the script is still running", async ({ page }) => {
  await openJavaScript(page);
  await runScript(
    page,
    "console.log('first');\nconst until = Date.now() + 3000;\nwhile (Date.now() < until) {}\nconsole.log('last');\n",
  );

  await expect(output(page)).toHaveText("first", { timeout: BOOT });
  await expect(page.getByText("Running…")).toBeVisible();

  await expect.poll(() => outputText(page), { timeout: 10000 }).toBe("first\nlast\n");
});

test("a script that never ends can be stopped", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "while (true) {}\n");
  await expect(page.getByText(/^(Starting JavaScript|Running)/)).toBeVisible({ timeout: BOOT });

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();

  await runScript(page, "console.log('after');\n");
  await expect(output(page)).toHaveText("after", { timeout: BOOT });
});

test("what a stopped script printed is kept", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "console.log('printed before the loop');\nwhile (true) {}\n");
  await expect(output(page)).toContainText("printed before the loop", { timeout: BOOT });

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
  await expect(output(page)).toContainText("printed before the loop");
});

test("a script that never stops printing leaves the page usable", { tag: "@slow" }, async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "let i = 0;\nwhile (true) console.log('flood', i++);\n");
  await expect(page.getByText("… earlier output dropped")).toBeVisible({ timeout: BOOT });

  const kept = await outputText(page);
  expect(kept!.length).toBeLessThan(200 * 1024);
  expect(kept).toMatch(/flood \d+\n$/);

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();

  await runScript(page, "console.log('after the flood');\n");
  await expect(output(page)).toHaveText("after the flood", { timeout: BOOT });
});

test("Stop is only offered while something is running", async ({ page }) => {
  await openJavaScript(page);
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();

  await runScript(page, "while (true) {}\n");
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
});

test("a run waits for the timers it set", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "setTimeout(() => console.log('later'), 50);\nconsole.log('now');\n");

  await expect.poll(() => outputText(page), { timeout: BOOT }).toBe("now\nlater\n");
});

test("the variables panel lists what a run defined", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "const count = 3;\nlet greeting = 'hi';\n");

  const tree = variables(page);
  await expect(tree.getByRole("treeitem").filter({ hasText: "count" })).toContainText("3", { timeout: BOOT });
  await expect(tree.getByRole("treeitem").filter({ hasText: "greeting" })).toContainText("'hi'");
  await expect(tree).not.toContainText("globalThis");
});

test("functions are gathered under a heading that opens closed", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "function helper() {}\nclass Box {}\nconst mine = 1;\n");

  const tree = variables(page);
  await expect(tree.getByRole("treeitem").filter({ hasText: "mine" })).toBeVisible({ timeout: BOOT });
  await expect(tree).not.toContainText("function helper()");

  await tree.getByRole("treeitem").filter({ hasText: "Functions" }).first().click();
  await expect(tree.getByRole("treeitem").filter({ hasText: "helper" }).first()).toContainText("function");
  await expect(tree.getByRole("treeitem").filter({ hasText: "Box" }).first()).toContainText("class");
});

test("an object opens to what is inside it and a plain value does not", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "const data = { a: [1, 2], b: null };\nconst total = 7;\n");

  const tree = variables(page);
  const data = tree.getByRole("treeitem").filter({ hasText: "data" }).first();
  await expect(data).toContainText("Object", { timeout: BOOT });

  await data.click();
  await expect(tree.getByRole("treeitem").filter({ hasText: /^a/ }).first()).toContainText("Array (2)");

  await tree.getByRole("treeitem").filter({ hasText: /^a/ }).first().click();
  await expect(tree.getByRole("treeitem").filter({ hasText: /^0/ })).toContainText("1");

  await tree.getByRole("treeitem").filter({ hasText: "total" }).click();
  await expect(tree.getByRole("treeitem").filter({ hasText: "total" })).toHaveText(/number7/);
});

test("the panel is disabled while a script runs", async ({ page }) => {
  await openJavaScript(page);
  await runScript(page, "const kept = 1;\nconsole.log('going');\n");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "kept" })).toBeVisible({ timeout: BOOT });

  await runScript(page, "while (true) {}\n");
  await expect(page.getByText("Variables are read when the run ends.")).toBeVisible();
  await expect(page.locator("[aria-disabled=true]").filter({ hasText: "Variables are read" })).toBeVisible();

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("The run was stopped before its variables could be read.")).toBeVisible();
});

test("the grip drags the panel wider and the arrow keys move it too", async ({ page }) => {
  await openJavaScript(page);
  const panel = page.locator(".split-panel");
  const started = (await panel.boundingBox())!.width;

  const grip = page.getByRole("separator", { name: "Resize the variables panel" });
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  const dragged = (await panel.boundingBox())!.width;
  expect(dragged).toBeGreaterThan(started + 100);

  await grip.focus();
  await page.keyboard.press("ArrowRight");
  expect((await panel.boundingBox())!.width).toBeLessThan(dragged);
});

test("a narrow region stacks the panel under the editor", async ({ page }) => {
  await openJavaScript(page);
  const editor = page.locator(".split-main");
  const panel = page.locator(".split-panel");
  expect((await panel.boundingBox())!.y).toBeCloseTo((await editor.boundingBox())!.y, 0);

  await page.setViewportSize({ width: 700, height: 800 });
  await expect(page.getByRole("separator", { name: "Resize the variables panel" })).toBeHidden();
  expect((await panel.boundingBox())!.y).toBeGreaterThan((await editor.boundingBox())!.y);
});

test("TypeScript is erased rather than checked, and what is left runs", async ({ page }) => {
  await openJavaScript(page);
  await setLanguage(page, "TypeScript");
  await runScript(
    page,
    "interface Shape { size: number }\nconst box: Shape = { size: 2 };\nconsole.log(box.size * 3);\n",
  );

  await expect(output(page)).toHaveText("6", { timeout: BOOT });
});

test("the language switch replaces the sample but never somebody's own script", async ({ page }) => {
  await openJavaScript(page);
  const document = () => page.evaluate(() => javascriptEditor.state.doc.toString());

  const sample = await document();
  await setLanguage(page, "TypeScript");
  await expect.poll(document).not.toBe(sample);
  await expect.poll(document).toContain("interface Reading");

  await setScript(page, "const mine = 1;\n");
  await setLanguage(page, "JavaScript");
  await expect.poll(document).toBe("const mine = 1;\n");
});

test("REPL takes the page from the editor", async ({ page }) => {
  await openRepl(page);

  await expect(page.locator(".cm-editor")).toHaveCount(0);
  await expect(page.getByText("JavaScript starts on the first line entered here.")).toBeVisible();
  await expect(variables(page)).toHaveCount(0);
  await expect(page.getByText("Nothing has been entered yet.")).toBeVisible();

  await switchTo(page, "Script");
  await expect(page.locator(".cm-editor")).toHaveCount(1);
});

test("the script is still there after a look at the REPL", async ({ page }) => {
  await openJavaScript(page);
  await setScript(page, "console.log('kept');\n");

  await switchTo(page, "REPL");
  await switchTo(page, "Script");
  await page.waitForFunction(() => (window as any).javascriptEditor !== undefined);
  await expect
    .poll(async () => page.evaluate(() => javascriptEditor.state.doc.toString()))
    .toBe("console.log('kept');\n");
});

test("an entry runs and what it printed is under the line that printed it", async ({ page }) => {
  await openRepl(page);
  await enter(page, "console.log('hello from', 2 + 3)");

  await expect(transcript(page)).toContainText("> console.log('hello from', 2 + 3)", { timeout: BOOT });
  await expect(transcript(page)).toContainText("hello from 5");
});

test("an expression is answered by its value and a statement by nothing", async ({ page }) => {
  await openRepl(page);
  await enter(page, "2 ** 8");
  await expect(transcript(page)).toContainText("256", { timeout: BOOT });

  await enter(page, "const quiet = 1");
  await expect(transcript(page)).not.toContainText("undefined");
});

test("the names an entry binds are there at the next one", async ({ page }) => {
  await openRepl(page);
  await enter(page, "let x = 41");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "x" })).toContainText("41", { timeout: BOOT });

  await enter(page, "x + 1");
  await expect(transcript(page)).toContainText("42");
});

test("the same declaration can be entered twice", async ({ page }) => {
  await openRepl(page);
  await enter(page, "let twice = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "twice" })).toContainText("1", {
    timeout: BOOT,
  });

  await enter(page, "let twice = 2");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "twice" })).toContainText("2");
  await expect(transcript(page)).not.toContainText("redeclaration");
});

test("the panel is re-read after every entry", async ({ page }) => {
  await openRepl(page);
  await enter(page, "const first = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "first" })).toBeVisible({ timeout: BOOT });

  await enter(page, "const second = [1, 2]");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "second" })).toContainText("Array (2)");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "first" })).toBeVisible();
});

test("a block asks for the rest of itself and runs when it is closed", async ({ page }) => {
  await openRepl(page);
  await enter(page, "for (const word of ['one', 'two']) {");
  await expect(transcript(page)).toContainText("> for (const word of ['one', 'two']) {");
  await expect(transcript(page)).not.toContainText("ONE");
  await expect(page.getByText(/^(Starting JavaScript|Running)/)).toBeHidden();

  await enter(page, "  console.log(word.toUpperCase());");
  await expect(transcript(page)).toContainText("... console.log(word.toUpperCase());");
  await expect(transcript(page)).not.toContainText("ONE");

  await enter(page, "}");
  await expect(transcript(page)).toContainText("ONE", { timeout: BOOT });
  await expect(transcript(page)).toContainText("TWO");
});

test("a failing entry answers with a stack of the line somebody wrote", async ({ page }) => {
  await openRepl(page);
  await enter(page, "nope()");

  await expect(transcript(page)).toContainText("ReferenceError", { timeout: BOOT });
  await expect(transcript(page)).toContainText("<repl>");
  await expect(transcript(page)).not.toContainText("runtime.js");

  await enter(page, "2 ** 8");
  await expect(transcript(page)).toContainText("256");
});

test("output arrives while the entry is still running", async ({ page }) => {
  await openRepl(page);
  await enter(
    page,
    "console.log('first'); const until = Date.now() + 3000; while (Date.now() < until) {} console.log('last')",
  );

  await expect(transcript(page)).toContainText("first", { timeout: BOOT });
  await expect(page.getByText("Running…")).toBeVisible();

  await expect(transcript(page)).toContainText("last", { timeout: 10000 });
});

test("a line that never returns can be stopped", async ({ page }) => {
  await openRepl(page);
  await enter(page, "let kept = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "kept" })).toBeVisible({ timeout: BOOT });

  await enter(page, "while (true) console.log('spinning')");
  await expect(page.getByText("Running…")).toBeVisible();

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
  await expect(transcript(page)).toContainText("spinning");
  await expect(transcript(page)).toContainText("Stopped, and the session's names went with the engine.");
  await expect(page.getByText("The engine was stopped, and the session's names went with it.")).toBeVisible();

  await enter(page, "kept");
  await expect(transcript(page)).toContainText("ReferenceError", { timeout: BOOT });
});

test("Escape drops the block at the prompt", async ({ page }) => {
  await openRepl(page);
  await enter(page, "function f() {");
  await expect(transcript(page)).toContainText("> function f() {");

  await prompt(page).press("Escape");
  await expect(transcript(page)).toContainText("Abandoned, so none of it ran.");

  await enter(page, "2 ** 8");
  await expect(transcript(page)).toContainText("256", { timeout: BOOT });
});

test("the arrow keys walk back through what has been entered", async ({ page }) => {
  await openRepl(page);
  await enter(page, "const first = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "first" })).toBeVisible({ timeout: BOOT });
  await enter(page, "const second = 2");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "second" })).toBeVisible();

  await prompt(page).press("ArrowUp");
  await expect(prompt(page)).toHaveValue("const second = 2");
  await prompt(page).press("ArrowUp");
  await expect(prompt(page)).toHaveValue("const first = 1");
  await prompt(page).press("ArrowDown");
  await expect(prompt(page)).toHaveValue("const second = 2");
  await prompt(page).press("ArrowDown");
  await expect(prompt(page)).toHaveValue("");
});

test("the address bar tracks the script, the mode, the language and the line at the prompt", async ({ page }) => {
  await openJavaScript(page);
  await setScript(page, "console.log('shared');\n");

  await expect.poll(async () => decodeHash(page.url()).code).toBe("console.log('shared');\n");

  await switchTo(page, "REPL");
  await expect.poll(async () => decodeHash(page.url()).mode).toBe("repl");
  await expect.poll(async () => decodeHash(page.url()).code).toBeUndefined();

  await prompt(page).fill("const x = 1");
  await expect.poll(async () => decodeHash(page.url()).line).toBe("const x = 1");

  await setLanguage(page, "TypeScript");
  await expect.poll(async () => decodeHash(page.url()).language).toBe("typescript");
  await expect(page.getByRole("textbox", { name: "TypeScript prompt" })).toBeVisible();
});

test("a shared link opens on the script it was copied from", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openJavaScript(page);
  await setScript(page, "console.log('restored');\n");

  await page.locator("header button").last().click();
  const url = await page.evaluate(() => navigator.clipboard.readText());

  await page.goto(url);
  await page.waitForFunction(() => (window as any).javascriptEditor !== undefined);
  await expect
    .poll(async () => page.evaluate(() => javascriptEditor.state.doc.toString()))
    .toBe("console.log('restored');\n");
});

test("the engine comes from this origin with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host || url.protocol === "blob:") return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openJavaScript(page);
  await runScript(page, "console.log(typeof fetch, [3, 1, 2].toSorted().join(''));\n");

  await expect(output(page)).toHaveText("undefined 123", { timeout: BOOT });
  expect(blocked).toEqual([]);
});
