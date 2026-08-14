import { javascript as javascriptLanguage } from "@codemirror/lang-javascript";
import { Box, Button, Card, Group, Paper, SegmentedControl, Stack, Text } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { EDITOR_BACKGROUND, EDITOR_STYLE, EDITOR_SURFACE } from "../common/editor-theme";
import { ABANDONED, BLANK_ENTRY, type Entry, NO_SESSION, Repl, type Session, written } from "../common/repl-console";
import { type Chunk, DRAW_DELAY, DROPPED_NOTE, IDLE, isWorking, MAX_OUTPUT, message, NOTHING_HELD, type Run, runStats, RunStatus } from "../common/run-output";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { Panes } from "../common/split-panes";
import { UtilityTitle } from "../common/utility-title";
import { type Scope, Variables } from "../common/variables-panel";
import { IconPlayerPlay, IconPlayerStop } from "../icons";
import type { Language } from "./javascript-engine";
import { unfinished } from "./javascript-syntax";
import type { Message, Request } from "./javascript-worker";

export default function JavaScript() {
  const initialState = useInitialHashState<{
    mode?: string;
    language?: string;
    code?: string;
    line?: string;
  }>();

  const [mode, setMode] = useState<Mode>(initialState?.mode === "repl" ? "repl" : "script");
  const opened: Language = initialState?.language === "typescript" ? "typescript" : "javascript";
  const [language, setLanguage] = useState<Language>(opened);

  const codeRef = useRef(initialState?.code ?? SAMPLES[opened]);

  const [output, setOutput] = useState<string | null>(null);
  const [dropped, setDropped] = useState(false);
  const [run, setRun] = useState<Run>(IDLE);

  const [scope, setScope] = useState<Scope | null>(null);

  const [session, setSession] = useState<Session>(NO_SESSION);
  const [sessionScope, setSessionScope] = useState<Scope | null>(null);
  const [line, setLine] = useState(initialState?.line ?? "");

  const workerRef = useRef<Worker | null>(null);
  const waiting = useRef(new Map<number, (message: Message) => void>());
  const runId = useRef(0);

  const held = useRef<Chunk>(NOTHING_HELD);
  const drawing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef("");
  const sink = useRef<Mode>("script");

  const syncShareState = useRegisterShareState(() => ({
    mode,
    language,
    code: mode === "script" ? codeRef.current : undefined,
    line: mode === "repl" && line ? line : undefined,
  }));

  useEffect(() => () => {
    self.javascriptEditor = undefined;
  }, []);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    waiting.current.clear();
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

  const makeWorker = useCallback(() => {
    const worker = new Worker(new URL("./javascript-worker.ts", import.meta.url), { type: "module" });

    worker.onmessage = ({ data }: MessageEvent<Message>) => {
      if (data.kind === "output") return receive({ text: data.text, dropped: data.dropped });
      if (data.kind === "started") return setRun({ state: "running" });

      const settle = waiting.current.get(data.id);
      waiting.current.delete(data.id);
      settle?.(data);
    };

    worker.onerror = (event) => {
      const failed = event.message || COULD_NOT_START;
      for (const [id, settle] of waiting.current) settle({ kind: "done", id, failed });
      waiting.current.clear();
    };

    return worker;
  }, [receive]);

  const ask = useCallback((request: Request) => {
    const worker = workerRef.current ?? (workerRef.current = makeWorker());

    return new Promise<Message>((settle) => {
      waiting.current.set(request.id, settle);
      worker.postMessage(request);
    });
  }, [makeWorker]);

  const handleChange = useCallback((next: string) => {
    codeRef.current = next;
    syncShareState();
  }, [syncShareState]);

  const handleLanguage = useCallback((next: Language) => {
    if (codeRef.current === SAMPLES[language]) codeRef.current = SAMPLES[next];
    setLanguage(next);
  }, [language]);

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

    const answer = await ask({ id, kind: "run", code: codeRef.current, language });
    if (runId.current !== id || answer.kind !== "done") return;

    draw();
    if (answer.failed !== undefined) {
      stopWorker();
      setRun({ state: "failed", message: answer.failed });
      return;
    }

    setScope(answer.scope ?? null);
    setRun({ state: "finished", seconds: answer.seconds ?? 0 });
  }, [ask, draw, language, stopWorker]);

  const handleEnter = useCallback(async (text: string) => {
    const block: Entry = {
      ...(session.current ?? BLANK_ENTRY),
      lines: [...(session.current?.lines ?? []), ...text.split("\n")],
    };
    setSession((session) => ({ ...session, current: block }));
    setLine("");

    const source = block.lines.join("\n");
    if (unfinished(source)) return;

    const id = ++runId.current;
    const booting = workerRef.current === null;
    sink.current = "repl";
    setRun({ state: booting ? "starting" : "running" });

    const answer = await ask({ id, kind: "enter", code: source, language });
    if (runId.current !== id || answer.kind !== "done") return;

    draw();
    if (answer.failed !== undefined) {
      stopWorker();
      setRun({ state: "failed", message: answer.failed });
      endSession(answer.failed);
      return;
    }

    setRun(IDLE);
    setSession((session) => ({ entries: [...session.entries, session.current ?? block], current: null }));
    setSessionScope(answer.scope ?? null);
  }, [ask, draw, endSession, language, session, stopWorker]);

  const handleAbandon = useCallback(() => {
    setLine("");
    setSession((session) =>
      session.current
        ? { entries: [...session.entries, { ...session.current, note: ABANDONED }], current: null }
        : session
    );
  }, []);

  const busy = isWorking(run);
  const spoken = LANGUAGE_NAMES[language];

  return (
    <Stack flex={1} mih={0} gap="md">
      <Group justify="space-between" align="center" wrap="nowrap">
        <UtilityTitle file="javascript.tsx">JavaScript</UtilityTitle>
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          data={[{ value: "script", label: "Script" }, { value: "repl", label: "REPL" }]}
        />
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="xl" justify="space-between" wrap="nowrap">
          <Group align="center" gap="sm">
            <SegmentedControl
              size="xs"
              value={language}
              onChange={(value) => handleLanguage(value as Language)}
              aria-label="Language"
              data={[{ value: "javascript", label: "JavaScript" }, { value: "typescript", label: "TypeScript" }]}
            />
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
          <RunStatus run={run} starting={`Starting ${spoken}…`} />
        </Group>
      </Card>

      <Panes
        panel={mode === "repl"
          ? (
            <Variables
              busy={busy}
              scope={sessionScope}
              empty={sessionMessage(run, sessionScope, session)}
              section={FUNCTIONS}
            />
          )
          : <Variables busy={busy} scope={scope} empty={runMessage(run, scope)} section={FUNCTIONS} />}
      >
        {mode === "repl"
          ? (
            <Repl
              session={session}
              busy={busy}
              line={line}
              marks={MARKS}
              label={`${spoken} prompt`}
              empty={`${spoken} starts on the first line entered here.`}
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
                  extensions={EDITOR_EXTENSIONS[language]}
                  onCreateEditor={(view) => {
                    self.javascriptEditor = view;
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
  if (session.entries.length > 0) return "The engine was stopped, and the session's names went with it.";
  return "Nothing has been entered yet.";
}

type Mode = "script" | "repl";

const COULD_NOT_START = "The engine could not be started.";

const FUNCTIONS = { label: "Functions", one: "name", many: "names" };

const MARKS = { prompt: ">", continued: "..." };

const STOPPED_NOTE = "Stopped, and the session's names went with the engine.";

const LANGUAGE_NAMES: Record<Language, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
};

const SAMPLES: Record<Language, string> = {
  javascript: `const now = new Date().toISOString();
const counts = Object.groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? "odd" : "even"));

console.log(\`Running at \${now}\`);
console.log(counts);
`,
  typescript: `interface Reading {
  label: string;
  value: number;
}

const readings: Reading[] = [
  { label: "first", value: 3 },
  { label: "second", value: 4 },
];

const total = readings.reduce((sum, reading) => sum + reading.value, 0);
console.log(\`\${readings.length} readings, \${total} in total\`);
`,
};

const EDITOR_EXTENSIONS = {
  javascript: [javascriptLanguage(), EditorView.lineWrapping, ...EDITOR_SURFACE],
  typescript: [javascriptLanguage({ typescript: true }), EditorView.lineWrapping, ...EDITOR_SURFACE],
};

declare global {
  var javascriptEditor: EditorView | undefined;
}
