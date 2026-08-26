import { ActionIcon, Alert, Badge, Box, Card, CopyButton, Group, NumberInput, Paper, SegmentedControl, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { download } from "../../common/download";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { isLanguage, LANGUAGE_OPTIONS, type LanguageId, LANGUAGES } from "../../common/schema/languages";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconAlertTriangle, IconCheck, IconCircleCheck, IconCircleX, IconCopy, IconDice5, IconDownload } from "../../icons";
import { type Candidate, identify } from "./checksums";
import { outputExtensions, schemaExtensions } from "./editor";
import { generateBatch, type Optionality, rowName } from "./generate";
import { isLocale, LOCALE_OPTIONS, type LocaleId } from "./locales";
import { SAMPLE_JSON_SCHEMA, SAMPLE_PYDANTIC, SAMPLE_ZOD } from "./samples";
import { freshSeed } from "./seed";
import { FORMAT_OPTIONS, type FormatId, FORMATS, isFormat } from "./write";

export default function Mock() {
  const initialState = useInitialHashState<{
    mode?: string;
    language?: string;
    schema?: string;
    seed?: string;
    count?: number;
    locale?: string;
    optional?: string;
    format?: string;
    value?: string;
  }>();

  const [mode, setMode] = useState<Mode>(initialState?.mode === "check" ? "check" : "generate");
  const [language, setLanguage] = useState<LanguageId>(
    isLanguage(initialState?.language) ? initialState.language : "json-schema",
  );
  const [seed, setSeed] = useState(initialState?.seed ?? DEFAULT_SEED);
  const [count, setCount] = useState<number | string>(clampCount(initialState?.count));
  const [locale, setLocale] = useState<LocaleId>(isLocale(initialState?.locale) ? initialState.locale : "en-US");
  const [optional, setOptional] = useState<Optionality>(pickOptionality(initialState?.optional));
  const [format, setFormat] = useState<FormatId>(isFormat(initialState?.format) ? initialState.format : "json");
  const [value, setValue] = useState(initialState?.value ?? "");

  const [initialDocuments] = useState<Documents>(() => {
    const documents = { ...SAMPLES };
    if (initialState?.schema !== undefined && isLanguage(initialState.language)) {
      documents[initialState.language] = initialState.schema;
    }
    return documents;
  });

  const documents = useRef(initialDocuments);
  const [sources, setSources] = useState(initialDocuments);

  const schemaView = useRef<EditorView | null>(null);
  const outputView = useRef<EditorView | null>(null);

  const syncShareState = useRegisterShareState(() => ({
    mode,
    language: mode === "generate" ? language : undefined,
    schema: mode === "generate" ? sources[language] : undefined,
    seed: mode === "generate" ? seed : undefined,
    count: mode === "generate" ? count : undefined,
    locale: mode === "generate" ? locale : undefined,
    optional: mode === "generate" ? optional : undefined,
    format: mode === "generate" ? format : undefined,
    value: mode === "check" && value ? value : undefined,
  }));

  useEffect(() => () => {
    self.mockEditors = undefined;
  }, []);

  const publish = useCallback(() => {
    if (schemaView.current && outputView.current) {
      self.mockEditors = { schema: schemaView.current, output: outputView.current };
    }
  }, []);

  const handleSchemaCreate = useCallback((view: EditorView) => {
    schemaView.current = view;
    publish();
  }, [publish]);

  const handleOutputCreate = useCallback((view: EditorView) => {
    outputView.current = view;
    publish();
  }, [publish]);

  const showing = useRef(language);
  showing.current = language;

  const handleSchemaChange = useCallback((next: string) => {
    documents.current = { ...documents.current, [showing.current]: next };
    setSources(documents.current);
    syncShareState();
  }, [syncShareState]);

  const rows = parseCount(count);

  const batch = useMemo(() => {
    if (rows === null) return null;
    const { document, errors } = LANGUAGES[language].read(sources[language]);
    if (!document) return { failed: errors[0]?.message ?? "This schema could not be read.", notes: [], text: "" };

    const { rows: generated, notes } = generateBatch(document, { seed, count: rows, locale, optional });
    return { failed: null, notes, text: FORMATS[format].write(generated, rowName(document)) };
  }, [sources, language, seed, rows, locale, optional, format]);

  const shown = useRef("");
  if (batch && !batch.failed) shown.current = batch.text;

  const countError = rows === null ? `Enter a count between 1 and ${MAX_COUNT}` : null;
  const candidates = useMemo(() => value.trim() ? identify(value.trim()) : [], [value]);

  const save = () => {
    if (!batch || batch.failed) return;
    const { extension, mime } = FORMATS[format];
    download(`${fileStem(sources[language], language)}.${extension}`, new Blob([batch.text], { type: mime }));
  };

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle
        directory="mock"
        control={
          <SegmentedControl
            value={mode}
            onChange={(next) => setMode(next as Mode)}
            data={MODES}
            aria-label="Mode"
          />
        }
      >
        {mode === "generate" ? "Mock Data" : "Check a Number"}
      </UtilityTitle>

      {mode === "generate"
        ? (
          <>
            <Card withBorder shadow="sm" radius="md">
              <Stack>
                <Box className="settings-row">
                  <Select
                    label="Schema"
                    data={LANGUAGE_OPTIONS}
                    value={language}
                    onChange={(next) => isLanguage(next) && setLanguage(next)}
                    allowDeselect={false}
                  />
                  <Select
                    label="Locale"
                    description="Names, addresses and bank details"
                    data={LOCALE_OPTIONS}
                    value={locale}
                    onChange={(next) => isLocale(next) && setLocale(next)}
                    allowDeselect={false}
                  />
                  <Select
                    label="Output"
                    data={FORMAT_OPTIONS}
                    value={format}
                    onChange={(next) => isFormat(next) && setFormat(next)}
                    allowDeselect={false}
                  />
                </Box>

                <Box
                  className={countError ? "settings-row has-error" : "settings-row"}
                  mb={countError ? "md" : 0}
                >
                  <NumberInput
                    label="Rows"
                    value={count}
                    onChange={setCount}
                    min={1}
                    max={MAX_COUNT}
                    allowDecimal={false}
                    allowNegative={false}
                    error={countError}
                    classNames={{ root: "relative-root", error: "absolute-error" }}
                  />
                  <Select
                    label="Optional fields"
                    description="What a key that need not be there does"
                    data={OPTIONALITY_OPTIONS}
                    value={optional}
                    onChange={(next) => setOptional(pickOptionality(next))}
                    allowDeselect={false}
                  />
                  <TextInput
                    label="Seed"
                    description="The same seed is the same batch"
                    value={seed}
                    onChange={(event) => setSeed(event.currentTarget.value)}
                    spellCheck={false}
                    rightSection={
                      <Tooltip label="New seed" withArrow position="left">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => setSeed(freshSeed())}
                          aria-label="New seed"
                        >
                          <IconDice5 size="1.1rem" />
                        </ActionIcon>
                      </Tooltip>
                    }
                  />
                </Box>
              </Stack>
            </Card>

            {batch?.failed && (
              <Alert color="red" icon={<IconAlertTriangle size="1rem" />} title="Nothing was generated">
                {batch.failed}
              </Alert>
            )}

            {batch && batch.notes.length > 0 && (
              <Alert
                color="yellow"
                icon={<IconAlertTriangle size="1rem" />}
                title="Some of the schema could not be honoured"
              >
                <Stack gap={4}>
                  {batch.notes.map((note) => <Text key={note} size="sm">{note}</Text>)}
                </Stack>
              </Alert>
            )}

            <Box className="editor-panes">
              <Pane label={`${LANGUAGES[language].label} — schema`} editorKey={language}>
                <CodeMirror
                  key={language}
                  value={documents.current[language]}
                  height="100%"
                  style={EDITOR_STYLE}
                  theme="dark"
                  extensions={schemaExtensions(language)}
                  onCreateEditor={handleSchemaCreate}
                  onChange={handleSchemaChange}
                />
              </Pane>

              <Pane
                label={`${rows ?? 0} ${rows === 1 ? "row" : "rows"} — ${FORMATS[format].label}`}
                editorKey={format}
                actions={
                  <Group gap={4}>
                    <Tooltip label="Save as a file" withArrow position="left">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={save}
                        disabled={!batch || Boolean(batch.failed)}
                        aria-label="Save the batch"
                      >
                        <IconDownload size="1.1rem" />
                      </ActionIcon>
                    </Tooltip>
                    <CopyButton value={batch?.text ?? ""} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                          <ActionIcon
                            variant="subtle"
                            color={copied ? "teal" : "gray"}
                            onClick={copy}
                            aria-label="Copy the batch"
                          >
                            {copied ? <IconCheck size="1.1rem" /> : <IconCopy size="1.1rem" />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                }
              >
                <CodeMirror
                  key={format}
                  value={shown.current}
                  height="100%"
                  style={EDITOR_STYLE}
                  theme="dark"
                  extensions={outputExtensions(format)}
                  onCreateEditor={handleOutputCreate}
                />
              </Pane>
            </Box>
          </>
        )
        : (
          <>
            <Card withBorder shadow="sm" radius="md">
              <TextInput
                label="Number"
                description="A payment card, an IBAN, an ISBN, a barcode or an IMEI — spaces and hyphens are ignored"
                placeholder="4539 5789 0080 5187"
                value={value}
                onChange={(event) => setValue(event.currentTarget.value)}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            </Card>

            {candidates.map((candidate) => <Verdict key={candidate.format} candidate={candidate} />)}

            {value.trim() && candidates.length === 0 && (
              <Alert color="gray" icon={<IconAlertTriangle size="1rem" />} title="Nothing recognised">
                This is not the length or the alphabet of a payment card, an IBAN, an ISBN, a barcode or an IMEI, so
                there is no checksum here to hold or fail.
              </Alert>
            )}
          </>
        )}
    </Stack>
  );
}

function Verdict({ candidate }: { candidate: Candidate }) {
  return (
    <Card withBorder shadow="sm" radius="md" data-verdict={candidate.format}>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
        <Stack gap={4} miw={0}>
          <Text fw={500}>{candidate.format}</Text>
          {candidate.detail && <Text size="sm" c="dimmed">{candidate.detail}</Text>}
          {candidate.expected && (
            <Text size="sm" c="dimmed">
              The check digit here is{" "}
              <Text span ff="monospace">{candidate.normalised.slice(-candidate.expected.length)}</Text>, where{" "}
              <Text span ff="monospace">{candidate.expected}</Text> is what would hold.
            </Text>
          )}
        </Stack>
        <Badge
          color={candidate.valid ? "teal" : "red"}
          variant="light"
          size="lg"
          leftSection={candidate.valid ? <IconCircleCheck size="0.9rem" /> : <IconCircleX size="0.9rem" />}
        >
          {candidate.valid ? "Valid" : "Fails"}
        </Badge>
      </Group>
    </Card>
  );
}

function Pane({ label, editorKey, actions, children }: PaneProps): ReactNode {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm" mih={26}>
        <Text size="sm" fw={500}>{label}</Text>
        {actions}
      </Group>
      <Paper withBorder shadow="sm" radius="md" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} key={editorKey}>
          {children}
        </Box>
      </Paper>
    </Stack>
  );
}

interface PaneProps {
  label: string;
  editorKey: string;
  actions?: ReactNode;
  children: ReactNode;
}

type Mode = "generate" | "check";

type Documents = { [id in LanguageId]: string };

function parseCount(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_COUNT) return null;
  return parsed;
}

function clampCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_COUNT;
  return Math.min(Math.max(Math.round(value), 1), MAX_COUNT);
}

function pickOptionality(value: string | null | undefined): Optionality {
  return value === "always" || value === "never" || value === "sometimes" ? value : "sometimes";
}

function fileStem(source: string, language: LanguageId): string {
  const { document } = LANGUAGES[language].read(source);
  const name = document ? rowName(document) : "mock";
  return name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "mock";
}

const MODES = [{ value: "generate", label: "Generate" }, { value: "check", label: "Check" }];

const OPTIONALITY_OPTIONS = [
  { value: "always", label: "Always filled" },
  { value: "sometimes", label: "Sometimes" },
  { value: "never", label: "Left out" },
];

const SAMPLES: Documents = {
  "json-schema": SAMPLE_JSON_SCHEMA,
  zod: SAMPLE_ZOD,
  pydantic: SAMPLE_PYDANTIC,
};

const DEFAULT_SEED = "utils";

const DEFAULT_COUNT = 10;

const MAX_COUNT = 1000;

declare global {
  var mockEditors: { schema: EditorView; output: EditorView } | undefined;
}
