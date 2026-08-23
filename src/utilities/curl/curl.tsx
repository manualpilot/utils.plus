import { ActionIcon, Autocomplete, Badge, Box, Button, Card, CloseButton, CopyButton, Fieldset, Group, Loader, Paper, SegmentedControl, Select, Stack, Switch, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_BACKGROUND, EDITOR_STYLE } from "../../common/editor-theme";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconPlayerPlay, IconPlayerStop, IconPlus, IconTrash } from "../../icons";
import { COMMAND_EXTENSIONS, COMMAND_SETUP } from "./editor";
import { addOption, addUrl, arrange, type Entry, type OptionEntry, optionNames, removeAt, setValue, type Slot } from "./entries";
import { addableOptions, findLong, flagsOf, type OptionSpec } from "./options";
import { parseCurl } from "./parse";
import { planRequest } from "./request";
import { SAMPLE_COMMAND } from "./sample";
import { explain, type Outcome, send } from "./send";
import { writeCurl } from "./write";

export default function Curl() {
  const initialState = useInitialHashState<{ command?: string; wrapped?: boolean }>();

  const [initialCommand] = useState(() =>
    typeof initialState?.command === "string" ? initialState.command : SAMPLE_COMMAND
  );
  const [command, setCommand] = useState(initialCommand);
  const [wrapped, setWrapped] = useState(initialState?.wrapped ?? true);
  const [pick, setPick] = useState<string | null>(null);
  const [run, setRun] = useState<Run>(IDLE);
  const viewRef = useRef<EditorView | null>(null);
  const stopRef = useRef<AbortController | null>(null);

  useRegisterShareState(() => ({ command, wrapped }));

  useEffect(() => () => {
    self.curlEditor = undefined;
    stopRef.current?.abort();
  }, []);

  const { entries, error } = useMemo(() => parseCurl(command), [command]);
  const parts = useMemo(() => arrange(entries), [entries]);
  const plan = useMemo(() => (error ? null : planRequest(entries)), [entries, error]);
  const addable = useMemo(() => addableOptions(optionNames(entries)), [entries]);
  const fields = useMemo(
    () => parts.singles.flatMap((block) => block.slots.map((slot) => ({ spec: block.spec, slot }))),
    [parts.singles],
  );

  const place = useCallback((text: string) => {
    setCommand(text);
    const editor = viewRef.current;
    if (!editor || editor.state.doc.toString() === text) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
  }, []);

  const apply = useCallback((next: Entry[]) => place(writeCurl(next, wrapped)), [place, wrapped]);

  const handleLayout = (value: string) => {
    const next = value === WRAPPED;
    setWrapped(next);
    if (!error) place(writeCurl(entries, next));
  };

  const handleAdd = () => {
    const spec = pick ? findLong(pick) : undefined;
    if (!spec) return;
    setPick(null);
    apply(addOption(entries, spec));
  };

  const handleSend = useCallback(async () => {
    if (error || !plan) return setRun({ state: "failed", sent: null, message: error ?? "" });
    if (plan.error) return setRun({ state: "failed", sent: null, message: plan.error });

    const sent = `${plan.method.toUpperCase()} ${plan.url}`;
    const controller = new AbortController();
    stopRef.current = controller;
    setRun({ state: "sending", sent });

    const signal = plan.timeout === null
      ? controller.signal
      : AbortSignal.any([controller.signal, AbortSignal.timeout(plan.timeout)]);

    try {
      setRun({ state: "answered", sent, outcome: await send(plan, signal) });
    } catch (thrown) {
      setRun({ state: "failed", sent, message: explain(thrown, plan, controller.signal.aborted) });
    } finally {
      if (stopRef.current === controller) stopRef.current = null;
    }
  }, [error, plan]);

  const handleStop = () => stopRef.current?.abort();

  const sending = run.state === "sending";

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="curl"
        control={
          <SegmentedControl
            value={wrapped ? WRAPPED : ONE_LINE}
            onChange={handleLayout}
            aria-label="How the command is laid out"
            data={[{ value: WRAPPED, label: "Wrapped" }, { value: ONE_LINE, label: "One line" }]}
          />
        }
      >
        curl
      </UtilityTitle>

      {error
        ? (
          <Text size="sm" c="dimmed">
            The builder shows the command once it reads as one. What is typed below is kept.
          </Text>
        )
        : (
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="md">
              <Group justify="space-between" align="flex-end" wrap="nowrap">
                <Title order={4}>Arguments</Title>
                <Group gap="sm" align="flex-end" wrap="nowrap">
                  <Select
                    aria-label="Argument to add"
                    placeholder="Choose an argument"
                    data={addable}
                    value={pick}
                    onChange={setPick}
                    searchable
                    nothingFoundMessage="No argument by that name"
                    w={280}
                    comboboxProps={{ withinPortal: true }}
                  />
                  <Button
                    variant="light"
                    leftSection={<IconPlus size="0.9rem" />}
                    onClick={handleAdd}
                    disabled={pick === null}
                  >
                    Add
                  </Button>
                </Group>
              </Group>

              <Fieldset legend="URL">
                <Stack gap="xs">
                  {parts.urls.length === 0 && <Text size="sm" c="dimmed">This command has no URL yet.</Text>}
                  {parts.urls.map((slot, at) => (
                    <TextInput
                      key={slot.index}
                      aria-label={`URL ${at + 1}`}
                      placeholder="https://example.com/path"
                      value={slot.entry.value}
                      onChange={(event) => apply(setValue(entries, slot.index, event.currentTarget.value))}
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="off"
                      styles={MONOSPACE}
                      rightSectionPointerEvents="all"
                      rightSection={
                        <Remove
                          label={`Remove URL ${at + 1}`}
                          onClick={() => apply(removeAt(entries, slot.index))}
                        />
                      }
                    />
                  ))}
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size="0.9rem" />}
                      onClick={() => apply(addUrl(entries))}
                    >
                      Add URL
                    </Button>
                  </Group>
                </Stack>
              </Fieldset>

              {chunk(fields).map((row) => (
                <Box key={`${row[0].spec.name}-${row[0].slot.index}`} className="settings-row">
                  {row.map(({ spec, slot }) => (
                    <ArgumentInput
                      key={slot.index}
                      spec={spec}
                      slot={slot}
                      label={spec.label}
                      onChange={(value) => apply(setValue(entries, slot.index, value))}
                      onRemove={() =>
                        apply(removeAt(entries, slot.index))}
                    />
                  ))}
                </Box>
              ))}

              {parts.groups.map((block) => (
                <Fieldset key={block.spec.name} legend={`${block.spec.label} (${flagsOf(block.spec)})`}>
                  <Stack gap="xs">
                    {block.spec.hint && <Text size="xs" c="dimmed">{block.spec.hint}</Text>}
                    {block.slots.map((slot, at) => (
                      <ArgumentInput
                        key={slot.index}
                        spec={block.spec}
                        slot={slot}
                        position={at + 1}
                        onChange={(value) => apply(setValue(entries, slot.index, value))}
                        onRemove={() =>
                          apply(removeAt(entries, slot.index))}
                      />
                    ))}
                    <Group>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconPlus size="0.9rem" />}
                        onClick={() =>
                          apply(addOption(entries, block.spec))}
                      >
                        Add {block.spec.label.toLowerCase()}
                      </Button>
                    </Group>
                  </Stack>
                </Fieldset>
              ))}

              {parts.flags.length > 0 && (
                <Fieldset legend="Flags">
                  <Group gap="lg">
                    {parts.flags.flatMap((block) =>
                      block.slots.map((slot) => (
                        <Tooltip key={slot.index} label={flagsOf(block.spec)} withArrow>
                          <Switch
                            checked
                            label={block.spec.label}
                            onChange={() => apply(removeAt(entries, slot.index))}
                          />
                        </Tooltip>
                      ))
                    )}
                  </Group>
                </Fieldset>
              )}

              {parts.unknown.length > 0 && (
                <Fieldset legend="Not recognised">
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">
                      No field is drawn for these, and they are carried through the command exactly as written.
                    </Text>
                    <Group gap="xs">
                      {parts.unknown.map((slot) => (
                        <Badge
                          key={slot.index}
                          variant="light"
                          color="gray"
                          size="lg"
                          styles={BADGE_TEXT}
                          rightSection={
                            <CloseButton
                              size="xs"
                              variant="transparent"
                              aria-label={`Remove ${slot.entry.flag}`}
                              onClick={() => apply(removeAt(entries, slot.index))}
                            />
                          }
                        >
                          {slot.entry.flag}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </Fieldset>
              )}
            </Stack>
          </Card>
        )}

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Title order={4}>Command</Title>
            <Group gap="xs" wrap="nowrap">
              <Button
                size="xs"
                onClick={handleSend}
                disabled={sending}
                leftSection={<IconPlayerPlay size="0.9rem" />}
              >
                Send
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={handleStop}
                disabled={!sending}
                leftSection={<IconPlayerStop size="0.9rem" />}
              >
                Stop
              </Button>
              <CopyButton value={command} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      disabled={command === ""}
                      aria-label="Copy the command"
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Group>

          <Paper withBorder radius="sm" className="curl-command">
            <CodeMirror
              value={initialCommand}
              style={EDITOR_STYLE}
              minHeight="7rem"
              maxHeight="22rem"
              theme="dark"
              basicSetup={COMMAND_SETUP}
              extensions={COMMAND_EXTENSIONS}
              onCreateEditor={(editor) => {
                viewRef.current = editor;
                self.curlEditor = editor;
              }}
              onChange={setCommand}
            />
          </Paper>

          {error && <Text size="sm" c="red">{error}</Text>}

          <Text size="xs" c="dimmed">
            Send makes the request from this tab, which is the one thing on this site that leaves your browser.
          </Text>

          {plan && plan.notes.length > 0 && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">The browser cannot do all of this:</Text>
              {plan.notes.map((note) => (
                <Text key={note.subject + note.reason} size="xs" c="dimmed">
                  <Text span ff="monospace" inherit>{note.subject}</Text> — {note.reason}
                </Text>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      {run.state !== "idle" && <Response run={run} />}
    </Stack>
  );
}

function Response({ run }: { run: Run }) {
  const outcome = run.state === "answered" ? run.outcome : null;

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" align="center" wrap="nowrap">
            <Title order={4}>Response</Title>
            {outcome && !outcome.opaque && (
              <Badge variant="light" color={statusColour(outcome.status)} styles={BADGE_TEXT}>
                {outcome.status} {outcome.statusText}
              </Badge>
            )}
          </Group>

          {run.state === "sending"
            ? (
              <Group gap="xs" wrap="nowrap">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">Sending…</Text>
              </Group>
            )
            : outcome && !outcome.opaque && (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" c="dimmed">{summary(outcome)}</Text>
                <CopyButton value={outcome.body} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        disabled={outcome.body === ""}
                        aria-label="Copy the body"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            )}
        </Group>

        {run.state !== "idle" && run.sent !== null && (
          <Text size="xs" c="dimmed" ff="monospace" style={{ overflowWrap: "anywhere" }}>{run.sent}</Text>
        )}

        {run.state === "failed" && <Text size="sm" c="red">{run.message}</Text>}

        {outcome?.opaque && (
          <Text size="sm" c="dimmed">
            The server answered with a redirect. curl stops on one too without -L, and a browser will not hand the page
            the answer it stopped on — turn Follow redirects on to go where it leads.
          </Text>
        )}

        {outcome && !outcome.opaque && (
          <>
            {outcome.headers.length > 0 && (
              <FactTable rows={outcome.headers.map(([name, value]) => ({ label: name, value }))} />
            )}
            <Text size="xs" c="dimmed">
              A browser hands the page only the headers the server marks as exposed, so this is usually shorter than
              what curl would print.
            </Text>

            <Paper
              withBorder
              radius="sm"
              style={{ backgroundColor: EDITOR_BACKGROUND, maxHeight: "26rem", overflow: "auto" }}
            >
              <Text
                component="pre"
                role="log"
                aria-label="Response body"
                ff="monospace"
                fz={EDITOR_STYLE.fontSize}
                p="sm"
                m={0}
                c={outcome.body === "" || outcome.binary ? "dimmed" : undefined}
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {bodyText(outcome)}
              </Text>
            </Paper>
          </>
        )}
      </Stack>
    </Card>
  );
}

function ArgumentInput({ spec, slot, label, position, onChange, onRemove }: ArgumentInputProps) {
  const name = position === undefined ? spec.label : `${spec.label} ${position}`;

  const shared = {
    label,
    description: label === undefined ? undefined : spec.hint,
    "aria-label": name,
    placeholder: spec.placeholder,
    value: slot.entry.value,
    spellCheck: false,
    autoComplete: "off",
    autoCapitalize: "off" as const,
    styles: MONOSPACE,
    rightSectionPointerEvents: "all" as const,
    rightSection: <Remove label={`Remove ${name.toLowerCase()}`} onClick={onRemove} />,
  };

  if (spec.value === "body") {
    return (
      <Textarea
        {...shared}
        onChange={(event) => onChange(event.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={10}
        rightSectionProps={{ style: { alignItems: "flex-start", paddingTop: 6 } }}
      />
    );
  }

  if (spec.choices) {
    return <Autocomplete {...shared} data={spec.choices} onChange={onChange} />;
  }

  return <TextInput {...shared} onChange={(event) => onChange(event.currentTarget.value)} />;
}

function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip label="Remove" withArrow position="left">
      <ActionIcon variant="subtle" color="gray" onClick={onClick} aria-label={label}>
        <IconTrash size="1.1rem" />
      </ActionIcon>
    </Tooltip>
  );
}

interface ArgumentInputProps {
  spec: OptionSpec;
  slot: Slot<OptionEntry>;
  label?: string;
  position?: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}

type Run =
  | { state: "idle" }
  | { state: "sending"; sent: string }
  | { state: "answered"; sent: string; outcome: Outcome }
  | { state: "failed"; sent: string | null; message: string };

const IDLE: Run = { state: "idle" };

function statusColour(status: number): string {
  if (status < 300) return "teal";
  if (status < 400) return "blue";
  if (status < 500) return "orange";
  return "red";
}

function summary(outcome: Outcome): string {
  const bytes = `${outcome.bytes.toLocaleString()} ${outcome.bytes === 1 ? "byte" : "bytes"}`;
  return `${outcome.seconds.toFixed(2)}s · ${bytes}${outcome.redirected ? " · redirected" : ""}`;
}

function bodyText(outcome: Outcome): string {
  if (outcome.binary) return "The response is not text, so it is not drawn here.";
  if (outcome.body === "") return "The response has no body.";
  return outcome.truncated ? `${outcome.body}\n\n… the rest is longer than this panel holds` : outcome.body;
}

const WRAPPED = "wrapped";
const ONE_LINE = "one-line";

const MONOSPACE = { input: { fontFamily: "monospace" } };

const BADGE_TEXT = { label: { fontFamily: "monospace", textTransform: "none" as const } };

function chunk<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let at = 0; at < items.length; at += 2) rows.push(items.slice(at, at + 2));
  return rows;
}

declare global {
  var curlEditor: EditorView | undefined;
}
