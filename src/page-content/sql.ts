import type { PageContent } from "../page-document.ts";

export default {
  related: ["/csv", "/mock", "/json", "/python"],
  howItWorks: [
    "Two real databases run in the tab, compiled to WebAssembly: SQLite from the SQLite project's own build, and PostgreSQL through PGlite, which is the Postgres server itself in single-user mode. Only the engine you pick is fetched, when you pick it; PostgreSQL is the heavier at about 16 MB. Both live in memory, so a reload, a switch of engine or Reset database leaves an empty database.",
    "Execute cuts the editor into statements at the semicolons that end them, stepping over strings, comments, Postgres dollar quotes and SQLite trigger bodies, and runs them one at a time. The Logs tab gets a line per statement with its command, the rows returned or changed and the time taken, plus any Postgres `NOTICE`. The Results tab shows the last statement that returned rows, drawing at most 1,000 of them with the real count above the grid.",
    "The schema pane is read again after every run: tables and views, their columns and types, keys, indexes and constraints. The editor completes table and column names from that reading, and wherever a column can go it offers the columns of the tables the statement names.",
    "Load writes one of the example datasets, Library or Movies, into the editor in the current dialect and runs it on a fresh database, asking first when that would replace anything. The share link carries the editor, the engine and the dataset choice, never the rows.",
  ],
  examples: [
    {
      title: "A table, three rows and a query",
      blocks: [
        {
          code:
            "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer TEXT NOT NULL, total NUMERIC(8, 2));\nINSERT INTO orders (customer, total) VALUES ('ada', 12.50), ('ada', 30), ('grace', 8);\nSELECT customer, count(*) AS orders, sum(total) AS spent\nFROM orders GROUP BY customer ORDER BY spent DESC;",
        },
        { code: "customer | orders | spent\nada      | 2      | 42.5\ngrace    | 1      | 8" },
        "In SQLite the log reads `CREATE`, then `INSERT, 3 rows affected`, then `SELECT, 2 rows`, each with its time. SQLite filled in `id` itself, because `INTEGER PRIMARY KEY` makes the column an alias for the row id, and it stored the totals as plain numbers, so 12.50 went in as 12.5.",
      ],
    },
    {
      title: "The same script in PostgreSQL",
      blocks: [
        "Switch the engine, press Execute, and the INSERT is refused:",
        { code: "null value in column \"id\" of relation \"orders\" violates not-null constraint" },
        "Postgres has no row-id alias, so the column needs a generator. Declared as `id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, the script runs and the query answers:",
        { code: "customer | orders | spent\nada      | 2      | 42.50\ngrace    | 1      | 8.00" },
        "`numeric(8, 2)` keeps its two decimal places in every result, where SQLite treated the declaration as a hint.",
      ],
    },
  ],
  problems: [
    {
      title: "`7 / 2` is 3",
      blocks: [
        "Dividing two integers gives an integer in both engines. `SELECT 7 / 2, 7 / 2.0, 7 % 3` answers `3`, `3.5`, `1` in SQLite and `3`, `3.5000000000000000`, `1` in PostgreSQL, whose `numeric` result keeps its scale. Make one side a decimal, or cast it, before working out an average or a percentage.",
      ],
    },
    {
      title: "SQLite keeps text in an INTEGER column",
      blocks: [
        "A declared type in SQLite is an affinity rather than a rule: inserting `'abc'` into `n INTEGER` stores the text and `typeof(n)` says `text`, while `'42'` is converted to the integer 42. PostgreSQL refuses the first with `invalid input syntax for type integer: \"abc\"`. Declaring the table `STRICT` makes SQLite refuse it too.",
      ],
    },
    {
      title: "The run stops at the first error, and what ran stays",
      blocks: [
        {
          code:
            "CREATE TABLE t (n INTEGER NOT NULL);\nINSERT INTO t VALUES (1);\nINSERT INTO t VALUES (NULL);\nINSERT INTO t VALUES (3);",
        },
        "There is no transaction around a run. The third statement fails and the log says `line 3: … NOT NULL constraint failed: t.n`; the fourth never runs, and `t` keeps the row the second put there. Reset database starts clean.",
      ],
    },
    {
      title: "`FOREIGN KEY constraint failed` in SQLite",
      blocks: [
        "SQLite leaves foreign keys unenforced unless `PRAGMA foreign_keys` is on, and this page turns it on, so a row pointing at a missing parent is refused as it would be in PostgreSQL. A script that relied on SQLite ignoring `REFERENCES` stops here.",
      ],
    },
  ],
  faq: [
    {
      question: "Where is the data stored?",
      answer:
        "In memory, in this tab. Nothing is written to disk or to browser storage, so a reload, a switch of engine or Reset database starts again empty. The share link carries the script rather than the rows, and one Execute rebuilds whatever the script creates.",
    },
    {
      question: "Is it real SQLite and real PostgreSQL?",
      answer:
        "Yes. SQLite is the project's own WebAssembly build, and PGlite is PostgreSQL compiled to WebAssembly without a virtual machine, so functions, types and error messages are Postgres's own. The first line of the log names the version of whichever is running.",
    },
    {
      question: "Can I load my own data?",
      answer:
        "Paste `CREATE TABLE` and `INSERT` statements into the editor and press Execute; there is no file import. For more rows than you want to type, [mock data](/mock) writes INSERT statements from a JSON Schema, Zod or Pydantic model.",
    },
  ],
  references: [
    { title: "Datatypes in SQLite", url: "https://www.sqlite.org/datatype3.html" },
    { title: "SQLite foreign key support", url: "https://www.sqlite.org/foreignkeys.html" },
    { title: "SQLite WebAssembly documentation", url: "https://sqlite.org/wasm/doc/trunk/index.md" },
    { title: "PGlite documentation", url: "https://pglite.dev/docs/" },
    {
      title: "PostgreSQL identity columns",
      url: "https://www.postgresql.org/docs/current/ddl-identity-columns.html",
    },
    {
      title: "PostgreSQL mathematical functions and operators",
      url: "https://www.postgresql.org/docs/current/functions-math.html",
    },
  ],
} satisfies PageContent;
