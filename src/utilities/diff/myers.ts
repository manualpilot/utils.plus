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

export function summarise(result: DiffResult): string {
  if (result.truncated) return "Too different to line up; everything between the matching ends is marked";
  if (result.left.length === 0 && result.right.length === 0) return "The documents are identical";
  return `${plural(result.left.length, "line")} removed, ${plural(result.right.length, "line")} added`;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
