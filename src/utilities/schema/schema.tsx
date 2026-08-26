import { Alert, Box, Button, Card, Code, Group, Modal, Paper, ScrollArea, SegmentedControl, Select, Stack, Text, UnstyledButton } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import type { ReadResult } from "../../common/schema/ir";
import { isLanguage, LANGUAGE_OPTIONS, type LanguageId, LANGUAGES } from "../../common/schema/languages";
import { type ParsedJson, parseJson } from "../../common/schema/locate";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconAlertTriangle, IconArrowsLeftRight, IconCheck, IconSparkles, IconTransform } from "../../icons";
import { type Mark, PAYLOAD_EXTENSIONS, replaceDoc, schemaExtensions, setMarks } from "./editor";
import { inferSchema } from "./infer";
import { samplePayload } from "./sample";
import { SAMPLE_JSON_SCHEMA, SAMPLE_PAYLOAD, SAMPLE_PYDANTIC, SAMPLE_ZOD } from "./samples";
import type { Problem } from "./validate";
import { validate } from "./validate";

export default function Schema() {
  const initialState = useInitialHashState<{
    mode?: string;
    language?: string;
    target?: string;
    direction?: string;
    schema?: string;
    output?: string;
    payload?: string;
  }>();

  const [mode, setMode] = useState<Mode>(initialState?.mode === "convert" ? "convert" : "validate");
  const [language, setLanguage] = useState<LanguageId>(
    isLanguage(initialState?.language) ? initialState.language : "json-schema",
  );
  const [target, setTarget] = useState<LanguageId>(() => {
    const shared = isLanguage(initialState?.target) ? initialState.target : "zod";
    const source = isLanguage(initialState?.language) ? initialState.language : "json-schema";
    return shared === source ? OTHER_LANGUAGE[source] : shared;
  });
  const [direction, setDirection] = useState<Direction>(initialState?.direction === "payload" ? "payload" : "schema");

  const [initialDocuments] = useState<Documents>(() => {
    const documents: Documents = {
      "json-schema": SAMPLE_JSON_SCHEMA,
      zod: SAMPLE_ZOD,
      pydantic: SAMPLE_PYDANTIC,
      payload: SAMPLE_PAYLOAD,
    };
    if (initialState?.schema !== undefined && isLanguage(initialState.language)) {
      documents[initialState.language] = initialState.schema;
    }
    if (initialState?.output !== undefined && isLanguage(initialState.target)) {
      documents[initialState.target] = initialState.output;
    }
    if (initialState?.payload !== undefined) documents.payload = initialState.payload;
    return documents;
  });

  const documents = useRef(initialDocuments);
  const [texts, setTexts] = useState(initialDocuments);

  const sourceView = useRef<EditorView | null>(null);
  const secondView = useRef<EditorView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const reading = useMemo(() => LANGUAGES[language].read(texts[language]), [language, texts]);
  const parsed = useMemo(() => parseJson(texts.payload), [texts.payload]);

  const problems = useMemo(() => {
    if (mode !== "validate" || !reading.document || !parsed.ok) return [];
    return validate(parsed.parsed.value, reading.document);
  }, [mode, reading, parsed]);

  const marks = useMemo(
    () => parsed.ok ? problems.map((problem) => markFor(problem, parsed.parsed)) : [],
    [problems, parsed],
  );

  useRegisterShareState(() => ({
    mode,
    language,
    target: mode === "convert" ? target : undefined,
    direction: mode === "validate" ? direction : undefined,
    schema: texts[language],
    output: mode === "convert" ? texts[target] : undefined,
    payload: mode === "validate" ? texts.payload : undefined,
  }));

  const standing = useRef<Mark[]>(marks);
  useEffect(() => {
    standing.current = marks;
    if (mode === "validate") secondView.current?.dispatch({ effects: setMarks.of(marks) });
  }, [marks, mode]);

  useEffect(() => () => {
    self.schemaEditors = undefined;
  }, []);

  const publish = useCallback(() => {
    if (sourceView.current && secondView.current) {
      self.schemaEditors = { source: sourceView.current, second: secondView.current };
    }
  }, []);

  const handleSourceCreate = useCallback((view: EditorView) => {
    sourceView.current = view;
    publish();
  }, [publish]);

  const handleSecondCreate = useCallback((view: EditorView) => {
    secondView.current = view;
    view.dispatch({ effects: setMarks.of(standing.current) });
    publish();
  }, [publish]);

  const showing = useRef<{ source: DocumentKey; second: DocumentKey }>({ source: language, second: "payload" });
  showing.current = { source: language, second: mode === "convert" ? target : "payload" };

  const record = useCallback((key: DocumentKey, next: string) => {
    documents.current = { ...documents.current, [key]: next };
    setTexts(documents.current);
    setNotice(null);
  }, []);

  const handleSourceChange = useCallback((next: string) => record(showing.current.source, next), [record]);
  const handleSecondChange = useCallback((next: string) => record(showing.current.second, next), [record]);

  const apply = (write: Pending) => {
    replaceDoc(write.key === language ? sourceView.current : secondView.current, write.text);
    setPending(null);
  };

  const request = (write: Pending) => {
    setNotice(null);
    if (documents.current[write.key].trim() === "") return apply(write);
    setPending(write);
  };

  const generate = () => {
    if (mode === "validate" && direction === "payload") {
      if (!parsed.ok) return setNotice(`The payload is not JSON: ${parsed.error.message}.`);
      const inferred = inferSchema(parsed.parsed.value);
      return request({ key: language, text: LANGUAGES[language].write(inferred), label: LANGUAGES[language].label });
    }

    const { document, errors } = reading;
    if (!document) return setNotice(errors[0]?.message ?? `That is not a ${LANGUAGES[language].label} schema.`);

    if (mode === "convert") {
      return request({ key: target, text: LANGUAGES[target].write(document), label: LANGUAGES[target].label });
    }
    return request({ key: "payload", text: `${JSON.stringify(samplePayload(document), null, 2)}\n`, label: "payload" });
  };

  const swap = () => {
    if (mode === "convert") {
      setLanguage(target);
      setTarget(language);
      return;
    }
    setDirection((current) => current === "schema" ? "payload" : "schema");
  };

  const handleLanguage = (next: string | null) => {
    if (!isLanguage(next)) return;
    if (mode === "convert" && next === target) setTarget(language);
    setLanguage(next);
    setNotice(null);
  };

  const handleTarget = (next: string | null) => {
    if (!isLanguage(next)) return;
    if (next === language) setLanguage(target);
    setTarget(next);
    setNotice(null);
  };

  const reveal = (mark: Mark) => {
    const view = secondView.current;
    if (!view || mode !== "validate") return;
    view.focus();
    view.dispatch({ selection: { anchor: mark.from, head: mark.to }, scrollIntoView: true });
  };

  const sourceFirst = mode === "convert" || direction === "schema";
  const action = mode === "convert"
    ? `Convert to ${LANGUAGES[target].label}`
    : direction === "schema"
    ? "Generate payload"
    : `Generate ${LANGUAGES[language].label}`;

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle directory="schema">Schema</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <SegmentedControl
            value={mode}
            onChange={(value) => {
              setMode(value as Mode);
              setNotice(null);
            }}
            data={[{ value: "validate", label: "Validation" }, { value: "convert", label: "Conversion" }]}
            w="fit-content"
          />

          <Group align="flex-end" gap="xl" justify="space-between">
            <Group align="flex-end" gap="sm">
              <Select
                label={mode === "convert" ? "From" : "Schema"}
                data={LANGUAGE_OPTIONS}
                value={language}
                onChange={handleLanguage}
                allowDeselect={false}
                w={150}
              />
              {mode === "convert" && (
                <Select
                  label="To"
                  data={LANGUAGE_OPTIONS}
                  value={target}
                  onChange={handleTarget}
                  allowDeselect={false}
                  w={150}
                />
              )}
              <Button
                onClick={generate}
                leftSection={mode === "convert" ? <IconTransform size="1rem" /> : <IconSparkles size="1rem" />}
              >
                {action}
              </Button>
              <Button variant="default" onClick={swap} leftSection={<IconArrowsLeftRight size="1rem" />}>
                Swap
              </Button>
            </Group>

            {mode === "validate" && <Verdict reading={reading} parsed={parsed} problems={problems} />}
          </Group>
        </Stack>
      </Card>

      {notice && (
        <Alert color="red" icon={<IconAlertTriangle size="1rem" />} title="Nothing was written">{notice}</Alert>
      )}

      <Box className="editor-panes">
        <Pane
          label={mode === "convert" ? `${LANGUAGES[language].label} — source` : LANGUAGES[language].label}
          order={sourceFirst ? 1 : 2}
          editorKey={language}
          value={documents.current[language]}
          extensions={schemaExtensions(language)}
          onCreateEditor={handleSourceCreate}
          onChange={handleSourceChange}
        />
        <Pane
          label={mode === "convert" ? `${LANGUAGES[target].label} — result` : "JSON payload"}
          order={sourceFirst ? 2 : 1}
          editorKey={mode === "convert" ? target : "payload"}
          value={mode === "convert" ? documents.current[target] : documents.current.payload}
          extensions={mode === "convert" ? schemaExtensions(target) : PAYLOAD_EXTENSIONS}
          onCreateEditor={handleSecondCreate}
          onChange={handleSecondChange}
        />
      </Box>

      {mode === "validate" && (
        <Findings reading={reading} parsed={parsed} problems={problems} marks={marks} onReveal={reveal} />
      )}

      <Modal opened={pending !== null} onClose={() => setPending(null)} title="Replace what is there?" centered>
        <Stack gap="lg">
          <Text size="sm">
            The {pending?.label}{" "}
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

function Verdict({ reading, parsed, problems }: ResultProps) {
  if (!reading.document) return <Text size="sm" c="red">The schema could not be read</Text>;
  if (!parsed.ok) return <Text size="sm" c="red">The payload is not JSON</Text>;
  if (problems.length === 0) {
    return (
      <Group gap={6} wrap="nowrap">
        <IconCheck size="1rem" color="var(--mantine-color-teal-5)" />
        <Text size="sm" c="teal">The payload matches the schema</Text>
      </Group>
    );
  }
  return <Text size="sm" c="red">{problems.length === 1 ? "1 problem" : `${problems.length} problems`}</Text>;
}

interface FindingsProps extends ResultProps {
  marks: Mark[];
  onReveal: (mark: Mark) => void;
}

function Findings({ reading, parsed, problems, marks, onReveal }: FindingsProps) {
  const notes = reading.errors;
  if (notes.length === 0 && parsed.ok && problems.length === 0) return null;

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="xs">
        {notes.length > 0 && (
          <>
            <Text size="sm" fw={500}>The schema</Text>
            {notes.slice(0, MAX_LISTED).map((note, index) => (
              <Text key={index} size="sm" c="dimmed">{note.message}</Text>
            ))}
          </>
        )}

        {!parsed.ok && (
          <Text size="sm" c="red">
            Line {parsed.error.line}, column {parsed.error.column} — {parsed.error.message}
          </Text>
        )}

        {problems.length > 0 && (
          <>
            <Text size="sm" fw={500}>Problems</Text>
            <ScrollArea.Autosize mah={220} type="auto">
              <Stack gap={4}>
                {problems.slice(0, MAX_LISTED).map((problem, index) => (
                  <UnstyledButton
                    key={index}
                    className="schema-problem"
                    onClick={() => onReveal(marks[index])}
                  >
                    <Group gap="xs" wrap="nowrap" align="baseline">
                      <Code className="schema-pointer">{problem.pointer === "" ? "(root)" : problem.pointer}</Code>
                      <Text size="sm">{problem.message}</Text>
                    </Group>
                  </UnstyledButton>
                ))}
              </Stack>
            </ScrollArea.Autosize>
            {problems.length > MAX_LISTED && <Text size="sm" c="dimmed">and {problems.length - MAX_LISTED} more</Text>}
          </>
        )}
      </Stack>
    </Card>
  );
}

interface PaneProps {
  label: string;
  order: number;
  editorKey: string;
  value: string;
  extensions: ReturnType<typeof schemaExtensions>;
  onCreateEditor: (view: EditorView) => void;
  onChange: (value: string) => void;
}

function Pane({ label, order, editorKey, value, extensions, onCreateEditor, onChange }: PaneProps): ReactNode {
  return (
    <Stack gap="xs" mih={0} style={{ order } as CSSProperties}>
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

function markFor(problem: Problem, parsed: ParsedJson): Mark {
  const key = parsed.keys.get(problem.pointer);
  const value = parsed.spans.get(problem.pointer);
  const span = (problem.onKey ? key : problem.keyword === "required" ? key ?? value : value) ?? key
    ?? { from: 0, to: 0 };
  return { from: span.from, to: span.to, message: problem.message };
}

type Mode = "validate" | "convert";

type Direction = "schema" | "payload";

type DocumentKey = LanguageId | "payload";

type Documents = Record<DocumentKey, string>;

interface Pending {
  key: DocumentKey;
  text: string;
  label: string;
}

interface ResultProps {
  reading: ReadResult;
  parsed: ReturnType<typeof parseJson>;
  problems: Problem[];
}

const OTHER_LANGUAGE: Record<LanguageId, LanguageId> = {
  "json-schema": "zod",
  zod: "json-schema",
  pydantic: "json-schema",
};

const MAX_LISTED = 50;

declare global {
  var schemaEditors: { source: EditorView; second: EditorView } | undefined;
}
