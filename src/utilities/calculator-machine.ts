import { randomBelow } from "../common/random";

export type Mode = "programmer" | "scientific";
export type Base = 8 | 10 | 16;
export type Bits = 8 | 16 | 32 | 64;
export type Angle = "deg" | "rad";

export type Value = bigint | number;

export const BASES: Base[] = [8, 10, 16];
export const WORD_SIZES: Bits[] = [8, 16, 32, 64];

export interface Machine {
  mode: Mode;
  base: Base;
  bits: Bits;
  angle: Angle;
  second: boolean;
  entry: string | null;
  value: Value;
  stack: Frame[];
  closes: number;
  repeat: Repeat | null;
  answered: string | null;
  memory: Value;
  error: string | null;
  awaiting: boolean;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  id: number;
  expression: string;
  result: string;
}

export interface Frame {
  op: BinaryKey | null;
  lhs: Value;
  closes: number;
}

export interface Repeat {
  op: BinaryKey;
  rhs: Value;
}

export function newMachine(mode: Mode = "programmer"): Machine {
  return {
    mode,
    base: 16,
    bits: 64,
    angle: "deg",
    second: false,
    entry: null,
    value: zero(mode),
    stack: [],
    closes: 0,
    repeat: null,
    answered: null,
    memory: zero(mode),
    error: null,
    awaiting: false,
    history: [],
  };
}

export function press(machine: Machine, key: Key): Machine {
  try {
    return route(machine, key);
  } catch (error) {
    return { ...clear(machine), error: reason(error) };
  }
}

const PRECEDENCE = {
  or: 1,
  nor: 1,
  xor: 2,
  and: 3,
  shl: 4,
  shr: 4,
  add: 5,
  sub: 5,
  mul: 6,
  div: 6,
  mod: 6,
  pow: 7,
  powOf: 7,
  root: 7,
  logBase: 7,
} as const;

export type BinaryKey = keyof typeof PRECEDENCE;

export const OPERATOR_SYMBOLS: Record<BinaryKey, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
  mod: "mod",
  and: "AND",
  or: "OR",
  xor: "XOR",
  nor: "NOR",
  shl: "<<",
  shr: ">>",
  pow: "^",
  powOf: "^ʸ",
  root: "ʸ√",
  logBase: "log",
};

const PROGRAMMER_BINARY: Partial<Record<BinaryKey, BinaryFn>> = {
  add: (a, b, m) => wrap(big(a) + big(b), m.bits),
  sub: (a, b, m) => wrap(big(a) - big(b), m.bits),
  mul: (a, b, m) => wrap(big(a) * big(b), m.bits),
  div: (a, b, m) => wrap(big(a) / nonZero(big(b)), m.bits),
  mod: (a, b, m) => wrap(big(a) % nonZero(big(b)), m.bits),
  and: (a, b, m) => wrap(big(a) & big(b), m.bits),
  or: (a, b, m) => wrap(big(a) | big(b), m.bits),
  xor: (a, b, m) => wrap(big(a) ^ big(b), m.bits),
  nor: (a, b, m) => wrap(~(big(a) | big(b)), m.bits),
  shl: (a, b, m) => shiftBy(a, big(b), m.bits),
  shr: (a, b, m) => shiftBy(a, -big(b), m.bits),
};

const SCIENTIFIC_BINARY: Partial<Record<BinaryKey, BinaryFn>> = {
  add: (a, b) => num(a) + num(b),
  sub: (a, b) => num(a) - num(b),
  mul: (a, b) => num(a) * num(b),
  div: (a, b) => num(a) / positive(num(b), "Cannot divide by zero", true),
  pow: (a, b) => Math.pow(num(a), num(b)),
  powOf: (a, b) => Math.pow(num(b), num(a)),
  root: (a, b) => nthRoot(num(a), num(b)),
  logBase: (a, b) => Math.log(logArgument(num(a))) / Math.log(logBase(num(b))),
};

const PROGRAMMER_UNARY = {
  not: (v: Value, m: Machine) => wrap(~big(v), m.bits),
  neg: (v: Value, m: Machine) => wrap(-big(v), m.bits),
  shl1: (v: Value, m: Machine) => shiftBy(v, 1n, m.bits),
  shr1: (v: Value, m: Machine) => shiftBy(v, -1n, m.bits),
  rol: (v: Value, m: Machine) => rotate(v, 1n, m.bits),
  ror: (v: Value, m: Machine) => rotate(v, -1n, m.bits),
  flip8: (v: Value, m: Machine) => reverseUnits(v, 8, m.bits),
  flip16: (v: Value, m: Machine) => reverseUnits(v, 16, m.bits),
};

const SCIENTIFIC_UNARY = {
  sqr: (v: Value) => num(v) ** 2,
  cube: (v: Value) => num(v) ** 3,
  recip: (v: Value) => 1 / positive(num(v), "Cannot divide by zero", true),
  sqrt: (v: Value) => Math.sqrt(notNegative(num(v), "Square root of a negative number")),
  cbrt: (v: Value) => Math.cbrt(num(v)),
  exp: (v: Value) => Math.exp(num(v)),
  exp10: (v: Value) => 10 ** num(v),
  exp2: (v: Value) => 2 ** num(v),
  ln: (v: Value) => Math.log(logArgument(num(v))),
  log10: (v: Value) => Math.log10(logArgument(num(v))),
  log2: (v: Value) => Math.log2(logArgument(num(v))),
  fact: (v: Value) => factorial(num(v)),
  sin: (v: Value, m: Machine) => Math.sin(toRadians(num(v), m)),
  cos: (v: Value, m: Machine) => Math.cos(toRadians(num(v), m)),
  tan: (v: Value, m: Machine) => Math.tan(toRadians(num(v), m)),
  asin: (v: Value, m: Machine) => fromRadians(Math.asin(withinOne(num(v))), m),
  acos: (v: Value, m: Machine) => fromRadians(Math.acos(withinOne(num(v))), m),
  atan: (v: Value, m: Machine) => fromRadians(Math.atan(num(v)), m),
  sinh: (v: Value) => Math.sinh(num(v)),
  cosh: (v: Value) => Math.cosh(num(v)),
  tanh: (v: Value) => Math.tanh(num(v)),
  asinh: (v: Value) => Math.asinh(num(v)),
  acosh: (v: Value) => Math.acosh(atLeastOne(num(v))),
  atanh: (v: Value) => Math.atanh(withinOne(num(v))),
};

export type UnaryKey = keyof typeof PROGRAMMER_UNARY | keyof typeof SCIENTIFIC_UNARY;

type BinaryFn = (a: Value, b: Value, m: Machine) => Value;
type UnaryFn = (v: Value, m: Machine) => Value;

interface Domain {
  binary: Partial<Record<BinaryKey, BinaryFn>>;
  unary: Partial<Record<UnaryKey, UnaryFn>>;
  parse(entry: string, m: Machine): Value;
  write(value: Value, m: Machine): string;
  settle(value: Value, m: Machine): Value;
}

const DOMAINS: Record<Mode, Domain> = {
  programmer: {
    binary: PROGRAMMER_BINARY,
    unary: PROGRAMMER_UNARY,
    parse: parseWord,
    write: writeWord,
    settle: (value, m) => wrap(big(value), m.bits),
  },
  scientific: {
    binary: SCIENTIFIC_BINARY,
    unary: SCIENTIFIC_UNARY,
    parse: (entry) => parseDecimal(entry),
    write: (value) => writeNumber(num(value)),
    settle: (value) => finite(num(value)),
  },
};

export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "A" | "B" | "C" | "D" | "E" | "F";

export type ControlKey =
  | "clear"
  | "back"
  | "equals"
  | "open"
  | "close"
  | "point"
  | "sign"
  | "ee"
  | "percent"
  | "pi"
  | "euler"
  | "rand"
  | "mc"
  | "mplus"
  | "mminus"
  | "mr"
  | "second"
  | "angle";

export type Key = Digit | "00" | "FF" | BinaryKey | UnaryKey | ControlKey;

function route(m: Machine, key: Key): Machine {
  if (m.error !== null) {
    if (key === "clear") return clear(m);
    if (!startsValue(key)) return m;
    m = clear(m);
  }

  if (isDigit(key)) return typeDigit(m, key);
  if (key in PRECEDENCE) return pushOperator(m, key as BinaryKey);
  if (isUnary(m, key)) return applyUnary(m, key as UnaryKey);

  switch (key) {
    case "clear":
      return clear(m);
    case "back":
      return backspace(m);
    case "equals":
      return equals(m);
    case "open":
      return {
        ...m,
        stack: [...m.stack, { op: null, lhs: zero(m.mode), closes: 0 }],
        entry: null,
        answered: null,
        awaiting: true,
      };
    case "close":
      return closeGroup(m);
    case "point":
      return typePoint(m);
    case "sign":
      return toggleSign(m);
    case "ee":
      return typeExponent(m);
    case "percent":
      return percentOf(m);
    case "pi":
      return settled(m, Math.PI);
    case "euler":
      return settled(m, Math.E);
    case "rand":
      return settled(m, randomBelow(0x100000000) / 0x100000000);
    case "mc":
      return { ...m, memory: zero(m.mode) };
    case "mplus":
      return { ...m, memory: combine(m, "add", m.memory, current(m)) };
    case "mminus":
      return { ...m, memory: combine(m, "sub", m.memory, current(m)) };
    case "mr":
      return { ...m, value: m.memory, entry: null, answered: null, awaiting: false };
    case "second":
      return { ...m, second: !m.second };
    case "angle":
      return { ...m, angle: m.angle === "deg" ? "rad" : "deg" };
    default:
      return m;
  }
}

export function current(m: Machine): Value {
  return m.entry === null ? m.value : DOMAINS[m.mode].parse(m.entry, m);
}

function clear(m: Machine): Machine {
  return {
    ...m,
    entry: null,
    value: zero(m.mode),
    stack: [],
    closes: 0,
    repeat: null,
    answered: null,
    error: null,
    awaiting: false,
  };
}

function typeDigit(m: Machine, key: string): Machine {
  const limit = m.mode === "programmer" ? m.base : 10;
  for (const character of key) {
    if (DIGITS.indexOf(character) >= limit) return m;
  }

  const started = m.entry ?? "";
  const next = started === "0" ? key : started === "-0" ? `-${key}` : started + key;
  if (!withinEntryLimits(next, m)) return m;

  return withEntry(m, next);
}

function typePoint(m: Machine): Machine {
  if (m.mode !== "scientific") return m;
  const started = m.entry ?? "0";
  if (started.includes(".") || started.includes("e")) return m;
  return withEntry(m, `${started}.`);
}

function typeExponent(m: Machine): Machine {
  if (m.mode !== "scientific") return m;
  const started = m.entry ?? writeValue(m, m.value);
  if (started.includes("e") || !/^-?\d*\.?\d*$/.test(started)) return m;
  return withEntry(m, `${started || "0"}e`);
}

function toggleSign(m: Machine): Machine {
  if (m.mode === "programmer") return applyUnary(m, "neg");
  if (m.entry === null) return settled(m, -num(m.value));

  const exponent = m.entry.indexOf("e");
  if (exponent === -1) {
    return withEntry(m, m.entry.startsWith("-") ? m.entry.slice(1) : `-${m.entry}`);
  }
  const power = m.entry.slice(exponent + 1);
  return withEntry(m, m.entry.slice(0, exponent + 1) + (power.startsWith("-") ? power.slice(1) : `-${power}`));
}

function percentOf(m: Machine): Machine {
  if (m.mode !== "scientific") return m;
  const share = num(current(m)) / 100;

  const pending = m.stack.at(-1);
  if (!pending || (pending.op !== "add" && pending.op !== "sub")) return settled(m, share);

  return settled(m, num(foldGroup(m, m.stack.slice(0, -1), pending.lhs, pending.closes)) * share);
}

function backspace(m: Machine): Machine {
  if (m.entry === null) return m;
  const shorter = m.entry.slice(0, -1);
  return shorter === "" || shorter === "-" ? { ...m, entry: null, value: zero(m.mode) } : withEntry(m, shorter);
}

function pushOperator(m: Machine, op: BinaryKey): Machine {
  if (!DOMAINS[m.mode].binary[op]) return m;

  const last = m.stack.at(-1);
  if (m.awaiting && last && last.op !== null) {
    const taken = { ...m, stack: m.stack.slice(0, -1), value: last.lhs, closes: last.closes, entry: null };
    return pushOperator({ ...taken, awaiting: false }, op);
  }

  const value = current(m);
  return {
    ...m,
    value,
    entry: null,
    stack: [...m.stack, { op, lhs: value, closes: m.closes }],
    closes: 0,
    repeat: null,
    answered: null,
    awaiting: true,
  };
}

function applyUnary(m: Machine, key: UnaryKey): Machine {
  const operation = DOMAINS[m.mode].unary[key];
  if (!operation) return m;
  return settled(m, operation(current(m), m));
}

function equals(m: Machine): Machine {
  const value = current(m);

  if (m.stack.length === 0) {
    if (!m.repeat) return settled(m, value);
    const repeated = `${writeValue(m, value)} ${OPERATOR_SYMBOLS[m.repeat.op]} ${writeValue(m, m.repeat.rhs)}`;
    return remember(settled(m, combine(m, m.repeat.op, value, m.repeat.rhs)), repeated);
  }

  const innermost = [...m.stack].reverse().find((frame) => frame.op !== null);
  const repeat = innermost?.op ? { op: innermost.op, rhs: value } : m.repeat;
  const expression = finishedExpression(m, value);
  const answer = settled(m, fold(m, m.stack, value, m.closes));
  return { ...remember(answer, expression), stack: [], closes: 0, repeat };
}

const MAX_HISTORY = 100;

function remember(m: Machine, expression: string): Machine {
  const id = m.history.length > 0 ? m.history[0].id + 1 : 1;
  const entry: HistoryEntry = { id, expression, result: writeValue(m, m.value) };
  return { ...m, answered: expression, history: [entry, ...m.history].slice(0, MAX_HISTORY) };
}

function finishedExpression(m: Machine, value: Value): string {
  return joinParts([...expressionParts(m), operandText(m, value, m.closes + openDepth(m))]);
}

function closeGroup(m: Machine): Machine {
  if (openDepth(m) === 0) return m;
  return { ...settled(m, current(m)), closes: m.closes + 1 };
}

function openDepth(m: Machine): number {
  const opened = m.stack.filter((frame) => frame.op === null).length;
  return opened - m.stack.reduce((closed, frame) => closed + frame.closes, 0) - m.closes;
}

function walk(m: Machine, frames: Frame[], value: Value, closes: number): Reading {
  const reading: Reading = { values: [], ops: [] };

  for (const frame of frames) {
    if (frame.op === null) {
      reading.ops.push(null);
      continue;
    }
    reading.values.push(frame.lhs);
    closeGroups(m, reading, frame.closes);
    while (bindsAtLeast(reading, PRECEDENCE[frame.op])) applyTop(m, reading);
    reading.ops.push(frame.op);
  }

  reading.values.push(value);
  closeGroups(m, reading, closes);
  return reading;
}

interface Reading {
  values: Value[];
  ops: (BinaryKey | null)[];
}

function fold(m: Machine, frames: Frame[], value: Value, closes: number): Value {
  const reading = walk(m, frames, value, closes);
  while (reading.ops.length > 0) {
    if (reading.ops[reading.ops.length - 1] === null) reading.ops.pop();
    else applyTop(m, reading);
  }
  return reading.values[reading.values.length - 1] ?? zero(m.mode);
}

function foldGroup(m: Machine, frames: Frame[], value: Value, closes: number): Value {
  const reading = walk(m, frames, value, closes);
  while (bindsAtLeast(reading, 0)) applyTop(m, reading);
  return reading.values[reading.values.length - 1] ?? zero(m.mode);
}

function closeGroups(m: Machine, reading: Reading, count: number): void {
  for (let closed = 0; closed < count; closed++) {
    while (bindsAtLeast(reading, 0)) applyTop(m, reading);
    reading.ops.pop();
  }
}

function bindsAtLeast(reading: Reading, minimum: number): boolean {
  const top = reading.ops[reading.ops.length - 1];
  return top !== undefined && top !== null && PRECEDENCE[top] >= minimum;
}

function applyTop(m: Machine, reading: Reading): void {
  const op = reading.ops.pop();
  const rhs = reading.values.pop();
  const lhs = reading.values.pop();
  if (op == null || rhs === undefined || lhs === undefined) throw new CalculatorError("That expression cannot be read");
  reading.values.push(combine(m, op, lhs, rhs));
}

function combine(m: Machine, op: BinaryKey, a: Value, b: Value): Value {
  const operation = DOMAINS[m.mode].binary[op];
  if (!operation) throw new CalculatorError("That operation belongs to the other mode");
  return DOMAINS[m.mode].settle(operation(a, b, m), m);
}

function settled(m: Machine, value: Value): Machine {
  return { ...m, value: DOMAINS[m.mode].settle(value, m), entry: null, answered: null, awaiting: false };
}

function withEntry(m: Machine, entry: string): Machine {
  return { ...m, entry, answered: null, awaiting: false };
}

export function setBase(m: Machine, base: Base): Machine {
  return { ...settled(m, safeCurrent(m)), base };
}

export function setBits(m: Machine, bits: Bits): Machine {
  const narrowed: Machine = { ...settled(m, safeCurrent(m)), bits };
  return {
    ...narrowed,
    value: wrap(big(narrowed.value), bits),
    memory: wrap(big(narrowed.memory), bits),
    stack: narrowed.stack.map((frame) => ({ ...frame, lhs: wrap(big(frame.lhs), bits) })),
  };
}

export function setMode(m: Machine, mode: Mode): Machine {
  if (mode === m.mode) return m;
  const carried = safeCurrent(m);
  const convert = (value: Value) => (mode === "programmer" ? wrap(big(value), m.bits) : num(value));

  return {
    ...m,
    mode,
    value: convert(carried),
    memory: convert(m.memory),
    entry: null,
    stack: [],
    closes: 0,
    repeat: null,
    answered: null,
    error: null,
    awaiting: false,
  };
}

export function toggleBit(m: Machine, index: number): Machine {
  if (m.mode !== "programmer" || index < 0 || index >= m.bits) return m;
  const flipped = pattern(safeCurrent(m), m.bits) ^ (1n << BigInt(index));
  return settled(m, signedOf(flipped, m.bits));
}

export function bitPattern(m: Machine): bigint {
  return pattern(safeCurrent(m), m.bits);
}

export function clearHistory(m: Machine): Machine {
  return { ...m, history: [] };
}

export function dropHistoryEntry(m: Machine, id: number): Machine {
  return { ...m, history: m.history.filter((entry) => entry.id !== id) };
}

export function hasMemory(m: Machine): boolean {
  return m.memory !== zero(m.mode);
}

export function display(m: Machine): string {
  if (m.error !== null) return "Error";
  return groupDigits(readout(m), m);
}

export function readout(m: Machine): string {
  if (m.error !== null) return "";
  return m.entry ?? writeValue(m, m.value);
}

export function writeValue(m: Machine, value: Value): string {
  return DOMAINS[m.mode].write(value, m);
}

export function expressionText(m: Machine): string {
  const parts = expressionParts(m);
  if (m.closes > 0) parts.push(operandText(m, safeCurrent(m), m.closes));
  if (parts.length > 0) return joinParts(parts);
  return m.answered === null ? "" : `${m.answered} =`;
}

function expressionParts(m: Machine): string[] {
  return m.stack.flatMap((frame) =>
    frame.op === null ? ["("] : [operandText(m, frame.lhs, frame.closes), OPERATOR_SYMBOLS[frame.op]]
  );
}

function operandText(m: Machine, value: Value, closes: number): string {
  return writeValue(m, value) + ")".repeat(closes);
}

function joinParts(parts: string[]): string {
  return parts.reduce((text, part) => text === "" || text.endsWith("(") ? text + part : `${text} ${part}`, "");
}

export function writeInBase(m: Machine, base: Base): string {
  return writeWord(safeCurrent(m), { ...m, base });
}

export function characterOf(m: Machine): { codePoint: string; glyph: string } | null {
  const code = Number(pattern(safeCurrent(m), m.bits));
  if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;

  const glyph = code < 0x20 ? String.fromCodePoint(0x2400 + code) : code === 0x7f ? "␡" : String.fromCodePoint(code);
  return { codePoint: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`, glyph };
}

function safeCurrent(m: Machine): Value {
  try {
    return current(m);
  } catch {
    return zero(m.mode);
  }
}

export function isDigit(key: string): boolean {
  return key === "00" || key === "FF" || (key.length === 1 && DIGITS.includes(key));
}

function isUnary(m: Machine, key: string): boolean {
  return key in DOMAINS[m.mode].unary;
}

function startsValue(key: Key): boolean {
  return isDigit(key) || key === "point" || key === "pi" || key === "euler" || key === "rand" || key === "mr";
}

const DIGITS = "0123456789ABCDEF";

const MAX_DECIMAL_DIGITS = 15;
const MAX_EXPONENT_DIGITS = 3;

function withinEntryLimits(entry: string, m: Machine): boolean {
  if (m.mode === "programmer") {
    try {
      parseWord(entry, m);
      return true;
    } catch {
      return false;
    }
  }

  if (!DECIMAL_ENTRY.test(entry)) return false;
  const [mantissa, exponent = ""] = entry.split("e");
  const digits = mantissa.replace(/[-.]/g, "").replace(/^0+/, "");
  return digits.length <= MAX_DECIMAL_DIGITS && exponent.replace("-", "").length <= MAX_EXPONENT_DIGITS;
}

const DECIMAL_ENTRY = /^-?\d*\.?\d*(?:e-?\d*)?$/;

const BASE_PREFIXES: Record<Base, string> = { 8: "0o", 10: "", 16: "0x" };

function parseWord(entry: string, m: Machine): bigint {
  const digits = entry.replace(/^-/, "") || "0";
  let unsigned: bigint;
  try {
    unsigned = BigInt(`${BASE_PREFIXES[m.base]}${digits}`);
  } catch {
    throw new CalculatorError("That is not a number in this base");
  }
  if (unsigned > maskOf(m.bits)) throw new CalculatorError(`That does not fit in ${m.bits} bits`);

  const value = signedOf(unsigned, m.bits);
  return entry.startsWith("-") ? wrap(-value, m.bits) : value;
}

function parseDecimal(entry: string): number {
  const cleaned = entry.replace(/e[-+]?$/, "").replace(/\.$/, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const value = Number(cleaned);
  if (Number.isNaN(value)) throw new CalculatorError("That is not a number");
  return value;
}

function writeWord(value: Value, m: Machine): string {
  const word = big(value);
  return m.base === 10 ? word.toString(10) : pattern(word, m.bits).toString(m.base).toUpperCase();
}

function writeNumber(value: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "Not a number" : value > 0 ? "Infinity" : "-Infinity";
  const rounded = Number(value.toPrecision(MAX_DECIMAL_DIGITS));
  return rounded === 0 ? "0" : String(rounded).replace("e+", "e");
}

function groupDigits(text: string, m: Machine): string {
  const sign = text.startsWith("-") ? "-" : "";
  const body = sign ? text.slice(1) : text;
  const split = body.search(/[.e]/);
  const whole = split === -1 ? body : body.slice(0, split);
  const tail = split === -1 ? "" : body.slice(split);
  if (!/^[0-9A-F]+$/.test(whole)) return text;

  const size = m.mode === "programmer" && m.base === 16 ? 4 : 3;
  const separator = m.mode === "programmer" && m.base !== 10 ? " " : ",";
  const groups: string[] = [];
  for (let end = whole.length; end > 0; end -= size) {
    groups.unshift(whole.slice(Math.max(0, end - size), end));
  }

  return sign + groups.join(separator) + tail;
}

export class CalculatorError extends Error {}

function reason(error: unknown): string {
  return error instanceof CalculatorError ? error.message : "That cannot be worked out";
}

function zero(mode: Mode): Value {
  return mode === "programmer" ? 0n : 0;
}

function big(value: Value): bigint {
  if (typeof value === "bigint") return value;
  return Number.isFinite(value) ? BigInt(Math.trunc(value)) : 0n;
}

function num(value: Value): number {
  return typeof value === "number" ? value : Number(value);
}

function maskOf(bits: number): bigint {
  return (1n << BigInt(bits)) - 1n;
}

function pattern(value: Value, bits: Bits): bigint {
  return big(value) & maskOf(bits);
}

function signedOf(unsigned: bigint, bits: Bits): bigint {
  const half = 1n << BigInt(bits - 1);
  return unsigned >= half ? unsigned - (1n << BigInt(bits)) : unsigned;
}

function wrap(value: bigint, bits: Bits): bigint {
  return signedOf(value & maskOf(bits), bits);
}

function shiftBy(value: Value, places: bigint, bits: Bits): bigint {
  if (places < 0n) {
    const right = -places;
    return right >= BigInt(bits) ? 0n : wrap(pattern(value, bits) >> right, bits);
  }
  return places >= BigInt(bits) ? 0n : wrap(pattern(value, bits) << places, bits);
}

function rotate(value: Value, places: bigint, bits: Bits): bigint {
  const width = BigInt(bits);
  const by = ((places % width) + width) % width;
  const bit = pattern(value, bits);
  return wrap((bit << by) | (bit >> (width - by)), bits);
}

function reverseUnits(value: Value, unit: number, bits: Bits): bigint {
  if (bits < unit) return big(value);
  const chunk = maskOf(unit);
  const shift = BigInt(unit);
  let left = pattern(value, bits);
  let flipped = 0n;

  for (let taken = 0; taken < bits / unit; taken++) {
    flipped = (flipped << shift) | (left & chunk);
    left >>= shift;
  }

  return wrap(flipped, bits);
}

function nonZero(divisor: bigint): bigint {
  if (divisor === 0n) throw new CalculatorError("Cannot divide by zero");
  return divisor;
}

function positive(value: number, message: string, zeroOnly = false): number {
  if (value === 0 || (!zeroOnly && value < 0)) throw new CalculatorError(message);
  return value;
}

function notNegative(value: number, message: string): number {
  if (value < 0) throw new CalculatorError(message);
  return value;
}

function logArgument(value: number): number {
  return positive(value, "A logarithm needs a number above zero");
}

function logBase(value: number): number {
  if (value <= 0 || value === 1) throw new CalculatorError("A logarithm's base must be above zero and not one");
  return value;
}

function withinOne(value: number): number {
  if (value < -1 || value > 1) throw new CalculatorError("That function only takes a number between −1 and 1");
  return value;
}

function atLeastOne(value: number): number {
  if (value < 1) throw new CalculatorError("That function only takes a number of 1 or more");
  return value;
}

function nthRoot(value: number, degree: number): number {
  if (degree === 0) throw new CalculatorError("A root of degree zero has no value");
  if (value < 0) {
    if (Math.abs(degree % 2) !== 1) throw new CalculatorError("An even root of a negative number is not real");
    return -Math.pow(-value, 1 / degree);
  }
  return Math.pow(value, 1 / degree);
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new CalculatorError("A factorial only takes a whole number of zero or more");
  }
  let product = 1;
  for (let step = 2; step <= value; step++) product *= step;
  return finite(product);
}

function finite(value: number): number {
  if (Number.isNaN(value)) throw new CalculatorError("That has no answer");
  if (!Number.isFinite(value)) throw new CalculatorError("The result is too large to hold");
  return value;
}

const DEGREES_PER_RADIAN = 180 / Math.PI;

function toRadians(value: number, m: Machine): number {
  return m.angle === "deg" ? value / DEGREES_PER_RADIAN : value;
}

function fromRadians(value: number, m: Machine): number {
  return m.angle === "deg" ? value * DEGREES_PER_RADIAN : value;
}

export interface CalculatorShare extends Record<string, unknown> {
  mode?: string;
  base?: number;
  bits?: number;
  angle?: string;
  second?: boolean;
  value?: string;
  entry?: string;
  stack?: (string | null)[][];
  closes?: number;
  answered?: string;
  memory?: string;
}

export function toShare(m: Machine): CalculatorShare {
  const programmer = m.mode === "programmer";
  return {
    mode: m.mode,
    base: programmer ? m.base : undefined,
    bits: programmer ? m.bits : undefined,
    angle: programmer ? undefined : m.angle,
    second: !programmer && m.second ? true : undefined,
    value: writeShareValue(m.value),
    entry: m.entry ?? undefined,
    stack: m.stack.length > 0
      ? m.stack.map((frame) =>
        frame.closes > 0
          ? [frame.op, writeShareValue(frame.lhs), String(frame.closes)]
          : [frame.op, writeShareValue(frame.lhs)]
      )
      : undefined,
    closes: m.closes > 0 ? m.closes : undefined,
    answered: m.stack.length === 0 ? m.answered ?? undefined : undefined,
    memory: m.memory === zero(m.mode) ? undefined : writeShareValue(m.memory),
  };
}

export function fromShare(state: CalculatorShare | null): Machine {
  const mode: Mode = state?.mode === "scientific" ? "scientific" : "programmer";
  const machine = newMachine(mode);
  if (!state) return machine;

  const read = (text: string | undefined | null) => readShareValue(text, mode);
  const opened: Machine = {
    ...machine,
    base: BASES.find((base) => base === state.base) ?? machine.base,
    bits: WORD_SIZES.find((bits) => bits === state.bits) ?? machine.bits,
    angle: state.angle === "rad" ? "rad" : "deg",
    second: state.second === true,
    value: read(state.value) ?? machine.value,
    entry: typeof state.entry === "string" && state.entry !== "" ? state.entry : null,
    answered: typeof state.answered === "string" && state.answered !== "" ? state.answered : null,
    memory: read(state.memory) ?? machine.memory,
    stack: readShareStack(state.stack, mode),
    closes: readShareCount(state.closes),
  };

  return opened.entry !== null && !withinEntryLimits(opened.entry, opened) ? { ...opened, entry: null } : opened;
}

function writeShareValue(value: Value): string {
  return typeof value === "bigint" ? value.toString(10) : String(value);
}

function readShareValue(text: string | null | undefined, mode: Mode): Value | null {
  if (typeof text !== "string" || text === "") return null;
  if (mode === "scientific") {
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

function readShareStack(frames: (string | null)[][] | undefined, mode: Mode): Frame[] {
  if (!Array.isArray(frames)) return [];
  const read: Frame[] = [];

  for (const frame of frames) {
    if (!Array.isArray(frame)) return [];
    const [op, lhs, closes] = frame;
    if (op !== null && !(typeof op === "string" && op in PRECEDENCE)) return [];
    const value = readShareValue(lhs, mode);
    if (value === null) return [];
    read.push({ op: op as BinaryKey | null, lhs: value, closes: readShareCount(closes) });
  }

  return read;
}

function readShareCount(value: string | number | null | undefined): number {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}
