import { PostgreSQL, SQLite } from "@codemirror/lang-sql";
import { EditorState } from "@uiw/react-codemirror";
import { describe, expect, it } from "vitest";
import { isNull, writeCell } from "../src/utilities/sql/cells";
import { catalogueCompletion, type Option, statementScope } from "../src/utilities/sql/completion";
import { datasetNamed, DATASETS, isDataset } from "../src/utilities/sql/datasets";
import { type ModeId, populated, type Relation, type Schema } from "../src/utilities/sql/engine";
import { appended, type LogEntry, MAX_LOG_ENTRIES, writeLog } from "../src/utilities/sql/logs";
import { commandOf, oneLine, splitStatements } from "../src/utilities/sql/statements";
import { defaultOpen, schemaTree } from "../src/utilities/sql/tree";

function cut(text: string, dialect: "sqlite" | "postgres" = "sqlite"): string[] {
  return splitStatements(text, dialect).map((statement) => `${statement.line}: ${oneLine(statement.sql)}`);
}

describe("splitting statements", () => {
  it("cuts at the semicolons between them", () => {
    expect(cut("SELECT 1; SELECT 2;")).toEqual(["1: SELECT 1;", "1: SELECT 2;"]);
  });

  it("keeps a trailing statement that was never terminated", () => {
    expect(cut("SELECT 1;\nSELECT 2")).toEqual(["1: SELECT 1;", "2: SELECT 2"]);
  });

  it("reports the line a statement began on", () => {
    expect(cut("\n\nSELECT 1;\n\n-- a note\nSELECT 2;")).toEqual(["3: SELECT 1;", "6: -- a note SELECT 2;"]);
  });

  it("drops a document that is nothing but comments, space and semicolons", () => {
    expect(cut("  \n-- nothing here\n/* nor here */\n;;\n")).toEqual([]);
  });

  it("does not cut at a semicolon inside a string, an identifier or a comment", () => {
    expect(cut("SELECT ';' AS \"a;b\"; -- and; this\nSELECT 2;")).toEqual([
      "1: SELECT ';' AS \"a;b\";",
      "2: -- and; this SELECT 2;",
    ]);
  });

  it("reads a doubled quote as an escape rather than as the end of the string", () => {
    expect(cut("SELECT 'it''s; fine'; SELECT 2;")).toEqual(["1: SELECT 'it''s; fine';", "1: SELECT 2;"]);
  });

  it("counts the lines a multi-line string spans", () => {
    expect(cut("SELECT 'one\ntwo\nthree';\nSELECT 2;")).toEqual(["1: SELECT 'one two three';", "4: SELECT 2;"]);
  });

  it("keeps a SQLite trigger body whole", () => {
    const trigger = "CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET n = 1; DELETE FROM c; END;\nSELECT 2;";
    expect(cut(trigger)).toEqual([
      "1: CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET n = 1; DELETE FROM c; END;",
      "2: SELECT 2;",
    ]);
  });

  it("counts a CASE inside a trigger body against its own END", () => {
    const trigger = "CREATE TRIGGER t AFTER INSERT ON a BEGIN "
      + "UPDATE b SET n = CASE WHEN 1 THEN 2 ELSE 3 END; END;\nSELECT 2;";
    expect(cut(trigger)).toHaveLength(2);
  });

  it("still cuts after a transaction's own BEGIN", () => {
    expect(cut("BEGIN; INSERT INTO a VALUES (1); COMMIT;")).toEqual([
      "1: BEGIN;",
      "1: INSERT INTO a VALUES (1);",
      "1: COMMIT;",
    ]);
  });

  it("keeps a dollar-quoted Postgres body whole", () => {
    const body = "CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql;\nSELECT 2;";
    expect(cut(body, "postgres")).toEqual([
      "1: CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql;",
      "2: SELECT 2;",
    ]);
  });

  it("tells a tagged dollar quote from an untagged one", () => {
    expect(cut("SELECT $tag$ a; $$ b; $tag$; SELECT 2;", "postgres")).toEqual([
      "1: SELECT $tag$ a; $$ b; $tag$;",
      "1: SELECT 2;",
    ]);
  });

  it("steps over a backslash-escaped quote in an E-string", () => {
    expect(cut("SELECT E'a\\'; b'; SELECT 2;", "postgres")).toEqual(["1: SELECT E'a\\'; b';", "1: SELECT 2;"]);
  });

  it("leaves a backslash alone in a plain string", () => {
    expect(cut("SELECT 'a\\'; SELECT 2;", "postgres")).toEqual(["1: SELECT 'a\\';", "1: SELECT 2;"]);
  });

  it("reads SQLite's brackets and backticks as quoted identifiers", () => {
    expect(cut("SELECT [a;b], `c;d`; SELECT 2;")).toEqual(["1: SELECT [a;b], `c;d`;", "1: SELECT 2;"]);
  });
});

describe("naming a command", () => {
  it("is the word the statement opens with", () => {
    expect(commandOf("  select 1")).toBe("SELECT");
    expect(commandOf("INSERT INTO a VALUES (1)")).toBe("INSERT");
  });

  it("looks past the comments above it", () => {
    expect(commandOf("-- a note\n/* another */\nUPDATE a SET n = 1")).toBe("UPDATE");
  });

  it("has no answer for a statement that opens with none", () => {
    expect(commandOf("   ")).toBeNull();
  });
});

describe("writing a statement into the log", () => {
  it("runs it onto one line", () => {
    expect(oneLine("SELECT\n  1,\n  2")).toBe("SELECT 1, 2");
  });

  it("cuts a long one at the limit", () => {
    expect(oneLine("SELECT " + "a".repeat(200), 20)).toBe("SELECT aaaaaaaaaaaa…");
  });
});

describe("writing a cell", () => {
  it("spells NULL for the two absences, and says so separately", () => {
    expect(writeCell(null)).toBe("NULL");
    expect(writeCell(undefined)).toBe("NULL");
    expect(isNull(null)).toBe(true);
    expect(writeCell("")).toBe("");
    expect(isNull("")).toBe(false);
  });

  it("writes the types a database answers with as themselves", () => {
    expect(writeCell(42)).toBe("42");
    expect(writeCell(9007199254740993n)).toBe("9007199254740993");
    expect(writeCell(true)).toBe("true");
    expect(writeCell(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
  });

  it("writes a blob as a hex literal either dialect would take back", () => {
    expect(writeCell(new Uint8Array([0, 15, 255]))).toBe("x'000fff'");
  });

  it("writes an array or an object as JSON, which is what pglite parsed it into", () => {
    expect(writeCell(["a", "b"])).toBe("[\"a\",\"b\"]");
    expect(writeCell({ a: 1 })).toBe("{\"a\":1}");
  });

  it("clips a value too long to be a cell", () => {
    expect(writeCell("a".repeat(5000))).toHaveLength(2001);
  });
});

describe("the log", () => {
  const entry = (text: string): LogEntry => ({ at: Date.UTC(2026, 0, 1), level: "query", text });

  it("keeps the newest entries and drops the oldest", () => {
    const filled = appended([], Array.from({ length: MAX_LOG_ENTRIES }, (_, i) => entry(String(i))));
    const over = appended(filled, [entry("last")]);

    expect(over).toHaveLength(MAX_LOG_ENTRIES);
    expect(over[0].text).toBe("1");
    expect(over[over.length - 1].text).toBe("last");
  });

  it("hands the same array back when nothing was appended", () => {
    const entries = appended([], [entry("one")]);
    expect(appended(entries, [])).toBe(entries);
  });

  it("writes a line per entry, with the level padded to one width", () => {
    const written = writeLog([{ at: Date.UTC(2026, 0, 1), level: "error", text: "no such table" }]);
    expect(written).toMatch(/^\d\d:\d\d:\d\d\.\d\d\d {2}ERROR {3}no such table$/);
  });
});

describe("the schema tree", () => {
  const relation: Relation = {
    name: "books",
    kind: "table",
    definition: "CREATE TABLE books (id INTEGER PRIMARY KEY)",
    columns: [
      { name: "id", type: "INTEGER", notNull: true, primaryKey: true, fallback: null },
      { name: "title", type: "TEXT", notNull: false, primaryKey: false, fallback: "''" },
    ],
    indexes: [{ name: "books_title", unique: true, primary: false, columns: ["title"] }],
    constraints: [
      { name: "", kind: "PRIMARY KEY", detail: "(id)" },
      { name: "", kind: "CHECK", detail: "(length(title) > 0)" },
    ],
  };
  const schemas: Schema[] = [{ name: "main", relations: [relation] }];

  it("gathers a relation's catalogue under headings of its own", () => {
    const [main] = schemaTree(schemas);
    const books = main.children![0];

    expect(main.row).toEqual({ name: "main", kind: "1 relation" });
    expect(books.row).toEqual({ name: "books", kind: "table", detail: "2 columns" });
    expect(books.children!.map((section) => section.label)).toEqual([
      "Columns",
      "Indexes",
      "Constraints",
      "Definition",
    ]);
  });

  it("flags a column with what its own row cannot otherwise say", () => {
    const columns = schemaTree(schemas)[0].children![0].children![0];
    expect(columns.children![0].row.marks).toEqual(["PK", "NOT NULL"]);
    expect(columns.children![1].row).toMatchObject({ kind: "TEXT", detail: "DEFAULT ''" });
  });

  it("gives every node a value of its own", () => {
    const values: string[] = [];
    (function walk(nodes: ReturnType<typeof schemaTree>) {
      for (const node of nodes) {
        values.push(node.value);
        walk(node.children ?? []);
      }
    })(schemaTree(schemas));

    expect(new Set(values).size).toBe(values.length);
  });

  it("builds the same values from the same catalogue", () => {
    expect(defaultOpen(schemaTree(schemas))).toEqual(defaultOpen(schemaTree(schemas)));
  });

  it("opens the schema, its relations and their columns and nothing further", () => {
    expect(defaultOpen(schemaTree(schemas))).toEqual([
      "schema:main",
      "schema:main/relation:books",
      "schema:main/relation:books/columns",
    ]);
  });

  it("leaves out a heading a relation has nothing under", () => {
    const bare: Schema[] = [{ name: "main", relations: [{ ...relation, indexes: [], constraints: [] }] }];
    expect(schemaTree(bare)[0].children![0].children!.map((section) => section.label)).toEqual([
      "Columns",
      "Definition",
    ]);
  });
});

describe("completing from the catalogue", () => {
  const column = (name: string, type: string) => ({ name, type, notNull: false, primaryKey: false, fallback: null });

  const relation = (name: string, kind: string, columns: ReturnType<typeof column>[]): Relation => ({
    name,
    kind,
    columns,
    indexes: [],
    constraints: [],
    definition: null,
  });

  const sqlite: Schema[] = [{
    name: "main",
    relations: [
      relation("greeting", "table", [column("id", "INTEGER"), column("message", "TEXT")]),
      relation("people", "table", [column("id", "INTEGER"), column("name", "TEXT")]),
      relation("v1.2", "view", [column("n", "INTEGER")]),
      relation("Order Items", "table", [column("quantity", "INTEGER")]),
    ],
  }];

  const postgres: Schema[] = [
    { name: "public", relations: [relation("people", "table", [column("id", "integer"), column("userId", "text")])] },
    { name: "app", relations: [relation("audit", "materialized view", [column("at", "timestamp")])] },
  ];

  type Source = (context: { state: EditorState; pos: number; explicit: boolean }) => { options: Option[] } | null;

  function offered(doc: string, mode: ModeId, schemas: Schema[], at = doc.length): Option[] {
    const state = editing(doc, mode, schemas);
    return state.languageDataAt<Source>("autocomplete", at)
      .flatMap((source) => source({ state, pos: at, explicit: true })?.options ?? []);
  }

  function editing(doc: string, mode: ModeId, schemas: Schema[]): EditorState {
    const dialect = mode === "sqlite" ? SQLite : PostgreSQL;
    return EditorState.create({
      doc,
      extensions: [dialect.language, catalogueCompletion(dialect, mode, () => schemas)],
    });
  }

  const scopeColumns = (options: Option[]) => options.filter((option) => option.type === "property");

  it("offers the relations of the schema a bare name resolves against, and the schemas over them", () => {
    expect(offered("SELECT * FROM ", "postgres", postgres)).toEqual([
      { label: "public", type: "namespace", detail: "schema" },
      { label: "app", type: "namespace", detail: "schema" },
      { label: "people", type: "type", detail: "table" },
    ]);
  });

  it("offers a relation's columns with the type the database gave them", () => {
    const columns = [
      { label: "id", type: "property", detail: "integer" },
      { label: "userId", type: "property", detail: "text", apply: "\"userId\"" },
    ];

    expect(offered("SELECT people.", "postgres", postgres)).toEqual(columns);
    expect(offered("SELECT * FROM people p WHERE p.", "postgres", postgres)).toEqual(columns);
  });

  it("offers what a schema holds when that schema is the one named", () => {
    expect(offered("SELECT * FROM app.", "postgres", postgres)).toEqual([
      { label: "audit", type: "type", detail: "materialized view" },
    ]);
    expect(offered("SELECT * FROM app.audit a WHERE a.", "postgres", postgres)).toEqual([
      { label: "at", type: "property", detail: "timestamp" },
    ]);
  });

  it("writes a name that cannot be written plainly as the dialect quotes it", () => {
    expect(offered("SELECT * FROM Ord", "sqlite", sqlite)).toContainEqual({
      label: "Order Items",
      type: "type",
      detail: "table",
      apply: "`Order Items`",
    });
  });

  it("keeps a name with a dot of its own whole", () => {
    expect(offered("SELECT * FROM ", "sqlite", sqlite).map((option) => option.label)).toContain("v1.2");
    expect(offered("SELECT * FROM v1.", "sqlite", sqlite)).toEqual([]);
  });

  it("offers the columns of the relations the statement names, where a column can be written", () => {
    expect(scopeColumns(offered("SELECT * FROM greeting WHERE mes", "sqlite", sqlite))).toEqual([
      { label: "id", type: "property", detail: "INTEGER", boost: 1 },
      { label: "message", type: "property", detail: "TEXT", boost: 1 },
    ]);

    expect(scopeColumns(offered("SELECT  FROM greeting", "sqlite", sqlite, 7)).map((option) => option.label))
      .toEqual(["id", "message"]);
  });

  it("offers the columns of every relation a join or a comma brought in", () => {
    const joined = "SELECT * FROM greeting g JOIN people p ON ";
    expect(scopeColumns(offered(joined, "sqlite", sqlite)).map((option) => option.label))
      .toEqual(["id", "message", "name"]);
    expect(scopeColumns(offered("SELECT * FROM greeting, people WHERE ", "sqlite", sqlite)).map((o) => o.label))
      .toEqual(["id", "message", "name"]);
  });

  it.each([
    "UPDATE greeting SET mes",
    "INSERT INTO greeting (mes",
    "DELETE FROM greeting WHERE mes",
  ])("offers them in %s", (doc) => {
    expect(scopeColumns(offered(doc, "sqlite", sqlite)).map((option) => option.label)).toContain("message");
  });

  it("offers no column where the name being written is a relation's own", () => {
    expect(scopeColumns(offered("SELECT * FROM gree", "sqlite", sqlite))).toEqual([]);
    expect(scopeColumns(offered("INSERT INTO gree", "sqlite", sqlite))).toEqual([]);
  });

  it("leaves a name written in front of the caret to the catalogue alone", () => {
    expect(offered("SELECT * FROM greeting g WHERE g.", "sqlite", sqlite)).toEqual([
      { label: "id", type: "property", detail: "INTEGER" },
      { label: "message", type: "property", detail: "TEXT" },
    ]);
  });

  it("reads the relations of the statement the caret is in and of no other", () => {
    const scope = (doc: string) => statementScope(editing(doc, "sqlite", sqlite), doc.length);

    expect(scope("SELECT * FROM main.greeting g, people WHERE ")).toEqual({
      relations: [["main", "greeting"], ["people"]],
      naming: false,
    });
    expect(scope("SELECT * FROM gree")).toEqual({ relations: [["gree"]], naming: true });
    expect(scope("SELECT * FROM greeting; SELECT ")).toEqual({ relations: [], naming: false });
  });

  it("offers nothing of a relation the catalogue has never heard of", () => {
    expect(scopeColumns(offered("SELECT * FROM nowhere WHERE ", "sqlite", sqlite))).toEqual([]);
  });

  it("answers with nothing at all until something has been made", () => {
    expect(populated([{ name: "public", relations: [] }])).toBe(false);
    expect(populated(postgres)).toBe(true);

    expect(offered("SELECT * FROM ", "postgres", [{ name: "public", relations: [] }])).toEqual([]);
    expect(offered("SELECT * FROM ", "sqlite", [])).toEqual([]);
  });
});

describe("the example datasets", () => {
  const scripts = DATASETS.flatMap((dataset) =>
    (["sqlite", "postgres"] as const).flatMap((dialect) => [
      { what: `${dataset.label} ${dialect} schema`, dialect, sql: dataset.sql[dialect] },
      { what: `${dataset.label} ${dialect} query`, dialect, sql: dataset.query[dialect] },
    ])
  );

  it.each(scripts)("$what splits into statements with nothing dropped", ({ dialect, sql }) => {
    const statements = splitStatements(sql, dialect);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) expect(commandOf(statement.sql)).not.toBeNull();
    expect(statements.map((statement) => statement.sql).join("\n").replace(/\s+/g, " ")).toBe(
      sql.trim().replace(/\s+/g, " "),
    );
  });

  it("names the datasets the control offers and answers for nothing else", () => {
    expect(DATASETS.map((dataset) => dataset.value)).toEqual(["library", "movies"]);
    expect(isDataset("movies")).toBe(true);
    expect(isDataset("nothing")).toBe(false);
    expect(datasetNamed("movies").label).toBe("Movies");
  });
});
