import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

const BOOT = 120000;

declare const pythonEditor: any;

async function openPython(page: Page) {
  await page.goto(`${BASE}/python`);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await page.waitForFunction(() => (window as any).pythonEditor !== undefined);
}

function setScript(page: Page, code: string) {
  return page.evaluate((code) => {
    pythonEditor.dispatch({ changes: { from: 0, to: pythonEditor.state.doc.length, insert: code } });
  }, code);
}

const output = (page: Page) => page.getByRole("log", { name: "Script output" });
const variables = (page: Page) => page.getByRole("tree", { name: "Variables" });
const run = (page: Page) => page.getByRole("button", { name: "Run" }).click();

const transcript = (page: Page) => page.getByRole("log", { name: "REPL output" });
const prompt = (page: Page) => page.getByRole("textbox", { name: "Python prompt" });

async function openRepl(page: Page) {
  await openPython(page);
  await switchTo(page, "REPL");
  await expect(prompt(page)).toBeFocused();
}

async function enter(page: Page, text: string) {
  await prompt(page).fill(text);
  await prompt(page).press("Enter");
}

const outputText = (page: Page) => output(page).textContent();

const switchTo = (page: Page, mode: string) => page.getByText(mode, { exact: true }).click();

function decodeHash(url: string): { mode?: string; code?: string; line?: string } {
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

test("a script runs and its output is what the interpreter printed", async ({ page }) => {
  await openPython(page);
  await runScript(page, "print('hello from', 2 + 3)\n");

  await expect(output(page)).toHaveText("hello from 5", { timeout: BOOT });
  await expect(page.getByText(/^Finished in /).first()).toBeVisible();
});

test("a finished run leaves its stats under the output", async ({ page }) => {
  await openPython(page);
  await runScript(page, "print('one')\nprint('two')\n");

  await expect(page.getByText(/^Finished in \d+\.\d\ds · 2 lines$/)).toBeVisible({ timeout: BOOT });
  await expect(outputText(page)).resolves.toBe("one\ntwo\n");

  await runScript(page, "pass\n");
  await expect(page.getByText(/^Finished in \d+\.\d\ds · no output$/)).toBeVisible({ timeout: 10000 });
});

test("stderr lands in the same output as stdout", async ({ page }) => {
  await openPython(page);
  await runScript(page, "import sys\nprint('out')\nprint('err', file=sys.stderr)\n");

  await expect.poll(() => outputText(page), { timeout: BOOT }).toBe("out\nerr\n");
});

test("a second run reuses the interpreter the first one started", async ({ page }) => {
  await openPython(page);
  await runScript(page, "print('first')\n");
  await expect(output(page)).toHaveText("first", { timeout: BOOT });

  await runScript(page, "print('second')\n");
  await expect(output(page)).toHaveText("second", { timeout: 10000 });
});

test("a run starts on nothing the run before it left behind", async ({ page }) => {
  await openPython(page);
  await runScript(page, "kept = 1\nprint('set')\n");
  await expect(output(page)).toHaveText("set", { timeout: BOOT });

  await runScript(page, "print(kept)\n");
  await expect(output(page)).toContainText("NameError", { timeout: 10000 });
});

test("a traceback opens on the line of the script that raised", async ({ page }) => {
  await openPython(page);
  await runScript(page, "def boom():\n    raise ValueError('nope')\n\nboom()\n");

  const text = output(page);
  await expect(text).toContainText("ValueError: nope", { timeout: BOOT });
  await expect(text).toContainText("line 4, in <module>");
  await expect(text).toContainText("line 2, in boom");
  await expect(text).not.toContainText("python-worker");
});

test("a script that cannot be compiled says so where it broke", async ({ page }) => {
  await openPython(page);
  await runScript(page, "def broken(:\n");

  await expect(output(page)).toContainText("SyntaxError", { timeout: BOOT });
  await expect(output(page)).toContainText("line 1");
});

test("output written before a failure survives it", async ({ page }) => {
  await openPython(page);
  await runScript(page, "print('before')\nraise SystemExit(3)\n");

  await expect(output(page)).toContainText("before", { timeout: BOOT });
  await expect(output(page)).toContainText("SystemExit: 3");
});

test("output arrives while the script is still running", async ({ page }) => {
  await openPython(page);
  await runScript(page, "import time\nprint('first')\ntime.sleep(3)\nprint('last')\n");

  await expect(output(page)).toHaveText("first", { timeout: BOOT });
  await expect(page.getByText("Running…")).toBeVisible();

  await expect.poll(() => outputText(page), { timeout: 10000 }).toBe("first\nlast\n");
});

test("a line with no newline on the end still arrives", async ({ page }) => {
  await openPython(page);
  await runScript(page, "import sys\nsys.stdout.write('no newline')\n");

  await expect.poll(() => outputText(page), { timeout: BOOT }).toBe("no newline");
});

test("a script that never ends can be stopped", async ({ page }) => {
  await openPython(page);
  await runScript(page, "while True:\n    pass\n");
  await expect(page.getByText(/^(Starting Python|Running)/)).toBeVisible({ timeout: BOOT });

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();

  await runScript(page, "print('after')\n");
  await expect(output(page)).toHaveText("after", { timeout: BOOT });
});

test("what a stopped script printed is kept", async ({ page }) => {
  await openPython(page);
  await runScript(page, "print('printed before the loop')\nwhile True:\n    pass\n");
  await expect(output(page)).toContainText("printed before the loop", { timeout: BOOT });

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
  await expect(output(page)).toContainText("printed before the loop");
});

test("a script that never stops printing leaves the page usable", { tag: "@slow" }, async ({ page }) => {
  await openPython(page);
  await runScript(page, "i = 0\nwhile True:\n    print('flood', i)\n    i += 1\n");
  await expect(page.getByText("… earlier output dropped")).toBeVisible({ timeout: BOOT });

  const kept = await outputText(page);
  expect(kept!.length).toBeLessThan(200 * 1024);
  expect(kept).toMatch(/flood \d+\n$/);

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();

  await runScript(page, "print('after the flood')\n");
  await expect(output(page)).toHaveText("after the flood", { timeout: BOOT });
});

test("Stop is only offered while something is running", async ({ page }) => {
  await openPython(page);
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();

  await runScript(page, "while True:\n    pass\n");
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
});

test("the variables panel lists what a run defined", async ({ page }) => {
  await openPython(page);
  await runScript(page, "count = 3\ngreeting = 'hi'\n");

  const tree = variables(page);
  await expect(tree.getByRole("treeitem").filter({ hasText: "count" })).toContainText("3", { timeout: BOOT });
  await expect(tree.getByRole("treeitem").filter({ hasText: "greeting" })).toContainText("'hi'");
  await expect(tree).not.toContainText("__builtins__");
});

test("imported names are gathered under a heading that opens closed", async ({ page }) => {
  await openPython(page);
  await runScript(page, "import sys\nfrom datetime import timezone\nmine = 1\n");

  const tree = variables(page);
  await expect(tree.getByRole("treeitem").filter({ hasText: "mine" })).toBeVisible({ timeout: BOOT });
  await expect(tree).not.toContainText("<module 'sys'");

  await tree.getByRole("treeitem").filter({ hasText: "Imported" }).first().click();
  await expect(tree.getByRole("treeitem").filter({ hasText: "sys" }).first()).toContainText("module");
  await expect(tree.getByRole("treeitem").filter({ hasText: "timezone" }).first()).toBeVisible();
});

test("an object opens to what is inside it and a plain value does not", async ({ page }) => {
  await openPython(page);
  await runScript(page, "data = {'a': [1, 2], 'b': None}\ntotal = 7\n");

  const tree = variables(page);
  const data = tree.getByRole("treeitem").filter({ hasText: "data" }).first();
  await expect(data).toContainText("dict (2)", { timeout: BOOT });

  await data.click();
  await expect(tree.getByRole("treeitem").filter({ hasText: "'a'" }).first()).toContainText("list (2)");

  await tree.getByRole("treeitem").filter({ hasText: "'a'" }).first().click();
  await expect(tree.getByRole("treeitem").filter({ hasText: /^0/ })).toContainText("1");

  await tree.getByRole("treeitem").filter({ hasText: "total" }).click();
  await expect(tree.getByRole("treeitem").filter({ hasText: "total" })).toHaveText(/int7/);
});

test("the panel is disabled while a script runs", async ({ page }) => {
  await openPython(page);
  await runScript(page, "kept = 1\nprint('going')\n");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "kept" })).toBeVisible({ timeout: BOOT });

  await runScript(page, "while True:\n    pass\n");
  await expect(page.getByText("Variables are read when the run ends.")).toBeVisible();
  await expect(page.locator("[aria-disabled=true]").filter({ hasText: "Variables are read" })).toBeVisible();

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("The run was stopped before its variables could be read.")).toBeVisible();
});

test("the grip drags the panel wider and the arrow keys move it too", async ({ page }) => {
  await openPython(page);
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
  await openPython(page);
  const editor = page.locator(".split-main");
  const panel = page.locator(".split-panel");
  expect((await panel.boundingBox())!.y).toBeCloseTo((await editor.boundingBox())!.y, 0);

  await page.setViewportSize({ width: 700, height: 800 });
  await expect(page.getByRole("separator", { name: "Resize the variables panel" })).toBeHidden();
  expect((await panel.boundingBox())!.y).toBeGreaterThan((await editor.boundingBox())!.y);
});

test("REPL takes the page from the editor", async ({ page }) => {
  await openRepl(page);

  await expect(page.locator(".cm-editor")).toHaveCount(0);
  await expect(page.getByText("Python starts on the first line entered here.")).toBeVisible();
  await expect(variables(page)).toHaveCount(0);
  await expect(page.getByText("Nothing has been entered yet.")).toBeVisible();

  await switchTo(page, "Script");
  await expect(page.locator(".cm-editor")).toHaveCount(1);
});

test("the script is still there after a look at the REPL", async ({ page }) => {
  await openPython(page);
  await setScript(page, "print('kept')\n");

  await switchTo(page, "REPL");
  await switchTo(page, "Script");
  await page.waitForFunction(() => (window as any).pythonEditor !== undefined);
  await expect
    .poll(async () => page.evaluate(() => pythonEditor.state.doc.toString()))
    .toBe("print('kept')\n");
});

test("an entry runs and what it printed is under the line that printed it", async ({ page }) => {
  await openRepl(page);
  await enter(page, "print('hello from', 2 + 3)");

  await expect(transcript(page)).toContainText(">>> print('hello from', 2 + 3)", { timeout: BOOT });
  await expect(transcript(page)).toContainText("hello from 5");
});

test("an expression is answered by its value and a statement by nothing", async ({ page }) => {
  await openRepl(page);
  await enter(page, "2 ** 8");
  await expect(transcript(page)).toContainText("256", { timeout: BOOT });

  await enter(page, "quiet = 1");
  await expect(transcript(page)).not.toContainText("None");
});

test("the names an entry binds are there at the next one", async ({ page }) => {
  await openRepl(page);
  await enter(page, "x = 41");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "x" })).toContainText("41", { timeout: BOOT });

  await enter(page, "x + 1");
  await expect(transcript(page)).toContainText("42");
});

test("the panel is re-read after every entry", async ({ page }) => {
  await openRepl(page);
  await enter(page, "first = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "first" })).toBeVisible({ timeout: BOOT });

  await enter(page, "second = [1, 2]");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "second" })).toContainText("list (2)");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "first" })).toBeVisible();

  await enter(page, "import sys");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "Imported" })).toBeVisible();
});

test("a block asks for the rest of itself and runs on a blank line", async ({ page }) => {
  await openRepl(page);
  await enter(page, "for word in ('one', 'two'):");
  await expect(transcript(page)).toContainText(">>> for word in ('one', 'two'):", { timeout: BOOT });
  await expect(transcript(page)).not.toContainText("one\ntwo");

  await enter(page, "    print(word.upper())");
  await expect(transcript(page)).toContainText("... print(word.upper())");
  await expect(transcript(page)).not.toContainText("ONE");

  await enter(page, "");
  await expect(transcript(page)).toContainText("ONE");
  await expect(transcript(page)).toContainText("TWO");
});

test("a failing entry answers with a traceback of the line somebody wrote", async ({ page }) => {
  await openRepl(page);
  await enter(page, "1 / 0");

  await expect(transcript(page)).toContainText("ZeroDivisionError", { timeout: BOOT });
  await expect(transcript(page)).toContainText("File \"<repl>\", line 1");
  await expect(transcript(page)).not.toContainText("python-worker");

  await enter(page, "2 ** 8");
  await expect(transcript(page)).toContainText("256");
});

test("output arrives while the entry is still running", async ({ page }) => {
  await openRepl(page);
  await enter(page, "import time; print('first'); time.sleep(3); print('last')");

  await expect(transcript(page)).toContainText("first", { timeout: BOOT });
  await expect(page.getByText("Running…")).toBeVisible();

  await expect(transcript(page)).toContainText("last", { timeout: 10000 });
});

test("a line that never returns can be stopped", async ({ page }) => {
  await openRepl(page);
  await enter(page, "kept = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "kept" })).toBeVisible({ timeout: BOOT });

  await enter(page, "while True: print('spinning')");
  await enter(page, "");
  await expect(page.getByText("Running…")).toBeVisible();

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
  await expect(transcript(page)).toContainText("spinning");
  await expect(transcript(page)).toContainText("Stopped, and the session's names went with the interpreter.");
  await expect(page.getByText("The interpreter was stopped, and the session's names went with it.")).toBeVisible();

  await enter(page, "kept");
  await expect(transcript(page)).toContainText("NameError", { timeout: BOOT });
});

test("Escape drops the block at the prompt", async ({ page }) => {
  await openRepl(page);
  await enter(page, "def f():");
  await expect(transcript(page)).toContainText(">>> def f():", { timeout: BOOT });
  await expect(prompt(page)).toBeEnabled();

  await prompt(page).press("Escape");
  await expect(transcript(page)).toContainText("Abandoned, so none of it ran.");

  await enter(page, "2 ** 8");
  await expect(transcript(page)).toContainText("256");
});

test("the arrow keys walk back through what has been entered", async ({ page }) => {
  await openRepl(page);
  await enter(page, "first = 1");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "first" })).toBeVisible({ timeout: BOOT });
  await enter(page, "second = 2");
  await expect(variables(page).getByRole("treeitem").filter({ hasText: "second" })).toBeVisible();

  await prompt(page).press("ArrowUp");
  await expect(prompt(page)).toHaveValue("second = 2");
  await prompt(page).press("ArrowUp");
  await expect(prompt(page)).toHaveValue("first = 1");
  await prompt(page).press("ArrowDown");
  await expect(prompt(page)).toHaveValue("second = 2");
  await prompt(page).press("ArrowDown");
  await expect(prompt(page)).toHaveValue("");
});

test("the address bar tracks the script, the mode and the line at the prompt", async ({ page }) => {
  await openPython(page);
  await setScript(page, "print('shared')\n");

  await expect.poll(async () => decodeHash(page.url()).code).toBe("print('shared')\n");

  await switchTo(page, "REPL");
  await expect.poll(async () => decodeHash(page.url()).mode).toBe("repl");
  await expect.poll(async () => decodeHash(page.url()).code).toBeUndefined();

  await prompt(page).fill("x = 1");
  await expect.poll(async () => decodeHash(page.url()).line).toBe("x = 1");
});

test("a shared link opens on the script it was copied from", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openPython(page);
  await setScript(page, "print('restored')\n");

  await page.locator("header button").last().click();
  const url = await page.evaluate(() => navigator.clipboard.readText());

  await page.goto(url);
  await page.waitForFunction(() => (window as any).pythonEditor !== undefined);
  await expect
    .poll(async () => page.evaluate(() => pythonEditor.state.doc.toString()))
    .toBe("print('restored')\n");
});

test("the interpreter comes from this origin with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host || url.protocol === "blob:") return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openPython(page);
  await runScript(page, "import sys\nprint(sys.version.split()[0])\n");

  await expect(output(page)).toHaveText(/^3\.\d+/, { timeout: BOOT });
  expect(blocked).toEqual([]);
});
