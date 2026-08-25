import type { PyodideAPI } from "pyodide";
import { version as PYODIDE_VERSION } from "pyodide/package.json";
import type { Scope } from "../../common/variables-panel";
import WORKER_SOURCE from "./worker.py?raw";

let interpreter: Promise<Interpreter> | null = null;

let buffer = "";
let dropped = false;
let posted = 0;

self.addEventListener("message", (event: MessageEvent<Request>) => {
  void answer(event.data);
});

async function answer(request: Request) {
  try {
    const booting = interpreter === null;
    interpreter ??= start();
    const started = await interpreter;
    if (booting) send({ kind: "started", id: request.id });

    const at = performance.now();
    const reply = request.kind === "run" ? started.run(request.code) : started.repl(request.code);

    flush();
    send({ kind: "done", id: request.id, ...read(reply), seconds: (performance.now() - at) / 1000 });
  } catch (error) {
    flush();
    send({ kind: "done", id: request.id, failed: error instanceof Error ? error.message : String(error) });
  }
}

async function start(): Promise<Interpreter> {
  const module = await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`) as typeof import("pyodide");
  const pyodide = await module.loadPyodide({ indexURL: INDEX_URL });

  pyodide.setStdout({ isatty: false, write });
  pyodide.setStderr({ isatty: false, write });
  self.flushScriptOutput = flush;

  pyodide.runPython(WORKER_SOURCE);
  return { run: entry(pyodide, "run"), repl: entry(pyodide, "repl") };
}

function entry(pyodide: PyodideAPI, name: string): (code: string) => string {
  return pyodide.globals.get(name) as (code: string) => string;
}

function read(payload: string): { scope?: Scope | null; incomplete?: boolean } {
  try {
    const parsed = JSON.parse(payload) as {
      status?: string;
      variables?: Scope["variables"];
      section?: Scope["section"];
    };
    if (parsed?.status === "incomplete") return { incomplete: true };
    const answered = Array.isArray(parsed?.variables) && Array.isArray(parsed?.section);
    return { scope: answered ? { variables: parsed.variables!, section: parsed.section! } : null };
  } catch {
    return { scope: null };
  }
}

function write(bytes: Uint8Array): number {
  buffer += DECODER.decode(bytes, { stream: true });
  if (buffer.length > PER_POST) {
    buffer = buffer.slice(-PER_POST);
    dropped = true;
  }
  if (Date.now() - posted >= EVERY_MS) post();
  return bytes.length;
}

function post() {
  if (!buffer && !dropped) return;
  posted = Date.now();
  send({ kind: "output", text: buffer, dropped });
  buffer = "";
  dropped = false;
}

function flush() {
  buffer += DECODER.decode();
  posted = 0;
  post();
}

function send(message: Message) {
  self.postMessage(message);
}

export interface Request {
  id: number;
  kind: "run" | "enter";
  code: string;
}

export type Message =
  | { kind: "output"; text: string; dropped: boolean }
  | { kind: "started"; id: number }
  | { kind: "done"; id: number; scope?: Scope | null; incomplete?: boolean; seconds?: number; failed?: string };

interface Interpreter {
  run: (code: string) => string;
  repl: (source: string) => string;
}

const INDEX_URL = `/assets/pyodide/${PYODIDE_VERSION}/`;

const DECODER = new TextDecoder();

const EVERY_MS = 50;
const PER_POST = 64 * 1024;

declare global {
  var flushScriptOutput: () => void;
}
