import { ActionIcon, Alert, Box, Button, Card, Divider, Group, Menu, Paper, SegmentedControl, Select, Stack, Text, Tooltip, Typography } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { type ChangeEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconChevronDown, IconDownload, IconUpload, IconX } from "../../icons";
import { applyFormat, EDITOR_EXTENSIONS, fileDropHandlers, replaceDocument } from "./editor";
import { DEFAULT_FLAVOUR, FLAVOUR_OPTIONS, isFlavour } from "./flavours";
import type { FormatKind } from "./format";
import { ACCEPT, message, readDocument } from "./open";
import { renderMarkdown } from "./render";
import { SAMPLE_DOCUMENT } from "./sample";
import { SAVE_FORMATS, saveDocument, type SaveKind } from "./save";
import { FORMAT_GROUPS, shortcutLabel } from "./toolbar";
import { DEFAULT_VIEW, isView, VIEWS } from "./views";

export default function Markdown() {
  const initialState = useInitialHashState<{
    value?: string;
    flavour?: string;
    view?: string;
  }>();

  const [initialValue] = useState(() => initialState?.value ?? SAMPLE_DOCUMENT);
  const valueRef = useRef(initialValue);
  const editorRef = useRef<EditorView | null>(null);

  const [flavour, setFlavour] = useState(() =>
    isFlavour(initialState?.flavour) ? initialState.flavour : DEFAULT_FLAVOUR
  );
  const [view, setView] = useState(() => isView(initialState?.view) ? initialState.view : DEFAULT_VIEW);
  const [previewed, setPreviewed] = useState(initialValue);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const html = useMemo(() => renderMarkdown(previewed, flavour), [previewed, flavour]);

  const syncShareState = useRegisterShareState(() => ({ value: valueRef.current, flavour, view }));

  useEffect(() => () => {
    self.markdownEditor = undefined;
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
  }, []);

  const handleChange = useCallback((next: string) => {
    valueRef.current = next;
    syncShareState();

    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      setPreviewed(valueRef.current);
    }, PREVIEW_DELAY);
  }, [syncShareState]);

  const handleFormat = useCallback((kind: FormatKind) => applyFormat(editorRef.current, kind), []);

  const handleSave = useCallback(async (kind: SaveKind) => {
    setSaving(true);
    try {
      await saveDocument(kind, valueRef.current, flavour);
    } catch (error) {
      setFailure({ title: "That document was not saved", message: message(error) });
    } finally {
      setSaving(false);
    }
  }, [flavour]);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const text = await readDocument(file);
      setFailure(null);
      replaceDocument(editorRef.current, text);
    } catch (error) {
      setFailure({ title: "That file did not open", message: message(error) });
    }
  }, []);

  const extensions = useMemo(
    () => [...EDITOR_EXTENSIONS, fileDropHandlers(setDragging, (file) => void handleFile(file))],
    [handleFile],
  );

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle directory="markdown">Markdown</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="xl" justify="space-between">
          <Group align="flex-end" gap="md">
            <Select
              label="Flavour"
              data={FLAVOUR_OPTIONS}
              value={flavour}
              onChange={(value) => isFlavour(value) && setFlavour(value)}
              allowDeselect={false}
              w={260}
            />
            <Button
              component="label"
              variant="default"
              leftSection={<IconUpload size="1rem" stroke={1.5} />}
            >
              Open file
              <input
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  void handleFile(event.currentTarget.files?.item(0) ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </Button>

            <Menu shadow="md" position="bottom-start" withinPortal>
              <Menu.Target>
                <Button
                  variant="default"
                  loading={saving}
                  leftSection={<IconDownload size="1rem" stroke={1.5} />}
                  rightSection={<IconChevronDown size="0.9rem" stroke={1.5} />}
                >
                  Download
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {SAVE_FORMATS.map(({ value, label, Icon, note }) => (
                  <Menu.Item
                    key={value}
                    leftSection={<Icon size="1rem" stroke={1.5} />}
                    onClick={() => void handleSave(value)}
                  >
                    {label}
                    <Text component="span" display="block" size="xs" c="dimmed">{note}</Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
          <SegmentedControl
            value={view}
            onChange={(value) => isView(value) && setView(value)}
            aria-label="Which halves of the page are showing"
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
        </Group>
      </Card>

      {failure && (
        <Alert
          color="red"
          icon={<IconX size="1rem" />}
          title={failure.title}
          withCloseButton
          onClose={() => setFailure(null)}
        >
          {failure.message}
        </Alert>
      )}

      <Box className="markdown-panes" data-view={view}>
        <Paper
          withBorder
          shadow="sm"
          radius="md"
          className="markdown-editor-pane"
          data-dragging={dragging || undefined}
        >
          <Group className="markdown-toolbar" gap={2} role="toolbar" aria-label="Formatting">
            {FORMAT_GROUPS.map((group, index) => (
              <Fragment key={group[0].kind}>
                {index > 0 && <Divider orientation="vertical" mx={4} />}
                {group.map(({ kind, label, Icon, key }) => (
                  <Tooltip key={kind} label={key ? `${label} (${shortcutLabel(key)})` : label} withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={label}
                      onClick={() =>
                        handleFormat(kind)}
                    >
                      <Icon size="1.1rem" stroke={1.5} />
                    </ActionIcon>
                  </Tooltip>
                ))}
              </Fragment>
            ))}
          </Group>

          <Box className="markdown-editor-host">
            <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <CodeMirror
                value={initialValue}
                height="100%"
                style={EDITOR_STYLE}
                theme="dark"
                extensions={extensions}
                onCreateEditor={(editor) => {
                  editorRef.current = editor;
                  self.markdownEditor = editor;
                }}
                onChange={handleChange}
              />
            </Box>
          </Box>
        </Paper>

        <Paper withBorder shadow="sm" radius="md" className="markdown-preview-pane">
          <Typography className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </Paper>
      </Box>
    </Stack>
  );
}

const PREVIEW_DELAY = 120;

interface Failure {
  title: string;
  message: string;
}

declare global {
  var markdownEditor: EditorView | undefined;
}
