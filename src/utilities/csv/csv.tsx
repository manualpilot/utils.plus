import { Box, Card, FileInput, Group, Paper, SegmentedControl, Select, Stack, Switch, Text } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { DataTable, type DataTableColumn, type DataTableSortStatus } from "mantine-datatable";
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { AUTO, DELIMITERS, isDelimiter } from "./delimiters";
import { editorExtensions } from "./editor";
import { FILE_TOO_BIG, MAX_FILE_BYTES, raggedWarning, READ_FAILED, summarise, truncatedMessage, UNTERMINATED_QUOTE } from "./messages";
import { readCsv } from "./parse";
import { cellText, MAX_ROWS, sortRows } from "./rows";
import { SAMPLE_DOCUMENT } from "./sample";
import { DEFAULT_VIEW, isView, VIEWS } from "./views";

import "mantine-datatable/styles.css";

export default function Csv() {
  const initialState = useInitialHashState<{
    value?: string;
    delimiter?: string;
    header?: boolean;
    view?: string;
  }>();

  const [initialValue] = useState(() => initialState?.value ?? SAMPLE_DOCUMENT);
  const valueRef = useRef(initialValue);
  const viewRef = useRef<EditorView | null>(null);

  const [delimiter, setDelimiter] = useState(() =>
    isDelimiter(initialState?.delimiter) ? initialState.delimiter : AUTO
  );
  const [header, setHeader] = useState(initialState?.header ?? true);
  const [view, setView] = useState(() => isView(initialState?.view) ? initialState.view : DEFAULT_VIEW);
  const [text, setText] = useState(initialValue);
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [problem, setProblem] = useState<string | null>(null);
  const [sort, setSort] = useState<DataTableSortStatus<Row> | null>(null);

  const table = useMemo(() => readCsv(text, delimiter, header), [text, delimiter, header]);

  useEffect(() => setSort(null), [delimiter, header]);

  const syncShareState = useRegisterShareState(() => ({
    value: valueRef.current,
    delimiter,
    header,
    view,
  }));

  useEffect(() => () => {
    self.csvEditor = undefined;
    if (parseTimer.current !== null) clearTimeout(parseTimer.current);
  }, []);

  const handleChange = useCallback((next: string) => {
    valueRef.current = next;
    syncShareState();

    if (parseTimer.current !== null) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      parseTimer.current = null;
      setText(valueRef.current);
    }, PARSE_DELAY);
  }, [syncShareState]);

  const placeDocument = useCallback((next: string) => {
    const editor = viewRef.current;
    if (!editor) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: next } });
  }, []);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setProblem(FILE_TOO_BIG);
      return;
    }

    try {
      const read = await file.text();
      setProblem(null);
      placeDocument(read);
      if (parseTimer.current !== null) clearTimeout(parseTimer.current);
      parseTimer.current = null;
      setText(read);
    } catch {
      setProblem(READ_FAILED);
    }
  }, [placeDocument]);

  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files.item(0));
  }, [handleFile]);

  const rows = useMemo(() => {
    const at = sort ? Number(sort.columnAccessor) : -1;
    return at >= 0 ? sortRows(table.rows, at, sort!.direction) : table.rows;
  }, [sort, table.rows]);

  const records = useMemo<Row[]>(
    () => rows.slice(0, MAX_ROWS).map((row, index) => ({ [ROW_KEY]: index, cells: row })),
    [rows],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () =>
      table.columns.map((title, at) => ({
        accessor: String(at),
        title,
        sortable: true,
        resizable: true,
        ellipsis: true,
        render: (record) => <Cell text={cellText(record.cells, at)} />,
      })),
    [table.columns],
  );

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle
        directory="csv"
        control={
          <SegmentedControl
            value={view}
            onChange={(value) => isView(value) && setView(value)}
            aria-label="Which half of the page is showing"
            data={VIEWS.map(({ value, label, Icon }) => ({
              value,
              label: (
                <Group gap={6} wrap="nowrap" justify="center">
                  <Icon size="1rem" stroke={1.5} />
                  {label}
                </Group>
              ),
            }))}
          />
        }
      >
        CSV
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Box className="settings-row">
            <Select
              label="Delimiter"
              data={DELIMITERS.map(({ value, label }) => ({ value, label }))}
              value={delimiter}
              onChange={(value) => isDelimiter(value) && setDelimiter(value)}
              allowDeselect={false}
            />
            <Box
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={handleDrop}
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                outline: dragging ? "2px dashed var(--mantine-color-blue-5)" : "none",
                outlineOffset: "4px",
              }}
            >
              <FileInput
                label="File"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                placeholder="Choose a file, or drop one here"
                aria-label="CSV file to read"
                value={null}
                onChange={(file) => void handleFile(file)}
              />
            </Box>
            <Box pb={8}>
              <Switch
                checked={header}
                onChange={(event) => setHeader(event.currentTarget.checked)}
                label="First row is a header"
              />
            </Box>
          </Box>

          <Group gap="sm" wrap="nowrap">
            <Text size="sm" c="dimmed">{summarise(table, rows.length)}</Text>
            {table.unterminated && <Text size="sm" c="yellow">{UNTERMINATED_QUOTE}</Text>}
            {table.ragged > 0 && <Text size="sm" c="yellow">{raggedWarning(table.ragged)}</Text>}
            {problem && <Text size="sm" c="red">{problem}</Text>}
          </Group>
        </Stack>
      </Card>

      <Box className="csv-panes" data-view={view}>
        <Paper withBorder shadow="sm" radius="md" className="csv-text-pane">
          <Box style={PANE_FILL}>
            <CodeMirror
              value={initialValue}
              height="100%"
              style={EDITOR_STYLE}
              theme="dark"
              extensions={editorExtensions(table.delimiter)}
              onCreateEditor={(editor) => {
                viewRef.current = editor;
                self.csvEditor = editor;
              }}
              onChange={handleChange}
            />
          </Box>
        </Paper>

        <Paper withBorder shadow="sm" radius="md" className="csv-table-pane">
          <Box style={PANE_FILL}>
            {rows.length > MAX_ROWS && (
              <Text size="xs" c="yellow" px="sm" py={6} style={BAR}>{truncatedMessage(rows.length)}</Text>
            )}
            <Box style={{ flex: 1, minHeight: 0 }}>
              <DataTable
                records={records}
                columns={columns}
                idAccessor={ROW_KEY}
                height="100%"
                sortStatus={sort ?? UNSORTED}
                onSortStatusChange={setSort}
                withColumnBorders
                striped
                highlightOnHover
                noRecordsText="Nothing to show — paste a delimited document above, or drop a file on the picker."
                verticalSpacing={4}
                horizontalSpacing="sm"
              />
            </Box>
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}

interface Row {
  [ROW_KEY]: number;
  cells: string[];
}

function Cell({ text }: { text: string }) {
  return <Text component="span" size="xs" ff="monospace" title={text}>{text}</Text>;
}

const PARSE_DELAY = 150;

const ROW_KEY = "__row";

const UNSORTED: DataTableSortStatus<Row> = { columnAccessor: "", direction: "asc" };

const PANE_FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column" as const,
};

const BAR = { flex: "none", borderBottom: "1px solid var(--mantine-color-default-border)" };

declare global {
  var csvEditor: EditorView | undefined;
}
