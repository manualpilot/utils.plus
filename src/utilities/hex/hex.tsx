import { ActionIcon, Alert, Box, Button, Card, Divider, Group, Paper, SegmentedControl, Select, Stack, Switch, Text, TextInput, Title, Tooltip } from "@mantine/core";
import CodeMirror, { EditorSelection, EditorView, Text as EditorText, type ViewUpdate } from "@uiw/react-codemirror";
import { type ChangeEvent, type DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { byteSize } from "../../common/byte-size";
import { download } from "../../common/download";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconArrowDown, IconArrowUp, IconDownload, IconEraser, IconPlus, IconRestore, IconSearch, IconTrash, IconUpload, IconX } from "../../icons";
import { type Doc, insert, isDirty, openDoc, overwrite, parseHex, remove, revert } from "./bytes";
import { dumpLines, formatByte, formatOffset, offsetDigits, PER_ROW_OPTIONS } from "./dump";
import { type Caret, caretOf, type Column, type Handlers, HEX_SETUP, hexExtensions, type Model, modelField, positionOf, selectBytes, setModel } from "./editor";
import { pickEncoding, TEXT_ENCODINGS } from "./encodings";
import { MAX_TEXT, PEEK, textReadings, valueReadings } from "./inspect";
import { countMatches, findNext, findPrevious, MATCH_CAP, type Mode, MODE_OPTIONS, needleFor, parseOffset } from "./search";
import { load, type Loaded, MAX_BYTES, message } from "./source";

export default function HexTool() {
  const initialState = useInitialHashState<{
    perRow?: number;
    base?: number;
    encoding?: string;
    upper?: boolean;
    endian?: string;
  }>();

  const [perRow, setPerRow] = useState(() => pickPerRow(initialState?.perRow));
  const [base, setBase] = useState(initialState?.base === 10 ? 10 : 16);
  const [encodingValue, setEncodingValue] = useState(() => pickEncoding(initialState?.encoding).value);
  const [upper, setUpper] = useState(initialState?.upper === true);
  const [little, setLittle] = useState(initialState?.endian !== "big");

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [name, setName] = useState("");

  const [caret, setCaret] = useState<Caret>(NO_CARET);
  const [column, setColumn] = useState<Column>("hex");

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("hex");

  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const editor = useRef<EditorView | null>(null);
  const pending = useRef<number | null>(null);

  useRegisterShareState(() => ({
    perRow: perRow === DEFAULT_PER_ROW ? undefined : perRow,
    base: base === 16 ? undefined : base,
    encoding: encodingValue === TEXT_ENCODINGS[0].value ? undefined : encodingValue,
    upper: upper || undefined,
    endian: little ? undefined : "big",
  }));

  const encoding = pickEncoding(encodingValue);
  const bytes = doc?.bytes ?? EMPTY;
  const size = bytes.length;
  const digits = offsetDigits(size, base);
  const { cursor, start, end } = caret;
  const run = end - start + 1;

  const model: Model = useMemo(
    () => ({ doc: doc ?? EMPTY_DOC, perRow, upper, base, digits, encoding, column }),
    [doc, perRow, upper, base, digits, encoding, column],
  );

  const handlers = useRef<Handlers>({ type: () => {}, move: () => {}, focus: () => {} });
  const extensions = useMemo(() => hexExtensions(handlers), []);

  const move = useCallback((offset: number, extend: boolean) => {
    const view = editor.current;
    if (!view) return;
    if (!extend) {
      selectBytes(view, offset, offset);
      return;
    }
    const was = caretOf(view.state);
    selectBytes(view, was.cursor === was.start ? was.end : was.start, offset);
  }, []);

  const type = useCallback((key: string) => {
    const view = editor.current;
    const current = docRef.current;
    if (!view || !current) return;
    const { cursor, nibble } = caretOf(view.state);
    const size = current.bytes.length;
    if (cursor >= size) return;
    const byte = current.bytes[cursor];

    let written: number;
    let to = cursor;
    let half = 0;
    if (columnRef.current === "hex") {
      if (!/^[0-9a-f]$/i.test(key)) return;
      const value = Number.parseInt(key, 16);
      written = nibble === 0 ? (value << 4) | (byte & 0x0f) : (byte & 0xf0) | value;
      if (nibble === 0) half = 1;
      else to = Math.min(cursor + 1, size - 1);
    } else {
      const value = encodingRef.current.byteFor(key);
      if (value === null) return;
      written = value;
      to = Math.min(cursor + 1, size - 1);
    }

    const next = overwrite(current, cursor, Uint8Array.of(written));
    setDoc(next);
    const at = positionOf(view.state, cursor);
    view.dispatch({
      changes: { from: at, to: at + 2, insert: formatByte(written, upperRef.current) },
      selection: EditorSelection.single(positionOf(view.state, to, half)),
      effects: setModel.of({ ...modelRef.current, doc: next }),
    });
  }, []);

  const focus = useCallback((which: Column) => setColumn(which), []);

  const docRef = useRef(doc);
  const columnRef = useRef(column);
  const encodingRef = useRef(encoding);
  const upperRef = useRef(upper);
  const modelRef = useRef(model);
  const caretRef = useRef(caret);
  docRef.current = doc;
  columnRef.current = column;
  encodingRef.current = encoding;
  upperRef.current = upper;
  modelRef.current = model;
  caretRef.current = caret;
  handlers.current = { type, move, focus };

  useEffect(() => {
    const view = editor.current;
    if (!ready || !view || !doc) return;
    const was = caretOf(view.state);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: EditorText.of(dumpLines(doc.bytes, perRow, upper)) },
      effects: setModel.of(modelRef.current),
    });
    const last = Math.max(0, doc.bytes.length - 1);
    const wanted = pending.current;
    pending.current = null;
    const head = Math.min(wanted ?? was.cursor, last);
    selectBytes(view, wanted === null ? Math.min(was.start, last) : head, head);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, revision, perRow, upper]);

  useEffect(() => {
    const view = editor.current;
    if (!ready || !view) return;
    if (view.state.field(modelField, false) === model) return;
    view.dispatch({ effects: setModel.of(model) });
  }, [ready, model]);

  const take = useCallback(async (file: File | null) => {
    if (!file) return;
    setReading(true);
    try {
      const next = await load(file);
      setLoaded(next);
      setDoc(openDoc(next.bytes));
      setName(next.name);
      setFailure(null);
      setCaret(NO_CARET);
      setRevision((at) => at + 1);
    } catch (error) {
      setFailure(message(error));
    } finally {
      setReading(false);
    }
  }, []);

  const put = useCallback((next: Doc, at: number) => {
    pending.current = at;
    setDoc(next);
    setRevision((count) => count + 1);
  }, []);

  const needle = useMemo(() => needleFor(query, mode, encoding), [query, mode, encoding]);
  const found = needle && "bytes" in needle ? needle.bytes : null;
  const queryProblem = needle && "error" in needle ? needle.error : null;
  const matches = useMemo(() => (found && size > 0 ? countMatches(bytes, found) : 0), [bytes, found, size]);

  const select = useCallback((from: number, to: number) => {
    const view = editor.current;
    if (view) selectBytes(view, to, from);
  }, []);

  useEffect(() => {
    if (!found || size === 0) return;
    const at = findNext(bytes, found, cursor);
    if (at >= 0) select(at, at + found.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);

  const step = useCallback((backwards: boolean) => {
    const view = editor.current;
    const current = docRef.current;
    const needle = foundRef.current;
    if (!view || !current || !needle || current.bytes.length === 0) return;
    const at = caretOf(view.state).cursor;
    const found = backwards
      ? findPrevious(current.bytes, needle, at - 1)
      : findNext(current.bytes, needle, at + 1);
    if (found >= 0) select(found, found + needle.length - 1);
  }, [select]);

  const foundRef = useRef(found);
  foundRef.current = found;

  const goTo = useCallback((offset: number) => select(offset, offset), [select]);

  const insertBytes = useCallback((values: Uint8Array, atEnd: boolean) => {
    const current = docRef.current;
    if (!current) return;
    const at = atEnd ? current.bytes.length : caretRef.current.start;
    put(insert(current, at, values), at);
  }, [put]);

  const fillRun = useCallback((values: Uint8Array) => {
    const current = docRef.current;
    if (!current) return;
    const { start, end } = caretRef.current;
    const length = end - start + 1;
    const written = new Uint8Array(length);
    for (let at = 0; at < length; at++) written[at] = values[at % values.length];
    put(overwrite(current, start, written), start);
  }, [put]);

  const deleteRun = useCallback(() => {
    const current = docRef.current;
    if (!current) return;
    const { start, end } = caretRef.current;
    put(remove(current, start, end - start + 1), start);
  }, [put]);

  const revertAll = useCallback(() => {
    const current = docRef.current;
    if (current) put(revert(current), 0);
  }, [put]);

  const removeFile = useCallback(() => {
    setLoaded(null);
    setDoc(null);
    setQuery("");
    setCaret(NO_CARET);
    setReady(false);
    editor.current = null;
  }, []);

  const save = useCallback(() => {
    const current = docRef.current;
    const file = loadedRef.current;
    if (!current || !file) return;
    download(nameRef.current.trim() || file.name, new Blob([current.bytes as BlobPart], { type: file.type }));
  }, []);

  const loadedRef = useRef(loaded);
  const nameRef = useRef(name);
  loadedRef.current = loaded;
  nameRef.current = name;

  useEffect(() => () => {
    self.hexEditor = undefined;
  }, []);

  const onCreate = useCallback((view: EditorView) => {
    editor.current = view;
    self.hexEditor = view;
    setReady(true);
  }, []);

  const onUpdate = useCallback((update: ViewUpdate) => {
    if (update.selectionSet || update.docChanged) setCaret(caretOf(update.state));
  }, []);

  return (
    <Stack gap="md">
      <UtilityTitle directory="hex">Hex</UtilityTitle>

      <FileCard
        loaded={loaded}
        doc={doc}
        reading={reading}
        failure={failure}
        onTake={take}
        onRevert={revertAll}
        onRemove={removeFile}
      />

      {doc && loaded && (
        <>
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="sm">
              <Title order={4}>Bytes</Title>

              <ViewSettings
                perRow={perRow}
                base={base}
                encodingValue={encodingValue}
                upper={upper}
                onPerRow={setPerRow}
                onBase={setBase}
                onEncoding={setEncodingValue}
                onUpper={setUpper}
              />

              <Paper withBorder radius="sm" className="hex-editor">
                <CodeMirror
                  theme="dark"
                  maxHeight={EDITOR_MAX_HEIGHT}
                  style={EDITOR_TEXT}
                  basicSetup={HEX_SETUP}
                  extensions={extensions}
                  onCreateEditor={onCreate}
                  onUpdate={onUpdate}
                />
              </Paper>

              <Group gap="lg" wrap="wrap">
                <Text size="xs" c="dimmed" ff="monospace" data-hex="offset">
                  {`Offset ${formatOffset(cursor, base, digits, upper)}${base === 16 ? ` (${cursor})` : ""}`}
                </Text>
                <Text size="xs" c="dimmed" data-hex="selection">
                  {run > 1 ? `${run} bytes selected` : "Nothing selected"}
                </Text>
                <Text size="xs" c="dimmed">
                  {column === "hex" ? "Typing sets the hex" : `Typing sets the ${encoding.label} character`}
                </Text>
              </Group>

              <Text size="xs" c="dimmed">
                Click a byte to put the caret on it, drag or hold shift to select a run, and type to overwrite. The
                arrow keys walk the file; nothing typed here ever changes how long it is.
              </Text>
            </Stack>
          </Card>

          <Box className="card-columns">
            <Inspector
              bytes={bytes}
              cursor={cursor}
              start={start}
              end={end}
              run={run}
              little={little}
              onEndian={setLittle}
            />
            <FindCard
              query={query}
              mode={mode}
              queryProblem={queryProblem}
              matches={matches}
              found={found !== null}
              size={size}
              onQuery={setQuery}
              onMode={setMode}
              onStep={step}
              onGo={goTo}
            />
          </Box>

          <Box className="card-columns">
            <EditCard
              column={column}
              run={run}
              size={size}
              onColumn={setColumn}
              onInsert={insertBytes}
              onFill={fillRun}
              onDelete={deleteRun}
            />
            <SaveCard name={name} type={loaded.type} length={doc.bytes.length} onName={setName} onSave={save} />
          </Box>
        </>
      )}

      {!loaded && (
        <Text size="sm" c="dimmed">
          {`Any file up to ${MAX_BYTES / 1024 / 1024} MB, of any kind. It is read in this tab, edited in this tab and `
            + "saved back out of this tab, and no part of it is ever sent anywhere."}
        </Text>
      )}
    </Stack>
  );
}

const FileCard = memo(function FileCard({ loaded, doc, reading, failure, onTake, onRevert, onRemove }: FileCardProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      onDragOver={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event: DragEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        void onTake(event.dataTransfer.files.item(0));
      }}
      style={{ outline: dragging && loaded ? "2px dashed var(--mantine-color-orange-4)" : undefined }}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Title order={4}>File</Title>
          {loaded && doc && (
            <Group gap={4} wrap="nowrap">
              {isDirty(doc) && (
                <Tooltip label="Throw every edit away and read the file as it arrived" withArrow position="left">
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconRestore size="0.9rem" />}
                    onClick={onRevert}
                  >
                    Put it back
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="Take this file off the page" withArrow position="left">
                <ActionIcon variant="subtle" color="gray" aria-label="Remove the file" onClick={onRemove}>
                  <IconTrash size="1.1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>

        {!loaded && (
          <Box
            component="label"
            className="file-dropzone"
            data-dragging={dragging || undefined}
            onDragOver={(event: DragEvent<HTMLLabelElement>) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event: DragEvent<HTMLLabelElement>) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(event: DragEvent<HTMLLabelElement>) => {
              event.preventDefault();
              setDragging(false);
              void onTake(event.dataTransfer.files.item(0));
            }}
          >
            <Stack align="center" gap={4}>
              <IconUpload size="2rem" stroke={1.3} />
              <Text size="sm">Click to choose any file, or drop one here</Text>
              <Text size="xs" c="dimmed">
                Nothing is uploaded — the file is read in this tab and never leaves it
              </Text>
            </Stack>
            <input
              type="file"
              hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                void onTake(event.currentTarget.files?.item(0) ?? null);
                event.currentTarget.value = "";
              }}
            />
          </Box>
        )}

        {reading && <Text size="sm" c="dimmed">Reading…</Text>}

        {failure && (
          <Alert color="red" icon={<IconX size="1rem" />} title="That file did not open">
            {failure}
          </Alert>
        )}

        {loaded && doc && (
          <FactTable
            rows={[
              { label: "Name", value: loaded.name },
              { label: "Type", value: loaded.type },
              { label: "Looks like", value: loaded.kind ?? "" },
              { label: "Size", value: sizeFact(loaded.size, doc.bytes.length) },
              { label: "Changed", value: changedFact(doc) },
              { label: "Modified", value: loaded.modified ? new Date(loaded.modified).toLocaleString() : "" },
            ]}
          />
        )}
      </Stack>
    </Card>
  );
});

interface FileCardProps {
  loaded: Loaded | null;
  doc: Doc | null;
  reading: boolean;
  failure: string | null;
  onTake(file: File | null): void;
  onRevert(): void;
  onRemove(): void;
}

const ViewSettings = memo(function ViewSettings(
  { perRow, base, encodingValue, upper, onPerRow, onBase, onEncoding, onUpper }: ViewSettingsProps,
) {
  return (
    <Box className="settings-row">
      <Select
        label="Bytes per row"
        data={PER_ROW_OPTIONS.map((count) => ({ value: String(count), label: String(count) }))}
        value={String(perRow)}
        onChange={(value) => onPerRow(pickPerRow(Number(value)))}
        allowDeselect={false}
      />
      <Select
        label="Offsets"
        data={[{ value: "16", label: "Hexadecimal" }, { value: "10", label: "Decimal" }]}
        value={String(base)}
        onChange={(value) => onBase(value === "10" ? 10 : 16)}
        allowDeselect={false}
      />
      <Select
        label="Text as"
        description="One byte, one glyph"
        data={TEXT_ENCODINGS.map(({ value, label }) => ({ value, label }))}
        value={encodingValue}
        onChange={(value) => onEncoding(pickEncoding(value ?? undefined).value)}
        allowDeselect={false}
      />
      <Box pb={8}>
        <Switch checked={upper} onChange={(event) => onUpper(event.currentTarget.checked)} label="Uppercase hex" />
      </Box>
    </Box>
  );
});

interface ViewSettingsProps {
  perRow: number;
  base: number;
  encodingValue: string;
  upper: boolean;
  onPerRow(value: number): void;
  onBase(value: number): void;
  onEncoding(value: string): void;
  onUpper(value: boolean): void;
}

const Inspector = memo(function Inspector({ bytes, cursor, start, end, run, little, onEndian }: InspectorProps) {
  const size = bytes.length;
  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Title order={4}>Inspector</Title>
          <SegmentedControl
            size="xs"
            value={little ? "little" : "big"}
            onChange={(value) => onEndian(value === "little")}
            aria-label="Byte order"
            data={[{ value: "little", label: "Little-endian" }, { value: "big", label: "Big-endian" }]}
          />
        </Group>
        <FactTable rows={valueReadings(bytes, cursor, little)} />
        <Divider />
        <Text size="xs" c="dimmed">{textCaption(run, size - start)}</Text>
        <FactTable rows={run > 1 ? textReadings(bytes, start, end + 1) : textReadings(bytes, start, size, PEEK)} />
      </Stack>
    </Card>
  );
});

interface InspectorProps {
  bytes: Uint8Array;
  cursor: number;
  start: number;
  end: number;
  run: number;
  little: boolean;
  onEndian(little: boolean): void;
}

const FindCard = memo(function FindCard(
  { query, mode, queryProblem, matches, found, size, onQuery, onMode, onStep, onGo }: FindCardProps,
) {
  const [target, setTarget] = useState("");
  const [asked, setAsked] = useState(false);

  const jump = () => {
    setAsked(true);
    const parsed = parseOffset(target, size);
    if (typeof parsed === "number") onGo(parsed);
  };

  const targetProblem = problemOf(target, () => parseOffset(target, size), asked);

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm">
        <Title order={4}>Find</Title>
        <Box className={rowClass(queryProblem)} mb={queryProblem ? "md" : 0}>
          <TextInput
            label="Looking for"
            placeholder={mode === "hex" ? "ff d8 ff" : "PNG"}
            value={query}
            onChange={(event) => onQuery(event.currentTarget.value)}
            error={queryProblem}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            spellCheck={false}
          />
          <Select
            label="As"
            data={MODE_OPTIONS}
            value={mode}
            onChange={(value) => onMode(value === "text" ? "text" : "hex")}
            allowDeselect={false}
          />
          <Box pb={0}>
            <Group gap={4} wrap="nowrap">
              <Tooltip label="The match before the caret" withArrow>
                <ActionIcon
                  variant="light"
                  size="lg"
                  aria-label="Previous match"
                  disabled={!found || matches === 0}
                  onClick={() => onStep(true)}
                >
                  <IconArrowUp size="1.1rem" />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="The match after the caret" withArrow>
                <ActionIcon
                  variant="light"
                  size="lg"
                  aria-label="Next match"
                  disabled={!found || matches === 0}
                  onClick={() => onStep(false)}
                >
                  <IconArrowDown size="1.1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        </Box>

        <Text size="xs" c="dimmed" data-hex="matches">{matchesFact(found, matches)}</Text>

        <Divider />

        <Box className={rowClass(targetProblem)} mb={targetProblem ? "md" : 0}>
          <TextInput
            label="Go to offset"
            description="Decimal, or hex behind 0x"
            placeholder="0x1a4"
            value={target}
            onChange={(event) => setTarget(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && jump()}
            error={targetProblem}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            spellCheck={false}
          />
          <Box pb={0}>
            <Button variant="light" leftSection={<IconSearch size="0.9rem" />} onClick={jump}>
              Go there
            </Button>
          </Box>
        </Box>
      </Stack>
    </Card>
  );
});

interface FindCardProps {
  query: string;
  mode: Mode;
  queryProblem: string | null;
  matches: number;
  found: boolean;
  size: number;
  onQuery(value: string): void;
  onMode(value: Mode): void;
  onStep(backwards: boolean): void;
  onGo(offset: number): void;
}

const EditCard = memo(function EditCard({ column, run, size, onColumn, onInsert, onFill, onDelete }: EditCardProps) {
  const [pattern, setPattern] = useState("");
  const [where, setWhere] = useState("cursor");
  const [fill, setFill] = useState("00");
  const [asked, setAsked] = useState({ pattern: false, fill: false });

  const insertBytes = () => {
    setAsked((was) => ({ ...was, pattern: true }));
    const values = parseHex(pattern);
    if (values) onInsert(values, where === "end");
  };

  const fillRun = () => {
    setAsked((was) => ({ ...was, fill: true }));
    const values = parseHex(fill);
    if (values) onFill(values);
  };

  const patternProblem = problemOf(pattern, () => parseHex(pattern) ?? { error: BAD_HEX }, asked.pattern);
  const fillProblem = problemOf(fill, () => parseHex(fill) ?? { error: BAD_HEX }, asked.fill);

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Title order={4}>Edit</Title>
          <SegmentedControl
            size="xs"
            value={column}
            onChange={(value) => onColumn(value === "text" ? "text" : "hex")}
            aria-label="Which column typing goes into"
            data={[{ value: "hex", label: "Type hex" }, { value: "text", label: "Type text" }]}
          />
        </Group>

        <Box className={rowClass(patternProblem)} mb={patternProblem ? "md" : 0}>
          <TextInput
            label="Insert bytes"
            placeholder="00 ff"
            value={pattern}
            onChange={(event) => setPattern(event.currentTarget.value)}
            error={patternProblem}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            spellCheck={false}
          />
          <Select
            label="At"
            data={[{ value: "cursor", label: "The caret" }, { value: "end", label: "The end" }]}
            value={where}
            onChange={(value) => setWhere(value === "end" ? "end" : "cursor")}
            allowDeselect={false}
          />
          <Box pb={0}>
            <Button variant="light" leftSection={<IconPlus size="0.9rem" />} onClick={insertBytes}>
              Insert
            </Button>
          </Box>
        </Box>

        <Box className={rowClass(fillProblem)} mb={fillProblem ? "md" : 0}>
          <TextInput
            label="Fill the selection with"
            description="Repeated to whatever length it is"
            placeholder="00"
            value={fill}
            onChange={(event) => setFill(event.currentTarget.value)}
            error={fillProblem}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            spellCheck={false}
          />
          <Box pb={0}>
            <Button variant="light" leftSection={<IconEraser size="0.9rem" />} onClick={fillRun}>
              {run > 1 ? `Fill ${run} bytes` : "Fill the byte"}
            </Button>
          </Box>
        </Box>

        <Group gap="sm">
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size="0.9rem" />}
            disabled={run >= size}
            onClick={onDelete}
          >
            {run > 1 ? `Delete ${run} bytes` : "Delete the byte"}
          </Button>
          <Text size="xs" c="dimmed">
            {run >= size
              ? "A file with no bytes left is not a file this can save."
              : "There is no undo — Put it back is the whole file."}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
});

interface EditCardProps {
  column: Column;
  run: number;
  size: number;
  onColumn(column: Column): void;
  onInsert(values: Uint8Array, atEnd: boolean): void;
  onFill(values: Uint8Array): void;
  onDelete(): void;
}

const SaveCard = memo(function SaveCard({ name, type, length, onName, onSave }: SaveCardProps) {
  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm">
        <Title order={4}>Save</Title>
        <Box className="settings-row">
          <TextInput
            label="File name"
            value={name}
            onChange={(event) => onName(event.currentTarget.value)}
            spellCheck={false}
          />
          <Box pb={0}>
            <Button leftSection={<IconDownload size="0.9rem" />} onClick={onSave}>
              Download
            </Button>
          </Box>
        </Box>
        <Text size="xs" c="dimmed">
          {`${byteSize(length)}, written back as ${type}. Every byte nobody touched is the byte that was read — `
            + "nothing here re-encodes anything."}
        </Text>
      </Stack>
    </Card>
  );
});

interface SaveCardProps {
  name: string;
  type: string;
  length: number;
  onName(value: string): void;
  onSave(): void;
}

function problemOf(value: string, read: () => unknown, asked: boolean): string | null {
  if (value.trim() === "") return asked ? "Required" : null;
  const answer = read();
  return answer !== null && typeof answer === "object" && "error" in answer ? String(answer.error) : null;
}

function rowClass(problem: string | null): string {
  return problem ? "settings-row has-error" : "settings-row";
}

function sizeFact(original: number, now: number): string {
  if (original === now) return byteSize(now);
  return `${byteSize(now)} — it arrived as ${byteSize(original)}`;
}

function changedFact(doc: Doc): string {
  if (!isDirty(doc)) return "";
  const written = doc.changed.size;
  const grew = doc.bytes.length - doc.original.length;
  const length = grew === 0 ? "" : grew > 0 ? `, ${grew} longer` : `, ${-grew} shorter`;
  return `${written} ${written === 1 ? "byte" : "bytes"} written${length}`;
}

function textCaption(run: number, left: number): string {
  if (run > 1) {
    return run > MAX_TEXT
      ? `The first ${MAX_TEXT} of the ${run} selected bytes, read as text`
      : `The ${run} selected bytes, read as text`;
  }
  return left > PEEK
    ? `The ${PEEK} bytes from the caret on, read as text`
    : "The bytes from the caret on, read as text";
}

function matchesFact(found: boolean, matches: number): string {
  if (!found) return "";
  if (matches === 0) return "No match anywhere in the file.";
  if (matches >= MATCH_CAP) return `More than ${MATCH_CAP} matches — the arrows step through them from the caret.`;
  return `${matches} ${matches === 1 ? "match" : "matches"}, and the arrows step through them from the caret.`;
}

function pickPerRow(value: number | undefined): number {
  return value !== undefined && PER_ROW_OPTIONS.includes(value) ? value : DEFAULT_PER_ROW;
}

const DEFAULT_PER_ROW = 16;

const BAD_HEX = "Pairs of hex digits, spaced however you like.";

const EMPTY = new Uint8Array(0);

const EMPTY_DOC: Doc = { bytes: EMPTY, original: EMPTY, changed: new Set() };

const NO_CARET: Caret = { cursor: 0, start: 0, end: 0, nibble: 0 };

const EDITOR_MAX_HEIGHT = "min(60vh, 620px)";

const EDITOR_TEXT = { fontSize: 13 };

declare global {
  var hexEditor: EditorView | undefined;
}
