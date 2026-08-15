import { type Base, BASES, isDigit, type Key, type Machine } from "./machine";

export interface KeyDefinition {
  key: Key;
  label: string;
  name: string;
  shortcuts?: string[];
  hint?: string;
  tone?: Tone;
  isActive?: (machine: Machine) => boolean;
}

export type Tone = "digit" | "function" | "control" | "operator";

export const TONE_VARIANTS: Record<Tone, string> = {
  digit: "default",
  function: "default",
  control: "light",
  operator: "filled",
};

export const TONE_COLOURS: Record<Tone, string> = {
  digit: "gray",
  function: "gray",
  control: "gray",
  operator: "orange.6",
};

export const BASE_NAMES: Record<Base, string> = { 8: "OCT", 10: "DEC", 16: "HEX" };

export const OTHER_BASES: Base[] = [...BASES].reverse();

const CLEAR: KeyDefinition = {
  key: "clear",
  label: "AC",
  name: "Clear",
  tone: "control",
  shortcuts: ["Escape", "Delete"],
};
const BACK: KeyDefinition = { key: "back", label: "⌫", name: "Backspace", tone: "control", shortcuts: ["Backspace"] };
const OPEN: KeyDefinition = { key: "open", label: "(", name: "Open bracket", shortcuts: ["("] };
const CLOSE: KeyDefinition = { key: "close", label: ")", name: "Close bracket", shortcuts: [")"] };
const EQUALS: KeyDefinition = {
  key: "equals",
  label: "=",
  name: "Equals",
  tone: "operator",
  shortcuts: ["=", "Enter"],
};

const DIVIDE: KeyDefinition = { key: "div", label: "÷", name: "Divide", tone: "operator", shortcuts: ["/"] };
const MULTIPLY: KeyDefinition = {
  key: "mul",
  label: "×",
  name: "Multiply",
  tone: "operator",
  shortcuts: ["*", "x", "X"],
};
const SUBTRACT: KeyDefinition = { key: "sub", label: "−", name: "Subtract", tone: "operator", shortcuts: ["-"] };
const ADD: KeyDefinition = { key: "add", label: "+", name: "Add", tone: "operator", shortcuts: ["+"] };

function digit(value: string): KeyDefinition {
  const letters = /[A-F]/.test(value);
  return {
    key: value as Key,
    label: value,
    name: value,
    tone: "digit",
    shortcuts: value.length === 1 ? (letters ? [value.toLowerCase(), value] : [value]) : undefined,
  };
}

export const PROGRAMMER_FUNCTIONS: KeyDefinition[] = [
  BACK,
  OPEN,
  CLOSE,
  { key: "and", label: "AND", name: "AND", shortcuts: ["&"] },
  { key: "or", label: "OR", name: "OR", shortcuts: ["|"] },
  { key: "xor", label: "XOR", name: "XOR", shortcuts: ["^"] },
  { key: "nor", label: "NOR", name: "NOR" },
  { key: "shl1", label: "<<", name: "Shift left one", hint: "Shift the bits one place left" },
  { key: "shr1", label: ">>", name: "Shift right one", hint: "Shift the bits one place right" },
  { key: "not", label: "NOT", name: "NOT", shortcuts: ["~"] },
  { key: "shl", label: "X<<Y", name: "Shift left by", hint: "Shift left by the number entered next", shortcuts: ["<"] },
  {
    key: "shr",
    label: "X>>Y",
    name: "Shift right by",
    hint: "Shift right by the number entered next",
    shortcuts: [">"],
  },
  { key: "neg", label: "NEG", name: "Negate", hint: "Two's complement negation", shortcuts: ["n", "N"] },
  { key: "rol", label: "RoL", name: "Rotate left", hint: "Rotate the bits one place left, end around" },
  { key: "ror", label: "RoR", name: "Rotate right", hint: "Rotate the bits one place right, end around" },
  { key: "mod", label: "mod", name: "Modulo", hint: "Remainder, truncated toward zero", shortcuts: ["%"] },
  { key: "flip8", label: "flip₈", name: "Flip bytes", hint: "Reverse the order of the bytes" },
  { key: "flip16", label: "flip₁₆", name: "Flip 16-bit words", hint: "Reverse the order of the 16-bit words" },
];

export const PROGRAMMER_NUMBERS: KeyDefinition[] = [
  digit("D"),
  digit("E"),
  digit("F"),
  CLEAR,
  digit("A"),
  digit("B"),
  digit("C"),
  DIVIDE,
  digit("7"),
  digit("8"),
  digit("9"),
  MULTIPLY,
  digit("4"),
  digit("5"),
  digit("6"),
  SUBTRACT,
  digit("1"),
  digit("2"),
  digit("3"),
  ADD,
  digit("FF"),
  digit("0"),
  digit("00"),
  EQUALS,
];

export const SCIENTIFIC_NUMBERS: KeyDefinition[] = [
  BACK,
  CLEAR,
  {
    key: "percent",
    label: "%",
    name: "Percent",
    tone: "control",
    hint: "A share of what it is being added to",
    shortcuts: ["%"],
  },
  DIVIDE,
  digit("7"),
  digit("8"),
  digit("9"),
  MULTIPLY,
  digit("4"),
  digit("5"),
  digit("6"),
  SUBTRACT,
  digit("1"),
  digit("2"),
  digit("3"),
  ADD,
  { key: "sign", label: "⁺∕₋", name: "Change sign", tone: "digit", shortcuts: ["n", "N"] },
  digit("0"),
  { key: "point", label: ".", name: "Decimal point", tone: "digit", shortcuts: [".", ","] },
  EQUALS,
];

export function scientificFunctions(machine: Machine): KeyDefinition[] {
  const second = machine.second;

  return [
    OPEN,
    CLOSE,
    { key: "mc", label: "mc", name: "Memory clear" },
    { key: "mplus", label: "m+", name: "Memory add" },
    { key: "mminus", label: "m−", name: "Memory subtract" },
    { key: "mr", label: "mr", name: "Memory recall" },
    {
      key: "second",
      label: "2ⁿᵈ",
      name: "Second function",
      hint: "Swap in the inverse of the function keys",
      isActive: (current) => current.second,
    },
    { key: "sqr", label: "x²", name: "Square" },
    { key: "cube", label: "x³", name: "Cube" },
    { key: "pow", label: "xʸ", name: "Power", hint: "The display raised to the number entered next", shortcuts: ["^"] },
    second
      ? { key: "powOf", label: "yˣ", name: "Power of", hint: "The number entered next raised to the display" }
      : { key: "exp", label: "eˣ", name: "Exponential" },
    second
      ? { key: "exp2", label: "2ˣ", name: "Two to the power" }
      : { key: "exp10", label: "10ˣ", name: "Ten to the power" },
    { key: "recip", label: "¹⁄ₓ", name: "Reciprocal" },
    { key: "sqrt", label: "²√x", name: "Square root", shortcuts: ["r", "R"] },
    { key: "cbrt", label: "³√x", name: "Cube root" },
    { key: "root", label: "ʸ√x", name: "Root", hint: "The root of the display, of the degree entered next" },
    second
      ? {
        key: "logBase",
        label: "log ʸ",
        name: "Logarithm base",
        hint: "Base is the number entered next",
        shortcuts: ["l", "L"],
      }
      : { key: "ln", label: "ln", name: "Natural logarithm", shortcuts: ["l", "L"] },
    second
      ? { key: "log2", label: "log₂", name: "Binary logarithm" }
      : { key: "log10", label: "log₁₀", name: "Common logarithm" },
    { key: "fact", label: "x!", name: "Factorial", shortcuts: ["!"] },
    second
      ? { key: "asin", label: "sin⁻¹", name: "Arcsine", shortcuts: ["s", "S"] }
      : { key: "sin", label: "sin", name: "Sine", shortcuts: ["s", "S"] },
    second
      ? { key: "acos", label: "cos⁻¹", name: "Arccosine", shortcuts: ["c", "C"] }
      : { key: "cos", label: "cos", name: "Cosine", shortcuts: ["c", "C"] },
    second
      ? { key: "atan", label: "tan⁻¹", name: "Arctangent", shortcuts: ["t", "T"] }
      : { key: "tan", label: "tan", name: "Tangent", shortcuts: ["t", "T"] },
    { key: "euler", label: "e", name: "Euler's number" },
    { key: "ee", label: "EE", name: "Exponent", hint: "Types a power of ten onto the number", shortcuts: ["e", "E"] },
    { key: "rand", label: "Rand", name: "Random", hint: "A random number from 0 up to 1" },
    second
      ? { key: "asinh", label: "sinh⁻¹", name: "Inverse hyperbolic sine" }
      : { key: "sinh", label: "sinh", name: "Hyperbolic sine" },
    second
      ? { key: "acosh", label: "cosh⁻¹", name: "Inverse hyperbolic cosine" }
      : { key: "cosh", label: "cosh", name: "Hyperbolic cosine" },
    second
      ? { key: "atanh", label: "tanh⁻¹", name: "Inverse hyperbolic tangent" }
      : { key: "tanh", label: "tanh", name: "Hyperbolic tangent" },
    { key: "pi", label: "π", name: "Pi", shortcuts: ["p", "P"] },
    {
      key: "angle",
      label: machine.angle === "deg" ? "Rad" : "Deg",
      name: machine.angle === "deg" ? "Switch to radians" : "Switch to degrees",
    },
  ];
}

const DIGIT_CHARACTERS = "0123456789ABCDEF";

export function isRefused(definition: KeyDefinition | undefined, machine: Machine): boolean {
  if (!definition || !isDigit(definition.key)) return false;
  const limit = machine.mode === "programmer" ? machine.base : 10;
  return ![...definition.key].every((character) => DIGIT_CHARACTERS.indexOf(character) < limit);
}

export const FLASH_MS = 150;

export function shortcutMap(keys: KeyDefinition[], machine: Machine): Map<string, Key> {
  const map = new Map<string, Key>();

  for (const definition of keys) {
    if (isRefused(definition, machine)) continue;
    for (const shortcut of definition.shortcuts ?? []) {
      if (!map.has(shortcut)) map.set(shortcut, definition.key);
    }
  }

  return map;
}

export function shortcutName(shortcut: string): string {
  return SHORTCUT_NAMES[shortcut] ?? shortcut;
}

export const SHORTCUT_NAMES: Record<string, string> = {
  Enter: "Enter",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "Del",
  " ": "Space",
};
