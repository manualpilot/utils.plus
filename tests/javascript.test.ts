// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { type Scope, ScriptEngine } from "../src/utilities/javascript/engine";
import { unfinished } from "../src/utilities/javascript/syntax";

describe("running a script", () => {
  it("writes what the script printed, in the order it wrote it", async () => {
    const { output } = await run("console.log('one'); console.error('two'); console.log(3 * 4);");

    expect(output).toBe("one\ntwo\n12\n");
  });

  it("prints a string as it is and anything else as it reads", async () => {
    const { output } = await run("console.log('a', 1, [1, 2], { b: 'c' }, null, undefined, true);");

    expect(output).toBe("a 1 [1, 2] { b: 'c' } null undefined true\n");
  });

  it("fills the specifiers a console takes", async () => {
    const { output } = await run("console.log('%s has %d of %j', 'it', 3.7, { a: 1 }, 'left');");

    expect(output).toBe("it has 3 of {\"a\":1} left\n");
  });

  it("reports a throw where it happened and keeps what was written before it", async () => {
    const { output } = await run("console.log('before');\nfunction boom() { throw new TypeError('nope') }\nboom();");

    expect(output).toContain("before\n");
    expect(output).toContain("TypeError: nope");
    expect(output).toContain("at boom (<script>:2:");
    expect(output).toContain("at <eval> (<script>:3:");
    expect(output).not.toContain("runtime.js");
  });

  it("reports a syntax error rather than running anything", async () => {
    const { output } = await run("const broken = (;");

    expect(output).toContain("SyntaxError");
  });

  it("starts each run on nothing the run before it left", async () => {
    const engine = await start();
    const first = await capture(engine, "let kept = 1; console.log('set');");
    expect(first.output).toBe("set\n");

    const second = await capture(engine, "console.log(typeof kept);");
    expect(second.output).toBe("undefined\n");
    engine.dispose();
  });

  it("lets a script that declares a name run twice", async () => {
    const engine = await start();
    await capture(engine, "const only = 1;");
    const again = await capture(engine, "const only = 2; console.log(only);");

    expect(again.output).toBe("2\n");
    engine.dispose();
  });

  it("has the language the engine arrived with and nothing fetched from anywhere", async () => {
    const { output } = await run(
      "console.log([3, 1, 2].toSorted().join(''), typeof structuredClone, typeof fetch, typeof require);",
    );

    expect(output).toBe("123 undefined undefined undefined\n");
  });
});

describe("the event loop", () => {
  it("runs a timer and waits for it before the run is over", async () => {
    const { output } = await run("setTimeout(() => console.log('later'), 20); console.log('now');");

    expect(output).toBe("now\nlater\n");
  });

  it("drains promises a script left behind", async () => {
    const { output } = await run(
      "(async () => { await new Promise((go) => setTimeout(go, 10)); console.log('awaited'); })();",
    );

    expect(output).toBe("awaited\n");
  });

  it("stops an interval that cleared itself", async () => {
    const { output } = await run(
      "let n = 0; const id = setInterval(() => { console.log(++n); if (n === 3) clearInterval(id); }, 1);",
    );

    expect(output).toBe("1\n2\n3\n");
  });

  it("reports a rejection nothing else would have", async () => {
    const { output } = await run("(async () => { throw new Error('unhandled') })();");

    expect(output).toContain("Uncaught (in promise) Error: unhandled");
  });
});

describe("the variables a run leaves bound", () => {
  it("lists what the top level declared, however it was declared", async () => {
    const { scope } = await run("let a = 1; const b = 'two'; var c = [3]; globalThis.d = 4;");

    expect(named(scope, "a")).toMatchObject({ kind: "number", value: "1" });
    expect(named(scope, "b")).toMatchObject({ kind: "string", value: "'two'" });
    expect(named(scope, "c")).toMatchObject({ kind: "Array (1)", value: "[3]" });
    expect(named(scope, "d")).toMatchObject({ value: "4" });
  });

  it("takes every name out of a pattern", async () => {
    const { scope } = await run("const { p, q: renamed = 2, ...rest } = { p: 1, z: 9 }; const [first] = [7];");

    expect(scope!.variables.map((variable) => variable.name)).toEqual(["p", "renamed", "rest", "first"]);
  });

  it("gathers functions and classes under a section of their own", async () => {
    const { scope } = await run("function helper() {}\nclass Box {}\nconst arrow = () => 1;\nconst value = 5;");

    expect(scope!.variables.map((variable) => variable.name)).toEqual(["value"]);
    expect(scope!.section.map((variable) => variable.name)).toEqual(["helper", "Box", "arrow"]);
    expect(named(scope, "Box", true)).toMatchObject({ kind: "class", value: "class Box" });
  });

  it("opens an object to what is inside it and leaves a plain value shut", async () => {
    const { scope } = await run("const data = { a: [1, 2], b: null }; const total = 7;");

    const data = named(scope, "data");
    expect(data.kind).toBe("Object");
    expect(data.children!.map((child) => child.name)).toEqual(["a", "b"]);
    expect(data.children![0].children!.map((child) => child.value)).toEqual(["1", "2"]);
    expect(named(scope, "total").children).toBeUndefined();
  });

  it("names a map, a set and a date for what they are", async () => {
    const { scope } = await run(
      "const m = new Map([['k', 1]]); const s = new Set([1, 2]); const d = new Date(0); const r = /ab+/g;",
    );

    expect(named(scope, "m")).toMatchObject({ kind: "Map (1)", value: "Map(1) {'k' => 1}" });
    expect(named(scope, "s")).toMatchObject({ kind: "Set (2)", value: "Set(2) {1, 2}" });
    expect(named(scope, "d")).toMatchObject({ value: "1970-01-01T00:00:00.000Z" });
    expect(named(scope, "r")).toMatchObject({ value: "/ab+/g" });
  });

  it("answers a structure that holds itself by the name it repeats under", async () => {
    const { scope } = await run("const loop = { name: 'self' }; loop.self = loop;");

    expect(named(scope, "loop").children!.find((child) => child.name === "self")!.value)
      .toBe("<circular reference>");
  });

  it("names a getter without calling it", async () => {
    const { scope } = await run("const risky = { get boom() { throw new Error('called') } };");

    expect(named(scope, "risky").children![0]).toMatchObject({ kind: "getter", value: "[Getter]" });
  });

  it("keeps the names bound above a line that threw", async () => {
    const { scope } = await run("const survived = 1;\nmissing();\nconst never = 2;");

    expect(named(scope, "survived").value).toBe("1");
    expect(scope!.variables.map((variable) => variable.name)).toEqual(["survived"]);
  });

  it("lists nothing of the runtime the engine installed", async () => {
    const { scope } = await run("const mine = 1;");

    expect(scope!.variables.map((variable) => variable.name)).toEqual(["mine"]);
    expect(scope!.section).toEqual([]);
  });
});

describe("TypeScript", () => {
  it("erases the types and runs what is left", async () => {
    const { output, scope } = await run(
      "interface Shape { size: number }\nconst box: Shape = { size: 2 };\n"
        + "function area(x: number, y = 3): number { return x * y }\nconsole.log(area(box.size));",
      "typescript",
    );

    expect(output).toBe("6\n");
    expect(named(scope, "box").kind).toBe("Object");
  });

  it("builds an enum, which is a value rather than a type", async () => {
    const { output } = await run("enum Colour { Red, Green }\nconsole.log(Colour.Green, Colour[0]);", "typescript");

    expect(output).toBe("1 Red\n");
  });

  it("keeps the syntax the engine already has rather than rewriting it", async () => {
    const { output, scope } = await run(
      "const o = { a: { b: 1 } } as const;\nconsole.log(o?.a?.b ?? 0);",
      "typescript",
    );

    expect(output).toBe("1\n");
    expect(scope!.section).toEqual([]);
  });

  it("reports a TypeScript syntax error before anything runs", async () => {
    const { output } = await run("const x: = 1;", "typescript");

    expect(output).toContain("SyntaxError");
  });
});

describe("a session at the prompt", () => {
  it("keeps the names an entry bound for the entry after it", async () => {
    const engine = await start();
    await capture(engine, "let x = 41;", "javascript", true);
    const next = await capture(engine, "console.log(x + 1);", "javascript", true);

    expect(next.output).toBe("42\n");
    expect(named(next.scope, "x").value).toBe("41");
    engine.dispose();
  });

  it("answers an expression with its value and a statement with nothing", async () => {
    const engine = await start();
    expect((await capture(engine, "2 ** 8", "javascript", true)).output).toBe("256\n");
    expect((await capture(engine, "const quiet = 1", "javascript", true)).output).toBe("");
    expect((await capture(engine, "'text'", "javascript", true)).output).toBe("'text'\n");
    engine.dispose();
  });

  it("lets the same declaration be entered twice", async () => {
    const engine = await start();
    await capture(engine, "let twice = 1;", "javascript", true);
    const again = await capture(engine, "let twice = 2; console.log(twice);", "javascript", true);

    expect(again.output).toBe("2\n");
    expect(named(again.scope, "twice").value).toBe("2");
    engine.dispose();
  });

  it("lets a class be declared again too", async () => {
    const engine = await start();
    await capture(engine, "class Same { one() { return 1 } }", "javascript", true);
    const again = await capture(engine, "class Same { one() { return 2 } }\nconsole.log(new Same().one());");

    expect(again.output).toBe("2\n");
    engine.dispose();
  });

  it("keeps the session after an entry that threw", async () => {
    const engine = await start();
    await capture(engine, "let kept = 1;", "javascript", true);
    const failed = await capture(engine, "nope()", "javascript", true);
    expect(failed.output).toContain("ReferenceError");

    const after = await capture(engine, "kept + 1", "javascript", true);
    expect(after.output).toBe("2\n");
    engine.dispose();
  });
});

describe("deciding an entry is unfinished", () => {
  it("waits for a bracket that was opened", () => {
    expect(unfinished("const o = {")).toBe(true);
    expect(unfinished("const o = { a: 1 }")).toBe(false);
    expect(unfinished("function f() {\n  return 1;")).toBe(true);
    expect(unfinished("function f() {\n  return 1;\n}")).toBe(false);
    expect(unfinished("f([1, 2")).toBe(true);
  });

  it("waits for a string or a template that was opened", () => {
    expect(unfinished("const s = 'half")).toBe(true);
    expect(unfinished("const s = 'whole'")).toBe(false);
    expect(unfinished("const s = `line")).toBe(true);
    expect(unfinished("const s = `${ 1 + 1 }`")).toBe(false);
    expect(unfinished("const s = `${ { a: 1 }.a }`")).toBe(false);
  });

  it("is not fooled by a bracket that is only text", () => {
    expect(unfinished("const s = '{'")).toBe(false);
    expect(unfinished("const s = \"}\"")).toBe(false);
    expect(unfinished("// {")).toBe(false);
    expect(unfinished("/* {\n */")).toBe(false);
    expect(unfinished("const s = 'it\\'s'")).toBe(false);
  });

  it("waits for a block comment that was opened", () => {
    expect(unfinished("/* going")).toBe(true);
    expect(unfinished("/* done */")).toBe(false);
  });

  it("calls a blank line finished, since a prompt has nothing to wait for", () => {
    expect(unfinished("")).toBe(false);
    expect(unfinished("   ")).toBe(false);
  });

  it("tells a regular expression from a division", () => {
    expect(unfinished("const r = /[{]/")).toBe(false);
    expect(unfinished("const half = a / b")).toBe(false);
    expect(unfinished("const r = /{")).toBe(true);
  });
});

const named = (scope: Scope | null, name: string, section = false) => {
  const found = (section ? scope!.section : scope!.variables).find((variable) => variable.name === name);
  if (!found) throw new Error(`no variable called ${name} in ${JSON.stringify(scope)}`);
  return found;
};

let written = "";
const start = () => ScriptEngine.start((text) => (written += text));

async function capture(engine: ScriptEngine, code: string, language: Language = "javascript", repl = false) {
  written = "";
  const scope = repl ? await engine.enter(code, language) : await engine.run(code, language);
  return { output: written, scope };
}

async function run(code: string, language: Language = "javascript") {
  const engine = await start();
  try {
    return await capture(engine, code, language);
  } finally {
    engine.dispose();
  }
}

type Language = "javascript" | "typescript";

beforeAll(async () => {
  (await start()).dispose();
}, 30000);
