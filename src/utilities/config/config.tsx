import { Alert, Box, Button, Card, Group, Modal, Paper, Select, Stack, Text } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconAlertTriangle, IconArrowsLeftRight, IconTransform } from "../../icons";
import { editorExtensions, replaceDoc } from "./editor";
import { FORMAT_OPTIONS, type FormatId, FORMATS, isFormat } from "./formats";
import { SAMPLES } from "./samples";

export default function Config() {
  const initialState = useInitialHashState<{
    from?: string;
    to?: string;
    indent?: string;
    source?: string;
    output?: string;
  }>();

  const [from, setFrom] = useState<FormatId>(isFormat(initialState?.from) ? initialState.from : "yaml");
  const [to, setTo] = useState<FormatId>(() => {
    const source = isFormat(initialState?.from) ? initialState.from : "yaml";
    const target = isFormat(initialState?.to) ? initialState.to : "json";
    return target === source ? OTHER_FORMAT[source] : target;
  });
  const [indent, setIndent] = useState(initialState?.indent ?? "2");

  const [initialDocuments] = useState<Documents>(() => {
    const documents = { ...SAMPLES };
    if (initialState?.source !== undefined && isFormat(initialState.from)) {
      documents[initialState.from] = initialState.source;
    }
    if (initialState?.output !== undefined && isFormat(initialState.to)) {
      documents[initialState.to] = initialState.output;
    }
    return documents;
  });

  const documents = useRef(initialDocuments);

  const sourceView = useRef<EditorView | null>(null);
  const targetView = useRef<EditorView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lost, setLost] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  const syncShareState = useRegisterShareState(() => ({
    from,
    to,
    indent: FORMATS[to].indents ? indent : undefined,
    source: documents.current[from],
    output: documents.current[to],
  }));

  useEffect(() => () => {
    self.configEditors = undefined;
  }, []);

  const publish = useCallback(() => {
    if (sourceView.current && targetView.current) {
      self.configEditors = { source: sourceView.current, target: targetView.current };
    }
  }, []);

  const handleSourceCreate = useCallback((view: EditorView) => {
    sourceView.current = view;
    publish();
  }, [publish]);

  const handleTargetCreate = useCallback((view: EditorView) => {
    targetView.current = view;
    publish();
  }, [publish]);

  const showing = useRef<{ source: FormatId; target: FormatId }>({ source: from, target: to });
  showing.current = { source: from, target: to };

  const record = useCallback((format: FormatId, next: string) => {
    documents.current = { ...documents.current, [format]: next };
    syncShareState();
  }, [syncShareState]);

  const handleSourceChange = useCallback((next: string) => record(showing.current.source, next), [record]);
  const handleTargetChange = useCallback((next: string) => record(showing.current.target, next), [record]);

  const apply = (write: Pending) => {
    replaceDoc(targetView.current, write.text);
    setLost(write.lost);
    setPending(null);
  };

  const convert = () => {
    setNotice(null);
    setLost([]);

    const source = FORMATS[from];
    const reading = source.read(documents.current[from]);
    if (!reading.ok) {
      const { message, line, column } = reading.error;
      const place = line === undefined ? "" : ` at line ${line}, column ${column}`;
      return setNotice(`The ${source.label} document could not be read${place}: ${message}`);
    }

    const result = FORMATS[to].write(reading.value, { indent: parseInt(indent, 10) });
    if (!result.ok) return setNotice(result.message);

    const write = { text: result.text, lost: result.lost };
    return documents.current[to].trim() === "" ? apply(write) : setPending(write);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setNotice(null);
    setLost([]);
  };

  const handleFrom = (next: string | null) => {
    if (!isFormat(next)) return;
    if (next === to) setTo(from);
    setFrom(next);
    setNotice(null);
    setLost([]);
  };

  const handleTo = (next: string | null) => {
    if (!isFormat(next)) return;
    if (next === from) setFrom(to);
    setTo(next);
    setNotice(null);
    setLost([]);
  };

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle directory="config">Config</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="sm">
          <Select label="From" data={FORMAT_OPTIONS} value={from} onChange={handleFrom} allowDeselect={false} w={150} />
          <Select label="To" data={FORMAT_OPTIONS} value={to} onChange={handleTo} allowDeselect={false} w={150} />
          {FORMATS[to].indents && (
            <Select
              label="Indent"
              data={INDENT_OPTIONS}
              value={indent}
              onChange={(value) => value && setIndent(value)}
              allowDeselect={false}
              w={130}
            />
          )}
          <Button onClick={convert} leftSection={<IconTransform size="1rem" />}>
            Convert to {FORMATS[to].label}
          </Button>
          <Button variant="default" onClick={swap} leftSection={<IconArrowsLeftRight size="1rem" />}>
            Swap
          </Button>
        </Group>
      </Card>

      {notice && (
        <Alert color="red" icon={<IconAlertTriangle size="1rem" />} title="Nothing was written">{notice}</Alert>
      )}

      {lost.length > 0 && (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size="1rem" />}
          title={`${FORMATS[to].label} has no way to hold everything in this document`}
        >
          Nothing was written for {lost.slice(0, MAX_LISTED).join(", ")}
          {lost.length > MAX_LISTED ? `, and ${lost.length - MAX_LISTED} more` : ""}.
        </Alert>
      )}

      <Box className="editor-panes">
        <Pane
          label={`${FORMATS[from].label} — source`}
          editorKey={from}
          value={documents.current[from]}
          extensions={editorExtensions(from)}
          onCreateEditor={handleSourceCreate}
          onChange={handleSourceChange}
        />
        <Pane
          label={`${FORMATS[to].label} — result`}
          editorKey={to}
          value={documents.current[to]}
          extensions={editorExtensions(to)}
          onCreateEditor={handleTargetCreate}
          onChange={handleTargetChange}
        />
      </Box>

      <Modal opened={pending !== null} onClose={() => setPending(null)} title="Replace what is there?" centered>
        <Stack gap="lg">
          <Text size="sm">
            The {FORMATS[to].label}{" "}
            pane already has something in it. Writing this over it cannot be undone from here, though the editor's own
            undo still has it.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setPending(null)}>Cancel</Button>
            <Button color="red" onClick={() => pending && apply(pending)}>Replace</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface PaneProps {
  label: string;
  editorKey: string;
  value: string;
  extensions: ReturnType<typeof editorExtensions>;
  onCreateEditor: (view: EditorView) => void;
  onChange: (value: string) => void;
}

function Pane({ label, editorKey, value, extensions, onCreateEditor, onChange }: PaneProps): ReactNode {
  return (
    <Stack gap="xs" mih={0}>
      <Text size="sm" fw={500}>{label}</Text>
      <Paper withBorder shadow="sm" radius="md" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <CodeMirror
            key={editorKey}
            value={value}
            height="100%"
            style={EDITOR_STYLE}
            theme="dark"
            extensions={extensions}
            onCreateEditor={onCreateEditor}
            onChange={onChange}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

type Documents = { [id in FormatId]: string };

interface Pending {
  text: string;
  lost: string[];
}

const OTHER_FORMAT: { [id in FormatId]: FormatId } = {
  yaml: "json",
  json: "yaml",
  toml: "yaml",
  env: "yaml",
  properties: "yaml",
};

const INDENT_OPTIONS = [
  { value: "2", label: "2 Spaces" },
  { value: "4", label: "4 Spaces" },
  { value: "8", label: "8 Spaces" },
];

const MAX_LISTED = 20;

declare global {
  var configEditors: { source: EditorView; target: EditorView } | undefined;
}
