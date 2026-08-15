import { ScriptEngine } from "./engine";
import type { Language, Scope } from "./engine";

let engine: Promise<ScriptEngine> | null = null;

let buffer = "";
let dropped = false;
let posted = 0;

self.addEventListener("message", (event: MessageEvent<Request>) => {
  void answer(event.data);
});

async function answer(request: Request) {
  try {
    const booting = engine === null;
    engine ??= ScriptEngine.start(write);
    const started = await engine;
    if (booting) send({ kind: "started", id: request.id });

    const at = performance.now();
    const scope = request.kind === "run"
      ? await started.run(request.code, request.language)
      : await started.enter(request.code, request.language);

    flush();
    send({ kind: "done", id: request.id, scope, seconds: (performance.now() - at) / 1000 });
  } catch (error) {
    flush();
    send({ kind: "done", id: request.id, failed: error instanceof Error ? error.message : String(error) });
  }
}

function write(text: string) {
  buffer += text;
  if (buffer.length > PER_POST) {
    buffer = buffer.slice(-PER_POST);
    dropped = true;
  }
  if (Date.now() - posted >= EVERY_MS) post();
}

function post() {
  if (!buffer && !dropped) return;
  posted = Date.now();
  send({ kind: "output", text: buffer, dropped });
  buffer = "";
  dropped = false;
}

function flush() {
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
  language: Language;
}

export type Message =
  | { kind: "output"; text: string; dropped: boolean }
  | { kind: "started"; id: number }
  | { kind: "done"; id: number; scope?: Scope | null; seconds?: number; failed?: string };

const EVERY_MS = 50;
const PER_POST = 64 * 1024;
