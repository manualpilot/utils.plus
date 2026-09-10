import { type JsonNode, printDocument, readDocument, stringOf } from "./document";
import { normalizedPath, type Segment } from "./path";

export interface Match {
  node: JsonNode;
  path: Segment[];
}

export type QueryResult = { ok: true; matches: Match[] } | { ok: false; error: string };

export function runQuery(document: JsonNode, query: string): QueryResult {
  let segments: QuerySegment[];
  try {
    segments = new Parser(query).query();
  } catch (fault) {
    if (!(fault instanceof QueryFault)) throw fault;
    return { ok: false, error: `${fault.message} at column ${fault.at + 1}` };
  }

  const root: Match = { node: document, path: [] };
  return { ok: true, matches: select([root], segments, root) };
}

interface QuerySegment {
  descendant: boolean;
  selectors: Selector[];
}

type Selector =
  | { kind: "name"; name: string }
  | { kind: "wildcard" }
  | { kind: "index"; index: number }
  | { kind: "slice"; start?: number; end?: number; step?: number }
  | { kind: "filter"; test: Logical };

type Logical =
  | { kind: "or"; parts: Logical[] }
  | { kind: "and"; parts: Logical[] }
  | { kind: "not"; operand: Logical }
  | { kind: "compare"; op: Operator; left: Comparable; right: Comparable }
  | { kind: "exists"; query: FilterQuery }
  | { kind: "test"; call: Call };

type Comparable =
  | { kind: "literal"; node: JsonNode }
  | { kind: "query"; query: FilterQuery }
  | { kind: "call"; call: Call };

interface FilterQuery {
  relative: boolean;
  segments: QuerySegment[];
}

interface Call {
  name: FunctionName;
  args: Comparable[];
}

type Operator = "==" | "!=" | "<=" | ">=" | "<" | ">";

const OPERATORS: Operator[] = ["==", "!=", "<=", ">=", "<", ">"];

type FunctionName = "length" | "count" | "value" | "match" | "search";

const FUNCTIONS: Record<FunctionName, { takes: ("value" | "nodes")[]; gives: "value" | "logical" }> = {
  length: { takes: ["value"], gives: "value" },
  count: { takes: ["nodes"], gives: "value" },
  value: { takes: ["nodes"], gives: "value" },
  match: { takes: ["value", "value"], gives: "logical" },
  search: { takes: ["value", "value"], gives: "logical" },
};

class QueryFault extends Error {
  constructor(message: string, readonly at: number) {
    super(message);
  }
}

class Parser {
  private at = 0;

  constructor(private readonly text: string) {}

  query(): QuerySegment[] {
    this.blank();
    if (!this.eat("$")) this.fail("a query starts with $");
    const segments = this.segments();
    this.blank();
    if (this.at < this.text.length) this.fail(`unexpected ${JSON.stringify(this.text[this.at])}`);
    return segments;
  }

  private fail(message: string, at = this.at): never {
    throw new QueryFault(message, at);
  }

  private blank() {
    while (BLANK.has(this.text[this.at])) this.at++;
  }

  private eat(token: string): boolean {
    if (!this.text.startsWith(token, this.at)) return false;
    this.at += token.length;
    return true;
  }

  private expect(token: string) {
    if (!this.eat(token)) this.fail(`expected ${JSON.stringify(token)}`);
  }

  private segments(): QuerySegment[] {
    const segments: QuerySegment[] = [];
    for (;;) {
      const before = this.at;
      this.blank();
      const segment = this.segment();
      if (!segment) {
        this.at = before;
        return segments;
      }
      segments.push(segment);
    }
  }

  private segment(): QuerySegment | null {
    if (this.eat("..")) {
      if (this.text[this.at] === "[") return { descendant: true, selectors: this.bracketed() };
      return { descendant: true, selectors: [this.dotted("..")] };
    }
    if (this.text[this.at] === "[") return { descendant: false, selectors: this.bracketed() };
    if (this.eat(".")) return { descendant: false, selectors: [this.dotted(".")] };
    return null;
  }

  private dotted(after: string): Selector {
    if (this.eat("*")) return { kind: "wildcard" };
    const name = this.shorthand();
    if (name === null) this.fail(`expected a name or * after ${after}`);
    return { kind: "name", name };
  }

  private shorthand(): string | null {
    const start = this.at;
    while (this.at < this.text.length) {
      const character = String.fromCodePoint(this.text.codePointAt(this.at)!);
      const allowed = this.at === start ? isNameStart(character) : isNameStart(character) || isDigit(character);
      if (!allowed) break;
      this.at += character.length;
    }
    return this.at === start ? null : this.text.slice(start, this.at);
  }

  private bracketed(): Selector[] {
    this.expect("[");
    this.blank();
    const selectors = [this.selector()];
    this.blank();
    while (this.eat(",")) {
      this.blank();
      selectors.push(this.selector());
      this.blank();
    }
    this.expect("]");
    return selectors;
  }

  private selector(): Selector {
    const next = this.text[this.at];
    if (next === "'" || next === "\"") return { kind: "name", name: this.string() };
    if (this.eat("*")) return { kind: "wildcard" };
    if (this.eat("?")) {
      this.blank();
      return { kind: "filter", test: this.or() };
    }

    const start = this.integer();
    this.blank();
    if (!this.eat(":")) {
      if (start === undefined) this.fail("expected a name, an index, a slice, * or a filter");
      return { kind: "index", index: start };
    }
    this.blank();
    const end = this.integer();
    this.blank();
    let step: number | undefined;
    if (this.eat(":")) {
      this.blank();
      step = this.integer();
    }
    return { kind: "slice", start, end, step };
  }

  private integer(): number | undefined {
    INTEGER.lastIndex = this.at;
    const match = INTEGER.exec(this.text);
    if (!match) return undefined;
    this.at += match[0].length;
    return Number(match[0]);
  }

  private string(): string {
    const quote = this.text[this.at++];
    let spelled = "";
    for (;;) {
      const character = this.text[this.at++];
      if (character === undefined) this.fail("a string is never closed");
      if (character === quote) return spelled;
      if (character < " ") this.fail("a control character has to be escaped", this.at - 1);
      if (character !== "\\") {
        spelled += character;
        continue;
      }
      const escape = this.text[this.at++];
      if (escape === "u") {
        const hex = this.text.slice(this.at, this.at + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("a \\u escape needs four hex digits");
        spelled += String.fromCharCode(parseInt(hex, 16));
        this.at += 4;
      } else if (escape === quote || STRING_ESCAPES[escape] !== undefined) {
        spelled += STRING_ESCAPES[escape] ?? escape;
      } else {
        this.fail(`\\${escape ?? ""} is not an escape`, this.at - 2);
      }
    }
  }

  private or(): Logical {
    const parts = [this.and()];
    while (this.blankThen("||")) {
      this.blank();
      parts.push(this.and());
    }
    return parts.length === 1 ? parts[0] : { kind: "or", parts };
  }

  private and(): Logical {
    const parts = [this.basic()];
    while (this.blankThen("&&")) {
      this.blank();
      parts.push(this.basic());
    }
    return parts.length === 1 ? parts[0] : { kind: "and", parts };
  }

  private blankThen(token: string): boolean {
    const before = this.at;
    this.blank();
    if (this.eat(token)) return true;
    this.at = before;
    return false;
  }

  private basic(): Logical {
    this.blank();
    if (this.eat("!")) {
      this.blank();
      return { kind: "not", operand: this.eat("(") ? this.parenthesised() : this.testOnly() };
    }
    if (this.eat("(")) return this.parenthesised();

    const start = this.at;
    const left = this.comparable();
    const before = this.at;
    this.blank();
    const op = OPERATORS.find((operator) => this.eat(operator));
    if (!op) {
      this.at = before;
      return this.asTest(left, start);
    }

    this.blank();
    const rightStart = this.at;
    const right = this.comparable();
    this.checkValue(left, start);
    this.checkValue(right, rightStart);
    return { kind: "compare", op, left, right };
  }

  private parenthesised(): Logical {
    this.blank();
    const inner = this.or();
    this.blank();
    this.expect(")");
    return inner;
  }

  private testOnly(): Logical {
    const start = this.at;
    return this.asTest(this.comparable(), start);
  }

  private asTest(operand: Comparable, at: number): Logical {
    if (operand.kind === "query") return { kind: "exists", query: operand.query };
    if (operand.kind === "call" && FUNCTIONS[operand.call.name].gives === "logical") {
      return { kind: "test", call: operand.call };
    }
    if (operand.kind === "call") this.fail(`${operand.call.name}() gives a value, so compare it with something`, at);
    return this.fail("a literal on its own is not a test, so compare it with something", at);
  }

  private checkValue(operand: Comparable, at: number) {
    if (operand.kind === "query" && !isSingular(operand.query)) {
      this.fail("a comparison needs a query naming one place, with no *, slice, filter or ..", at);
    }
    if (operand.kind === "call" && FUNCTIONS[operand.call.name].gives !== "value") {
      this.fail(`${operand.call.name}() is a test and not a value`, at);
    }
  }

  private comparable(): Comparable {
    const next = this.text[this.at];
    if (next === "@" || next === "$") {
      this.at++;
      return { kind: "query", query: { relative: next === "@", segments: this.segments() } };
    }
    if (next === "'" || next === "\"") {
      return { kind: "literal", node: { kind: "scalar", type: "string", text: JSON.stringify(this.string()) } };
    }

    NUMBER.lastIndex = this.at;
    const number = NUMBER.exec(this.text);
    if (number) {
      this.at += number[0].length;
      return { kind: "literal", node: { kind: "scalar", type: "number", text: number[0] } };
    }

    WORD.lastIndex = this.at;
    const word = WORD.exec(this.text)?.[0];
    if (word === undefined) return this.fail("expected a value, a query or a function");
    const start = this.at;
    this.at += word.length;
    if (word === "true" || word === "false" || word === "null") {
      return { kind: "literal", node: { kind: "scalar", type: word, text: word } };
    }
    if (this.text[this.at] !== "(") this.fail(`unexpected ${JSON.stringify(word)}`, start);
    if (!(word in FUNCTIONS)) this.fail(`there is no function called ${word}()`, start);
    return { kind: "call", call: this.call(word as FunctionName, start) };
  }

  private call(name: FunctionName, start: number): Call {
    this.expect("(");
    this.blank();
    const args: { operand: Comparable; at: number }[] = [];
    if (this.text[this.at] !== ")") {
      do {
        this.blank();
        args.push({ at: this.at, operand: this.comparable() });
        this.blank();
      } while (this.eat(","));
    }
    this.expect(")");

    const { takes } = FUNCTIONS[name];
    if (args.length !== takes.length) {
      this.fail(`${name}() takes ${takes.length} argument${takes.length === 1 ? "" : "s"}`, start);
    }
    takes.forEach((kind, index) => {
      const { operand, at } = args[index];
      if (kind === "value") this.checkValue(operand, at);
      else if (operand.kind !== "query") this.fail(`${name}() takes a query`, at);
    });
    return { name, args: args.map(({ operand }) => operand) };
  }
}

const BLANK = new Set([" ", "\t", "\n", "\r"]);

const INTEGER = /-?(?:0|[1-9]\d*)/y;
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD = /[a-z][a-z0-9_]*/y;

const STRING_ESCAPES: Record<string, string> = {
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  "/": "/",
  "\\": "\\",
};

const isNameStart = (character: string) => /^[A-Za-z_]$/.test(character) || character.codePointAt(0)! >= 0x80;
const isDigit = (character: string) => character >= "0" && character <= "9";

const isSingular = (query: FilterQuery) =>
  query.segments.every(({ descendant, selectors }) =>
    !descendant && selectors.length === 1 && (selectors[0].kind === "name" || selectors[0].kind === "index")
  );

function select(input: Match[], segments: QuerySegment[], root: Match): Match[] {
  let current = input;
  for (const segment of segments) {
    const next: Match[] = [];
    for (const match of current) {
      for (const target of segment.descendant ? descendants(match) : [match]) {
        for (const selector of segment.selectors) apply(selector, target, root, next);
      }
    }
    current = next;
  }
  return current;
}

function childrenOf({ node, path }: Match): Match[] {
  if (node.kind === "object") return node.entries.map(({ name, value }) => ({ node: value, path: [...path, name] }));
  if (node.kind === "array") return node.items.map((item, index) => ({ node: item, path: [...path, index] }));
  return [];
}

function descendants(match: Match): Match[] {
  const out: Match[] = [];
  const visit = (current: Match) => {
    out.push(current);
    childrenOf(current).forEach(visit);
  };
  visit(match);
  return out;
}

function apply(selector: Selector, target: Match, root: Match, out: Match[]) {
  const { node, path } = target;

  if (selector.kind === "name") {
    if (node.kind === "object") {
      for (const { name, value } of node.entries) {
        if (name === selector.name) out.push({ node: value, path: [...path, name] });
      }
    }
  } else if (selector.kind === "wildcard") {
    out.push(...childrenOf(target));
  } else if (selector.kind === "index") {
    if (node.kind !== "array") return;
    const index = selector.index < 0 ? node.items.length + selector.index : selector.index;
    if (index >= 0 && index < node.items.length) out.push({ node: node.items[index], path: [...path, index] });
  } else if (selector.kind === "slice") {
    if (node.kind !== "array") return;
    for (const index of sliceIndices(node.items.length, selector)) {
      out.push({ node: node.items[index], path: [...path, index] });
    }
  } else {
    for (const child of childrenOf(target)) if (test(selector.test, child, root)) out.push(child);
  }
}

function sliceIndices(
  length: number,
  { start, end, step = 1 }: { start?: number; end?: number; step?: number },
): number[] {
  const indices: number[] = [];
  if (step === 0) return indices;
  const normal = (index: number) => index >= 0 ? index : length + index;

  if (step > 0) {
    const lower = Math.min(Math.max(normal(start ?? 0), 0), length);
    const upper = Math.min(Math.max(normal(end ?? length), 0), length);
    for (let index = lower; index < upper; index += step) indices.push(index);
  } else {
    const upper = Math.min(Math.max(normal(start ?? length - 1), -1), length - 1);
    const lower = Math.min(Math.max(end === undefined ? -1 : normal(end), -1), length - 1);
    for (let index = upper; index > lower; index += step) indices.push(index);
  }
  return indices;
}

function test(logical: Logical, current: Match, root: Match): boolean {
  switch (logical.kind) {
    case "or":
      return logical.parts.some((part) => test(part, current, root));
    case "and":
      return logical.parts.every((part) => test(part, current, root));
    case "not":
      return !test(logical.operand, current, root);
    case "exists":
      return nodesOf(logical.query, current, root).length > 0;
    case "test":
      return callTest(logical.call, current, root);
    case "compare":
      return compare(logical.op, valueOf(logical.left, current, root), valueOf(logical.right, current, root));
  }
}

function nodesOf(query: FilterQuery, current: Match, root: Match): Match[] {
  return select([query.relative ? current : root], query.segments, root);
}

function valueOf(operand: Comparable, current: Match, root: Match): JsonNode | undefined {
  if (operand.kind === "literal") return operand.node;
  if (operand.kind === "call") return callValue(operand.call, current, root);
  return nodesOf(operand.query, current, root).at(-1)?.node;
}

function callValue(call: Call, current: Match, root: Match): JsonNode | undefined {
  const [argument] = call.args;
  if (call.name === "count") return numberNode(nodesOf(queryOf(argument), current, root).length);
  if (call.name === "value") {
    const nodes = nodesOf(queryOf(argument), current, root);
    return nodes.length === 1 ? nodes[0].node : undefined;
  }

  const value = valueOf(argument, current, root);
  if (!value) return undefined;
  const spelled = stringOf(value);
  if (spelled !== null) return numberNode([...spelled].length);
  if (value.kind === "array") return numberNode(value.items.length);
  if (value.kind === "object") return numberNode(value.entries.length);
  return undefined;
}

const queryOf = (operand: Comparable) => (operand as { query: FilterQuery }).query;

const numberNode = (count: number): JsonNode => ({ kind: "scalar", type: "number", text: String(count) });

function callTest(call: Call, current: Match, root: Match): boolean {
  const [subject, pattern] = call.args.map((argument) => valueOf(argument, current, root));
  const text = subject ? stringOf(subject) : null;
  const source = pattern ? stringOf(pattern) : null;
  if (text === null || source === null) return false;
  return patternOf(source, call.name === "match")?.test(text) ?? false;
}

const PATTERNS = new Map<string, RegExp | null>();

function patternOf(source: string, whole: boolean): RegExp | null {
  const key = `${whole ? "^" : ""}${source}`;
  if (!PATTERNS.has(key)) {
    try {
      PATTERNS.set(key, new RegExp(whole ? `^(?:${source})$` : source, "u"));
    } catch {
      PATTERNS.set(key, null);
    }
  }
  return PATTERNS.get(key)!;
}

function compare(op: Operator, left: JsonNode | undefined, right: JsonNode | undefined): boolean {
  switch (op) {
    case "==":
      return equal(left, right);
    case "!=":
      return !equal(left, right);
    case "<":
      return less(left, right);
    case "<=":
      return less(left, right) || equal(left, right);
    case ">":
      return less(right, left);
    case ">=":
      return less(right, left) || equal(left, right);
  }
}

function equal(left: JsonNode | undefined, right: JsonNode | undefined): boolean {
  if (!left || !right) return !left && !right;
  if (left.kind === "scalar" && right.kind === "scalar") {
    if (left.type !== right.type) return false;
    if (left.type === "number") return Number(left.text) === Number(right.text);
    if (left.type === "string") return stringOf(left) === stringOf(right);
    return true;
  }
  if (left.kind === "array" && right.kind === "array") {
    return left.items.length === right.items.length
      && left.items.every((item, index) => equal(item, right.items[index]));
  }
  if (left.kind === "object" && right.kind === "object") {
    const theirs = new Map(right.entries.map(({ name, value }) => [name, value]));
    const ours = new Map(left.entries.map(({ name, value }) => [name, value]));
    return ours.size === theirs.size
      && [...ours].every(([name, value]) => theirs.has(name) && equal(value, theirs.get(name)));
  }
  return false;
}

function less(left: JsonNode | undefined, right: JsonNode | undefined): boolean {
  if (left?.kind !== "scalar" || right?.kind !== "scalar" || left.type !== right.type) return false;
  if (left.type === "number") return Number(left.text) < Number(right.text);
  if (left.type === "string") return stringOf(left)! < stringOf(right)!;
  return false;
}

export type Answer = { ok: true; matches: number; text: string } | {
  ok: false;
  error: string;
  in: "query" | "document";
};

export function answerQuery(text: string, query: string, paths: boolean): Answer {
  const read = readDocument(text);
  if (!read.ok) return { ok: false, error: read.error, in: "document" };

  const result = runQuery(read.node, query);
  if (!result.ok) return { ok: false, error: result.error, in: "query" };

  const items = result.matches.map(({ node, path }): JsonNode =>
    paths ? { kind: "scalar", type: "string", text: JSON.stringify(normalizedPath(path)) } : node
  );
  return { ok: true, matches: items.length, text: printDocument({ kind: "array", items }, RESULT_INDENT) };
}

const RESULT_INDENT = 2;

export function describeAnswer(answer: Answer | null): string {
  if (!answer) return "Type a JSONPath to query the document";
  if (answer.ok) return `${answer.matches} ${answer.matches === 1 ? "match" : "matches"}`;
  return answer.in === "document" ? answer.error : "Nothing to show until the query reads";
}
