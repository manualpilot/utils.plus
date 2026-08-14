import { Box, Group, Paper, Text, Textarea } from "@mantine/core";
import { type CSSProperties, type KeyboardEvent, memo, type UIEvent, useEffect, useRef } from "react";
import { EDITOR_BACKGROUND, EDITOR_STYLE } from "./editor-theme";
import { DROPPED_NOTE, MAX_OUTPUT } from "./run-output";

export function Repl({ session, busy, line, marks, label, empty, onLine, onEnter, onAbandon }: ReplProps) {
  const log = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);
  const stuck = useRef(true);
  const recalled = useRef<number | null>(null);

  useEffect(() => {
    const view = log.current;
    if (view && stuck.current) view.scrollTop = view.scrollHeight;
  });

  useEffect(() => {
    if (!busy) prompt.current?.focus();
  }, [busy]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const view = event.currentTarget;
    stuck.current = view.scrollHeight - view.scrollTop - view.clientHeight < STICK_SLACK;
  };

  const handleClick = () => {
    if (getSelection()?.isCollapsed !== false) prompt.current?.focus();
  };

  const recall = (step: number) => {
    const past = session.entries.filter((entry) => entry.lines.length > 0);
    if (past.length === 0) return;
    const at = Math.min(Math.max((recalled.current ?? past.length) + step, 0), past.length);
    recalled.current = at === past.length ? null : at;
    onLine(at === past.length ? "" : past[at].lines.join("\n"));
  };

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const field = event.currentTarget;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!line.trim() && !session.current) return;
      recalled.current = null;
      onEnter(line);
    } else if (event.key === "Escape" && session.current) {
      event.preventDefault();
      recalled.current = null;
      onAbandon();
    } else if (event.key === "ArrowUp" && field.value.lastIndexOf("\n", field.selectionStart - 1) === -1) {
      event.preventDefault();
      recall(-1);
    } else if (event.key === "ArrowDown" && field.value.indexOf("\n", field.selectionStart) === -1) {
      event.preventDefault();
      recall(1);
    }
  };

  return (
    <Paper
      withBorder
      shadow="sm"
      radius="md"
      className="split-main"
      style={{ position: "relative", overflow: "hidden", backgroundColor: EDITOR_BACKGROUND }}
    >
      <Box
        ref={log}
        role="log"
        aria-label="REPL output"
        p="sm"
        style={LOG_INSET}
        onScroll={handleScroll}
        onClick={handleClick}
      >
        {session.entries.length === 0 && !session.current && <Text size="sm" c="dimmed" mb="xs">{empty}</Text>}
        {session.entries.map((entry, index) => <Answered key={index} entry={entry} marks={marks} />)}
        {session.current && <Answered entry={session.current} marks={marks} />}

        <Group align="flex-start" gap="xs" wrap="nowrap">
          <span style={PROMPT_MARK}>{session.current && !busy ? marks.continued : marks.prompt}</span>
          <Textarea
            ref={prompt}
            aria-label={label}
            variant="unstyled"
            autosize
            minRows={1}
            spellCheck={false}
            autoComplete="off"
            disabled={busy}
            value={line}
            onChange={(event) => onLine(event.currentTarget.value)}
            onKeyDown={handleKey}
            flex={1}
            miw={0}
            styles={{ input: PROMPT_INPUT }}
          />
        </Group>
      </Box>
    </Paper>
  );
}

const Answered = memo(function Answered({ entry, marks }: { entry: Entry; marks: Marks }) {
  const written = entry.output.endsWith("\n") ? entry.output.slice(0, -1) : entry.output;

  return (
    <>
      {entry.lines.map((line, index) => (
        <Box key={index} style={CONSOLE_LINE}>
          <span style={PROMPT_MARK}>{index === 0 ? marks.prompt : marks.continued}</span> {line}
        </Box>
      ))}
      {(written || entry.dropped) && <Box style={CONSOLE_LINE}>{entry.dropped ? DROPPED_NOTE + written : written}</Box>}
      {entry.note && <Text size="xs" c="dimmed" fs="italic">{entry.note}</Text>}
    </>
  );
});

export interface Entry {
  lines: string[];
  output: string;
  dropped: boolean;
  note?: string;
}

export interface Session {
  entries: Entry[];
  current: Entry | null;
}

export interface Marks {
  prompt: string;
  continued: string;
}

interface ReplProps {
  session: Session;
  busy: boolean;
  line: string;
  marks: Marks;
  label: string;
  empty: string;
  onLine: (line: string) => void;
  onEnter: (line: string) => void;
  onAbandon: () => void;
}

export const NO_SESSION: Session = { entries: [], current: null };
export const BLANK_ENTRY: Entry = { lines: [], output: "", dropped: false };

export const ABANDONED = "Abandoned, so none of it ran.";

export function written(entry: Entry, text: string, dropped: boolean): Entry {
  const next = entry.output + text;
  const kept = next.length > MAX_OUTPUT ? next.slice(-MAX_OUTPUT) : next;
  return { ...entry, output: kept, dropped: entry.dropped || dropped || kept.length < next.length };
}

const LOG_INSET: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "auto",
  cursor: "text",
};

const CONSOLE_TEXT: CSSProperties = {
  fontFamily: "var(--mantine-font-family-monospace)",
  fontSize: EDITOR_STYLE.fontSize,
  lineHeight: 1.55,
};

const CONSOLE_LINE: CSSProperties = { ...CONSOLE_TEXT, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

const PROMPT_MARK: CSSProperties = { ...CONSOLE_TEXT, color: "var(--mantine-color-dimmed)", flex: "0 0 auto" };

const PROMPT_INPUT: CSSProperties = { ...CONSOLE_TEXT, padding: 0, minHeight: 0, color: "var(--mantine-color-text)" };

const STICK_SLACK = 32;
