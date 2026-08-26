import { ActionIcon, Badge, Box, Button, Card, CopyButton, Group, Input, SegmentedControl, Stack, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { ALWAYS, keepFocus, type RovingItemProps, useRovingFocus } from "../../common/roving-focus";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconChevronDown, IconChevronUp, IconCopy, IconTrash, IconX } from "../../icons";
import { FIELD_NAMES, FLOAT_FIELDS, floatFacts, floatField, type FloatFormat, floatFormat, parseFloatText, readFloat, shortestDecimal, stepFloat } from "./float";
import { BITS_PER_ROW, chunk } from "./grid";
import { BASE_NAMES, FLASH_MS, isRefused, type KeyDefinition, OTHER_BASES, PROGRAMMER_FUNCTIONS, PROGRAMMER_NUMBERS, SCIENTIFIC_NUMBERS, scientificFunctions, shortcutMap, shortcutName, TONE_COLOURS, TONE_VARIANTS } from "./keys";
import { type Base, BASES, bitPattern, type Bits, type CalculatorShare, characterOf, clearHistory, display, dropHistoryEntry, expressionText, fromShare, hasMemory, type HistoryEntry, type Key, type Machine, type Mode, press, readout, setBase, setBits, setMode, setPattern, toggleBit, toShare, WORD_SIZES, writeInBase } from "./machine";

export default function Calculator() {
  const initialState = useInitialHashState<CalculatorShare>();
  const [machine, setMachine] = useState<Machine>(() => fromShare(initialState));
  const [draft, setDraft] = useState<string | null>(null);

  useRegisterShareState(() => toShare(machine));

  const move = useCallback((change: (current: Machine) => Machine) => {
    setDraft(null);
    setMachine(change);
  }, []);

  const type = useCallback((key: Key) => move((current) => press(current, key)), [move]);

  const programmer = machine.mode === "programmer";
  const format = programmer ? floatFormat(machine.bits) : null;
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

  const typeFloat = (text: string) => {
    setDraft(text);
    const bits = format && parseFloatText(text, format);
    if (bits != null) setMachine((current) => setPattern(current, bits));
  };

  const stepFloatTo = (up: boolean) =>
    move((current) => {
      const stepping = floatFormat(current.bits);
      return stepping === null ? current : setPattern(current, stepFloat(bitPattern(current), stepping, up));
    });

  const shown = display(machine);
  const expression = expressionText(machine);
  const character = programmer ? characterOf(machine) : null;

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="calculator"
        control={
          <SegmentedControl
            value={machine.mode}
            onChange={(value) => move((current) => setMode(current, value as Mode))}
            data={[{ value: "programmer", label: "Programmer" }, { value: "scientific", label: "Scientific" }]}
          />
        }
      >
        Calculator
      </UtilityTitle>

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
                  onChange={(value) => move((current) => setBase(current, Number(value) as Base))}
                  data={BASES.map((base) => ({ value: String(base), label: BASE_NAMES[base] }))}
                />
              </Input.Wrapper>
              <Input.Wrapper label="Word size" description="Every result is wrapped to this many bits">
                <SegmentedControl
                  fullWidth
                  value={String(machine.bits)}
                  onChange={(value) => move((current) => setBits(current, Number(value) as Bits))}
                  data={WORD_SIZES.map((bits) => ({ value: String(bits), label: `${bits}-bit` }))}
                />
              </Input.Wrapper>
            </Box>
            <Input.Wrapper label="Bits" description="Click a bit to flip it, or Tab here and use the arrow keys">
              <BitGrid
                machine={machine}
                format={format}
                onToggle={(index) => move((current) => toggleBit(current, index))}
              />
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

      {format && (
        <FloatCard
          pattern={bitPattern(machine)}
          format={format}
          draft={draft}
          onType={typeFloat}
          onStep={stepFloatTo}
        />
      )}

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

function BitGrid({ machine, format, onToggle }: BitGridProps) {
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
                        data-bit-field={format ? floatField(index, format) : undefined}
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

interface BitGridProps {
  machine: Machine;
  format: FloatFormat | null;
  onToggle: (index: number) => void;
}

function FloatCard({ pattern, format, draft, onType, onStep }: FloatCardProps) {
  const reading = readFloat(pattern, format);
  const unreadable = draft !== null && draft.trim() !== "" && parseFloatText(draft, format) === null;

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" gap="sm">
          <Group gap="xs" align="center" wrap="nowrap">
            <Text fw={500}>Float</Text>
            <Badge size="sm" variant="light" color="gray">{format.name} · {format.nickname}</Badge>
          </Group>
          <Group gap="sm" wrap="wrap" justify="flex-end">
            {FLOAT_FIELDS.map((field) => (
              <Group key={field} gap={6} wrap="nowrap">
                <Box className="bit-field-swatch" data-bit-field={field} />
                <Text size="xs" c="dimmed">{FIELD_NAMES[field]}</Text>
              </Group>
            ))}
          </Group>
        </Group>

        <TextInput
          label="Value"
          description="Type a number to load its bits, in decimal or as a hexadecimal float"
          value={draft ?? shortestDecimal(reading)}
          onChange={(event) => onType(event.currentTarget.value)}
          error={unreadable ? "Cannot read that as a number" : null}
          spellCheck={false}
          styles={{ input: { fontFamily: "monospace" } }}
          rightSectionWidth={64}
          rightSectionPointerEvents="all"
          rightSection={
            <Group gap={2} wrap="nowrap">
              <Tooltip label="Next float down" withArrow position="top">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label="Next float down"
                  onClick={() => onStep(false)}
                  onMouseDown={keepFocus}
                >
                  <IconChevronDown size="1rem" />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Next float up" withArrow position="top">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label="Next float up"
                  onClick={() => onStep(true)}
                  onMouseDown={keepFocus}
                >
                  <IconChevronUp size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          }
        />

        <FactTable rows={floatFacts(reading)} />
      </Stack>
    </Card>
  );
}

interface FloatCardProps {
  pattern: bigint;
  format: FloatFormat;
  draft: string | null;
  onType: (text: string) => void;
  onStep: (up: boolean) => void;
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
