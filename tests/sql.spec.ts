import { expect, Page, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL ?? "";

declare const sqlEditor: any;

const BOOT = 60_000;

async function openSql(page: Page, hash = "") {
  await page.goto(`${BASE}/sql${hash}`);
  await expect(page.locator(".cm-editor").first()).toBeVisible();
  await page.waitForFunction(() => (window as any).sqlEditor !== undefined);
  await ready(page);
}

function ready(page: Page) {
  return expect(page.getByText(/^(SQLite|PostgreSQL) \d/)).toBeVisible({ timeout: BOOT });
}

function setEditor(page: Page, text: string) {
  return page.evaluate((text) => {
    sqlEditor.dispatch({ changes: { from: 0, to: sqlEditor.state.doc.length, insert: text } });
  }, text);
}

async function execute(page: Page, sql?: string) {
  if (sql !== undefined) await setEditor(page, sql);
  await page.getByRole("button", { name: "Execute" }).click();
  await expect(page.getByRole("button", { name: "Execute" })).toBeEnabled({ timeout: BOOT });
}

async function loadDataset(page: Page, label: string, expected: string, over = false) {
  await page.getByRole("combobox", { name: "Example dataset" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "Load" }).click();
  if (over) await page.getByRole("button", { name: "Reset and load" }).click();
  await expect(tree(page).getByText(expected, { exact: true }).first()).toBeVisible({ timeout: BOOT });
}

const chooseMode = (page: Page, label: string) => page.getByText(label, { exact: true }).click();

const grid = (page: Page) => page.getByRole("table");
const log = (page: Page) => page.getByRole("log", { name: "Database log" });
const tree = (page: Page) => page.getByRole("tree", { name: "Database schema" });
const emptyNote = (page: Page) => page.getByText(/^This database is empty\./);

function openLogs(page: Page) {
  return page.getByRole("tab", { name: /^Logs/ }).click();
}

function decodeHash(url: string): { mode?: string; dataset?: string; sql?: string } {
  let b64 = new URL(url).hash.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  if (!b64) return {};
  while (b64.length % 4) b64 += "=";
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return {};
  }
}

test("opens on an empty database and an empty editor", async ({ page }) => {
  await openSql(page);

  await expect(page.getByText("SQLite 3.")).toBeVisible();
  expect(await page.evaluate(() => sqlEditor.state.doc.toString())).toBe("");
  await expect(emptyNote(page)).toBeVisible();
  await expect(tree(page)).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe("");
});

test("says there is nothing to run when Execute is pressed on an empty editor", async ({ page }) => {
  await openSql(page);
  await execute(page);

  await expect(page.getByText(/There is nothing to run/)).toBeVisible();
  await expect(grid(page)).toHaveCount(0);
});

test("runs a script somebody typed and reads the catalogue it built", async ({ page }) => {
  await openSql(page);
  await execute(
    page,
    "CREATE TABLE greeting (id INTEGER PRIMARY KEY, message TEXT NOT NULL);\n"
      + "INSERT INTO greeting (message) VALUES ('hello'), ('from SQLite');\n"
      + "SELECT id, message, length(message) AS letters FROM greeting;",
  );

  await expect(grid(page).getByText("from SQLite")).toBeVisible();
  await expect(page.getByText(/SELECT, 2 rows in /)).toBeVisible();
  await expect(tree(page).getByText("greeting", { exact: true })).toBeVisible();
});

test("loads the Library dataset by putting its script in the editor and running it", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");

  await expect(tree(page).getByText("books", { exact: true }).first()).toBeVisible();
  await expect(tree(page).getByText("author_totals", { exact: true })).toBeVisible();

  const script = await page.evaluate(() => sqlEditor.state.doc.toString());
  expect(script).toContain("CREATE TABLE authors");
  expect(script).toContain("INSERT INTO books");
  expect(script.trimEnd().endsWith(";")).toBe(true);
  expect(script).toContain("FROM books b");

  await expect(grid(page).getByText("The Dispossessed")).toBeVisible();
  await expect(page.getByText(/SELECT, 7 rows in /)).toBeVisible();

  await openLogs(page);
  await expect(log(page)).toContainText(/CREATE TABLE authors .* — CREATE in /);
  await expect(log(page)).toContainText(/INSERT INTO authors .* — INSERT, 4 rows affected in /);
});

test("writes the dataset's query over a script somebody else had in the editor", async ({ page }) => {
  await openSql(page);
  await setEditor(page, "SELECT 'mine' AS whose;");

  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText(/writes its script into the editor and runs it against a fresh database/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await page.evaluate(() => sqlEditor.state.doc.toString())).toBe("SELECT 'mine' AS whose;");
  await expect(emptyNote(page)).toBeVisible();

  await loadDataset(page, "Library", "authors", true);
  await expect(page.locator(".cm-content")).toContainText("CREATE TABLE authors");
  await expect(page.locator(".cm-content")).not.toContainText("mine");
  await expect(grid(page).getByText("The Dispossessed")).toBeVisible();
});

test("asks before a load empties a database that has something in it", async ({ page }) => {
  await openSql(page);
  await execute(page, "CREATE TABLE mine (id INTEGER PRIMARY KEY);");
  await setEditor(page, "");

  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText(/the tables in this one go with it/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(tree(page).getByText("mine", { exact: true })).toBeVisible();

  await loadDataset(page, "Library", "authors", true);
  await expect(tree(page).getByText("mine", { exact: true })).toHaveCount(0);
});

test("loads the Movies dataset over whatever was there before", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await loadDataset(page, "Movies", "directors", true);

  await expect(tree(page).getByText("authors", { exact: true })).toHaveCount(0);
  await expect(tree(page).getByText("films", { exact: true }).first()).toBeVisible();
  await expect(tree(page).getByText("genres", { exact: true }).first()).toBeVisible();
  await expect(tree(page).getByText("showings", { exact: true })).toBeVisible();

  await expect(page.locator(".cm-content")).not.toContainText("CREATE TABLE authors");
  await expect(grid(page).getByText("Parasite")).toBeVisible();
  await expect(page.getByText(/SELECT, 9 rows in /)).toBeVisible();
});

test("shows the last result set even when a write ran after it", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await execute(page, "SELECT name FROM authors ORDER BY name;\nUPDATE books SET pages = pages;");

  await expect(grid(page).getByText("Ted Chiang")).toBeVisible();
  await expect(page.getByText(/SELECT, 4 rows in /)).toBeVisible();
});

test("says so when a run returned no rows at all", async ({ page }) => {
  await openSql(page);
  await execute(page, "CREATE TABLE notes (id INTEGER PRIMARY KEY);");

  await expect(page.getByText(/1 statement ran in .*None of them returned rows\./)).toBeVisible();
  await expect(tree(page).getByText("notes", { exact: true })).toBeVisible();
});

test("stops at the statement the database refused and points at its line", async ({ page }) => {
  await openSql(page);
  await execute(page, "SELECT 1 AS ok;\n\nSELECT * FROM nowhere;\nSELECT 2;");

  await expect(page.getByText(/no such table: nowhere/)).toBeVisible();

  await openLogs(page);
  await expect(log(page)).toContainText("line 3:");
  await expect(log(page)).not.toContainText("SELECT 2;");
});

test("logs a line per statement with its command, rows and time", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await execute(page, "SELECT 1;\nINSERT INTO authors (name) VALUES ('Iain M. Banks');");
  await openLogs(page);

  await expect(log(page)).toContainText(/QUERY .*SELECT 1; — SELECT, 1 row in /);
  await expect(log(page)).toContainText(/QUERY .*INSERT INTO authors .* — INSERT, 1 row affected in /);
  await expect(log(page)).toContainText("Loading the Library dataset");
});

test("a reset empties the database and leaves the editor alone", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await expect(grid(page).getByText("Ted Chiang").first()).toBeVisible();

  await page.getByRole("button", { name: "Reset database" }).click();
  await ready(page);

  await expect(emptyNote(page)).toBeVisible();
  await expect(tree(page)).toHaveCount(0);
  await expect(page.locator(".cm-content")).toContainText("CREATE TABLE authors");

  await execute(page);
  await expect(tree(page).getByText("authors", { exact: true }).first()).toBeVisible({ timeout: BOOT });
  await expect(grid(page).getByText("Ted Chiang").first()).toBeVisible();
});

test("switches to Postgres behind a loading state and carries the dataset over", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Movies", "directors");
  await chooseMode(page, "PostgreSQL");

  await expect(page.getByText(/Starting PostgreSQL and loading the Movies dataset/)).toBeVisible();
  await expect(page.getByText("PostgreSQL 1")).toBeVisible({ timeout: BOOT });

  await expect(tree(page).getByText("cinema", { exact: true })).toBeVisible({ timeout: BOOT });
  await expect(tree(page).getByText("public", { exact: true })).toBeVisible();
  await expect(tree(page).getByText("showings", { exact: true })).toBeVisible();

  await expect(page.locator(".cm-content")).toContainText("CREATE SCHEMA cinema");
  await expect(grid(page).getByText("Spirited Away")).toBeVisible();
  await expect(grid(page).getByText(/\["animation","fantasy"\]/)).toBeVisible();
});

test("reports what Postgres raised as a notice", async ({ page }) => {
  await openSql(page);
  await chooseMode(page, "PostgreSQL");
  await expect(page.getByText("PostgreSQL 1")).toBeVisible({ timeout: BOOT });

  await execute(page, "DO $$ BEGIN RAISE NOTICE 'hello from plpgsql'; END $$;");
  await openLogs(page);
  await expect(log(page)).toContainText("NOTICE: hello from plpgsql");
});

test("carries the editor, the mode and the dataset on the link, and never the database", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Movies", "directors");
  await execute(page, "CREATE TABLE only_here (id INTEGER PRIMARY KEY);");

  await expect(async () => {
    const state = decodeHash(page.url());
    expect(state.sql).toContain("only_here");
    expect(Object.keys(state).sort()).toEqual(["dataset", "mode", "sql"]);
    expect(state.mode).toBe("sqlite");
    expect(state.dataset).toBe("movies");
  }).toPass();

  const shared = new URL(page.url()).hash;
  await page.goto("about:blank");
  await openSql(page, shared);

  await expect(emptyNote(page)).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("only_here");
  await expect(page.getByRole("combobox", { name: "Example dataset" })).toHaveValue("Movies");
});

test("swaps the sample when the dialect changes, and keeps anything typed", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await expect(page.locator(".cm-content")).not.toContainText("b.tags");

  await chooseMode(page, "PostgreSQL");
  await expect(page.locator(".cm-content")).toContainText("b.tags");
  await expect(tree(page).getByText("books", { exact: true }).first()).toBeVisible({ timeout: BOOT });

  await setEditor(page, "SELECT 1 AS mine;");
  await chooseMode(page, "SQLite");
  await expect(page.locator(".cm-content")).toContainText("SELECT 1 AS mine;");
});

test("empties an untouched editor when the dialect changes with no dataset loaded", async ({ page }) => {
  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await page.getByRole("button", { name: "Reset database" }).click();
  await ready(page);

  await chooseMode(page, "PostgreSQL");
  expect(await page.evaluate(() => sqlEditor.state.doc.toString())).toBe("");
});

test("resizes the panes and the columns of the grid", async ({ page }) => {
  await openSql(page);
  await execute(page, "SELECT 'a fairly long value to widen a column' AS text, 1 AS number;");

  const pane = page.getByRole("separator", { name: "Resize the schema pane" });
  const before = await page.locator(".split-pair[data-direction='row'] > .split-second").boundingBox();
  await pane.focus();
  await pane.press("ArrowLeft");
  await pane.press("ArrowLeft");
  const after = await page.locator(".split-pair[data-direction='row'] > .split-second").boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width);

  await expect(page.locator(".mantine-datatable-header-resizable-handle").first()).toBeAttached();
});

test("both engines come from this origin with every third-party request blocked", async ({ page }) => {
  const host = new URL(BASE || "http://localhost:5173").host;
  const blocked: string[] = [];

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host === host || url.protocol === "blob:") return route.continue();
    blocked.push(url.host);
    return route.abort();
  });

  await openSql(page);
  await loadDataset(page, "Library", "authors");
  await expect(grid(page).getByText("The Dispossessed")).toBeVisible();

  await chooseMode(page, "PostgreSQL");
  await expect(page.getByText("PostgreSQL 1")).toBeVisible({ timeout: BOOT });

  expect(blocked).toEqual([]);
});
