import { ActionIcon, Badge, Box, Button, Card, CopyButton, Group, Input, SegmentedControl, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy, IconTrash, IconX } from "../icons";
import { type Base, BASES, bitPattern, type Bits, type CalculatorShare, characterOf, clearHistory, display, dropHistoryEntry, expressionText, fromShare, hasMemory, type HistoryEntry, isDigit, type Key, type Machine, type Mode, press, readout, setBase, setBits, setMode, toggleBit, toShare, WORD_SIZES, writeInBase } from "./calculator-machine";

export default function Calculator() {
  const initialState = useInitialHashState<CalculatorShare>();
  const [machine, setMachine] = useState<Machine>(() => fromShare(initialState));

  useRegisterShareState(() => toShare(machine));

  const type = useCallback((key: Key) => setMachine((current) => press(current, key)), []);

  const programmer = machine.mode === "programmer";
  const functionKeys = useMemo(
    () => programmer ? PROGRAMMER_FUNCTIONS : scientificFunctions(machine),
    [programmer, machine.second, machine.angle],
  );
  const numberKeys = programmer ? PROGRAMMER_NUMBERS : SCIENTIFIC_NUMBERS;

  const shortcuts = useMemo(
    () => shortcutMap([...functionKeys, ...numberKeys], machine),
    [functionKeys, numberKeys, machine.mode, machine.base],
  );

  const [flashed, setFlashed] = useState<Key | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(flashTimer.current ?? undefined), []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest(
          "[role=\"dialog\"], .calculator-history, input:not([type=\"radio\"]), textarea, [contenteditable]",
        )
      ) return;
      if ((event.key === "Enter" || event.key === " ") && target?.tagName === "BUTTON") return;

      const key = shortcuts.get(event.key);
      if (!key) return;
      event.preventDefault();
      type(key);

      setFlashed(key);
      clearTimeout(flashTimer.current ?? undefined);
      flashTimer.current = setTimeout(() => setFlashed(null), FLASH_MS);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [shortcuts, type]);

  const shown = display(machine);
  const expression = expressionText(machine);
  const character = programmer ? characterOf(machine) : null;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <UtilityTitle file="calculator.tsx">Calculator</UtilityTitle>
        <SegmentedControl
          value={machine.mode}
          onChange={(value) => setMachine((current) => setMode(current, value as Mode))}
          data={[{ value: "programmer", label: "Programmer" }, { value: "scientific", label: "Scientific" }]}
        />
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap={4}>
          <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
            <Text size="sm" c="dimmed" ff="monospace" lineClamp={1} aria-label="Expression">
              {expression || " "}
            </Text>
            <Group gap="xs" wrap="nowrap">
              {hasMemory(machine) && (
                <Badge size="sm" variant="light" color="gray" aria-label="Memory holds a number">M</Badge>
              )}
              {!programmer && (
                <Badge size="sm" variant="light" color="gray">{machine.angle === "deg" ? "DEG" : "RAD"}</Badge>
              )}
              {!programmer && machine.second && <Badge size="sm" variant="light" color="orange">2nd</Badge>}
              <CopyButton value={readout(machine)} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color={copied ? "teal" : "gray"}
                      onClick={copy}
                      aria-label="Copy the displayed value"
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Group>

          <Group justify="flex-end" align="baseline" gap={6} wrap="nowrap" className="calculator-readout">
            <Text className="calculator-display" ff="monospace" fw={300} role="status" aria-label="Display">
              {shown}
            </Text>
            {programmer && <Text ff="monospace" fz="lg" c="dimmed">{machine.base}</Text>}
          </Group>

          {machine.error
            ? <Text size="sm" c="var(--mantine-color-error)" ta="right">{machine.error}</Text>
            : programmer && (
              <Group justify="flex-end" gap="md" wrap="wrap">
                {OTHER_BASES.filter((base) => base !== machine.base).map((base) => (
                  <Text key={base} size="sm" c="dimmed" ff="monospace">
                    {BASE_NAMES[base]} {writeInBase(machine, base)}
                  </Text>
                ))}
                {character && <Text size="sm" c="dimmed" ff="monospace">{character.codePoint} {character.glyph}</Text>}
              </Group>
            )}
        </Stack>
      </Card>

      {programmer && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="md">
            <Box className="settings-row">
              <Input.Wrapper label="Base">
                <SegmentedControl
                  fullWidth
                  value={String(machine.base)}
                  onChange={(value) => setMachine((current) => setBase(current, Number(value) as Base))}
                  data={BASES.map((base) => ({ value: String(base), label: BASE_NAMES[base] }))}
                />
              </Input.Wrapper>
              <Input.Wrapper label="Word size" description="Every result is wrapped to this many bits">
                <SegmentedControl
                  fullWidth
                  value={String(machine.bits)}
                  onChange={(value) => setMachine((current) => setBits(current, Number(value) as Bits))}
                  data={WORD_SIZES.map((bits) => ({ value: String(bits), label: `${bits}-bit` }))}
                />
              </Input.Wrapper>
            </Box>
            <Input.Wrapper label="Bits" description="Click a bit to flip it, or Tab here and use the arrow keys">
              <BitGrid machine={machine} onToggle={(index) => setMachine((current) => toggleBit(current, index))} />
            </Input.Wrapper>
          </Stack>
        </Card>
      )}

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Box className="calculator-pad">
            <Keypad
              label="Function keys"
              columns={programmer ? 3 : 6}
              keys={functionKeys}
              machine={machine}
              flashed={flashed}
              onPress={type}
            />
            <Keypad
              label="Number keys"
              columns={4}
              keys={numberKeys}
              machine={machine}
              flashed={flashed}
              onPress={type}
            />
          </Box>
          <Text size="sm" c="dimmed">
            Every key takes a keystroke as well as a click — hover one to see which. Enter is =, Esc clears, and Tab
            reaches a pad, where the arrow keys move between the keys.
          </Text>
        </Stack>
      </Card>

      {machine.history.length > 0 && (
        <HistoryCard
          entries={machine.history}
          onRemove={(id) => setMachine((current) => dropHistoryEntry(current, id))}
          onClear={() => setMachine(clearHistory)}
        />
      )}
    </Stack>
  );
}

function Keypad({ label, columns, keys, machine, flashed, onPress }: KeypadProps) {
  const enabled = useCallback((index: number) => !isRefused(keys[index], machine), [keys, machine]);
  const roving = useRovingFocus(keys.length, columns, enabled);

  return (
    <Box
      className="calculator-keys"
      style={{ "--calculator-columns": columns } as CSSProperties}
      role="toolbar"
      aria-label={label}
      onKeyDown={roving.handleKeyDown}
    >
      {keys.map((definition, index) => (
        <KeyButton
          key={definition.name}
          definition={definition}
          machine={machine}
          flashed={flashed === definition.key}
          onPress={onPress}
          {...roving.itemProps(index)}
        />
      ))}
    </Box>
  );
}

interface KeypadProps {
  label: string;
  columns: number;
  keys: KeyDefinition[];
  machine: Machine;
  flashed: Key | null;
  onPress: (key: Key) => void;
}

function KeyButton({ definition, machine, flashed, onPress, ...roving }: KeyButtonProps) {
  const { key, label, name, hint, shortcuts, tone = "function" } = definition;
  const disabled = isRefused(definition, machine);
  const active = definition.isActive?.(machine) ?? false;
  const tip = [hint, shortcuts && `Key: ${shortcutName(shortcuts[0])}`].filter(Boolean).join(" · ");

  const button = (
    <Button
      className="calculator-key"
      fullWidth
      radius="md"
      px={4}
      h={44}
      fz="sm"
      variant={active ? "light" : TONE_VARIANTS[tone]}
      color={active ? "orange" : TONE_COLOURS[tone]}
      c={tone === "function" ? "dimmed" : undefined}
      disabled={disabled}
      onClick={() => onPress(key)}
      onMouseDown={keepFocus}
      aria-label={name}
      aria-pressed={definition.isActive ? active : undefined}
      aria-keyshortcuts={shortcuts?.[0]}
      data-flash={flashed || undefined}
      {...roving}
    >
      {label}
    </Button>
  );

  return tip ? <Tooltip label={tip} withArrow openDelay={400}>{button}</Tooltip> : button;
}

interface KeyButtonProps extends RovingItemProps {
  definition: KeyDefinition;
  machine: Machine;
  flashed: boolean;
  onPress: (key: Key) => void;
}

function BitGrid({ machine, onToggle }: { machine: Machine; onToggle: (index: number) => void }) {
  const bits = bitPattern(machine);
  const rows: number[][] = [];
  for (let high = machine.bits - 1; high >= 0; high -= BITS_PER_ROW) {
    const low = Math.max(0, high - BITS_PER_ROW + 1);
    rows.push(Array.from({ length: high - low + 1 }, (_, offset) => high - offset));
  }

  const roving = useRovingFocus(machine.bits, Math.min(machine.bits, BITS_PER_ROW), ALWAYS);

  return (
    <Box className="bit-grid" role="toolbar" aria-label="Bits" onKeyDown={roving.handleKeyDown}>
      <Stack gap="xs" style={{ width: "max-content" }}>
        {rows.map((row) => (
          <Box key={row[0]}>
            <Group gap="sm" wrap="nowrap">
              {chunk(row, 4).map((nibble) => (
                <Group key={nibble[0]} gap={2} wrap="nowrap">
                  {nibble.map((index) => {
                    const set = (bits >> BigInt(index)) & 1n;
                    return (
                      <UnstyledButton
                        key={index}
                        className="bit-key"
                        data-set={set === 1n}
                        aria-label={`Bit ${index}`}
                        aria-pressed={set === 1n}
                        onClick={() => onToggle(index)}
                        onMouseDown={keepFocus}
                        {...roving.itemProps(machine.bits - 1 - index)}
                      >
                        {String(set)}
                      </UnstyledButton>
                    );
                  })}
                </Group>
              ))}
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" ff="monospace">{row[0]}</Text>
              <Text size="xs" c="dimmed" ff="monospace">{row[row.length - 1]}</Text>
            </Group>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function HistoryCard({ entries, onRemove, onClear }: HistoryCardProps) {
  const roving = useRovingFocus(entries.length, 1, ALWAYS);
  const [refocus, setRefocus] = useState<number | null>(null);

  useEffect(() => {
    if (refocus === null) return;
    setRefocus(null);
    roving.focus(refocus);
  }, [refocus]);

  const remove = (index: number, focused: boolean) => {
    onRemove(entries[index].id);
    if (focused) setRefocus(index);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      remove(roving.active, true);
      return;
    }
    roving.handleKeyDown(event);
  };

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs" align="center" wrap="nowrap">
            <Text fw={500}>History</Text>
            <Badge size="sm" variant="light" color="gray">{entries.length}</Badge>
          </Group>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            leftSection={<IconTrash size="1rem" />}
            onClick={onClear}
            onMouseDown={keepFocus}
          >
            Clear all
          </Button>
        </Group>

        <Box className="calculator-history" role="toolbar" aria-label="History" onKeyDown={handleKeyDown}>
          {entries.map((entry, index) => (
            <Group key={entry.id} className="calculator-history-row" wrap="nowrap" gap="sm">
              <Text
                size="sm"
                c="dimmed"
                ff="monospace"
                className="calculator-history-expression"
                title={entry.expression}
              >
                {entry.expression} =
              </Text>
              <Text size="sm" ff="monospace" className="calculator-history-result">{entry.result}</Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Remove ${entry.expression} = ${entry.result}`}
                onClick={(event) =>
                  remove(index, document.activeElement === event.currentTarget)}
                onMouseDown={keepFocus}
                {...roving.itemProps(index)}
              >
                <IconX size="0.9rem" />
              </ActionIcon>
            </Group>
          ))}
        </Box>
      </Stack>
    </Card>
  );
}

interface HistoryCardProps {
  entries: HistoryEntry[];
  onRemove: (id: number) => void;
  onClear: () => void;
}

function useRovingFocus(count: number, columns: number, enabled: (index: number) => boolean) {
  const [focused, setFocused] = useState(0);
  const nodes = useRef<(HTMLElement | null)[]>([]);

  const search = (from: number, stride: number): number | null => {
    for (let index = from; index >= 0 && index < count; index += stride) {
      if (enabled(index)) return index;
    }
    return null;
  };

  const start = Math.min(focused, count - 1);
  const active = search(start, 1) ?? search(start, -1) ?? 0;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const strides: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    const stride = strides[event.key];
    const target = stride !== undefined
      ? search(active + stride, stride)
      : event.key === "Home"
      ? search(0, 1)
      : event.key === "End"
      ? search(count - 1, -1)
      : null;

    if (target === null) return;
    event.preventDefault();
    setFocused(target);
    nodes.current[target]?.focus();
  };

  const itemProps = (index: number): RovingItemProps => ({
    tabIndex: index === active ? 0 : -1,
    onFocus: () => setFocused(index),
    ref: (node: HTMLElement | null) => {
      nodes.current[index] = node;
    },
  });

  const focus = (index: number) => {
    const target = search(Math.min(index, count - 1), -1) ?? search(0, 1);
    if (target === null) return;
    setFocused(target);
    nodes.current[target]?.focus();
  };

  return { active, focus, handleKeyDown, itemProps };
}

interface RovingItemProps {
  tabIndex: number;
  onFocus: () => void;
  ref: (node: HTMLElement | null) => void;
}

const ALWAYS = () => true;

function keepFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

const BITS_PER_ROW = 32;

function chunk(indexes: number[], size: number): number[][] {
  const groups: number[][] = [];
  for (let start = 0; start < indexes.length; start += size) groups.push(indexes.slice(start, start + size));
  return groups;
}

interface KeyDefinition {
  key: Key;
  label: string;
  name: string;
  shortcuts?: string[];
  hint?: string;
  tone?: Tone;
  isActive?: (machine: Machine) => boolean;
}

type Tone = "digit" | "function" | "control" | "operator";

const TONE_VARIANTS: Record<Tone, string> = {
  digit: "default",
  function: "default",
  control: "light",
  operator: "filled",
};

const TONE_COLOURS: Record<Tone, string> = {
  digit: "gray",
  function: "gray",
  control: "gray",
  operator: "orange.6",
};

const BASE_NAMES: Record<Base, string> = { 8: "OCT", 10: "DEC", 16: "HEX" };

const OTHER_BASES: Base[] = [...BASES].reverse();

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

const PROGRAMMER_FUNCTIONS: KeyDefinition[] = [
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

const PROGRAMMER_NUMBERS: KeyDefinition[] = [
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

const SCIENTIFIC_NUMBERS: KeyDefinition[] = [
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

function scientificFunctions(machine: Machine): KeyDefinition[] {
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

function isRefused(definition: KeyDefinition | undefined, machine: Machine): boolean {
  if (!definition || !isDigit(definition.key)) return false;
  const limit = machine.mode === "programmer" ? machine.base : 10;
  return ![...definition.key].every((character) => DIGIT_CHARACTERS.indexOf(character) < limit);
}

const FLASH_MS = 150;

function shortcutMap(keys: KeyDefinition[], machine: Machine): Map<string, Key> {
  const map = new Map<string, Key>();

  for (const definition of keys) {
    if (isRefused(definition, machine)) continue;
    for (const shortcut of definition.shortcuts ?? []) {
      if (!map.has(shortcut)) map.set(shortcut, definition.key);
    }
  }

  return map;
}

function shortcutName(shortcut: string): string {
  return SHORTCUT_NAMES[shortcut] ?? shortcut;
}

const SHORTCUT_NAMES: Record<string, string> = {
  Enter: "Enter",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "Del",
  " ": "Space",
};
