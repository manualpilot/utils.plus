import type { Editor } from "@docx-editor.dev/core";
import "@docx-editor.dev/core/styles/editor.css";
import { DocxEditor, type DocxEditorRef, useEditorState, useFonts } from "@docx-editor.dev/react";
import { ActionIcon, Alert, Box, Button, Card, Group, Paper, Popover, SegmentedControl, Stack, Table, Text, Tooltip } from "@mantine/core";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { download } from "../../common/download";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconDownload, IconFilePlus, IconFolderOpen, IconMoon, IconSun, IconTrash, IconTypography, IconUpload, IconX } from "../../icons";
import { blankDocument } from "./blank";
import { documentFonts } from "./fonts";
import { DEFAULT_MODE, isMode, type ModeId, MODES } from "./modes";
import { DEFAULT_PAPER, isPaper, type PaperId } from "./paper";
import { ACCEPT, type Extension, extensionOf, EXTENSIONS, load, MAX_BYTES, message, saveName, titleOf, unreadableMessage, UNTITLED } from "./source";
import { DEFAULT_FAMILY, noteOf, type Reading } from "./substitutes";

export default function Docx() {
  const initialState = useInitialHashState<{ mode?: string; paper?: string }>();

  const [mode, setMode] = useState<ModeId>(() => isMode(initialState?.mode) ? initialState.mode : DEFAULT_MODE);
  const [paper, setPaper] = useState<PaperId>(() => isPaper(initialState?.paper) ? initialState.paper : DEFAULT_PAPER);

  const [opened, setOpened] = useState<Opened | null>(null);
  const [title, setTitle] = useState(UNTITLED);
  const [extension, setExtension] = useState<Extension>("docx");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [readings, setReadings] = useState<Reading[] | null>(null);

  const editorRef = useRef<DocxEditorRef>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const [resolver] = useState(() => documentFonts(setReadings));
  const fonts = useFonts(resolver);

  useRegisterShareState(() => ({
    mode: mode === DEFAULT_MODE ? undefined : mode,
    paper: opened && paper !== DEFAULT_PAPER ? paper : undefined,
  }));

  useEffect(() => () => {
    self.docxEditor = undefined;
  }, []);

  const take = useCallback(async (file: File | null) => {
    if (!file) return;
    setReading(true);
    try {
      const next = await load(file);
      setFailure(null);
      setReadings(null);
      setTitle(titleOf(next.name));
      setExtension(extensionOf(next.name));
      setOpened((was) => ({ document: next.bytes, count: (was?.count ?? 0) + 1 }));
    } catch (error) {
      setFailure({ title: "That file did not open", message: message(error) });
    } finally {
      setReading(false);
    }
  }, []);

  const startBlank = useCallback(() => {
    setFailure(null);
    setReadings(null);
    setTitle(UNTITLED);
    setExtension("docx");
    setMode("edit");
    setOpened((was) => ({ document: blankDocument(), count: (was?.count ?? 0) + 1 }));
  }, []);

  const unreadable = useCallback((code: string) => {
    setOpened(null);
    setReadings(null);
    self.docxEditor = undefined;
    setFailure({ title: "That file did not open", message: unreadableMessage(code) });
  }, []);

  const close = useCallback(() => {
    setOpened(null);
    setReadings(null);
    setFailure(null);
    self.docxEditor = undefined;
  }, []);

  const save = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setSaving(true);
    try {
      const bytes = await editor.save();
      if (!bytes) return;
      const { title, extension } = nameRef.current;
      download(saveName(title, extension), new Blob([bytes], { type: EXTENSIONS[extension] }));
    } catch (error) {
      setFailure({ title: "That document was not saved", message: message(error) });
    } finally {
      setSaving(false);
    }
  }, []);

  const nameRef = useRef({ title, extension });
  nameRef.current = { title, extension };

  const openPicker = useCallback(() => pickerRef.current?.click(), []);

  const onReady = useCallback((editor: Editor) => {
    self.docxEditor = editor;
  }, []);

  return (
    <Stack flex={1} className="fill-screen" gap="md">
      <UtilityTitle
        directory="docx"
        control={
          <SegmentedControl
            value={mode}
            onChange={(value) => isMode(value) && setMode(value)}
            aria-label="Read the document or write in it"
            data={MODES.map(({ value, label, Icon }) => ({
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
        DOCX
      </UtilityTitle>

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

      {opened
        ? (
          <Paper withBorder shadow="sm" radius="md" className="docx-pane">
            <Box className="docx-host" data-paper={paper}>
              <DocxEditor
                key={opened.count}
                ref={editorRef}
                document={opened.document}
                mode={mode}
                colorMode="dark"
                fonts={fonts}
                title={title}
                onTitleChange={setTitle}
                onSave={() => void save()}
                onOpen={openPicker}
                menu={{ reportIssue: false }}
                onReady={onReady}
                renderTitleBarRight={() => (
                  <TitleBarControls
                    readings={readings}
                    paper={paper}
                    onPaper={setPaper}
                    extension={extension}
                    saving={saving}
                    onOpen={openPicker}
                    onSave={() => void save()}
                    onClose={close}
                    onUnreadable={unreadable}
                  />
                )}
              />
            </Box>
            <input
              ref={pickerRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                void take(event.currentTarget.files?.item(0) ?? null);
                event.currentTarget.value = "";
              }}
            />
          </Paper>
        )
        : <OpenCard reading={reading} onTake={take} onBlank={startBlank} />}
    </Stack>
  );
}

function OpenCard({ reading, onTake, onBlank }: OpenCardProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="md">
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
            <Text size="sm">Click to choose a Word document, or drop one here</Text>
            <Text size="xs" c="dimmed">
              Nothing is uploaded — the document is read in this tab and never leaves it
            </Text>
          </Stack>
          <input
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              void onTake(event.currentTarget.files?.item(0) ?? null);
              event.currentTarget.value = "";
            }}
          />
        </Box>

        <Group justify="space-between" wrap="wrap" gap="sm">
          <Text size="sm" c="dimmed">
            {reading
              ? "Reading…"
              : `A .docx, .docm, .dotx or .dotm up to ${MAX_BYTES / 1024 / 1024} MB. Word's own fonts are drawn in `
                + "open ones built to the same widths, and anything else in the closest there is."}
          </Text>
          <Button variant="default" leftSection={<IconFilePlus size="1rem" stroke={1.5} />} onClick={onBlank}>
            New document
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

interface OpenCardProps {
  reading: boolean;
  onTake(file: File | null): Promise<void>;
  onBlank(): void;
}

function TitleBarControls(
  { readings, paper, onPaper, extension, saving, onOpen, onSave, onClose, onUnreadable }: TitleBarControlsProps,
) {
  const parseError = useEditorState((snapshot) => snapshot.parseError);
  useEffect(() => {
    if (parseError) onUnreadable(parseError);
  }, [parseError, onUnreadable]);

  return (
    <Group gap={4} wrap="nowrap" className="docx-title-controls">
      <FontsButton readings={readings} />
      <Tooltip label={paper === "dark" ? "Switch to white paper" : "Switch to dark paper"} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Dark paper"
          aria-pressed={paper === "dark"}
          onClick={() => onPaper(paper === "dark" ? "white" : "dark")}
        >
          {paper === "dark" ? <IconSun size="1.2rem" stroke={1.5} /> : <IconMoon size="1.2rem" stroke={1.5} />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Open another document" withArrow>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Open another document" onClick={onOpen}>
          <IconFolderOpen size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={`Download as .${extension}`} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Download the document"
          loading={saving}
          onClick={onSave}
        >
          <IconDownload size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Take this document off the page" withArrow>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Close the document" onClick={onClose}>
          <IconTrash size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

interface TitleBarControlsProps {
  readings: Reading[] | null;
  paper: PaperId;
  onPaper(paper: PaperId): void;
  extension: Extension;
  saving: boolean;
  onOpen(): void;
  onSave(): void;
  onClose(): void;
  onUnreadable(code: string): void;
}

function FontsButton({ readings }: { readings: Reading[] | null }) {
  return (
    <Popover width={360} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          leftSection={<IconTypography size="1rem" stroke={1.5} />}
        >
          Fonts
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        {readings === null && <Text size="sm" c="dimmed">Reading the document's fonts…</Text>}
        {readings?.length === 0 && (
          <Text size="sm" data-docx="fonts">
            {`The document names no fonts of its own, so all of it is drawn in ${DEFAULT_FAMILY}.`}
          </Text>
        )}
        {readings && readings.length > 0 && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              Each font the document names, and the face it is drawn and measured in here.
            </Text>
            <Table verticalSpacing={4} horizontalSpacing="xs" withRowBorders={false} data-docx="fonts">
              <Table.Tbody>
                {readings.map((one) => (
                  <Table.Tr key={one.family} data-font={one.family} data-kind={one.kind}>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Text size="sm">{one.family}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{noteOf(one)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

interface Opened {
  document: Uint8Array;
  count: number;
}

interface Failure {
  title: string;
  message: string;
}

declare global {
  var docxEditor: Editor | undefined;
}
