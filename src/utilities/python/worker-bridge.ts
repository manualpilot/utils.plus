import { hooks, PyWorker } from "@pyscript/core";
import { version as PYODIDE_VERSION } from "pyodide/package.json";
import type { Chunk } from "../../common/run-output";
import type { Scope } from "../../common/variables-panel";
import WORKER_SOURCE from "./worker.py?raw";

export function readReply(payload: string): { incomplete: boolean; scope: Scope | null } {
  try {
    const parsed = JSON.parse(payload) as {
      status?: string;
      variables?: Scope["variables"];
      section?: Scope["section"];
    };
    if (parsed?.status === "incomplete") return { incomplete: true, scope: null };
    const answered = Array.isArray(parsed?.variables) && Array.isArray(parsed?.section);
    return { incomplete: false, scope: answered ? { variables: parsed.variables!, section: parsed.section! } : null };
  } catch {
    return { incomplete: false, scope: null };
  }
}

export function startWorker(receive: (chunk: Chunk) => void): Promise<PyodideWorker> {
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/x-python" }));
  const version = new URL(INTERPRETER_PATH, location.href).href;

  return startPyWorker(url, { version })
    .then((worker) => {
      worker.addEventListener("message", ({ data }) => {
        if (Array.isArray(data) && data[0] === OUTPUT_TAG) receive({ text: data[1], dropped: data[2] });
      });
      return worker;
    })
    .finally(() => URL.revokeObjectURL(url));
}

export type PyodideWorker = Worker & {
  sync: {
    run: (code: string) => Promise<string>;
    repl: (source: string) => Promise<string>;
  };
};

const startPyWorker = PyWorker as (file: string, options: { version: string }) => Promise<PyodideWorker>;

const OUTPUT_TAG = "utils.plus/output";

hooks.worker.onReady.add(({ interpreter }: { interpreter: PyodideInterpreter }, xworker: WorkerScope) => {
  const TAG = "utils.plus/output";
  const EVERY_MS = 50;
  const PER_POST = 64 * 1024;

  const decoder = new TextDecoder();
  let buffer = "";
  let dropped = false;
  let posted = 0;

  const post = () => {
    if (!buffer) return;
    posted = Date.now();
    xworker.postMessage([TAG, buffer, dropped]);
    buffer = "";
    dropped = false;
  };

  const write = (bytes: Uint8Array) => {
    buffer += decoder.decode(bytes, { stream: true });
    if (buffer.length > PER_POST) {
      buffer = buffer.slice(-PER_POST);
      dropped = true;
    }
    if (Date.now() - posted >= EVERY_MS) post();
    return bytes.length;
  };

  self.flushScriptOutput = () => {
    buffer += decoder.decode();
    posted = 0;
    post();
  };

  interpreter.setStdout({ isatty: false, write });
  interpreter.setStderr({ isatty: false, write });
});

interface PyodideInterpreter {
  setStdout: (options: { isatty: boolean; write: (bytes: Uint8Array) => number }) => void;
  setStderr: (options: { isatty: boolean; write: (bytes: Uint8Array) => number }) => void;
}

type WorkerScope = { postMessage: (data: unknown) => void };

const INTERPRETER_PATH = `/assets/pyodide/${PYODIDE_VERSION}/pyodide.mjs`;
