import { python as pythonLanguage } from "@codemirror/lang-python";
import { Box, Button, Card, Group, Paper, SegmentedControl, Stack, Text } from "@mantine/core";
import { hooks, PyWorker } from "@pyscript/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { version as PYODIDE_VERSION } from "pyodide/package.json";
import { useCallback, useEffect, useRef, useState } from "react";
import { EDITOR_BACKGROUND, EDITOR_STYLE, EDITOR_SURFACE } from "../common/editor-theme";
import { ABANDONED, BLANK_ENTRY, type Entry, NO_SESSION, Repl, type Session, written } from "../common/repl-console";
import { type Chunk, DRAW_DELAY, DROPPED_NOTE, IDLE, isWorking, MAX_OUTPUT, message, NOTHING_HELD, type Run, runStats, RunStatus } from "../common/run-output";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { Panes } from "../common/split-panes";
import { UtilityTitle } from "../common/utility-title";
import { type Scope, Variables } from "../common/variables-panel";
import { IconPlayerPlay, IconPlayerStop } from "../icons";
import WORKER_SOURCE from "./python-worker.py?raw";

export default function Python() {
  const initialState = useInitialHashState<{
    mode?: string;
    code?: string;
    line?: string;
  }>();

  const [mode, setMode] = useState<Mode>(initialState?.mode === "repl" ? "repl" : "script");

  const codeRef = useRef(initialState?.code ?? SAMPLE_SCRIPT);

  const [output, setOutput] = useState<string | null>(null);
  const [dropped, setDropped] = useState(false);
  const [run, setRun] = useState<Run>(IDLE);

  const [scope, setScope] = useState<Scope | null>(null);

  const [session, setSession] = useState<Session>(NO_SESSION);
  const [sessionScope, setSessionScope] = useState<Scope | null>(null);
  const [line, setLine] = useState(initialState?.line ?? "");

  const workerRef = useRef<Promise<PyodideWorker> | null>(null);
  const runId = useRef(0);

  const held = useRef<Chunk>(NOTHING_HELD);
  const drawing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef("");
  const sink = useRef<Mode>("script");

  const syncShareState = useRegisterShareState(() => ({
    mode,
    code: mode === "script" ? codeRef.current : undefined,
    line: mode === "repl" && line ? line : undefined,
  }));

  useEffect(() => () => {
    self.pythonEditor = undefined;
  }, []);

  const stopWorker = useCallback(() => {
    workerRef.current?.then((worker) => worker.terminate(), () => {});
    workerRef.current = null;
  }, []);

  const draw = useCallback(() => {
    if (drawing.current !== null) clearTimeout(drawing.current);
    drawing.current = null;

    const { text, dropped } = held.current;
    if (!text && !dropped) return;
    held.current = NOTHING_HELD;

    if (sink.current === "repl") {
      setSession((session) =>
        session.current ? { ...session, current: written(session.current, text, dropped) } : session
      );
      return;
    }

    const next = shown.current + text;
    shown.current = next.length > MAX_OUTPUT ? next.slice(-MAX_OUTPUT) : next;
    setOutput(shown.current);
    if (dropped || next.length > MAX_OUTPUT) setDropped(true);
  }, []);

  const receive = useCallback((chunk: Chunk) => {
    held.current = { text: held.current.text + chunk.text, dropped: held.current.dropped || chunk.dropped };
    if (drawing.current === null) drawing.current = setTimeout(draw, DRAW_DELAY);
  }, [draw]);

  useEffect(() => () => {
    stopWorker();
    if (drawing.current !== null) clearTimeout(drawing.current);
  }, [stopWorker]);

  const handleChange = useCallback((next: string) => {
    codeRef.current = next;
    syncShareState();
  }, [syncShareState]);

  const endSession = useCallback((note: string) => {
    setSessionScope(null);
    setSession((session) => {
      if (!session.current && session.entries.length === 0) return session;
      const closed = session.current ?? BLANK_ENTRY;
      return { entries: [...session.entries, { ...closed, note }], current: null };
    });
  }, []);

  const handleStop = useCallback(() => {
    runId.current++;
    stopWorker();
    draw();
    setRun({ state: "stopped" });
    endSession(STOPPED_NOTE);
  }, [draw, endSession, stopWorker]);

  const handleRun = useCallback(async () => {
    const id = ++runId.current;
    const booting = workerRef.current === null;
    setRun({ state: booting ? "starting" : "running" });

    sink.current = "script";
    held.current = NOTHING_HELD;
    shown.current = "";
    setOutput("");
    setDropped(false);
    setScope(null);

    try {
      const worker = workerRef.current ?? (workerRef.current = startWorker(receive));
      const ready = await worker;
      if (runId.current !== id) return;

      setRun({ state: "running" });
      const started = performance.now();
      const payload = await ready.sync.run(codeRef.current);
      if (runId.current !== id) return;

      draw();
      setScope(readReply(payload).scope);
      setRun({ state: "finished", seconds: (performance.now() - started) / 1000 });
    } catch (error) {
      if (runId.current !== id) return;
      stopWorker();
      setRun({ state: "failed", message: message(error) });
      endSession(message(error));
    }
  }, [draw, endSession, receive, stopWorker]);

  const handleEnter = useCallback(async (text: string) => {
    const id = ++runId.current;
    const booting = workerRef.current === null;

    const block: Entry = {
      ...(session.current ?? BLANK_ENTRY),
      lines: [...(session.current?.lines ?? []), ...text.split("\n")],
    };
    setSession((session) => ({ ...session, current: block }));
    setLine("");
    sink.current = "repl";
    setRun({ state: booting ? "starting" : "running" });

    try {
      const worker = workerRef.current ?? (workerRef.current = startWorker(receive));
      const ready = await worker;
      if (runId.current !== id) return;

      setRun({ state: "running" });
      const answer = readReply(await ready.sync.repl(block.lines.join("\n")));
      if (runId.current !== id) return;

      draw();
      setRun(IDLE);
      if (answer.incomplete) return;

      setSession((session) => ({ entries: [...session.entries, session.current ?? block], current: null }));
      setSessionScope(answer.scope);
    } catch (error) {
      if (runId.current !== id) return;
      stopWorker();
      setRun({ state: "failed", message: message(error) });
      endSession(message(error));
    }
  }, [draw, endSession, receive, session, stopWorker]);

  const handleAbandon = useCallback(() => {
    setLine("");
    setSession((session) =>
      session.current
        ? { entries: [...session.entries, { ...session.current, note: ABANDONED }], current: null }
        : session
    );
  }, []);

  const busy = isWorking(run);

  return (
    <Stack flex={1} mih={0} gap="md">
      <Group justify="space-between" align="center" wrap="nowrap">
        <UtilityTitle file="python.tsx">Python</UtilityTitle>
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          data={[{ value: "script", label: "Script" }, { value: "repl", label: "REPL" }]}
        />
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="xl" justify="space-between" wrap="nowrap">
          <Group align="center" gap="sm">
            {mode === "script" && (
              <Button onClick={handleRun} disabled={busy} leftSection={<IconPlayerPlay size="1rem" />}>
                Run
              </Button>
            )}
            <Button
              variant="default"
              onClick={handleStop}
              disabled={!busy}
              leftSection={<IconPlayerStop size="1rem" />}
            >
              Stop
            </Button>
            {mode === "repl" && <Text size="sm" c="dimmed">Enter runs the line, Shift+Enter adds another.</Text>}
          </Group>
          <RunStatus run={run} starting="Starting Python…" />
        </Group>
      </Card>

      <Panes
        panel={mode === "repl"
          ? (
            <Variables
              busy={busy}
              scope={sessionScope}
              empty={sessionMessage(run, sessionScope, session)}
              section={IMPORTED}
            />
          )
          : <Variables busy={busy} scope={scope} empty={runMessage(run, scope)} section={IMPORTED} />}
      >
        {mode === "repl"
          ? (
            <Repl
              session={session}
              busy={busy}
              line={line}
              marks={MARKS}
              label="Python prompt"
              empty="Python starts on the first line entered here."
              onLine={setLine}
              onEnter={handleEnter}
              onAbandon={handleAbandon}
            />
          )
          : (
            <Paper
              withBorder
              shadow="sm"
              radius="md"
              className="split-main"
              style={{ position: "relative", overflow: "hidden" }}
            >
              <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                <CodeMirror
                  value={codeRef.current}
                  height="100%"
                  style={EDITOR_STYLE}
                  theme="dark"
                  extensions={EDITOR_EXTENSIONS}
                  onCreateEditor={(view) => {
                    self.pythonEditor = view;
                  }}
                  onChange={handleChange}
                />
              </Box>
            </Paper>
          )}
      </Panes>

      {mode === "script" && (
        <Paper
          withBorder
          shadow="sm"
          radius="md"
          style={{ flex: 1, minHeight: "8rem", overflow: "auto", backgroundColor: EDITOR_BACKGROUND }}
        >
          <Text
            component="pre"
            role="log"
            aria-label="Script output"
            ff="monospace"
            fz={EDITOR_STYLE.fontSize}
            p="sm"
            m={0}
            c={output === null ? "dimmed" : undefined}
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {output === null ? "Nothing has run yet." : dropped ? DROPPED_NOTE + output : output}
          </Text>

          {run.state === "finished" && (
            <Text ff="monospace" fz={EDITOR_STYLE.fontSize} c="dimmed" px="sm" pb="sm" mt="xl">
              {runStats(run.seconds, output, dropped)}
            </Text>
          )}
        </Paper>
      )}
    </Stack>
  );
}

function runMessage(run: Run, scope: Scope | null): string {
  if (isWorking(run)) return "Variables are read when the run ends.";
  if (scope) return "The script defined no variables.";
  if (run.state === "stopped") return "The run was stopped before its variables could be read.";
  return "Nothing has run yet.";
}

function sessionMessage(run: Run, scope: Scope | null, session: Session): string {
  if (isWorking(run)) return "Variables are read when the line returns.";
  if (scope) return "The session has bound no names.";
  if (session.entries.length > 0) return "The interpreter was stopped, and the session's names went with it.";
  return "Nothing has been entered yet.";
}

function readReply(payload: string): { incomplete: boolean; scope: Scope | null } {
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

function startWorker(receive: (chunk: Chunk) => void): Promise<PyodideWorker> {
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

type Mode = "script" | "repl";

type PyodideWorker = Worker & {
  sync: {
    run: (code: string) => Promise<string>;
    repl: (source: string) => Promise<string>;
  };
};

const startPyWorker = PyWorker as (file: string, options: { version: string }) => Promise<PyodideWorker>;

const IMPORTED = { label: "Imported", one: "name", many: "names" };

const MARKS = { prompt: ">>>", continued: "..." };

const STOPPED_NOTE = "Stopped, and the session's names went with the interpreter.";

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

const SAMPLE_SCRIPT = `import sys
from datetime import datetime, timezone

print(f"Python {sys.version.split()[0]}")
print(datetime.now(timezone.utc).isoformat(timespec="seconds"))
`;

const EDITOR_EXTENSIONS = [
  pythonLanguage(),
  EditorView.lineWrapping,
  ...EDITOR_SURFACE,
];

declare global {
  var pythonEditor: EditorView | undefined;
  var flushScriptOutput: () => void;
}
