import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Alert, Box, Button, Card, Collapse, ColorInput, CopyButton, Group, NumberInput, SegmentedControl, Select, Slider, Stack, Switch, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { download } from "../../common/download";
import { type Fact, FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconAdjustments, IconCheck, IconChevronRight, IconCopy, IconCrop, IconDownload, IconFlipHorizontal, IconFlipVertical, IconGripVertical, IconLink, IconMapPin, IconPhoto, IconRestore, IconRotate2, IconRotateClockwise, IconTags, IconTrash, IconUpload, IconX } from "../../icons";
import { formatBytes } from "./container";
import { ASPECTS, clampRect, CORNERS, CURSORS, dragRect, fitAspect, fitPreview, type Handle, handleAt, isWhole, localPoint, moveRect, ratioOf, resizeRect, turnTransform, wholeImage } from "./crop";
import { applyEdits, type Edits, editsFrom, locationProblem, NO_EDITS, problem, rewrite, sameEdits, withMetadata } from "./edits";
import { carriesExif, CONTAINER_LABELS } from "./embed";
import { countEntries } from "./exif";
import { exifGroups, fileFacts, locationFacts, otherFacts } from "./facts";
import { type Adjustments, cssFilter, isNeutral, matchPreset, NEUTRAL, PRESETS, SLIDERS } from "./filters";
import { encodable, formatFor, type OutputFormat } from "./formats";
import { PANEL_ORDER, panelTitle, reorderPanels, togglePanel } from "./panels";
import { encode, type Geometry, outputSize, type Rect, render } from "./render";
import { ACCEPT, load, loadBytes, type Loaded, MAX_BYTES, readDataUri, stem, toDataUri } from "./source";
import { EDITABLE, EDITABLE_FIELDS, ORIENTATIONS } from "./tags";

export default function ImageTool() {
  const initialState = useInitialHashState<{
    view?: string;
    format?: string;
    quality?: number;
    matte?: string;
    rotate?: number;
    flipX?: boolean;
    flipY?: boolean;
    aspect?: string;
    keep?: boolean;
    strip?: boolean;
    adjustments?: Partial<Adjustments>;
  }>();

  const [view, setView] = useState(initialState?.view === "metadata" ? "metadata" : "transform");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);

  const [crop, setCrop] = useState<Rect | null>(null);
  const [aspect, setAspect] = useState(initialState?.aspect ?? "free");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [locked, setLocked] = useState(true);
  const [rotate, setRotate] = useState(turnOf(initialState?.rotate));
  const [flipX, setFlipX] = useState(initialState?.flipX === true);
  const [flipY, setFlipY] = useState(initialState?.flipY === true);
  const [adjustments, setAdjustments] = useState<Adjustments>({ ...NEUTRAL, ...initialState?.adjustments });

  const [formats] = useState(encodable);
  const [format, setFormat] = useState(() => pickFormat(initialState?.format, formats));
  const [quality, setQuality] = useState(clampNumber(initialState?.quality, 1, 100, 85));
  const [matte, setMatte] = useState(initialState?.matte ?? "#ffffff");
  const [keepMetadata, setKeepMetadata] = useState(initialState?.keep !== false);

  const [edits, setEdits] = useState<Edits>(NO_EDITS);
  const [strip, setStrip] = useState(initialState?.strip === true);

  const [order, setOrder] = useState(PANEL_ORDER);
  const [closed, setClosed] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [result, setResult] = useState<Result | null>(null);
  const urls = useRef<{ source: string | null; output: string | null }>({ source: null, output: null });
  const [rendering, setRendering] = useState(false);
  const [uri, setUri] = useState("");

  const spec = formatFor(format);
  const natural = loaded ? { width: loaded.element.naturalWidth, height: loaded.element.naturalHeight } : null;
  const original = useMemo(() => (loaded ? editsFrom(loaded.exif) : NO_EDITS), [loaded]);
  const geometry: Geometry = { crop, width, height, rotate, flipX, flipY };
  const needsMatte = Boolean(loaded?.info.hasAlpha && !spec.alpha);

  useRegisterShareState(() => ({
    view: view === "metadata" ? view : undefined,
    format,
    quality: spec.lossy ? quality : undefined,
    matte: needsMatte ? matte : undefined,
    aspect: aspect === "free" ? undefined : aspect,
    rotate: rotate === 0 ? undefined : rotate,
    flipX: flipX || undefined,
    flipY: flipY || undefined,
    keep: keepMetadata ? undefined : false,
    strip: strip || undefined,
    adjustments: isNeutral(adjustments) ? undefined : adjustments,
  }));

  const place = useCallback((next: Loaded) => {
    if (urls.current.source) URL.revokeObjectURL(urls.current.source);
    urls.current.source = next.url;
    setLoaded(next);
    setFailure(null);
    setCrop(null);
    setWidth(next.element.naturalWidth);
    setHeight(next.element.naturalHeight);
    setEdits(editsFrom(next.exif));
    setUri("");
  }, []);

  const take = useCallback(async (file: File | null) => {
    if (!file) return;
    setReading(true);
    try {
      place(await load(file));
    } catch (error) {
      setFailure(message(error));
    } finally {
      setReading(false);
    }
  }, [place]);

  const takeUri = useCallback(async (text: string) => {
    const read = readDataUri(text);
    if (!read) {
      setFailure("That is not a data URI. It starts `data:image/…` and has a comma in it.");
      return;
    }
    if (read.bytes.length > MAX_BYTES) {
      setFailure(`That is larger than the ${MAX_BYTES / 1024 / 1024} MB this reads.`);
      return;
    }
    setReading(true);
    try {
      place(await loadBytes(read.bytes, read.name, read.type, null));
      setPasted("");
    } catch (error) {
      setFailure(message(error));
    } finally {
      setReading(false);
    }
  }, [place]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/"));
      if (item) {
        event.preventDefault();
        void take(item);
        return;
      }
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!/^\s*data:image\//i.test(text)) return;
      if (event.target instanceof HTMLElement && isTyping(event.target)) return;
      event.preventDefault();
      void takeUri(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [take, takeUri]);

  useEffect(() => () => {
    for (const url of [urls.current.source, urls.current.output]) if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!loaded || !natural) return;
    let live = true;
    setRendering(true);
    const timer = setTimeout(() => {
      void (async () => {
        const canvas = render(loaded.element, geometry, adjustments, needsMatte ? matte : "");
        const blob = await encode(canvas, spec, quality);
        if (!live) return;
        if (!blob) {
          setResult(null);
          setRendering(false);
          return;
        }
        const exif = keepMetadata && !strip ? applyEdits(loaded.exif, edits) : null;
        const carried = await withMetadata(blob, exif, canvas.width, canvas.height);
        if (!live) return;
        if (urls.current.output) URL.revokeObjectURL(urls.current.output);
        urls.current.output = URL.createObjectURL(carried);
        setResult({ blob: carried, url: urls.current.output, width: canvas.width, height: canvas.height });
        setUri("");
        setRendering(false);
      })();
    }, RENDER_DELAY);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loaded,
    crop,
    width,
    height,
    rotate,
    flipX,
    flipY,
    adjustments,
    format,
    quality,
    matte,
    needsMatte,
    keepMetadata,
    strip,
    edits,
  ]);

  const editing = !sameEdits(edits, original) || strip;
  const rewritten = useMemo(() => {
    if (!loaded || !editing) return null;
    return rewrite(loaded.bytes, loaded.info.container, strip ? null : applyEdits(loaded.exif, edits), strip);
  }, [loaded, edits, strip, editing]);

  const resize = (next: number, axis: "width" | "height") => {
    if (!natural) return;
    const base = crop ?? wholeImage(natural);
    const value = Math.max(1, Math.min(next, MAX_SIDE));
    if (axis === "width") {
      setWidth(value);
      if (locked) setHeight(Math.max(1, Math.round((value * base.height) / base.width)));
    } else {
      setHeight(value);
      if (locked) setWidth(Math.max(1, Math.round((value * base.width) / base.height)));
    }
  };

  const chooseAspect = (value: string) => {
    setAspect(value);
    if (!natural) return;
    const ratio = ratioOf(value);
    if (ratio <= 0) return;
    setCropTo(fitAspect(crop ?? wholeImage(natural), natural, ratio));
  };

  const setCropTo = (next: Rect | null) => {
    setCrop(next);
    if (!natural) return;
    const rect = next ?? wholeImage(natural);
    setWidth(rect.width);
    setHeight(rect.height);
  };

  const revert = () => {
    if (!natural) return;
    setCropTo(null);
    setAspect("free");
    setRotate(0);
    setFlipX(false);
    setFlipY(false);
    setAdjustments(NEUTRAL);
  };

  const save = () => {
    if (!result || !loaded) return;
    download(`${stem(loaded.name)}.${spec.extension}`, result.blob);
  };

  const saveMetadata = () => {
    if (!rewritten || !loaded) return;
    const type = loaded.type;
    download(
      `${stem(loaded.name)}.${extensionOf(loaded.name, loaded.info.container)}`,
      new Blob([rewritten as BlobPart], { type }),
    );
  };

  const makeUri = async () => {
    if (!result) return;
    setUri(await toDataUri(result.blob));
  };

  const output = outputSize(geometry);
  const groups = useMemo(() => exifGroups(loaded?.exif ?? null), [loaded]);
  const others = useMemo(() => (loaded ? otherFacts(loaded) : []), [loaded]);
  const places = useMemo(() => locationFacts(loaded?.exif ?? null), [loaded]);
  const [latitudeError, longitudeError] = locationProblem(edits.latitude, edits.longitude);
  const writable = loaded ? carriesExif(loaded.info.container) : false;

  const reorderCards = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    setOrder((current) => reorderPanels(current, String(active.id), String(over.id)));
  };

  const controls: Record<string, ReactNode> = {
    shape: (
      <Button size="xs" variant="subtle" color="gray" leftSection={<IconRestore size="0.9rem" />} onClick={revert}>
        Start over
      </Button>
    ),
    colour: (
      <Button
        size="xs"
        variant="subtle"
        color="gray"
        leftSection={<IconRestore size="0.9rem" />}
        onClick={() => setAdjustments(NEUTRAL)}
        disabled={isNeutral(adjustments)}
      >
        Neutral
      </Button>
    ),
  };

  const bodies: Record<string, ReactNode> = loaded && natural
    ? {
      shape: (
        <>
          <Box className="settings-row">
            <Select
              label="Crop shape"
              description="Drag on the picture to draw one"
              data={ASPECTS.map(({ value, label }) => ({ value, label }))}
              value={aspect}
              onChange={(value) => value && chooseAspect(value)}
              allowDeselect={false}
              leftSection={<IconCrop size="1rem" />}
            />
            <NumberInput
              label="Crop X"
              value={crop?.x ?? 0}
              min={0}
              max={natural.width - 1}
              onChange={(value) =>
                setCropTo(clampRect({ ...(crop ?? wholeImage(natural)), x: Number(value) }, natural))}
            />
            <NumberInput
              label="Crop Y"
              value={crop?.y ?? 0}
              min={0}
              max={natural.height - 1}
              onChange={(value) =>
                setCropTo(clampRect({ ...(crop ?? wholeImage(natural)), y: Number(value) }, natural))}
            />
            <NumberInput
              label="Crop width"
              value={crop?.width ?? natural.width}
              min={1}
              max={natural.width}
              onChange={(value) =>
                setCropTo(clampRect({ ...(crop ?? wholeImage(natural)), width: Number(value) }, natural))}
            />
            <NumberInput
              label="Crop height"
              value={crop?.height ?? natural.height}
              min={1}
              max={natural.height}
              onChange={(value) =>
                setCropTo(clampRect({ ...(crop ?? wholeImage(natural)), height: Number(value) }, natural))}
            />
          </Box>

          <Box className="settings-row">
            <NumberInput
              label="Width"
              description="Pixels the saved file comes out at"
              value={width}
              min={1}
              max={MAX_SIDE}
              onChange={(value) => resize(Number(value), "width")}
            />
            <NumberInput
              label="Height"
              value={height}
              min={1}
              max={MAX_SIDE}
              onChange={(value) => resize(Number(value), "height")}
            />
            <Select
              label="Scale"
              description="A share of what is left after the crop"
              data={SCALES}
              value={shareOf(width, (crop ?? wholeImage(natural)).width)}
              placeholder="Sized by hand"
              onChange={(value) => {
                const base = crop ?? wholeImage(natural);
                const share = Number(value) / 100;
                setWidth(Math.max(1, Math.round(base.width * share)));
                setHeight(Math.max(1, Math.round(base.height * share)));
              }}
            />
            <Box pb={8}>
              <Switch
                checked={locked}
                onChange={(event) => setLocked(event.currentTarget.checked)}
                label="Keep the proportions"
              />
            </Box>
          </Box>

          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRotate2 size="0.9rem" />}
              onClick={() => setRotate(turnOf(rotate + 270))}
            >
              Left
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRotateClockwise size="0.9rem" />}
              onClick={() => setRotate(turnOf(rotate + 90))}
            >
              Right
            </Button>
            <Button
              size="xs"
              variant={flipX ? "filled" : "light"}
              leftSection={<IconFlipHorizontal size="0.9rem" />}
              onClick={() => setFlipX(!flipX)}
            >
              Mirror
            </Button>
            <Button
              size="xs"
              variant={flipY ? "filled" : "light"}
              leftSection={<IconFlipVertical size="0.9rem" />}
              onClick={() => setFlipY(!flipY)}
            >
              Flip
            </Button>
            <Text size="xs" c="dimmed">
              {rotate === 0 ? "Not turned" : `Turned ${rotate}° clockwise`}
            </Text>
          </Group>
        </>
      ),
      colour: (
        <>
          <Select
            label="Preset"
            description="A place to start; every slider still moves after it"
            data={PRESETS.map(({ value, label }) => ({ value, label }))}
            value={matchPreset(adjustments)}
            placeholder="Adjusted by hand"
            onChange={(value) => {
              const preset = PRESETS.find((entry) => entry.value === value);
              if (preset) setAdjustments(preset.adjustments);
            }}
            allowDeselect={false}
            maw={SELECT_WIDTH}
          />

          {SLIDERS.map(({ key, label, min, max, unit }) => (
            <Box key={key}>
              <Group justify="space-between" gap="xs">
                <Text size="sm">{label}</Text>
                <Text size="sm" c="dimmed" ff="monospace">{adjustments[key]}{unit}</Text>
              </Group>
              <Slider
                value={adjustments[key]}
                min={min}
                max={max}
                label={(value) => `${value}${unit}`}
                aria-label={label}
                onChange={(value) => setAdjustments({ ...adjustments, [key]: value })}
              />
            </Box>
          ))}
        </>
      ),
    }
    : {};

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="image"
        control={loaded
          ? (
            <SegmentedControl
              value={view}
              onChange={setView}
              aria-label="Which half of the page is showing"
              data={[
                { value: "transform", label: <Tab Icon={IconAdjustments} label="Transform" /> },
                { value: "metadata", label: <Tab Icon={IconTags} label="Metadata" /> },
              ]}
            />
          )
          : undefined}
      >
        Image
      </UtilityTitle>

      <Card
        withBorder
        shadow="sm"
        radius="md"
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event: DragEvent<HTMLDivElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setDragging(false);
          void take(event.dataTransfer.files.item(0));
        }}
        style={{ outline: dragging && loaded ? "2px dashed var(--mantine-color-orange-4)" : undefined }}
      >
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Title order={4}>Picture</Title>
            {loaded && (
              <Tooltip label="Take this picture off the page" withArrow position="left">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Remove the picture"
                  onClick={() => {
                    for (const url of [urls.current.source, urls.current.output]) if (url) URL.revokeObjectURL(url);
                    urls.current = { source: null, output: null };
                    setLoaded(null);
                    setResult(null);
                    setUri("");
                  }}
                >
                  <IconTrash size="1.1rem" />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          {!loaded && (
            <Box
              component="label"
              className="image-dropzone"
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
                void take(event.dataTransfer.files.item(0));
              }}
            >
              <Stack align="center" gap={4}>
                <IconUpload size="2rem" stroke={1.3} />
                <Text size="sm">Click to choose a picture, drop one here, or paste one</Text>
                <Text size="xs" c="dimmed">
                  Nothing is uploaded — the file is read in this tab and never leaves it
                </Text>
              </Stack>
              <input
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  void take(event.currentTarget.files?.item(0) ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </Box>
          )}

          {!loaded && (
            <Box className="settings-row">
              <Textarea
                className="image-data-uri"
                label="Or paste a data URI"
                placeholder="data:image/png;base64,iVBORw0KGgo…"
                value={pasted}
                onChange={(event) => setPasted(event.currentTarget.value)}
                autosize
                minRows={2}
                maxRows={6}
                spellCheck={false}
              />
              <Box pb={0}>
                <Button
                  variant="light"
                  leftSection={<IconPhoto size="0.9rem" />}
                  loading={reading}
                  onClick={() => void takeUri(pasted)}
                >
                  Read the URI
                </Button>
              </Box>
            </Box>
          )}

          {failure && (
            <Alert color="red" icon={<IconX size="1rem" />} title="That did not read as a picture">
              {failure}
            </Alert>
          )}

          {loaded && natural && (
            <Stage
              loaded={loaded}
              natural={natural}
              crop={view === "transform" ? crop : null}
              aspect={aspect}
              filter={cssFilter(adjustments)}
              rotate={rotate}
              flipX={flipX}
              flipY={flipY}
              editable={view === "transform"}
              onCrop={setCropTo}
            />
          )}
        </Stack>
      </Card>

      {loaded && natural && view === "transform" && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={reorderCards}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((id) => (
                <Panel
                  key={id}
                  id={id}
                  open={!closed.includes(id)}
                  control={controls[id]}
                  onToggle={() => setClosed((current) => togglePanel(current, id))}
                >
                  {bodies[id]}
                </Panel>
              ))}
            </SortableContext>
          </DndContext>

          <Card withBorder shadow="sm" radius="md">
            <Stack gap="sm">
              <Title order={4}>Save as</Title>

              <Box className="settings-row">
                <Select
                  label="Format"
                  description={formats.length < 4 ? "Only what this browser will encode" : undefined}
                  data={formats.map(({ value, label }) => ({ value, label }))}
                  value={format}
                  onChange={(value) => value && setFormat(value)}
                  allowDeselect={false}
                />
                {spec.lossy && (
                  <NumberInput
                    label="Quality"
                    description="Lower is smaller and coarser"
                    value={quality}
                    min={1}
                    max={100}
                    onChange={(value) => setQuality(clampNumber(Number(value), 1, 100, 85))}
                  />
                )}
                {needsMatte && (
                  <ColorInput
                    label="Behind the transparency"
                    description={`${spec.label} carries no alpha`}
                    value={matte}
                    onChange={setMatte}
                    format="hex"
                  />
                )}
                <Box pb={8}>
                  <Switch
                    checked={keepMetadata}
                    onChange={(event) => setKeepMetadata(event.currentTarget.checked)}
                    label="Carry the metadata over"
                    description={strip ? "Nothing to carry — it is being taken off" : undefined}
                    disabled={strip}
                  />
                </Box>
              </Box>

              <FactTable
                rows={[
                  { label: "Dimensions", value: `${output.width} × ${output.height}` },
                  { label: "Size", value: result ? formatBytes(result.blob.size) : "" },
                  {
                    label: "Against the original",
                    value: result ? difference(result.blob.size, loaded.size) : "",
                  },
                  { label: "Type", value: spec.mime },
                ]}
              />

              <Group gap="xs">
                <Button
                  leftSection={<IconDownload size="0.9rem" />}
                  onClick={save}
                  disabled={!result}
                  loading={rendering}
                >
                  Save the picture
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconLink size="0.9rem" />}
                  onClick={() => void makeUri()}
                  disabled={!result}
                >
                  Make a data URI
                </Button>
                {result && (
                  <Text size="xs" c="dimmed">
                    {rendering ? "Working…" : `${formatBytes(result.blob.size)}`}
                  </Text>
                )}
              </Group>

              {uri !== "" && (
                <Box className="image-data-uri" pos="relative">
                  <Textarea
                    value={uri}
                    aria-label="The picture as a data URI"
                    readOnly
                    autosize
                    minRows={3}
                    maxRows={10}
                    spellCheck={false}
                  />
                  <Group gap="xs" mt="xs">
                    <Text size="xs" c="dimmed">
                      {uri.length.toLocaleString()}{" "}
                      characters — a third larger than the file, which is what base64 costs
                    </Text>
                    <CopyButton value={uri} timeout={2000}>
                      {({ copied, copy }) => (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color={copied ? "teal" : "gray"}
                          leftSection={copied ? <IconCheck size="0.8rem" /> : <IconCopy size="0.8rem" />}
                          onClick={copy}
                        >
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                </Box>
              )}
            </Stack>
          </Card>
        </>
      )}

      {loaded && view === "metadata" && (
        <>
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="xs">
              <Title order={4}>File</Title>
              <FactTable rows={fileFacts(loaded)} />
            </Stack>
          </Card>

          <Card withBorder shadow="sm" radius="md">
            <Stack gap="sm">
              <Group justify="space-between" wrap="nowrap">
                <Title order={4}>Edit the metadata</Title>
                <Switch
                  checked={strip}
                  onChange={(event) => setStrip(event.currentTarget.checked)}
                  label="Take all of it off"
                />
              </Group>

              {!writable && (
                <Alert color="yellow" variant="light">
                  {CONTAINER_LABELS[loaded.info.container]}{" "}
                  has nowhere to put an EXIF block back, so these are read here and written only into a JPEG, a PNG or a
                  WebP saved from the Transform tab.
                </Alert>
              )}

              {FIELD_ROWS.map((row) => (
                <FieldRow key={row[0]} names={row} edits={edits} onEdit={setEdits} disabled={strip} />
              ))}

              <Box
                className={latitudeError || longitudeError ? "settings-row has-error" : "settings-row"}
                mb={latitudeError || longitudeError ? "md" : 0}
                style={{ opacity: strip ? 0.5 : 1 }}
              >
                <Select
                  label="Orientation"
                  description="How a viewer should turn it"
                  data={[{ value: "", label: "Not recorded" }, ...ORIENTATIONS]}
                  value={edits.orientation}
                  onChange={(value) => setEdits({ ...edits, orientation: value ?? "" })}
                  allowDeselect={false}
                  disabled={strip}
                />
                <TextInput
                  label="Latitude"
                  description="Clear both to take the location off"
                  placeholder="-33.865143"
                  value={edits.latitude}
                  onChange={(event) => setEdits({ ...edits, latitude: event.currentTarget.value })}
                  error={latitudeError}
                  classNames={ERROR_CLASSES}
                  leftSection={<IconMapPin size="1rem" />}
                  disabled={strip}
                />
                <TextInput
                  label="Longitude"
                  placeholder="151.209900"
                  value={edits.longitude}
                  onChange={(event) => setEdits({ ...edits, longitude: event.currentTarget.value })}
                  error={longitudeError}
                  classNames={ERROR_CLASSES}
                  disabled={strip}
                />
              </Box>

              <Group gap="xs">
                <Button
                  leftSection={<IconDownload size="0.9rem" />}
                  onClick={saveMetadata}
                  disabled={!rewritten}
                >
                  Save with these changes
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconRestore size="0.9rem" />}
                  onClick={() => {
                    setEdits(original);
                    setStrip(false);
                  }}
                  disabled={!editing}
                >
                  Put it back
                </Button>
                <Text size="xs" c="dimmed">
                  {!editing
                    ? "Nothing has changed yet."
                    : rewritten
                    ? `${formatBytes(rewritten.length)} — the pixels are untouched, only the metadata is rewritten.`
                    : `${CONTAINER_LABELS[loaded.info.container]} cannot be rewritten here.`}
                </Text>
              </Group>
            </Stack>
          </Card>

          {places.length > 0 && (
            <Card withBorder shadow="sm" radius="md">
              <Stack gap="xs">
                <Title order={4}>Where it was taken</Title>
                <FactTable rows={places} />
              </Stack>
            </Card>
          )}

          {groups.map((group) => (
            <Card key={group.title} withBorder shadow="sm" radius="md">
              <Stack gap="xs">
                <Title order={4}>{group.title}</Title>
                <FactTable rows={group.rows} />
              </Stack>
            </Card>
          ))}

          {others.length > 0 && (
            <Card withBorder shadow="sm" radius="md">
              <Stack gap="xs">
                <Title order={4}>Other notes</Title>
                <FactTable rows={others} />
              </Stack>
            </Card>
          )}

          {!loaded.exif && others.length === 0 && (
            <Card withBorder shadow="sm" radius="md">
              <Text size="sm" c="dimmed">
                This file carries no EXIF and no text of its own — either it never had any, or whatever last wrote it
                took it off.
              </Text>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}

function Stage({ loaded, natural, crop, aspect, filter, rotate, flipX, flipY, editable, onCrop }: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<Handle | null>(null);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const element = stage.current;
      if (!element) return;
      setRoom({ width: element.clientWidth, height: window.innerHeight * (editable ? TALL : SHORT) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (stage.current) observer.observe(stage.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [editable]);

  const turned = rotate === 90 || rotate === 270;
  const fit = fitPreview(natural, room.width > 0 ? room : FALLBACK_ROOM, turned);
  const scale = natural.width / fit.width;

  const at = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = layer.current!.getBoundingClientRect();
    const centre = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const local = localPoint({ x: event.clientX, y: event.clientY }, centre, fit, rotate, flipX, flipY);
    return { x: local.x * scale, y: local.y * scale };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const point = at(event);
    const handle = crop ? handleAt(point, crop, HANDLE_TOLERANCE * scale) : null;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = handle && crop
      ? { kind: handle, from: point, rect: crop }
      : { kind: "draw", from: point, rect: null };
    if (!handle) onCrop(null);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = at(event);
    const current = drag.current;
    if (!current) {
      setHover(crop ? handleAt(point, crop, HANDLE_TOLERANCE * scale) : null);
      return;
    }
    const ratio = ratioOf(aspect);
    if (current.kind === "draw") onCrop(dragRect(current.from, point, natural, ratio));
    else if (current.kind === "move" && current.rect) {
      onCrop(moveRect(current.rect, point.x - current.from.x, point.y - current.from.y, natural));
    } else if (current.rect) onCrop(resizeRect(current.rect, current.kind as Handle, point, natural, ratio));
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const current = drag.current;
    drag.current = null;
    if (current?.kind === "draw" && crop && (crop.width < 12 || crop.height < 12)) onCrop(null);
  };

  const share = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <Stack gap={4}>
      <Box className="image-stage" ref={stage}>
        <div className="image-frame" style={{ width: fit.frame.width, height: fit.frame.height }}>
          <div
            className="image-turn"
            style={{ width: fit.width, height: fit.height, transform: turnTransform(rotate, flipX, flipY) }}
          >
            <img src={loaded.url} alt={loaded.name} style={{ filter }} draggable={false} />
            <div
              ref={layer}
              className="image-crop-layer"
              hidden={!editable}
              style={{ cursor: hover ? CURSORS[hover] : "crosshair" }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              {crop && (
                <div
                  className="image-crop"
                  style={{
                    left: share(crop.x, natural.width),
                    top: share(crop.y, natural.height),
                    width: share(crop.width, natural.width),
                    height: share(crop.height, natural.height),
                  }}
                >
                  {CORNERS.map((corner) => (
                    <div
                      key={corner}
                      className="image-crop-handle"
                      style={{
                        left: corner.includes("w") ? -6 : undefined,
                        right: corner.includes("e") ? -6 : undefined,
                        top: corner.includes("n") ? -6 : undefined,
                        bottom: corner.includes("s") ? -6 : undefined,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Box>
      <Text size="xs" c="dimmed">
        {!editable
          ? `${natural.width} × ${natural.height} as a viewer shows it.`
          : isWhole(crop, natural)
          ? "Drag on the picture to crop it."
          : `Crop ${crop!.width} × ${crop!.height} at ${crop!.x}, ${
            crop!.y
          } — drag inside to move it, a corner to resize.`}
      </Text>
    </Stack>
  );
}

function Panel({ id, open, control, onToggle, children }: PanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const title = panelTitle(id);

  return (
    <Card
      ref={setNodeRef}
      withBorder
      shadow={isDragging ? "lg" : "sm"}
      radius="md"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 1 : 0,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap={4} align="center" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? "Close" : "Open"} ${title}`}
          >
            <IconChevronRight className="panel-chevron" data-open={open || undefined} size="1.1rem" />
          </ActionIcon>
          <Title order={4}>{title}</Title>
        </Group>
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {control}
          <Tooltip label="Drag to reorder" withArrow position="left">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
              aria-label={`Reorder ${title}`}
              {...attributes}
              {...listeners}
            >
              <IconGripVertical size="1.1rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Collapse expanded={open}>
        <Stack gap="sm" pt="sm">{children}</Stack>
      </Collapse>
    </Card>
  );
}

interface PanelProps {
  id: string;
  open: boolean;
  control: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}

function FieldRow({ names, edits, onEdit, disabled }: FieldRowProps) {
  const errors = names.map((name) => problem(name, edits.fields[name] ?? ""));
  const erroring = errors.some(Boolean);
  return (
    <Box
      className={erroring ? "settings-row has-error" : "settings-row"}
      mb={erroring ? "md" : 0}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {names.map((name, at) => (
        <TextInput
          key={name}
          label={EDITABLE[name].label}
          placeholder={EDITABLE[name].placeholder}
          value={edits.fields[name] ?? ""}
          onChange={(event) => onEdit({ ...edits, fields: { ...edits.fields, [name]: event.currentTarget.value } })}
          error={errors[at]}
          classNames={ERROR_CLASSES}
          disabled={disabled}
          spellCheck={false}
        />
      ))}
    </Box>
  );
}

function Tab({ Icon, label }: { Icon: typeof IconTags; label: string }): ReactNode {
  return (
    <Group gap={6} wrap="nowrap" justify="center">
      <Icon size="1rem" stroke={1.5} />
      {label}
    </Group>
  );
}

interface StageProps {
  loaded: Loaded;
  natural: { width: number; height: number };
  crop: Rect | null;
  aspect: string;
  filter: string;
  rotate: number;
  flipX: boolean;
  flipY: boolean;
  editable: boolean;
  onCrop: (rect: Rect | null) => void;
}

interface FieldRowProps {
  names: string[];
  edits: Edits;
  onEdit: (edits: Edits) => void;
  disabled: boolean;
}

interface Drag {
  kind: Handle | "draw";
  from: { x: number; y: number };
  rect: Rect | null;
}

interface Result {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

function difference(size: number, original: number): string {
  if (original <= 0) return "";
  const share = size / original;
  if (share >= 2) return `${share.toFixed(1)}× the original`;
  if (share <= 0.5) return `${(1 / share).toFixed(1)}× smaller than the original`;
  const word = size < original ? "smaller" : "larger";
  return `${Math.abs(100 - share * 100).toFixed(1)}% ${word}`;
}

function shareOf(width: number, base: number): string {
  if (base <= 0) return "";
  const percent = String(Math.round((width / base) * 100));
  return SCALES.some((scale) => scale.value === percent) ? percent : "";
}

function turnOf(value: number | undefined): number {
  const turns = Math.round((value ?? 0) / 90) * 90;
  return ((turns % 360) + 360) % 360;
}

function clampNumber(value: number | undefined, low: number, high: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(low, Math.min(high, Math.round(value!)));
}

function pickFormat(value: string | undefined, formats: OutputFormat[]): string {
  return formats.some((format) => format.value === value) ? value! : "png";
}

function extensionOf(name: string, container: string): string {
  const at = name.lastIndexOf(".");
  return at > 0 ? name.slice(at + 1) : container === "jpeg" ? "jpg" : container;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTyping(target: HTMLElement): boolean {
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

const ERROR_CLASSES = { root: "relative-root", error: "absolute-error" };

const FIELD_ROWS = [EDITABLE_FIELDS.slice(0, 3), EDITABLE_FIELDS.slice(3, 6), EDITABLE_FIELDS.slice(6)];

const RENDER_DELAY = 320;

const MAX_SIDE = 16384;

const HANDLE_TOLERANCE = 10;

const TALL = 0.6;
const SHORT = 0.3;

const FALLBACK_ROOM = { width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER };

const SCALES = ["10", "25", "33", "50", "66", "75", "150", "200"].map((value) => ({
  value,
  label: `${value}%`,
}));

const SELECT_WIDTH = "calc(20rem * var(--mantine-scale))";
