import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import { parse } from "acorn";
import type { Node, Pattern, Program, VariableDeclaration } from "acorn";
import { newQuickJSWASMModuleFromVariant, type QuickJSContext, type QuickJSHandle, type QuickJSRuntime, type QuickJSWASMModule } from "quickjs-emscripten-core";
import { transform } from "sucrase";
import RUNTIME_SOURCE from "./runtime.js?raw";

export class ScriptEngine {
  private static wasm: Promise<QuickJSWASMModule> | null = null;

  static async start(write: (text: string) => void): Promise<ScriptEngine> {
    ScriptEngine.wasm ??= newQuickJSWASMModuleFromVariant(variant);
    const runtime = (await ScriptEngine.wasm).newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT);
    runtime.setMaxStackSize(STACK_LIMIT);
    return new ScriptEngine(runtime, write);
  }

  private session: Session | null = null;
  private sessionNames = new Set<string>();

  private constructor(private runtime: QuickJSRuntime, private write: (text: string) => void) {}

  async run(source: string, language: Language): Promise<Scope | null> {
    const session = this.open();
    try {
      const code = this.compile(source, language);
      if (code === null) return this.read(session, []);

      const names = topLevelNames(code.program);
      this.evaluate(session, code.text, "<script>");
      await this.settle(session);
      return this.read(session, names);
    } finally {
      session.context.dispose();
    }
  }

  async enter(source: string, language: Language): Promise<Scope | null> {
    this.session ??= this.open();
    const session = this.session;

    const code = this.compile(source, language);
    if (code === null) return this.read(session, [...this.sessionNames]);

    for (const name of topLevelNames(code.program)) this.sessionNames.add(name);
    const value = this.evaluate(session, rewriteDeclarations(code.text, code.program), "<repl>");
    if (value !== undefined && value !== "undefined") this.write(value + "\n");

    await this.settle(session);
    return this.read(session, [...this.sessionNames]);
  }

  dispose() {
    this.session?.context.dispose();
    this.session = null;
    this.runtime.dispose();
  }

  private open(): Session {
    const context = this.runtime.newContext();

    const write = context.newFunction("__write", (text) => {
      this.write(context.getString(text));
    });
    context.setProp(context.global, "__write", write);
    write.dispose();

    const started = context.evalCode(RUNTIME_SOURCE, "<runtime>");
    if (started.error) {
      const failure = context.dump(started.error);
      started.error.dispose();
      context.dispose();
      throw new Error(`the guest runtime did not load: ${failure?.message ?? failure}`);
    }
    started.value.dispose();

    return { context };
  }

  private compile(source: string, language: Language): Compiled | null {
    let text = source;
    if (language === "typescript") {
      try {
        text = transform(source, TYPESCRIPT).code;
      } catch (error) {
        this.write(`SyntaxError: ${messageOf(error)}\n`);
        return null;
      }
    }

    try {
      return { text, program: parse(text, { ecmaVersion: "latest", sourceType: "script" }) };
    } catch {
      return { text, program: null };
    }
  }

  private evaluate(session: Session, code: string, filename: string): string | undefined {
    const { context } = session;
    const result = context.evalCode(code, filename);

    if (result.error) {
      this.report(context, result.error);
      result.error.dispose();
      return undefined;
    }

    if (context.typeof(result.value) === "object" && isPromise(context, result.value)) {
      session.pending?.dispose();
      session.pending = result.value;
      return undefined;
    }

    const shown = context.typeof(result.value) === "undefined" ? undefined : this.inspect(context, result.value);
    result.value.dispose();
    return shown;
  }

  private async settle(session: Session) {
    const { context } = session;

    for (;;) {
      const jobs = this.runtime.executePendingJobs();
      if (jobs.error) {
        this.report(context, jobs.error);
        jobs.error.dispose();
      }

      const due = this.callGuest(context, "__nextTimer");
      if (due === null) break;
      const at = Number(due);
      if (!Number.isFinite(at) || at < 0) break;

      const wait = at - Date.now();
      if (wait > 0) await new Promise((resume) => setTimeout(resume, Math.min(wait, MAX_WAIT)));
      this.callGuest(context, "__runTimers");
    }

    if (session.pending) {
      const state = context.getPromiseState(session.pending);
      if (state.type === "rejected") this.callGuest(context, "__rejected", state.error);
      else if (state.type === "fulfilled") state.value.dispose();

      session.pending.dispose();
      session.pending = undefined;
    }
  }

  private read(session: Session, names: string[]): Scope | null {
    const wanted = names.filter((name) => !name.startsWith("__"));
    const payload = this.callGuest(session.context, "__snapshot", session.context.newString(JSON.stringify(wanted)));
    if (payload === null) return null;

    try {
      const parsed = JSON.parse(payload) as Scope;
      return Array.isArray(parsed?.variables) && Array.isArray(parsed?.section) ? parsed : null;
    } catch {
      return null;
    }
  }

  private report(context: QuickJSContext, error: QuickJSHandle) {
    const written = this.callGuest(context, "__describe", error.dup());
    this.write((written ?? String(context.dump(error))) + "\n");
  }

  private inspect(context: QuickJSContext, value: QuickJSHandle): string {
    return this.callGuest(context, "__inspect", value.dup()) ?? String(context.dump(value));
  }

  private callGuest(context: QuickJSContext, name: string, ...args: QuickJSHandle[]): string | null {
    const fn = context.getProp(context.global, name);
    try {
      if (context.typeof(fn) !== "function") return null;
      const result = context.callFunction(fn, context.undefined, args);
      if (result.error) {
        result.error.dispose();
        return null;
      }
      const text = context.typeof(result.value) === "string"
        ? context.getString(result.value)
        : String(context.dump(result.value));
      result.value.dispose();
      return text;
    } finally {
      fn.dispose();
      for (const arg of args) arg.dispose();
    }
  }
}

export type Language = "javascript" | "typescript";

export interface Variable {
  name: string;
  kind: string;
  value: string;
  children?: Variable[];
  note?: boolean;
}

export interface Scope {
  variables: Variable[];
  section: Variable[];
}

interface Session {
  context: QuickJSContext;
  pending?: QuickJSHandle;
}

interface Compiled {
  text: string;
  program: Program | null;
}

export function topLevelNames(program: Program | null): string[] {
  const names: string[] = [];
  if (!program) return names;

  for (const node of program.body) {
    if (node.type === "VariableDeclaration") node.declarations.forEach((one) => collect(one.id, names));
    else if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") collect(node.id, names);
  }
  return [...new Set(names)];
}

function collect(node: Pattern | Node | null | undefined, names: string[]) {
  if (!node) return;
  switch (node.type) {
    case "Identifier":
      names.push((node as { name: string }).name);
      return;
    case "ObjectPattern":
      for (const property of (node as { properties: Node[] }).properties) {
        collect(property.type === "RestElement" ? (property as any).argument : (property as any).value, names);
      }
      return;
    case "ArrayPattern":
      for (const element of (node as { elements: (Node | null)[] }).elements) collect(element, names);
      return;
    case "AssignmentPattern":
      collect((node as any).left, names);
      return;
    case "RestElement":
      collect((node as any).argument, names);
      return;
  }
}

export function rewriteDeclarations(code: string, program: Program | null): string {
  if (!program) return code;
  let text = code;

  for (const node of [...program.body].reverse()) {
    if (node.type === "VariableDeclaration") {
      const kind = (node as VariableDeclaration).kind;
      if (kind === "let" || kind === "const") text = splice(text, node.start, node.start + kind.length, "var");
    } else if (node.type === "ClassDeclaration" && node.id) {
      text = splice(text, node.start, node.start + "class".length, `var ${node.id.name} = class`);
    }
  }
  return text;
}

function splice(text: string, from: number, to: number, insert: string): string {
  return text.slice(0, from) + insert + text.slice(to);
}

function isPromise(context: QuickJSContext, handle: QuickJSHandle): boolean {
  const then = context.getProp(handle, "then");
  const callable = context.typeof(then) === "function";
  then.dispose();
  return callable;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const TYPESCRIPT = {
  transforms: ["typescript" as const],
  disableESTransforms: true,
  filePath: "script.ts",
};

const MEMORY_LIMIT = 256 * 1024 * 1024;
const STACK_LIMIT = 2 * 1024 * 1024;

const MAX_WAIT = 250;
