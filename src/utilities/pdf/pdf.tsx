import type { DocumentState, PluginRegistry } from "@embedpdf/core";
import { EmbedPDF } from "@embedpdf/core/react";
import { type PdfEngine, PdfErrorCode } from "@embedpdf/models";
import { AnnotationLayer, type AnnotationSelectionMenuProps, useAnnotation, useAnnotationCapability } from "@embedpdf/plugin-annotation/react";
import { DocumentContent, useDocumentManagerCapability } from "@embedpdf/plugin-document-manager/react";
import { useExport } from "@embedpdf/plugin-export/react";
import { useHistoryCapability } from "@embedpdf/plugin-history/react";
import { PagePointerProvider } from "@embedpdf/plugin-interaction-manager/react";
import { RenderLayer } from "@embedpdf/plugin-render/react";
import { Scroller, useScroll } from "@embedpdf/plugin-scroll/react";
import { SelectionLayer, type SelectionSelectionMenuProps, useSelectionCapability } from "@embedpdf/plugin-selection/react";
import { SignatureDrawPad, type SignatureEntry, type SignatureFieldDefinition, SignaturePlugin, SignatureTypePad, useActivePlacement, useSignatureEntries, useSignatureUpload } from "@embedpdf/plugin-signature/react";
import { Viewport } from "@embedpdf/plugin-viewport/react";
import { useZoom } from "@embedpdf/plugin-zoom/react";
import { ActionIcon, Alert, Box, Button, Card, Center, CloseButton, ColorSwatch, Divider, Group, Loader, Menu, Modal, Paper, PasswordInput, SegmentedControl, Select, Slider, Stack, Tabs, Text, Tooltip } from "@mantine/core";
import { type ChangeEvent, type DragEvent, type RefObject, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { download } from "../../common/download";
import { useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconArrowBackUp, IconArrowForwardUp, IconCheck, IconCopy, IconDownload, IconFolderOpen, IconLock, IconPhoto, IconPlus, IconSignature, IconTrash, IconUpload, IconX, IconZoomIn, IconZoomOut } from "../../icons";
import { usePdfEngine } from "./engine";
import { IMAGE_ACCEPT, placeable } from "./image";
import { useMarkKeys } from "./keys";
import { useLinks } from "./links";
import { pluginsFor } from "./plugins";
import { CREATION_TABS, type CreationTab, DEFAULT_INK, type InkId, INKS, SIGNATURE_FONT, SIGNATURE_IMAGE_ACCEPT, signatureFaceReady } from "./signature";
import { ACCEPT, load, MAX_BYTES, message, saveName, unreadableMessage } from "./source";
import { ACCENT, colourOf, colourPatch, COLOURS, FONT_SIZES, hasWidth, type StyleFields, styleTarget, TOOLS, WIDTHS } from "./tools";
import { percent, ZOOM_FITS, ZOOM_LEVELS } from "./zoom";

export default function Pdf() {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const signatures = useRef<SignatureEntry[]>([]);
  const engine = usePdfEngine();
  const { start } = engine;

  useRegisterShareState(() => ({}));

  const take = useCallback(async (file: File | null) => {
    if (!file) return;
    setReading(true);
    try {
      const next = await load(file);
      setFailure(null);
      start();
      setOpened((was) => ({ ...next, count: (was?.count ?? 0) + 1 }));
    } catch (error) {
      setFailure({ title: "That file did not open", message: message(error) });
    } finally {
      setReading(false);
    }
  }, [start]);

  const close = useCallback(() => {
    setOpened(null);
    setFailure(null);
  }, []);

  const unreadable = useCallback((text: string) => {
    setOpened(null);
    setFailure({ title: "That file did not open", message: text });
  }, []);

  return (
    <Stack flex={1} className={opened ? "fill-screen" : undefined} gap="md">
      <UtilityTitle directory="pdf">PDF</UtilityTitle>

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

      {engine.error && (
        <Alert color="red" icon={<IconX size="1rem" />} title="The PDF engine did not load">
          {`Its WebAssembly could not be fetched from this site (${engine.error}). Choose the file again to retry.`}
        </Alert>
      )}

      {opened && !engine.error
        ? (
          <Paper withBorder shadow="sm" radius="md" className="pdf-pane">
            {engine.engine
              ? (
                <Viewer
                  key={opened.count}
                  engine={engine.engine}
                  opened={opened}
                  signatures={signatures}
                  onOpen={take}
                  onClose={close}
                  onUnreadable={unreadable}
                  onFailure={setFailure}
                />
              )
              : <Waiting>Loading the PDF engine…</Waiting>}
          </Paper>
        )
        : <OpenCard reading={reading} onTake={take} />}
    </Stack>
  );
}

function OpenCard({ reading, onTake }: OpenCardProps) {
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
            <Text size="sm">Click to choose a PDF, or drop one here</Text>
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
        <Text size="sm" c="dimmed">
          {reading
            ? "Reading…"
            : `A PDF up to ${MAX_BYTES / 1024 / 1024} MB. Highlight it, draw and write on it, sign it and put pictures `
              + "on it, and download it with every mark saved into the file."}
        </Text>
      </Stack>
    </Card>
  );
}

interface OpenCardProps {
  reading: boolean;
  onTake(file: File | null): Promise<void>;
}

function Viewer({ engine, opened, signatures, onOpen, onClose, onUnreadable, onFailure }: ViewerProps) {
  const plugins = useMemo(() => pluginsFor(opened.name, opened.bytes), [opened]);

  const onInitialized = useCallback(async (registry: PluginRegistry) => {
    self.pdfRegistry = registry;
    const kept = registry.getPlugin<SignaturePlugin>(SignaturePlugin.id)?.provides();
    kept?.loadEntries(signatures.current);
    kept?.onEntriesChange((entries) => {
      signatures.current = entries;
    });
  }, [signatures]);
  useEffect(() => () => {
    self.pdfRegistry = undefined;
  }, []);

  return (
    <EmbedPDF engine={engine} plugins={plugins} onInitialized={onInitialized}>
      {({ activeDocumentId, pluginsReady }) =>
        pluginsReady && activeDocumentId
          ? (
            <DocumentContent documentId={activeDocumentId}>
              {({ documentState, isLoaded, isError }) =>
                isLoaded
                  ? (
                    <Document
                      documentId={activeDocumentId}
                      name={opened.name}
                      onOpen={onOpen}
                      onClose={onClose}
                      onFailure={onFailure}
                    />
                  )
                  : isError
                  ? <Refused documentState={documentState} onUnreadable={onUnreadable} onClose={onClose} />
                  : <Waiting>Reading the document…</Waiting>}
            </DocumentContent>
          )
          : <Waiting>Reading the document…</Waiting>}
    </EmbedPDF>
  );
}

interface ViewerProps {
  engine: PdfEngine;
  opened: Opened;
  signatures: RefObject<SignatureEntry[]>;
  onOpen(file: File | null): Promise<void>;
  onClose(): void;
  onUnreadable(text: string): void;
  onFailure(failure: Failure): void;
}

function Refused({ documentState, onUnreadable, onClose }: RefusedProps) {
  const password = documentState.errorCode === PdfErrorCode.Password;
  useEffect(() => {
    if (!password) onUnreadable(unreadableMessage(documentState.errorCode, documentState.error));
  }, [password, documentState, onUnreadable]);

  return password ? <PasswordPrompt documentState={documentState} onClose={onClose} /> : null;
}

interface RefusedProps {
  documentState: DocumentState;
  onUnreadable(text: string): void;
  onClose(): void;
}

function PasswordPrompt({ documentState, onClose }: { documentState: DocumentState; onClose(): void }) {
  const { provides: documents } = useDocumentManagerCapability();
  const [password, setPassword] = useState("");
  const [asked, setAsked] = useState(false);
  const [trying, setTrying] = useState(false);
  const [wrong, setWrong] = useState(documentState.passwordProvided === true);

  const submit = () => {
    setAsked(true);
    if (!password || !documents) return;
    setTrying(true);
    documents.retryDocument(documentState.id, { password }).wait(() => setTrying(false), () => setTrying(false));
  };

  return (
    <Center className="pdf-waiting">
      <Card withBorder radius="md" w="100%" maw={400}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Stack gap="sm">
            <Group gap="xs" wrap="nowrap">
              <IconLock size="1.2rem" stroke={1.5} />
              <Text fw={600}>This PDF is locked with a password</Text>
            </Group>
            <Text size="sm" c="dimmed">
              The password is used here to read the file and goes nowhere else.
            </Text>
            <PasswordInput
              label="Password"
              autoFocus
              value={password}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
                setWrong(false);
              }}
              error={asked && !password
                ? "Required"
                : wrong
                ? "That is not the password this PDF was locked with."
                : undefined}
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={trying}>Open</Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}

function Document({ documentId, name, onOpen, onClose, onFailure }: DocumentProps) {
  useMarkKeys(documentId);
  useLinks(documentId);

  return (
    <Box className="pdf-document">
      <Group className="pdf-toolbar" gap="xs" justify="space-between" wrap="wrap">
        <MarkTools documentId={documentId} onFailure={onFailure} />
        <Group gap={4} wrap="nowrap" ml="auto">
          <PageCount documentId={documentId} />
          <ZoomControls documentId={documentId} />
          <Divider orientation="vertical" mx={4} />
          <FileControls documentId={documentId} name={name} onOpen={onOpen} onClose={onClose} onFailure={onFailure} />
        </Group>
      </Group>
      <Box className="pdf-host">
        <Viewport documentId={documentId} className="pdf-viewport">
          <Scroller
            documentId={documentId}
            renderPage={({ pageIndex }) => (
              <PagePointerProvider
                documentId={documentId}
                pageIndex={pageIndex}
                className="pdf-page"
                data-page={pageIndex + 1}
              >
                <RenderLayer documentId={documentId} pageIndex={pageIndex} style={{ pointerEvents: "none" }} />
                <SelectionLayer
                  documentId={documentId}
                  pageIndex={pageIndex}
                  selectionMenu={(props) => <TextMenu {...props} documentId={documentId} />}
                />
                <AnnotationLayer
                  documentId={documentId}
                  pageIndex={pageIndex}
                  selectionMenu={(props) => <MarkMenu {...props} documentId={documentId} />}
                  selectionOutline={{ color: ACCENT }}
                  resizeUI={{ color: ACCENT }}
                  vertexUI={{ color: ACCENT }}
                  rotationUI={{ iconColor: ACCENT, border: { color: ACCENT } }}
                />
              </PagePointerProvider>
            )}
          />
        </Viewport>
      </Box>
    </Box>
  );
}

interface DocumentProps {
  documentId: string;
  name: string;
  onOpen(file: File | null): Promise<void>;
  onClose(): void;
  onFailure(failure: Failure): void;
}

function MarkTools({ documentId, onFailure }: { documentId: string; onFailure(failure: Failure): void }) {
  const { provides: annotation, state } = useAnnotation(documentId);
  const active = state.activeToolId;

  return (
    <Group gap={2} wrap="wrap">
      {TOOLS.map(({ id, label, hint, Icon }) => (
        <Tooltip key={id} label={hint} withArrow>
          <ActionIcon
            variant={active === id ? "filled" : "subtle"}
            color={active === id ? undefined : "gray"}
            size="lg"
            aria-label={label}
            aria-pressed={active === id}
            onClick={() => {
              annotation?.deselectAnnotation();
              annotation?.setActiveTool(active === id ? null : id);
            }}
          >
            <Icon size="1.2rem" stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      ))}
      <ImageButton documentId={documentId} onFailure={onFailure} />
      <SignatureButton documentId={documentId} />
      <Divider orientation="vertical" mx={4} />
      <StyleControl documentId={documentId} />
      <HistoryControls documentId={documentId} />
      <Tooltip label="Delete the selected mark" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Delete the selected mark"
          disabled={state.selectedUids.length === 0}
          onClick={() => {
            const selected = annotation?.getSelectedAnnotations() ?? [];
            annotation?.deleteAnnotations(
              selected.map(({ object }) => ({ pageIndex: object.pageIndex, id: object.id })),
            );
          }}
        >
          <IconTrash size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function ImageButton({ documentId, onFailure }: { documentId: string; onFailure(failure: Failure): void }) {
  const { provides: tools } = useAnnotationCapability();
  const { provides: annotation, state } = useAnnotation(documentId);
  const picker = useRef<HTMLInputElement>(null);
  const url = useRef<string | null>(null);
  const armed = state.activeToolId === "stamp";

  useEffect(() => () => {
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);

  const choose = async (file: File) => {
    if (!tools || !annotation) return;
    try {
      const next = await placeable(file);
      annotation.setActiveTool(null);
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = next.url;
      tools.setToolDefaults("stamp", { imageSrc: next.url, imageSize: next.size });
      annotation.setActiveTool("stamp");
    } catch (error) {
      onFailure({ title: "That picture was not placed", message: message(error) });
    }
  };

  return (
    <>
      <Tooltip label={armed ? "Click the page to place the picture" : "Put a picture on the page"} withArrow>
        <ActionIcon
          variant={armed ? "filled" : "subtle"}
          color={armed ? undefined : "gray"}
          size="lg"
          aria-label="Image"
          aria-pressed={armed}
          onClick={() => armed ? annotation?.setActiveTool(null) : picker.current?.click()}
        >
          <IconPhoto size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <input
        ref={picker}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.currentTarget.files?.item(0);
          event.currentTarget.value = "";
          if (file) void choose(file);
        }}
      />
    </>
  );
}

function SignatureButton({ documentId }: { documentId: string }) {
  const { entries, provides: signatures } = useSignatureEntries();
  const placement = useActivePlacement(documentId);
  const [creating, setCreating] = useState(0);
  const armed = placement !== null;

  const arm = (id: string) => signatures?.forDocument(documentId).activateSignaturePlacement(id);
  const label = armed ? "Click the page to sign it" : "Sign the document";

  const button = (props: { onClick?(): void } = {}) => (
    <ActionIcon
      variant={armed ? "filled" : "subtle"}
      color={armed ? undefined : "gray"}
      size="lg"
      aria-label="Signature"
      aria-pressed={armed}
      {...props}
    >
      <IconSignature size="1.2rem" stroke={1.5} />
    </ActionIcon>
  );

  return (
    <>
      {entries.length === 0
        ? <Tooltip label={label} withArrow>{button({ onClick: () => setCreating((was) => was + 1) })}</Tooltip>
        : (
          <Menu position="bottom-start" withArrow shadow="md">
            <Tooltip label={label} withArrow>
              <Menu.Target>{button()}</Menu.Target>
            </Tooltip>
            <Menu.Dropdown>
              <Menu.Label>Choose one, then click the page</Menu.Label>
              {entries.map((entry, index) => (
                <Group key={entry.id} gap={4} wrap="nowrap">
                  <Menu.Item flex={1} onClick={() => arm(entry.id)} aria-label={`Signature ${index + 1}`}>
                    <img className="pdf-signature-preview" src={entry.signature.previewDataUrl} alt="" />
                  </Menu.Item>
                  <CloseButton
                    size="sm"
                    aria-label={`Forget signature ${index + 1}`}
                    onClick={() => signatures?.removeEntry(entry.id)}
                  />
                </Group>
              ))}
              <Menu.Divider />
              <Menu.Item leftSection={<IconPlus size="1rem" />} onClick={() => setCreating((was) => was + 1)}>
                New signature
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      <Modal opened={creating > 0} onClose={() => setCreating(0)} title="New signature" size="lg" centered>
        {creating > 0 && (
          <SignatureCreator
            key={creating}
            onCancel={() => setCreating(0)}
            onSave={(signature) => {
              const id = signatures?.addEntry({ signature });
              setCreating(0);
              if (id) arm(id);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function SignatureCreator({ onCancel, onSave }: SignatureCreatorProps) {
  const [tab, setTab] = useState<CreationTab>("draw");
  const [ink, setInk] = useState<InkId>(DEFAULT_INK);
  const [result, setResult] = useState<SignatureFieldDefinition | null>(null);
  const [asked, setAsked] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const pad = useRef<{ clear(): void } | null>(null);
  const upload = useSignatureUpload({ accept: SIGNATURE_IMAGE_ACCEPT, onResult: setResult });

  useEffect(() => {
    if (tab !== "type") return;
    let live = true;
    void signatureFaceReady().then(() => live && setFaceReady(true));
    return () => {
      live = false;
    };
  }, [tab]);

  const padRef = useCallback((handle: { clear(): void } | null) => {
    pad.current = handle;
  }, []);

  const switchTo = (next: CreationTab) => {
    setTab(next);
    setResult(null);
    setAsked(false);
  };

  const clear = () => {
    if (tab === "upload") upload.clear();
    else pad.current?.clear();
    setResult(null);
  };

  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={(value) => value && switchTo(value as CreationTab)}>
        <Tabs.List>
          {CREATION_TABS.map(({ value, label }) => <Tabs.Tab key={value} value={value}>{label}</Tabs.Tab>)}
        </Tabs.List>
      </Tabs>

      {tab !== "upload" && (
        <SegmentedControl
          value={ink}
          onChange={(value) => setInk(value as InkId)}
          aria-label="Ink"
          data={INKS.map(({ value, label }) => ({ value, label }))}
        />
      )}

      <Box className="pdf-signature-pad" data-tab={tab}>
        {tab === "draw" && <SignatureDrawPad strokeColor={ink} strokeWidth={3} onResult={setResult} padRef={padRef} />}
        {tab === "type" && faceReady && (
          <SignatureTypePad
            color={ink}
            fontFamily={SIGNATURE_FONT}
            placeholder="Type your name"
            onResult={setResult}
            padRef={padRef}
          />
        )}
        {tab === "upload" && (
          upload.previewUrl
            ? <img className="pdf-signature-upload" src={upload.previewUrl} alt="The chosen signature" />
            : (
              <Button variant="default" onClick={upload.openFilePicker} leftSection={<IconUpload size="1rem" />}>
                Choose a picture of a signature
              </Button>
            )
        )}
        <input
          ref={upload.inputRef}
          type="file"
          accept={SIGNATURE_IMAGE_ACCEPT}
          hidden
          onChange={(event) => upload.handleFileInputChange(event.nativeEvent)}
        />
      </Box>

      {asked && !result && (
        <Text size="sm" c="red">
          {tab === "draw"
            ? "Draw a signature in the box first."
            : tab === "type"
            ? "Type a name in the box first."
            : "Choose a picture first."}
        </Text>
      )}

      <Group justify="space-between" gap="sm">
        <Button variant="subtle" color="gray" onClick={clear}>Clear</Button>
        <Group gap="sm">
          <Button variant="default" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => {
              setAsked(true);
              if (result) onSave(result);
            }}
          >
            Place signature
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

interface SignatureCreatorProps {
  onCancel(): void;
  onSave(signature: SignatureFieldDefinition): void;
}

function StyleControl({ documentId }: { documentId: string }) {
  const { provides: annotation, state } = useAnnotation(documentId);
  const { provides: tools } = useAnnotationCapability();
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  useEffect(() => tools?.onToolsChange(redraw), [tools]);

  const selected = state.selectedUids.length === 1 ? state.byUid[state.selectedUids[0]]?.object : undefined;
  const active = state.activeToolId;
  const target = styleTarget(selected && annotation?.findToolForAnnotation(selected)?.id, active);
  const fields = (target?.selection ? selected : active && tools?.getTool(active)?.defaults) as StyleFields | undefined;

  const apply = (patch: Record<string, unknown>) => {
    if (target?.selection && selected) annotation?.updateAnnotation(selected.pageIndex, selected.id, patch);
    if (target?.tool && active) tools?.setToolDefaults(active, patch);
  };

  if (!target || !fields) {
    return (
      <Tooltip label="Choose a tool or select a mark to change its colour" withArrow>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Colour and size" disabled>
          <ColorSwatch color="transparent" size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }

  const { kind } = target;
  const colour = colourOf(kind, fields);
  return (
    <Menu position="bottom" withArrow shadow="md" closeOnItemClick={false}>
      <Tooltip
        label={target.selection ? "Colour and size of the selected mark" : "Colour and size of the next mark"}
        withArrow
      >
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Colour and size">
            <ColorSwatch color={colour ?? "transparent"} size={18} />
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown p="sm">
        <Stack gap="sm" w={250}>
          <Group gap={6}>
            {COLOURS.map(({ value, name }) => (
              <ColorSwatch
                key={value}
                component="button"
                type="button"
                color={value}
                size={22}
                aria-label={name}
                aria-pressed={colour?.toUpperCase() === value}
                style={{ cursor: "pointer" }}
                onClick={() => apply(colourPatch(kind, value))}
              >
                {colour?.toUpperCase() === value && (
                  <IconCheck size="0.8rem" color={value === "#FFFFFF" || value === "#FFCD45" ? "#000" : "#fff"} />
                )}
              </ColorSwatch>
            ))}
          </Group>
          {hasWidth(kind) && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Thickness</Text>
              <WidthSlider value={fields.strokeWidth ?? 3} onChange={(strokeWidth) => apply({ strokeWidth })} />
            </Box>
          )}
          {kind === "text" && (
            <Select
              label="Size"
              size="xs"
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
              data={FONT_SIZES.map((size) => ({ value: String(size), label: `${size} pt` }))}
              value={String(fields.fontSize ?? 12)}
              onChange={(value) => value && apply({ fontSize: Number(value) })}
            />
          )}
        </Stack>
      </Menu.Dropdown>
    </Menu>
  );
}

function WidthSlider({ value, onChange }: { value: number; onChange(value: number): void }) {
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  return (
    <Slider
      min={WIDTHS[0]}
      max={WIDTHS[WIDTHS.length - 1]}
      step={1}
      marks={WIDTHS.map((width) => ({ value: width }))}
      value={shown}
      onChange={setShown}
      onChangeEnd={onChange}
      label={(width) => `${width} pt`}
      aria-label="Thickness"
    />
  );
}

function HistoryControls({ documentId }: { documentId: string }) {
  const { provides } = useHistoryCapability();
  const history = useMemo(() => provides?.forDocument(documentId) ?? null, [provides, documentId]);
  const [can, setCan] = useState({ undo: false, redo: false });

  useEffect(() => {
    if (!history) return;
    const read = () => {
      const { global } = history.getHistoryState();
      setCan({ undo: global.canUndo, redo: global.canRedo });
    };
    read();
    return history.onHistoryChange(read);
  }, [history]);

  return (
    <>
      <Tooltip label="Undo" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Undo"
          disabled={!can.undo}
          onClick={() => history?.undo()}
        >
          <IconArrowBackUp size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Redo" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Redo"
          disabled={!can.redo}
          onClick={() => history?.redo()}
        >
          <IconArrowForwardUp size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}

function PageCount({ documentId }: { documentId: string }) {
  const { state } = useScroll(documentId);
  return (
    <Text size="sm" c="dimmed" px="xs" data-pdf="pages" aria-live="polite" style={{ whiteSpace: "nowrap" }}>
      {`Page ${state.currentPage} of ${state.totalPages}`}
    </Text>
  );
}

function ZoomControls({ documentId }: { documentId: string }) {
  const { state, provides: zoom } = useZoom(documentId);

  return (
    <Group gap={2} wrap="nowrap">
      <Tooltip label="Zoom out" withArrow>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Zoom out" onClick={() => zoom?.zoomOut()}>
          <IconZoomOut size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <Menu position="bottom" withArrow shadow="md">
        <Menu.Target>
          <Button variant="subtle" color="gray" size="compact-sm" w={64} aria-label="Zoom level">
            {percent(state.currentZoomLevel)}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {ZOOM_FITS.map(({ value, label }) => (
            <Menu.Item key={value} onClick={() => zoom?.requestZoom(value)}>{label}</Menu.Item>
          ))}
          <Menu.Divider />
          {ZOOM_LEVELS.map((level) => (
            <Menu.Item key={level} onClick={() => zoom?.requestZoom(level)}>{percent(level)}</Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Tooltip label="Zoom in" withArrow>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Zoom in" onClick={() => zoom?.zoomIn()}>
          <IconZoomIn size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function FileControls({ documentId, name, onOpen, onClose, onFailure }: FileControlsProps) {
  const { provides: exporter } = useExport(documentId);
  const { provides: annotation } = useAnnotation(documentId);
  const [saving, setSaving] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!exporter || !annotation) return;
    setSaving(true);
    try {
      await annotation.commit().toPromise();
      const bytes = await exporter.saveAsCopy().toPromise();
      download(saveName(name), new Blob([bytes], { type: "application/pdf" }));
    } catch (error) {
      onFailure({ title: "That PDF was not saved", message: message(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label="Open another PDF" withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Open another PDF"
          onClick={() => picker.current?.click()}
        >
          <IconFolderOpen size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={`Download as ${saveName(name)}`} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          aria-label="Download the PDF"
          loading={saving}
          onClick={() => void save()}
        >
          <IconDownload size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Take this PDF off the page" withArrow>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Close the PDF" onClick={onClose}>
          <IconTrash size="1.2rem" stroke={1.5} />
        </ActionIcon>
      </Tooltip>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void onOpen(event.currentTarget.files?.item(0) ?? null);
          event.currentTarget.value = "";
        }}
      />
    </Group>
  );
}

interface FileControlsProps {
  documentId: string;
  name: string;
  onOpen(file: File | null): Promise<void>;
  onClose(): void;
  onFailure(failure: Failure): void;
}

function TextMenu({ rect, menuWrapperProps, placement, documentId }: SelectionSelectionMenuProps & DocumentScoped) {
  const { provides: selection } = useSelectionCapability();
  return (
    <div {...menuWrapperProps}>
      <Paper
        className="pdf-float"
        shadow="md"
        withBorder
        style={{ top: placement.suggestTop ? -44 : rect.size.height + 8 }}
      >
        <Button
          size="compact-sm"
          variant="subtle"
          color="gray"
          leftSection={<IconCopy size="0.9rem" />}
          onClick={() => {
            const scoped = selection?.forDocument(documentId);
            scoped?.copyToClipboard();
            scoped?.clear();
          }}
        >
          Copy
        </Button>
      </Paper>
    </div>
  );
}

function MarkMenu(
  { selected, context, rect, menuWrapperProps, placement, documentId }: AnnotationSelectionMenuProps & DocumentScoped,
) {
  const { provides: annotation } = useAnnotationCapability();
  if (!selected) return null;
  const { pageIndex, id } = context.annotation.object;
  return (
    <div {...menuWrapperProps}>
      <Paper
        className="pdf-float"
        shadow="md"
        withBorder
        style={{ top: placement.suggestTop ? -44 : rect.size.height + 8 }}
      >
        <Tooltip label="Delete this mark" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Delete this mark"
            onClick={() => annotation?.forDocument(documentId).deleteAnnotation(pageIndex, id)}
          >
            <IconTrash size="1rem" stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Paper>
    </div>
  );
}

interface DocumentScoped {
  documentId: string;
}

function Waiting({ children }: { children: string }) {
  return (
    <Center className="pdf-waiting">
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{children}</Text>
      </Group>
    </Center>
  );
}

interface Opened {
  name: string;
  bytes: Uint8Array;
  count: number;
}

interface Failure {
  title: string;
  message: string;
}

declare global {
  var pdfRegistry: PluginRegistry | undefined;
}
