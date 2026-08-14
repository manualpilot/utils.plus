import { StreamLanguage } from "@codemirror/language";
import { Box, Button, Card, Group, Paper, Select, Stack, Text } from "@mantine/core";
import CodeMirror, { Decoration, type DecorationSet, type EditorState, EditorView, type Extension, type Range, StateEffect, type StateEffectType, StateField } from "@uiw/react-codemirror";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE, EDITOR_SURFACE } from "../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconArrowsLeftRight, IconGitCompare } from "../icons";

export default function Diff() {
  const initialState = useInitialHashState<{
    left?: string;
    right?: string;
    language?: string;
    diffed?: boolean;
  }>();

  const [initialLeft] = useState(() => initialState?.left ?? SAMPLE_LEFT);
  const [initialRight] = useState(() => initialState?.right ?? SAMPLE_RIGHT);
  const leftText = useRef(initialLeft);
  const rightText = useRef(initialRight);
  const leftView = useRef<EditorView | null>(null);
  const rightView = useRef<EditorView | null>(null);
  const pendingDiff = useRef(initialState?.diffed === true);
  const showing = useRef(false);

  const sharedLanguage = initialState?.language;
  const [language, setLanguage] = useState(() => isLanguage(sharedLanguage) ? sharedLanguage : "text");
  const [languageSupport, setLanguageSupport] = useState<Extension | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);

  const syncShareState = useRegisterShareState(() => ({
    left: leftText.current,
    right: rightText.current,
    language,
    diffed: result ? true : undefined,
  }));

  useEffect(() => {
    const load = LANGUAGES.find((entry) => entry.value === language)?.load;
    if (!load) {
      setLanguageSupport(null);
      return;
    }

    let current = true;
    load().then((support) => {
      if (current) setLanguageSupport(support);
    });
    return () => {
      current = false;
    };
  }, [language]);

  useEffect(() => () => {
    self.diffEditors = undefined;
  }, []);

  const runDiff = useCallback(() => {
    const next = diffText(leftText.current, rightText.current);
    showing.current = true;
    setResult(next);
    leftView.current?.dispatch({ effects: LEFT_MARKS.set.of(next.left) });
    rightView.current?.dispatch({ effects: RIGHT_MARKS.set.of(next.right) });
  }, []);

  const publishViews = useCallback(() => {
    const left = leftView.current;
    const right = rightView.current;
    if (!left || !right) return;

    self.diffEditors = { left, right };
    if (!pendingDiff.current) return;
    pendingDiff.current = false;
    runDiff();
  }, [runDiff]);

  const handleLeftCreate = useCallback((view: EditorView) => {
    leftView.current = view;
    publishViews();
  }, [publishViews]);

  const handleRightCreate = useCallback((view: EditorView) => {
    rightView.current = view;
    publishViews();
  }, [publishViews]);

  const clearResult = useCallback((standing: EditorView | null, set: StateEffectType<LineMark[]>) => {
    if (!showing.current) return;
    showing.current = false;
    setResult(null);
    standing?.dispatch({ effects: set.of(NO_MARKS) });
  }, []);

  const handleLeftChange = useCallback((next: string) => {
    leftText.current = next;
    clearResult(rightView.current, RIGHT_MARKS.set);
    syncShareState();
  }, [clearResult, syncShareState]);

  const handleRightChange = useCallback((next: string) => {
    rightText.current = next;
    clearResult(leftView.current, LEFT_MARKS.set);
    syncShareState();
  }, [clearResult, syncShareState]);

  const handleSwap = useCallback(() => {
    const left = leftText.current;
    const right = rightText.current;
    replaceDoc(leftView.current, right);
    replaceDoc(rightView.current, left);
  }, []);

  const leftExtensions = useMemo(() => paneExtensions(LEFT_MARKS.extension, languageSupport), [languageSupport]);
  const rightExtensions = useMemo(() => paneExtensions(RIGHT_MARKS.extension, languageSupport), [languageSupport]);

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle file="diff.tsx">Diff</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="xl" justify="space-between">
          <Group align="flex-end" gap="sm">
            <Select
              label="Language"
              data={LANGUAGE_OPTIONS}
              value={language}
              onChange={(value) => value && setLanguage(value)}
              allowDeselect={false}
              searchable
              w={180}
            />
            <Button onClick={runDiff} leftSection={<IconGitCompare size="1rem" />}>
              Diff
            </Button>
            <Button variant="default" onClick={handleSwap} leftSection={<IconArrowsLeftRight size="1rem" />}>
              Swap
            </Button>
          </Group>
          {result && <Text size="sm" c="dimmed">{summarise(result)}</Text>}
        </Group>
      </Card>

      <Box className="diff-panes">
        <DiffPane
          label="Original"
          note={result && result.left.length > 0 ? `${plural(result.left.length, "line")} removed` : null}
          initialValue={initialLeft}
          extensions={leftExtensions}
          onCreateEditor={handleLeftCreate}
          onChange={handleLeftChange}
        />
        <DiffPane
          label="Changed"
          note={result && result.right.length > 0 ? `${plural(result.right.length, "line")} added` : null}
          initialValue={initialRight}
          extensions={rightExtensions}
          onCreateEditor={handleRightCreate}
          onChange={handleRightChange}
        />
      </Box>
    </Stack>
  );
}

interface DiffPaneProps {
  label: string;
  note: ReactNode;
  initialValue: string;
  extensions: Extension[];
  onCreateEditor: (view: EditorView) => void;
  onChange: (value: string) => void;
}

function DiffPane({ label, note, initialValue, extensions, onCreateEditor, onChange }: DiffPaneProps) {
  return (
    <Stack gap="xs" mih={0}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="sm" fw={500}>{label}</Text>
        {note && <Text size="sm" c="dimmed">{note}</Text>}
      </Group>
      <Paper withBorder shadow="sm" radius="md" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <CodeMirror
            value={initialValue}
            height="100%"
            style={EDITOR_STYLE}
            theme="dark"
            extensions={extensions}
            onCreateEditor={onCreateEditor}
            onChange={onChange}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

function replaceDoc(view: EditorView | null, text: string) {
  view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

function summarise(result: DiffResult): string {
  if (result.truncated) return "Too different to line up; everything between the matching ends is marked";
  if (result.left.length === 0 && result.right.length === 0) return "The documents are identical";
  return `${plural(result.left.length, "line")} removed, ${plural(result.right.length, "line")} added`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

const SAMPLE_LEFT = "The quick brown fox\njumps over the lazy dog.\nPack my box with five dozen liquor jugs.\n";
const SAMPLE_RIGHT = "The quick brown fox\nleaps over the lazy dog.\nHow vexingly quick daft zebras jump!\n"
  + "Pack my box with five dozen liquor jugs.\n";

interface LanguageEntry {
  value: string;
  label: string;
  load: (() => Promise<Extension>) | null;
}

const LANGUAGES: LanguageEntry[] = [
  { value: "text", label: "Plain Text", load: null },
  { value: "cpp", label: "C / C++", load: () => import("@codemirror/lang-cpp").then((m) => m.cpp()) },
  { value: "css", label: "CSS", load: () => import("@codemirror/lang-css").then((m) => m.css()) },
  { value: "go", label: "Go", load: () => import("@codemirror/lang-go").then((m) => m.go()) },
  { value: "html", label: "HTML", load: () => import("@codemirror/lang-html").then((m) => m.html()) },
  { value: "java", label: "Java", load: () => import("@codemirror/lang-java").then((m) => m.java()) },
  {
    value: "javascript",
    label: "JavaScript",
    load: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  },
  { value: "json", label: "JSON", load: () => import("@codemirror/lang-json").then((m) => m.json()) },
  { value: "markdown", label: "Markdown", load: () => import("@codemirror/lang-markdown").then((m) => m.markdown()) },
  { value: "php", label: "PHP", load: () => import("@codemirror/lang-php").then((m) => m.php()) },
  { value: "python", label: "Python", load: () => import("@codemirror/lang-python").then((m) => m.python()) },
  { value: "rust", label: "Rust", load: () => import("@codemirror/lang-rust").then((m) => m.rust()) },
  {
    value: "shell",
    label: "Shell",
    load: () => import("@codemirror/legacy-modes/mode/shell").then((m) => StreamLanguage.define(m.shell)),
  },
  { value: "sql", label: "SQL", load: () => import("@codemirror/lang-sql").then((m) => m.sql()) },
  {
    value: "typescript",
    label: "TypeScript",
    load: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true, typescript: true })),
  },
  { value: "xml", label: "XML", load: () => import("@codemirror/lang-xml").then((m) => m.xml()) },
  { value: "yaml", label: "YAML", load: () => import("@codemirror/lang-yaml").then((m) => m.yaml()) },
];

const LANGUAGE_OPTIONS = LANGUAGES.map(({ value, label }) => ({ value, label }));

function isLanguage(value: string | undefined): value is string {
  return LANGUAGES.some((entry) => entry.value === value);
}

const DIFF_THEME = EditorView.theme({
  ".cm-line.cm-diff-removed": { backgroundColor: "rgba(224, 49, 49, 0.16)" },
  ".cm-line.cm-diff-added": { backgroundColor: "rgba(47, 158, 68, 0.18)" },
  ".cm-diff-removed-text": { backgroundColor: "rgba(224, 49, 49, 0.4)" },
  ".cm-diff-added-text": { backgroundColor: "rgba(47, 158, 68, 0.45)" },
});

const BASE_EXTENSIONS = [EditorView.lineWrapping, ...EDITOR_SURFACE, DIFF_THEME];

function paneExtensions(marks: Extension, language: Extension | null): Extension[] {
  return language ? [...BASE_EXTENSIONS, marks, language] : [...BASE_EXTENSIONS, marks];
}

interface DiffMarks {
  extension: Extension;
  set: StateEffectType<LineMark[]>;
}

function diffMarks(lineClass: string, textClass: string): DiffMarks {
  const set = StateEffect.define<LineMark[]>();
  const lineDecoration = Decoration.line({ class: lineClass });
  const textDecoration = Decoration.mark({ class: textClass });

  const field = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(marks, tr) {
      for (const effect of tr.effects) {
        if (effect.is(set)) return buildDecorations(tr.state, effect.value, lineDecoration, textDecoration);
      }
      return tr.docChanged ? Decoration.none : marks;
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return { extension: field, set };
}

function buildDecorations(
  state: EditorState,
  marks: LineMark[],
  lineDecoration: Decoration,
  textDecoration: Decoration,
): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const mark of marks) {
    if (mark.line < 1 || mark.line > state.doc.lines) continue;
    const line = state.doc.line(mark.line);
    ranges.push(lineDecoration.range(line.from));

    for (const span of mark.spans) {
      const from = line.from + span.from;
      const to = Math.min(line.from + span.to, line.to);
      if (to > from) ranges.push(textDecoration.range(from, to));
    }
  }

  return Decoration.set(ranges, true);
}

const LEFT_MARKS = diffMarks("cm-diff-removed", "cm-diff-removed-text");
const RIGHT_MARKS = diffMarks("cm-diff-added", "cm-diff-added-text");

const NO_MARKS: LineMark[] = [];

export interface Span {
  from: number;
  to: number;
}

export interface LineMark {
  line: number;
  spans: Span[];
}

export interface DiffResult {
  left: LineMark[];
  right: LineMark[];
  truncated: boolean;
}

export function diffText(left: string, right: string): DiffResult {
  const a = left.split("\n");
  const b = right.split("\n");

  const intern = interner();
  const aLines = Int32Array.from(a, intern);
  const bLines = Int32Array.from(b, intern);

  let start = 0;
  while (start < aLines.length && start < bLines.length && aLines[start] === bLines[start]) start++;
  let aEnd = aLines.length;
  let bEnd = bLines.length;
  while (aEnd > start && bEnd > start && aLines[aEnd - 1] === bLines[bEnd - 1]) {
    aEnd--;
    bEnd--;
  }

  const ops = myers(aLines.subarray(start, aEnd), bLines.subarray(start, bEnd), MAX_LINE_EDITS);
  if (!ops) return coarseResult(start, aEnd, bEnd);

  const leftMarks: LineMark[] = [];
  const rightMarks: LineMark[] = [];

  for (const hunk of hunksFrom(ops)) {
    const pairs = Math.min(hunk.removed.length, hunk.added.length);
    const paired: (LinePair | null)[] = [];
    for (let i = 0; i < pairs; i++) {
      paired.push(wordSpans(a[hunk.removed[i] + start], b[hunk.added[i] + start]));
    }

    hunk.removed.forEach((index, i) => leftMarks.push({ line: index + start + 1, spans: paired[i]?.left ?? [] }));
    hunk.added.forEach((index, i) => rightMarks.push({ line: index + start + 1, spans: paired[i]?.right ?? [] }));
  }

  return { left: leftMarks, right: rightMarks, truncated: false };
}

function coarseResult(start: number, aEnd: number, bEnd: number): DiffResult {
  const left: LineMark[] = [];
  const right: LineMark[] = [];
  for (let i = start; i < aEnd; i++) left.push({ line: i + 1, spans: [] });
  for (let i = start; i < bEnd; i++) right.push({ line: i + 1, spans: [] });
  return { left, right, truncated: true };
}

const MAX_LINE_EDITS = 2000;

const MAX_WORD_LINE_LENGTH = 2000;
const MAX_WORD_EDITS = 400;

const MIN_WORD_SIMILARITY = 0.35;

interface LinePair {
  left: Span[];
  right: Span[];
}

function wordSpans(left: string, right: string): LinePair | null {
  if (left === "" || right === "") return null;
  if (left.length > MAX_WORD_LINE_LENGTH || right.length > MAX_WORD_LINE_LENGTH) return null;

  const a = tokenize(left);
  const b = tokenize(right);
  const intern = interner();
  const ops = myers(
    Int32Array.from(a, (token) => intern(token.text)),
    Int32Array.from(b, (token) => intern(token.text)),
    MAX_WORD_EDITS,
  );
  if (!ops) return null;

  let common = 0;
  for (const op of ops) {
    if (op.kind === "equal") common += a[op.a].text.length;
  }
  if (2 * common < MIN_WORD_SIMILARITY * (left.length + right.length)) return null;

  return { left: spansFrom(ops, a, "delete"), right: spansFrom(ops, b, "insert") };
}

interface Token {
  text: string;
  from: number;
}

const TOKEN_PATTERN = /[\p{L}\p{N}_]+|\s+|[^\s\p{L}\p{N}_]/gu;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    tokens.push({ text: match[0], from: match.index ?? 0 });
  }
  return tokens;
}

function spansFrom(ops: Op[], tokens: Token[], kind: "delete" | "insert"): Span[] {
  const spans: Span[] = [];

  for (const op of ops) {
    if (op.kind !== kind) continue;
    const token = tokens[kind === "delete" ? op.a : op.b];
    const last = spans[spans.length - 1];
    if (last && last.to === token.from) last.to = token.from + token.text.length;
    else spans.push({ from: token.from, to: token.from + token.text.length });
  }

  return spans;
}

function interner(): (value: string) => number {
  const ids = new Map<string, number>();
  return (value) => {
    const existing = ids.get(value);
    if (existing !== undefined) return existing;
    const id = ids.size;
    ids.set(value, id);
    return id;
  };
}

type OpKind = "equal" | "delete" | "insert";

interface Op {
  kind: OpKind;
  a: number;
  b: number;
}

interface Hunk {
  removed: number[];
  added: number[];
}

function hunksFrom(ops: Op[]): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  for (const op of ops) {
    if (op.kind === "equal") {
      current = null;
      continue;
    }
    if (!current) {
      current = { removed: [], added: [] };
      hunks.push(current);
    }
    if (op.kind === "delete") current.removed.push(op.a);
    else current.added.push(op.b);
  }

  return hunks;
}

function myers(a: Int32Array, b: Int32Array, maxEdits: number): Op[] | null {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = n + m + 1;
  const v = new Int32Array(2 * (n + m) + 3);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));

    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
        ? v[offset + k + 1]
        : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, n, m);
    }
  }

  return null;
}

function backtrack(trace: Int32Array[], n: number, m: number): Op[] {
  const ops: Op[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d--) {
    const frontier = trace[d];
    const at = (diagonal: number) => frontier[diagonal + d + 1];
    const k = x - y;
    const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const previousX = at(previousK);
    const previousY = previousX - previousK;

    while (x > previousX && y > previousY) {
      x--;
      y--;
      ops.push({ kind: "equal", a: x, b: y });
    }
    if (d === 0) break;

    if (x > previousX) ops.push({ kind: "delete", a: --x, b: -1 });
    else ops.push({ kind: "insert", a: -1, b: --y });
  }

  return ops.reverse();
}

declare global {
  var diffEditors: { left: EditorView; right: EditorView } | undefined;
}
