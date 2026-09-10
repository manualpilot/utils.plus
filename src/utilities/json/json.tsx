import { ActionIcon, Box, Button, Card, Checkbox, CopyButton, Group, Menu, Paper, SegmentedControl, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import type { TablerIcon } from "@tabler/icons-react";
import CodeMirror, { EditorView, type ViewUpdate } from "@uiw/react-codemirror";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE, PANEL_BACKGROUND } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconBraces, IconBrackets, IconCheck, IconChevronDown, IconCode, IconCopy, IconFold, IconIndentDecrease, IconList, IconMinimize, IconSortAscendingLetters, IconTransform, IconWand } from "../../icons";
import { editorExtensions, resultExtensions } from "./editor";
import { foldToLevel } from "./fold";
import { caretPath, spellPath } from "./path";
import { type Answer, answerQuery, describeAnswer } from "./query";
import { escape, expand, format, minify, type Notice, repair, sortKeys, toArray, toLines, type Transform, unescape } from "./transforms";
import { DEFAULT_DOCUMENT, DEFAULT_QUERY, FOLD_LEVELS, INDENT_OPTIONS, isMode, isOutput, type Mode, MODE_OPTIONS, type Output, OUTPUT_OPTIONS } from "./views";

export default function Json() {
  const initialState = useInitialHashState<{
    value?: string;
    indentSize?: string;
    showCounts?: boolean;
    mode?: string;
    query?: string;
    output?: string;
  }>();

  const [initialValue] = useState(() => initialState?.value ?? DEFAULT_DOCUMENT);
  const valueRef = useRef(initialValue);
  const viewRef = useRef<EditorView | null>(null);

  const [mode, setMode] = useState<Mode>(isMode(initialState?.mode) ? initialState.mode : "edit");
  const [indentSize, setIndentSize] = useState(initialState?.indentSize ?? "2");
  const [showCounts, setShowCounts] = useState(initialState?.showCounts ?? true);
  const [query, setQuery] = useState(initialState?.query ?? DEFAULT_QUERY);
  const [output, setOutput] = useState<Output>(isOutput(initialState?.output) ? initialState.output : "values");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [path, setPath] = useState("$");
  const [revision, setRevision] = useState(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const syncShareState = useRegisterShareState(() => ({
    value: valueRef.current,
    indentSize: mode === "edit" ? indentSize : undefined,
    showCounts,
    mode: mode === "query" ? mode : undefined,
    query: mode === "query" ? query : undefined,
    output: mode === "query" ? output : undefined,
  }));

  useEffect(() => () => {
    self.editorView = undefined;
  }, []);

  const handleChange = useCallback((next: string) => {
    valueRef.current = next;
    syncShareState();
    setNotice(null);
    if (modeRef.current === "query") setRevision((count) => count + 1);
  }, [syncShareState]);

  const handleUpdate = useCallback((update: ViewUpdate) => {
    setPath(spellPath(caretPath(update.state, update.state.selection.main.head)));
  }, []);

  const replaceValue = useCallback((next: string) => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
  }, []);

  const apply = (transform: Transform) => {
    const outcome = transform(valueRef.current, parseInt(indentSize, 10));
    if (outcome.text !== undefined && outcome.text !== valueRef.current) replaceValue(outcome.text);
    setNotice(outcome.notice ?? null);
  };

  const handleMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
  };

  const answer = useMemo<Answer | null>(
    () => mode === "query" && query.trim() !== "" ? answerQuery(valueRef.current, query, output === "paths") : null,
    [mode, query, output, revision],
  );
  const queryError = answer && !answer.ok && answer.in === "query" ? answer.error : undefined;

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle
        directory="json"
        control={
          <SegmentedControl
            data={MODE_OPTIONS}
            value={mode}
            onChange={(value) => isMode(value) && handleMode(value)}
            aria-label="Mode"
          />
        }
      >
        JSON
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        {mode === "edit"
          ? (
            <Group align="flex-end" gap="xl">
              <Group align="flex-end" gap="sm">
                <Select
                  label="Format Indent"
                  data={INDENT_OPTIONS}
                  value={indentSize}
                  onChange={(val) => val && setIndentSize(val)}
                  allowDeselect={false}
                  w={120}
                />
                <Button onClick={() => apply(format)} leftSection={<IconIndentDecrease size="1rem" />}>
                  Format
                </Button>
                <Button onClick={() => apply(sortKeys)} leftSection={<IconSortAscendingLetters size="1rem" />}>
                  Sort Keys
                </Button>
              </Group>

              <Group align="flex-end" gap="sm">
                <Button onClick={() => apply(minify)} leftSection={<IconMinimize size="1rem" />}>
                  Minify
                </Button>
                <Button onClick={() => apply(escape)} leftSection={<IconCode size="1rem" />}>
                  Escape
                </Button>
                <Button onClick={() => apply(unescape)} leftSection={<IconBrackets size="1rem" />}>
                  Unescape
                </Button>
              </Group>

              <Group align="flex-end" gap="sm">
                <Menu shadow="md" position="bottom-start" withinPortal>
                  <Menu.Target>
                    <Button
                      leftSection={<IconTransform size="1rem" />}
                      rightSection={<IconChevronDown size="0.9rem" stroke={1.5} />}
                    >
                      Transform
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <TransformItem
                      Icon={IconWand}
                      label="Repair"
                      note="Comments, trailing commas, single quotes and bare keys"
                      onClick={() => apply(repair)}
                    />
                    <TransformItem
                      Icon={IconBraces}
                      label="Expand embedded JSON"
                      note="Open up every string that holds an object or an array"
                      onClick={() => apply(expand)}
                    />
                    <Menu.Divider />
                    <TransformItem
                      Icon={IconList}
                      label="Array to JSON Lines"
                      note="One element to a line"
                      onClick={() => apply(toLines)}
                    />
                    <TransformItem
                      Icon={IconBrackets}
                      label="JSON Lines to array"
                      note="One line to an element"
                      onClick={() => apply(toArray)}
                    />
                  </Menu.Dropdown>
                </Menu>

                <Menu shadow="md" position="bottom-start" withinPortal>
                  <Menu.Target>
                    <Button
                      leftSection={<IconFold size="1rem" />}
                      rightSection={<IconChevronDown size="0.9rem" stroke={1.5} />}
                    >
                      Fold
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {FOLD_LEVELS.map(({ label, depth }) => (
                      <Fragment key={label}>
                        {depth === null && <Menu.Divider />}
                        <Menu.Item onClick={() => viewRef.current && foldToLevel(viewRef.current, depth)}>
                          {label}
                        </Menu.Item>
                      </Fragment>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          )
          : (
            <Box className={queryError ? "settings-row has-error" : "settings-row"} mb={queryError ? "md" : 0}>
              <TextInput
                label="JSONPath"
                placeholder="$.store.book[?@.price < 10].title"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                error={queryError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
                spellCheck={false}
                autoComplete="off"
              />
              <Select
                label="Result"
                data={OUTPUT_OPTIONS}
                value={output}
                onChange={(value) => isOutput(value) && setOutput(value)}
                allowDeselect={false}
              />
            </Box>
          )}
      </Card>

      <Box className="editor-panes">
        <Paper
          withBorder
          shadow="sm"
          radius="md"
          style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <Box style={{ flex: 1, position: "relative", minHeight: 0 }}>
            <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <CodeMirror
                value={initialValue}
                height="100%"
                style={EDITOR_STYLE}
                theme="dark"
                extensions={editorExtensions(showCounts)}
                onCreateEditor={(view) => {
                  viewRef.current = view;
                  self.editorView = view;
                }}
                onChange={handleChange}
                onUpdate={handleUpdate}
              />
            </Box>
          </Box>
          <StatusBar>
            <Group gap={4} wrap="nowrap" miw={0}>
              <CopyControl value={path} label="Copy the path at the caret" />
              <Text size="xs" ff="monospace" truncate="end" miw={0} data-testid="caret-path">{path}</Text>
            </Group>
            <Group gap="md" wrap="nowrap" miw={0}>
              <Text
                size="xs"
                c={notice?.tone === "error" ? "red" : "dimmed"}
                truncate="end"
                miw={0}
                title={notice?.message}
                role="status"
              >
                {notice?.message}
              </Text>
              <Checkbox
                size="xs"
                label="Show Counts"
                checked={showCounts}
                onChange={(event) => setShowCounts(event.currentTarget.checked)}
                style={{ flexShrink: 0 }}
              />
            </Group>
          </StatusBar>
        </Paper>

        {mode === "query" && <ResultPane answer={answer} counts={showCounts} />}
      </Box>
    </Stack>
  );
}

function ResultPane({ answer, counts }: { answer: Answer | null; counts: boolean }) {
  useEffect(() => () => {
    self.jsonResult = undefined;
  }, []);

  const text = answer?.ok ? answer.text : "";

  return (
    <Paper withBorder shadow="sm" radius="md" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <CodeMirror
            value={text}
            height="100%"
            style={EDITOR_STYLE}
            theme="dark"
            extensions={resultExtensions(counts)}
            onCreateEditor={(view) => {
              self.jsonResult = view;
            }}
          />
        </Box>
      </Box>
      <StatusBar>
        <Text size="xs" c={answer && !answer.ok ? "red" : "dimmed"} truncate="end" miw={0} role="status">
          {describeAnswer(answer)}
        </Text>
        <CopyControl value={text} label="Copy the result" />
      </StatusBar>
    </Paper>
  );
}

function StatusBar({ children }: { children: ReactNode }) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="sm"
      px="xs"
      h={30}
      bg={PANEL_BACKGROUND}
      style={{ flexShrink: 0, borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      {children}
    </Group>
  );
}

function CopyControl({ value, label }: { value: string; label: string }) {
  return (
    <CopyButton value={value} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copied" : label} withArrow>
          <ActionIcon variant="subtle" color={copied ? "teal" : "gray"} size="sm" onClick={copy} aria-label={label}>
            {copied ? <IconCheck size="0.9rem" /> : <IconCopy size="0.9rem" />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

function TransformItem({ Icon, label, note, onClick }: TransformItemProps) {
  return (
    <Menu.Item leftSection={<Icon size="1rem" stroke={1.5} />} onClick={onClick}>
      {label}
      <Text component="span" display="block" size="xs" c="dimmed">{note}</Text>
    </Menu.Item>
  );
}

interface TransformItemProps {
  Icon: TablerIcon;
  label: string;
  note: string;
  onClick: () => void;
}

declare global {
  var editorView: EditorView | undefined;
  var jsonResult: EditorView | undefined;
}
