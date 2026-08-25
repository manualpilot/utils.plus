import { Badge, Box, Button, Card, Divider, getTreeExpandedState, Group, Loader, Modal, Paper, type RenderTreeNodePayload, SegmentedControl, Select, Stack, Tabs, Text, Tree, useTree } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { DataTable, type DataTableColumn } from "mantine-datatable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_BACKGROUND, EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { PANE_INSET, Split } from "../../common/split-panes";
import { UtilityTitle } from "../../common/utility-title";
import { IconChevronRight, IconDatabaseImport, IconPlayerPlay, IconRestore, IconTable, IconTerminal2 } from "../../icons";
import { type Cell, isNull, MAX_ROWS, writeCell } from "./cells";
import { type DatasetId, datasetNamed, DATASETS, datasetScript, isDataset } from "./datasets";
import { editorExtensions } from "./editor";
import { type Engine, failureText, isMode, type ModeId, MODES, openDatabase, type Outcome, populated, type Schema } from "./engine";
import { appended, type LogEntry, type LogLevel, writeLog } from "./logs";
import { EMPTY_SCHEMA, LOAD_UNDONE, loadingMessage, loadWarning, NO_LOG_YET, NO_SCHEMA_YET, NOT_RUN_YET, NOTHING_TO_RUN, ranMessage, readyMessage, RESETTING, RUNNING, schemaFailure, startFailure, startingMessage, summarise, truncatedMessage } from "./messages";

import { oneLine, splitStatements } from "./statements";
import { defaultOpen, type SchemaNode, schemaTree } from "./tree";

import "mantine-datatable/styles.css";

export default function Sql() {
  const initialState = useInitialHashState<{ mode?: string; dataset?: string; sql?: string }>();
  const opened: ModeId = isMode(initialState?.mode) ? initialState.mode : "sqlite";
  const [mode, setMode] = useState<ModeId>(opened);

  const sqlRef = useRef(initialState?.sql ?? "");
  const viewRef = useRef<EditorView | null>(null);
  const placed = useRef("");
  const runWanted = useRef(false);

  const [dataset, setDataset] = useState<DatasetId>(
    isDataset(initialState?.dataset) ? initialState.dataset : DATASETS[0].value,
  );
  const [loaded, setLoaded] = useState<DatasetId | null>(null);
  const [asking, setAsking] = useState(false);

  const [generation, setGeneration] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [starting, setStarting] = useState(true);
  const [running, setRunning] = useState(false);

  const [schemas, setSchemas] = useState<Schema[] | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<string | null>(RESULTS_TAB);

  const catalogue = useRef<Schema[]>(NO_SCHEMAS);
  useEffect(() => {
    catalogue.current = schemas ?? NO_SCHEMAS;
  }, [schemas]);
  const readCatalogue = useCallback(() => catalogue.current, []);
  const extensions = useMemo(() => editorExtensions(mode, readCatalogue), [mode, readCatalogue]);

  const syncShareState = useRegisterShareState(() => ({ mode, dataset, sql: sqlRef.current || undefined }));

  const record = useCallback((level: LogLevel, ...texts: string[]) => {
    const at = Date.now();
    setEntries((entries) => appended(entries, texts.map((text) => ({ at, level, text }))));
  }, []);

  useEffect(() => () => {
    self.sqlEditor = undefined;
  }, []);

  const runScript = useCallback(async (target: Engine, dialect: ModeId) => {
    const statements = splitStatements(sqlRef.current, dialect);
    if (statements.length === 0) {
      setShown(null);
      setProblem(null);
      setNote(NOTHING_TO_RUN);
      return;
    }

    setRunning(true);
    setNote(null);
    setProblem(null);
    const began = performance.now();
    let last: Shown | null = null;
    let done = 0;
    let refused: string | null = null;

    for (const statement of statements) {
      const started = performance.now();
      try {
        const outcome = await target.execute(statement.sql);
        const ms = performance.now() - started;
        done++;
        record("notice", ...outcome.notices);
        record("query", `${oneLine(statement.sql)} — ${summarise(outcome, ms)}`);
        if (outcome.columns.length > 0) last = { outcome, ms };
      } catch (error) {
        refused = failureText(error);
        record("error", `line ${statement.line}: ${refused}`);
        break;
      }
    }

    setShown(last);
    setProblem(refused);
    setNote(refused || last ? null : ranMessage(done, performance.now() - began));
    setRunning(false);

    try {
      setSchemas(await target.inspect());
    } catch (error) {
      record("error", schemaFailure(failureText(error)));
    }
  }, [record]);

  useEffect(() => {
    let live = true;
    let held: Engine | null = null;

    setEngine(null);
    setStarting(true);
    setSchemas(null);
    setShown(null);
    setNote(null);
    setProblem(null);

    (async () => {
      try {
        const started = await openDatabase(mode);
        held = started;
        if (!live) return;

        setEngine(started);
        setStarting(false);
        record("engine", readyMessage(started.version));

        if (runWanted.current) {
          runWanted.current = false;
          await runScript(started, mode);
          return;
        }

        const read = await started.inspect();
        if (live) setSchemas(read);
      } catch (error) {
        if (!live) return;
        setStarting(false);
        setProblem(startFailure(mode, failureText(error)));
        record("error", startFailure(mode, failureText(error)));
      }
    })();

    return () => {
      live = false;
      void held?.close();
    };
  }, [generation, mode, record, runScript]);

  const handleChange = useCallback((next: string) => {
    sqlRef.current = next;
    syncShareState();
  }, [syncShareState]);

  const writeSample = useCallback((next: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    placed.current = next;
  }, []);

  const replaceSample = useCallback((next: string) => {
    if (sqlRef.current === placed.current) writeSample(next);
  }, [writeSample]);

  const handleMode = useCallback((next: ModeId) => {
    const carried = loaded !== null && sqlRef.current === placed.current ? loaded : null;
    replaceSample(carried ? datasetScript(datasetNamed(carried), next) : "");
    runWanted.current = carried !== null;
    setLoaded(carried);
    setMode(next);
  }, [loaded, replaceSample]);

  const handleReset = useCallback(() => {
    record("engine", RESETTING);
    setLoaded(null);
    setGeneration((generation) => generation + 1);
  }, [record]);

  const filled = useMemo(() => populated(schemas ?? NO_SCHEMAS), [schemas]);

  const applyLoad = useCallback(() => {
    setAsking(false);
    record("engine", loadingMessage(datasetNamed(dataset).label));
    writeSample(datasetScript(datasetNamed(dataset), mode));
    setLoaded(dataset);
    runWanted.current = true;
    setGeneration((generation) => generation + 1);
  }, [dataset, mode, record, writeSample]);

  const handleLoad = useCallback(() => {
    if (sqlRef.current.trim() === "" && !filled) return applyLoad();
    setAsking(true);
  }, [applyLoad, filled]);

  const handleExecute = useCallback(() => {
    if (!engine || running) return;
    void runScript(engine, mode);
  }, [engine, mode, running, runScript]);

  const busy = starting || running;
  const status = starting ? startingMessage(mode, loaded && datasetNamed(loaded).label) : engine?.version;

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle
        directory="sql"
        control={
          <SegmentedControl
            value={mode}
            onChange={(value) => handleMode(value as ModeId)}
            aria-label="Database"
            disabled={running}
            data={MODES.map((entry) => ({ value: entry.value, label: entry.label }))}
          />
        }
      >
        SQL
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="center" gap="lg" justify="space-between" wrap="nowrap">
          <Group align="center" gap="sm" wrap="nowrap">
            <Button onClick={handleExecute} disabled={busy} leftSection={<IconPlayerPlay size="1rem" />}>
              Execute
            </Button>
            <Button variant="default" onClick={handleReset} disabled={busy} leftSection={<IconRestore size="1rem" />}>
              Reset database
            </Button>

            <Divider orientation="vertical" mx="xs" style={{ alignSelf: "stretch" }} />

            <Select
              w={150}
              aria-label="Example dataset"
              value={dataset}
              onChange={(value) => isDataset(value) && setDataset(value)}
              disabled={busy}
              allowDeselect={false}
              data={DATASETS.map((entry) => ({ value: entry.value, label: entry.label }))}
            />
            <Button
              variant="default"
              onClick={handleLoad}
              disabled={busy}
              leftSection={<IconDatabaseImport size="1rem" />}
            >
              Load
            </Button>
          </Group>

          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            {starting && <Loader size="xs" />}
            {status && <Text size="sm" c="dimmed" truncate="end">{status}</Text>}
          </Group>
        </Group>
      </Card>

      <Split
        direction="row"
        label="Resize the schema pane"
        initial={DEFAULT_SCHEMA_WIDTH}
        floors={SCHEMA_FLOORS}
        second={<SchemaPane schemas={schemas} />}
        first={
          <Split
            direction="column"
            label="Resize the results pane"
            initial={DEFAULT_RESULTS_HEIGHT}
            floors={RESULTS_FLOORS}
            first={
              <Paper withBorder shadow="sm" radius="md" style={{ position: "relative", overflow: "hidden" }}>
                <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  <CodeMirror
                    value={sqlRef.current}
                    height="100%"
                    style={EDITOR_STYLE}
                    theme="dark"
                    extensions={extensions}
                    onCreateEditor={(view) => {
                      viewRef.current = view;
                      self.sqlEditor = view;
                    }}
                    onChange={handleChange}
                  />
                </Box>
              </Paper>
            }
            second={
              <Paper withBorder shadow="sm" radius="md" style={{ position: "relative", overflow: "hidden" }}>
                <Box style={PANE_INSET}>
                  <Tabs
                    value={tab}
                    onChange={setTab}
                    keepMounted={false}
                    style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
                  >
                    <Tabs.List>
                      <Tabs.Tab value={RESULTS_TAB} leftSection={<IconTable size="0.9rem" />}>Results</Tabs.Tab>
                      <Tabs.Tab value={LOGS_TAB} leftSection={<IconTerminal2 size="0.9rem" />}>
                        Logs{entries.length > 0 && ` (${entries.length.toLocaleString()})`}
                      </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value={RESULTS_TAB} style={PANEL_FILL}>
                      <Results shown={shown} note={note} problem={problem} running={running} />
                    </Tabs.Panel>

                    <Tabs.Panel value={LOGS_TAB} style={PANEL_FILL}>
                      <Logs entries={entries} />
                    </Tabs.Panel>
                  </Tabs>
                </Box>
              </Paper>
            }
          />
        }
      />

      <Modal opened={asking} onClose={() => setAsking(false)} title="Load over what is here?" centered>
        <Stack gap="lg">
          <Text size="sm">{loadWarning(datasetNamed(dataset).label, filled)} {LOAD_UNDONE}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setAsking(false)}>Cancel</Button>
            <Button color="red" onClick={applyLoad}>Reset and load</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface Shown {
  outcome: Outcome;
  ms: number;
}

function Results({ shown, note, problem, running }: ResultsProps) {
  const rows = shown?.outcome.rows ?? EMPTY_ROWS;
  const columns = shown?.outcome.columns ?? EMPTY_COLUMNS;

  const records = useMemo(
    () =>
      rows.slice(0, MAX_ROWS).map((cells, index) => {
        const record: Record<string, Cell> = { [ROW_KEY]: index };
        cells.forEach((cell, at) => {
          record[String(at)] = cell;
        });
        return record;
      }),
    [rows],
  );

  const grid = useMemo<DataTableColumn<Record<string, Cell>>[]>(
    () =>
      columns.map((name, at) => ({
        accessor: String(at),
        title: name,
        resizable: true,
        ellipsis: true,
        render: (record) => <CellText value={record[String(at)]} />,
      })),
    [columns],
  );

  const message = running ? RUNNING : note ?? (problem ? null : NOT_RUN_YET);

  return (
    <>
      {problem && <Text size="xs" c="red" px="sm" py={6} style={{ ...BAR, whiteSpace: "pre-wrap" }}>{problem}</Text>}

      {shown
        ? (
          <>
            <Group px="sm" py={6} gap="sm" wrap="nowrap" style={BAR}>
              <Text size="xs" c="dimmed" truncate="end">{summarise(shown.outcome, shown.ms)}</Text>
              {rows.length > MAX_ROWS && (
                <Text size="xs" c="yellow" style={{ flex: "none" }}>{truncatedMessage(MAX_ROWS, rows.length)}</Text>
              )}
            </Group>

            <Box style={{ flex: 1, minHeight: 0 }}>
              <DataTable
                records={records}
                columns={grid}
                idAccessor={ROW_KEY}
                height="100%"
                withColumnBorders
                striped
                highlightOnHover
                noRecordsText="The statement returned no rows."
                verticalSpacing={4}
                horizontalSpacing="sm"
              />
            </Box>
          </>
        )
        : (
          <Box p="sm" style={{ flex: 1, overflow: "auto" }}>
            {message && <Text size="sm" c="dimmed">{message}</Text>}
          </Box>
        )}
    </>
  );
}

interface ResultsProps {
  shown: Shown | null;
  note: string | null;
  problem: string | null;
  running: boolean;
}

function CellText({ value }: { value: Cell }) {
  const text = writeCell(value);
  return (
    <Text component="span" size="xs" ff="monospace" c={isNull(value) ? "dimmed" : undefined} title={text}>
      {text}
    </Text>
  );
}

function Logs({ entries }: { entries: LogEntry[] }) {
  const text = useMemo(() => writeLog(entries), [entries]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const away = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (away < FOLLOW_SLACK) box.scrollTop = box.scrollHeight;
  }, [text]);

  return (
    <Box ref={scroller} style={{ flex: 1, minHeight: 0, overflow: "auto", backgroundColor: EDITOR_BACKGROUND }}>
      <Text
        component="pre"
        role="log"
        aria-label="Database log"
        ff="monospace"
        fz="xs"
        p="sm"
        m={0}
        c={entries.length === 0 ? "dimmed" : undefined}
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {entries.length === 0 ? NO_LOG_YET : text}
      </Text>
    </Box>
  );
}

function SchemaPane({ schemas }: { schemas: Schema[] | null }) {
  const tree = useTree();
  const nodes = useMemo(() => schemaTree(schemas ?? []), [schemas]);

  const settled = useRef(false);
  useEffect(() => {
    if (nodes.length === 0) {
      settled.current = false;
      return;
    }
    if (settled.current) return;
    settled.current = true;
    tree.setExpandedState(getTreeExpandedState(nodes, defaultOpen(nodes)));
  }, [nodes, tree]);

  return (
    <Paper withBorder shadow="sm" radius="md" style={{ position: "relative", overflow: "hidden" }}>
      <Box style={PANE_INSET}>
        <Box px="sm" py="xs" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <Text size="sm" fw={500}>Schema</Text>
        </Box>
        <Box p="xs" style={{ flex: 1, overflow: "auto" }}>
          {nodes.length === 0
            ? <Text size="sm" c="dimmed" px="xs">{schemas === null ? NO_SCHEMA_YET : EMPTY_SCHEMA}</Text>
            : <Tree data={nodes} tree={tree} aria-label="Database schema" levelOffset="md" renderNode={renderRow} />}
        </Box>
      </Box>
    </Paper>
  );
}

function renderRow({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) {
  const { name, kind, detail, marks, block } = (node as SchemaNode).row;
  const { style, ...rest } = elementProps;

  if (block) {
    return (
      <Box {...rest} style={{ ...style, cursor: "default" }}>
        <Text size="xs" ff="monospace" c="bright" style={{ whiteSpace: "pre-wrap" }}>{name}</Text>
      </Box>
    );
  }

  return (
    <Group {...rest} style={{ ...style, cursor: hasChildren ? "pointer" : "default" }} gap="xs" wrap="nowrap">
      <IconChevronRight
        size="0.8rem"
        style={{
          flex: "0 0 auto",
          visibility: hasChildren ? undefined : "hidden",
          transform: expanded ? "rotate(90deg)" : undefined,
        }}
      />
      <Text size="xs" ff="monospace" style={{ flex: "0 0 auto" }}>{name}</Text>
      {kind && <Text size="xs" c="dimmed" style={{ flex: "0 0 auto" }}>{kind}</Text>}
      {marks?.map((mark) => (
        <Badge key={mark} size="xs" variant="light" color="gray" tt="none" style={{ flex: "0 0 auto" }}>{mark}</Badge>
      ))}
      {detail && (
        <Text size="xs" ff="monospace" c="bright" flex={1} miw={0} truncate="end" title={detail}>{detail}</Text>
      )}
    </Group>
  );
}

const BAR = { flex: "none", borderBottom: "1px solid var(--mantine-color-default-border)" };

const RESULTS_TAB = "results";
const LOGS_TAB = "logs";

const PANEL_FILL = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" as const };

const DEFAULT_SCHEMA_WIDTH = 340;
const DEFAULT_RESULTS_HEIGHT = 260;
const SCHEMA_FLOORS = { first: 240, second: 192 };
const RESULTS_FLOORS = { first: 144, second: 128 };

const FOLLOW_SLACK = 24;

const ROW_KEY = "__row";

const NO_SCHEMAS: Schema[] = [];

const EMPTY_ROWS: Cell[][] = [];
const EMPTY_COLUMNS: string[] = [];

declare global {
  var sqlEditor: EditorView | undefined;
}
