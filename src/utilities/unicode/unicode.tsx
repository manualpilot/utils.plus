import { ActionIcon, Badge, Box, Card, CopyButton, Group, Loader, NavLink, SegmentedControl, Stack, Table, Text, Textarea, TextInput, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Fact, FactTable } from "../../common/fact-table";
import { graphemes } from "../../common/graphemes";
import { ALWAYS, keepFocus, useRovingFocus } from "../../common/roving-focus";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconChevronDown, IconChevronUp, IconCopy, IconSearch } from "../../icons";
import { categoryName, type Character, codePoint, isInvisible, placeholder, readCharacters } from "./characters";
import { encodings, escapes } from "./encode";
import { DEFAULT_GROUP, filterSections, type Key, type Keys, keysLabel, keysOf, readSearch, type Section, typed } from "./keys";
import { useNames } from "./names";
import { normalisations, type Normalised } from "./normalise";
import { readPoints, writePoints } from "./points";
import { type Finding, findings } from "./risks";
import { MAX_ROWS, type Mode, MODE_OPTIONS, MODES, pickAt, pickGroup, pickMode, pickValue } from "./settings";

export default function Unicode() {
  const initialState = useInitialHashState<{
    mode?: string;
    value?: string;
    at?: number;
    group?: string;
  }>();

  const initialMode = pickMode(initialState?.mode);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [value, setValue] = useState(() => pickValue(initialState?.value, initialMode));
  const [at, setAt] = useState(() => pickAt(initialState?.at));
  const [group, setGroup] = useState(() => pickGroup(initialState?.group));
  const [query, setQuery] = useState("");

  const box = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<[number, number] | null>(null);
  const keyed = useRef(false);

  const reading = useMemo(() => mode === "points" ? readPoints(value) : { text: value, error: "" }, [value, mode]);
  const characters = useMemo(() => readCharacters(reading.text), [reading.text]);
  const found = useMemo(() => findings(characters, reading.text), [characters, reading.text]);
  const forms = useMemo(() => normalisations(reading.text), [reading.text]);
  const search = useMemo(() => readSearch(query), [query]);
  const sections = useMemo(() => filterSections(search), [search]);
  const keys = useMemo(() => group === null ? EMPTY_KEYS : keysOf(group, search), [group, search]);
  const { nameOf, reading: naming } = useNames([
    ...characters.map(({ code }) => code),
    ...keys.keys.flatMap(({ code, name }) => code !== null && name === "" ? [code] : []),
  ]);

  const current = Math.min(at, characters.length - 1);
  const selected = characters[current];
  const name = selected ? nameOf(selected.code) : "";

  useRegisterShareState(() => ({
    mode,
    value,
    at: current > 0 ? current : undefined,
    group: group ?? undefined,
  }));

  const onMode = (next: string) => {
    const picked = pickMode(next);
    setMode(picked);
    setValue(picked === "points" ? writePoints(reading.text) : reading.text);
  };

  const onKey = (key: Key) => {
    const [start, end] = selection(box.current, caret.current, value.length);
    const spelled = typed(key, mode, value.slice(0, start));
    setValue(value.slice(0, start) + spelled + value.slice(end));
    caret.current = [start + spelled.length, start + spelled.length];
    keyed.current = true;
  };

  useLayoutEffect(() => {
    if (!keyed.current) return;
    keyed.current = false;
    const [start, end] = caret.current ?? [value.length, value.length];
    box.current?.setSelectionRange(start, end);
    if (document.activeElement === document.body) box.current?.focus();
  });

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="unicode"
        publications="the Unicode Character Database"
        control={
          <SegmentedControl value={mode} onChange={onMode} aria-label="How the box is read" data={MODE_OPTIONS} />
        }
      >
        {MODES[mode].title}
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Textarea
          ref={box}
          label={MODES[mode].field}
          description={MODES[mode].hint}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={(event) => {
            caret.current = [event.currentTarget.selectionStart, event.currentTarget.selectionEnd];
          }}
          error={reading.error || undefined}
          autosize
          minRows={3}
          maxRows={10}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          styles={{ input: { fontFamily: "monospace" } }}
        />
      </Card>

      <Card withBorder shadow="sm" radius="md" data-keyboard>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Title order={4}>Keyboard</Title>
            <Tooltip label={group === null ? "Show the keyboard" : "Hide the keyboard"} withArrow position="left">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setGroup(group === null ? DEFAULT_GROUP : null)}
                aria-label={group === null ? "Show the keyboard" : "Hide the keyboard"}
                aria-expanded={group !== null}
              >
                {group === null ? <IconChevronDown size="1.2rem" /> : <IconChevronUp size="1.2rem" />}
              </ActionIcon>
            </Tooltip>
          </Group>
          {group !== null && (
            <Box className="keyboard-panes">
              <GroupMenu sections={sections} group={group} onGroup={setGroup} query={query} onQuery={setQuery} />
              <Stack gap="xs" className="keyboard-keys">
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="sm" fw={500} truncate>{group}</Text>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>{keysLabel(keys)}</Text>
                </Group>
                <Keys keys={keys.keys} sifted={keys.sifted} nameOf={nameOf} onKey={onKey} />
              </Stack>
            </Box>
          )}
        </Stack>
      </Card>

      {found.length > 0 && (
        <Card withBorder shadow="sm" radius="md" data-findings>
          <Stack gap="sm">
            <Title order={4}>Findings</Title>
            {found.map((finding) => <FindingRow key={finding.kind} finding={finding} />)}
          </Stack>
        </Card>
      )}

      <Box className="card-columns">
        <Card withBorder shadow="sm" radius="md" data-counts>
          <Stack gap="xs">
            <Title order={4}>Text</Title>
            <FactTable rows={counts(reading.text, characters)} />
          </Stack>
        </Card>
        <Card withBorder shadow="sm" radius="md" data-normalisation>
          <Stack gap="xs">
            <Title order={4}>Normalisation</Title>
            <Forms forms={forms} />
          </Stack>
        </Card>
      </Box>

      <Card withBorder shadow="sm" radius="md" data-characters>
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>Characters</Title>
            <Group gap="xs">
              {naming && <Loader size="xs" />}
              <Text size="sm" c="dimmed">
                {characters.length > MAX_ROWS
                  ? `${MAX_ROWS} of ${characters.length} shown`
                  : `${characters.length} code point${characters.length === 1 ? "" : "s"}`}
              </Text>
            </Group>
          </Group>
          <Characters characters={characters} nameOf={nameOf} at={current} onPick={setAt} />
        </Stack>
      </Card>

      {selected && (
        <>
          <Card withBorder shadow="sm" radius="md" data-character>
            <Group align="flex-start" wrap="nowrap" gap="lg">
              <Glyph character={selected} />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <FactTable rows={identity(selected, name)} />
              </Box>
            </Group>
          </Card>

          <Box className="card-columns">
            <Card withBorder shadow="sm" radius="md" data-encodings>
              <Stack gap="xs">
                <Title order={4}>Encodings</Title>
                <FactTable rows={encodings(selected)} />
              </Stack>
            </Card>
            <Card withBorder shadow="sm" radius="md" data-escapes>
              <Stack gap="xs">
                <Title order={4}>Escapes</Title>
                <FactTable rows={escapes(selected, name)} />
              </Stack>
            </Card>
          </Box>
        </>
      )}
    </Stack>
  );
}

function GroupMenu(
  { sections, group, onGroup, query, onQuery }: {
    sections: Section[];
    group: string;
    onGroup: (group: string) => void;
    query: string;
    onQuery: (query: string) => void;
  },
) {
  const menu = useRef<HTMLDivElement>(null);
  const offsets = useMemo(() => {
    let at = 0;
    return sections.map(({ groups }) => {
      const start = at;
      at += groups.length;
      return start;
    });
  }, [sections]);
  const count = sections.reduce((total, { groups }) => total + groups.length, 0);
  const roving = useRovingFocus(count, 1, ALWAYS);

  useLayoutEffect(() => {
    menu.current?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
  }, [group]);

  return (
    <Box ref={menu} className="keyboard-menu">
      <Box className="keyboard-search">
        <TextInput
          value={query}
          onChange={(event) => onQuery(event.currentTarget.value)}
          aria-label="Search"
          placeholder="A name or a code point"
          leftSection={<IconSearch size="0.9rem" />}
          size="xs"
        />
      </Box>
      <Box role="listbox" aria-label="Characters" onKeyDown={roving.handleKeyDown}>
        {sections.map((section, index) => (
          <Box key={section.name} role="group" aria-label={section.name}>
            <Text className="keyboard-section" size="xs" c="dimmed" fw={700} tt="uppercase">{section.name}</Text>
            {section.groups.map((name, at) => (
              <NavLink
                key={name}
                component="button"
                type="button"
                className="keyboard-option"
                role="option"
                aria-selected={name === group}
                active={name === group}
                label={name}
                onClick={() => onGroup(name)}
                {...roving.itemProps((offsets[index] ?? 0) + at)}
              />
            ))}
          </Box>
        ))}
        {count === 0 && <Text size="sm" c="dimmed" p="xs">Nothing is called that.</Text>}
      </Box>
    </Box>
  );
}

function Keys(
  { keys, sifted, nameOf, onKey }: { keys: Key[]; sifted: boolean; nameOf: (code: number) => string; onKey: Typing },
) {
  const grid = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const roving = useRovingFocus(keys.length, columns, ALWAYS);

  useLayoutEffect(() => {
    const laid = grid.current;
    if (!laid) return;
    const measure = () => setColumns(columnsOf(laid));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(laid);
    return () => observer.disconnect();
  }, [keys]);

  if (keys.length === 0) {
    const nothing = sifted ? "Nothing in this group matches." : "Nothing to type from this block.";
    return <Text size="sm" c="dimmed">{nothing}</Text>;
  }

  return (
    <Box
      ref={grid}
      className="character-keys"
      role="toolbar"
      aria-label="Characters to type"
      onKeyDown={roving.handleKeyDown}
    >
      {keys.map((key, index) => (
        <UnstyledButton
          key={key.text}
          className="character-key"
          data-invisible={key.invisible || undefined}
          data-key={writePoints(key.text)}
          onClick={() => onKey(key)}
          onMouseDown={keepFocus}
          title={keyName(key, nameOf)}
          aria-label={keyName(key, nameOf)}
          {...roving.itemProps(index)}
        >
          {key.label}
        </UnstyledButton>
      ))}
    </Box>
  );
}

function columnsOf(grid: HTMLDivElement | null): number {
  const laid = [...grid?.children ?? []].filter((child): child is HTMLElement => child instanceof HTMLElement);
  const wrapped = laid.findIndex((child) => child.offsetTop > (laid[0]?.offsetTop ?? 0));
  return wrapped === -1 ? Math.max(laid.length, 1) : wrapped;
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap" data-finding={finding.kind}>
      <Badge color={finding.serious ? "orange" : "gray"} variant="light" tt="none">{finding.label}</Badge>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm">{finding.detail}</Text>
        {finding.codes.length > 0 && (
          <Text size="sm" c="dimmed" ff="monospace" style={{ overflowWrap: "anywhere" }}>
            {finding.codes.slice(0, MAX_CODES).map(codePoint).join(" ")}
            {finding.codes.length > MAX_CODES && ` and ${finding.codes.length - MAX_CODES} more`}
          </Text>
        )}
      </Box>
    </Group>
  );
}

function Forms({ forms }: { forms: Normalised[] }) {
  return (
    <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
      <Table.Tbody>
        {forms.map((form) => (
          <Table.Tr key={form.form} data-form={form.form}>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
              <Tooltip label={form.hint} withArrow multiline w={260}>
                <Text size="sm" c="dimmed">{form.form}</Text>
              </Tooltip>
            </Table.Td>
            <Table.Td w="1%">
              <Copy value={form.text} label={form.form} />
            </Table.Td>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
              <Text size="sm" c="dimmed">{form.characters}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }} c={form.same ? "dimmed" : undefined}>
                {form.same ? "unchanged" : form.text}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function Characters(
  { characters, nameOf, at, onPick }: {
    characters: Character[];
    nameOf: (code: number) => string;
    at: number;
    onPick: (at: number) => void;
  },
) {
  if (characters.length === 0) return <Text size="sm" c="dimmed">Nothing to read yet.</Text>;

  return (
    <Table.ScrollContainer minWidth={560} maxHeight={420} type="native">
      <Table verticalSpacing={6} horizontalSpacing="xs" highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w="1%">Character</Table.Th>
            <Table.Th w="1%">Code point</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th w="1%">Category</Table.Th>
            <Table.Th w="1%">Script</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {characters.slice(0, MAX_ROWS).map((character, index) => (
            <Table.Tr
              key={`${character.at}-${character.code}`}
              className="character-row"
              tabIndex={index === at ? 0 : -1}
              aria-selected={index === at}
              onClick={() => onPick(index)}
              onKeyDown={(event) => walk(event, index, onPick)}
              data-selected={index === at || undefined}
              data-code={codePoint(character.code)}
            >
              <Table.Td>
                <Text size="sm" ff="monospace" c={isInvisible(character) ? "dimmed" : undefined}>
                  {isInvisible(character) ? placeholder(character) : character.text}
                </Text>
              </Table.Td>
              <Table.Td style={{ whiteSpace: "nowrap" }}>
                <Text size="sm" ff="monospace">{codePoint(character.code)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" style={{ overflowWrap: "anywhere" }}>{nameOf(character.code)}</Text>
              </Table.Td>
              <Table.Td style={{ whiteSpace: "nowrap" }}>
                <Text size="sm" c="dimmed">{character.category}</Text>
              </Table.Td>
              <Table.Td style={{ whiteSpace: "nowrap" }}>
                <Text size="sm" c="dimmed">{character.script}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function walk(event: KeyboardEvent<HTMLTableRowElement>, index: number, onPick: (at: number) => void) {
  const move = MOVES[event.key];
  if (!move) return;

  const rows = event.currentTarget.parentElement?.children;
  const to = move(index, rows?.length ?? 0);
  const row = rows?.[to];
  if (!(row instanceof HTMLElement)) return;
  event.preventDefault();
  onPick(to);
  row.focus();
}

const MOVES: Record<string, ((index: number, rows: number) => number) | undefined> = {
  ArrowDown: (index) => index + 1,
  ArrowUp: (index) => index - 1,
  Home: () => 0,
  End: (_index, rows) => rows - 1,
};

function Glyph({ character }: { character: Character }) {
  if (isInvisible(character)) {
    return (
      <Text fz={20} ff="monospace" c="dimmed" ta="center" w={96} style={{ lineHeight: "96px" }}>
        {placeholder(character)}
      </Text>
    );
  }
  return <Text fz={64} ta="center" w={96} style={{ lineHeight: "96px" }}>{character.text}</Text>;
}

function Copy({ value, label }: { value: string; label: string }) {
  return (
    <CopyButton value={value} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
          <ActionIcon
            color={copied ? "teal" : "gray"}
            variant="subtle"
            size="sm"
            onClick={copy}
            aria-label={`Copy ${label}`}
          >
            {copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

function counts(text: string, characters: Character[]): Fact[] {
  const clusters = graphemes(text).length;
  return [
    { label: "Code points", value: String(characters.length) },
    { label: "Graphemes", value: clusters === characters.length ? "" : String(clusters) },
    { label: "UTF-16 units", value: String(text.length) },
    { label: "UTF-8 bytes", value: String(new TextEncoder().encode(text).length) },
    { label: "Scripts", value: [...new Set(characters.map(({ script }) => script))].join(", ") },
    { label: "Blocks", value: [...new Set(characters.map(({ block }) => block))].join(", ") },
  ];
}

function identity(character: Character, name: string): Fact[] {
  const { text } = character;
  const decomposed = text.normalize("NFD");
  const compatibility = text.normalize("NFKD");

  return [
    { label: "Name", value: name },
    { label: "Abbreviation", value: character.abbreviation },
    { label: "Category", value: `${categoryName(character.category)} (${character.category})` },
    { label: "Script", value: character.script },
    { label: "Block", value: character.block },
    { label: "Since", value: character.age === "" ? "" : `Unicode ${character.age}` },
    { label: "Looks like", value: character.looksLike === "" ? "" : `${character.looksLike} in ASCII` },
    { label: "Uppercase", value: text.toUpperCase() === text ? "" : text.toUpperCase() },
    { label: "Lowercase", value: text.toLowerCase() === text ? "" : text.toLowerCase() },
    { label: "Decomposes to", value: decomposed === text ? "" : writePoints(decomposed) },
    { label: "Stands for", value: compatibility === decomposed ? "" : writePoints(compatibility) },
  ];
}

const MAX_CODES = 24;

type Typing = (key: Key) => void;

function keyName(key: Key, nameOf: (code: number) => string): string {
  const named = key.name || (key.code === null ? "" : nameOf(key.code));
  return [writePoints(key.text), named].filter(Boolean).join(" ");
}

const EMPTY_KEYS: Keys = { keys: [], total: 0, sifted: false };

function selection(box: HTMLTextAreaElement | null, held: [number, number] | null, length: number): [number, number] {
  if (box && document.activeElement === box) return [box.selectionStart, box.selectionEnd];
  return held ?? [length, length];
}
