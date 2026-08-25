import { ActionIcon, Alert, Badge, Box, Card, ColorPicker, ColorSwatch, CopyButton, Group, Stack, Text, TextInput, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { type RefObject, useRef, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconAlertTriangle, IconArrowsExchange, IconCheck, IconCopy, IconX } from "../../icons";
import { BACKDROPS, CONTRAST_LEVELS, contrastRatio, grade, opaque, writeRatio } from "./contrast";
import { BACKGROUND_FIELD, DEFAULT_BACKGROUND, DEFAULT_COLOUR, FORMAT_ROWS, type FormatSpec, SWATCHES } from "./formats";
import { useInterference } from "./interference";
import { HARMONIES, harmony, type Swatch, tones } from "./palette";
import { parseColour } from "./parse";
import type { Rgba } from "./rgba";
import { simulate, VISIONS } from "./vision";
import { writeHex, writeRgba } from "./write";

export default function Colour() {
  const initialState = useInitialHashState<{ colour?: string; background?: string }>();

  const [colour, setColour] = useState<Rgba>(() => parseColour(initialState?.colour ?? "") ?? DEFAULT_COLOUR);
  const [background, setBackground] = useState<Rgba>(
    () => parseColour(initialState?.background ?? "") ?? DEFAULT_BACKGROUND,
  );
  const [draft, setDraft] = useState<{ format: string; text: string } | null>(null);

  const preview = useRef<HTMLDivElement>(null);
  const interference = useInterference(preview, { colour, background });

  useRegisterShareState(() => ({ colour: writeHex(colour), background: writeHex(background) }));

  const draftError = draft && draft.text.trim() && !parseColour(draft.text) ? "Cannot read that as a colour" : null;

  const handleType = (format: string, text: string) => {
    setDraft({ format, text });
    const typed = parseColour(text);
    if (!typed) return;
    if (format === BACKGROUND_FIELD.id) setBackground(typed);
    else setColour(typed);
  };

  const handleColour = (picked: Rgba) => {
    setColour(picked);
    setDraft(null);
  };

  const handlePick = (value: string) => {
    const picked = parseColour(value);
    if (picked) handleColour(picked);
  };

  const handleSwap = () => {
    setColour(background);
    setBackground(colour);
    setDraft(null);
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="colour">Colour</UtilityTitle>

      {interference && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertTriangle size="1rem" />}
          title="Something is changing the colours on this page"
          data-interference={interference.id}
        >
          {interference.message}
        </Alert>
      )}

      <Card withBorder shadow="sm" radius="md">
        <Group align="stretch" gap="lg" wrap="wrap">
          <ColorPicker
            format="rgba"
            value={writeRgba(colour)}
            onChange={handlePick}
            swatches={SWATCHES}
            size="lg"
            saturationLabel="Saturation and brightness"
            hueLabel="Hue"
            alphaLabel="Opacity"
          />
          <ColorSwatch
            color={writeRgba(colour)}
            radius="md"
            withShadow={false}
            aria-label="Selected colour"
            style={{ flex: "1 1 12rem", width: "auto", height: "auto", minHeight: "6rem" }}
          />
        </Group>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="md">
          {FORMAT_ROWS.map((row) => {
            const rowError = row.some((spec) => spec.id === draft?.format) ? draftError : null;
            return (
              <Box
                key={row.map((spec) => spec.id).join()}
                className={rowError ? "settings-row has-error" : "settings-row"}
                mb={rowError ? "md" : 0}
              >
                {row.map((spec) => (
                  <FormatField
                    key={spec.id}
                    spec={spec}
                    colour={colour}
                    draft={draft?.format === spec.id ? draft.text : null}
                    error={draft?.format === spec.id ? draftError : null}
                    onType={handleType}
                    onLeave={() => setDraft(null)}
                  />
                ))}
              </Box>
            );
          })}
        </Stack>
      </Card>

      <ContrastCard
        colour={colour}
        background={background}
        draft={draft?.format === BACKGROUND_FIELD.id ? draft.text : null}
        error={draft?.format === BACKGROUND_FIELD.id ? draftError : null}
        onType={handleType}
        onLeave={() => setDraft(null)}
        onSwap={handleSwap}
        previewRef={preview}
      />

      <PaletteCard colour={colour} onPick={handleColour} />

      <VisionCard colour={colour} background={background} />
    </Stack>
  );
}

function ContrastCard({ colour, background, draft, error, onType, onLeave, onSwap, previewRef }: ContrastCardProps) {
  const ratio = contrastRatio(colour, background);
  const elsewhere = BACKDROPS.map(({ label, colour: under }) => `${label} ${writeRatio(contrastRatio(colour, under))}`);

  return (
    <Card withBorder shadow="sm" radius="md" data-contrast={writeRatio(ratio)}>
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={4}>Contrast</Title>
          <Tooltip label="Swap the two" withArrow position="left">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onSwap}
              aria-label="Swap the colour and the background"
            >
              <IconArrowsExchange size="1.2rem" />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
          <FormatField
            spec={BACKGROUND_FIELD}
            colour={background}
            draft={draft}
            error={error}
            onType={onType}
            onLeave={onLeave}
          />
        </Box>

        <Box
          ref={previewRef}
          className="contrast-preview"
          style={{ background: writeRgba(opaque(background)), color: writeRgba(colour) }}
        >
          <Box className="contrast-ratio">{writeRatio(ratio)}</Box>
          <Box className="contrast-large">Large text, 24 pixels</Box>
          <Box className="contrast-body">Body text at the size most of a page is set in.</Box>
        </Box>

        <Group gap="xs" wrap="wrap">
          {CONTRAST_LEVELS.map((level) => {
            const passes = ratio >= level.ratio;
            return (
              <Tooltip key={level.id} label={`WCAG 2.2 success criterion ${level.note}`} withArrow>
                <Badge
                  data-level={level.id}
                  data-passes={passes}
                  color={passes ? "teal" : "red"}
                  variant="light"
                  leftSection={passes ? <IconCheck size="0.75rem" /> : <IconX size="0.75rem" />}
                >
                  {level.label} {level.ratio}
                </Badge>
              </Tooltip>
            );
          })}
        </Group>

        <Text size="sm" c="dimmed">
          {grade(ratio)}. On {elsewhere.join(", ")}.
        </Text>
      </Stack>
    </Card>
  );
}

function PaletteCard({ colour, onPick }: { colour: Rgba; onPick: (colour: Rgba) => void }) {
  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="md">
        <Title order={4}>Palette</Title>
        <SwatchRow id="tones" label="Tints and shades" swatches={tones(colour)} onPick={onPick} />
        {HARMONIES.map((arrangement) => (
          <SwatchRow
            key={arrangement.id}
            id={arrangement.id}
            label={arrangement.label}
            swatches={harmony(colour, arrangement.angles)}
            onPick={onPick}
          />
        ))}
      </Stack>
    </Card>
  );
}

function SwatchRow({ id, label, swatches, onPick }: SwatchRowProps) {
  return (
    <Box data-palette={id}>
      <Text size="sm" c="dimmed" mb={6}>{label}</Text>
      <Box className="colour-swatches">
        {swatches.map((swatch, index) => {
          const hex = writeHex(swatch.colour);
          return (
            <UnstyledButton
              key={`${hex}-${index}`}
              className="colour-swatch"
              data-base={swatch.base || undefined}
              onClick={() => onPick(swatch.colour)}
              aria-label={`Take ${hex} as the colour`}
            >
              <ColorSwatch
                color={writeRgba(swatch.colour)}
                radius="sm"
                withShadow={false}
                style={{ width: "100%", height: "2.25rem" }}
              />
              <Text size="xs" ff="monospace">{hex}</Text>
            </UnstyledButton>
          );
        })}
      </Box>
    </Box>
  );
}

function VisionCard({ colour, background }: { colour: Rgba; background: Rgba }) {
  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="md">
        <Title order={4}>Colour vision</Title>
        <Box className="colour-visions">
          {VISIONS.map((vision) => {
            const seen = simulate(colour, vision.matrix);
            const behind = simulate(opaque(background), vision.matrix);
            return (
              <Box key={vision.id} data-vision={vision.id}>
                <Box className="colour-vision-chip" style={{ background: writeRgba(behind) }}>
                  <Box className="colour-vision-mark" style={{ background: writeRgba(seen) }} />
                </Box>
                <Text size="sm" fw={500} mt={8}>{vision.label}</Text>
                <Text size="xs" c="dimmed">{vision.note}</Text>
                <Text size="xs" ff="monospace" mt={4}>{writeHex(seen)}</Text>
              </Box>
            );
          })}
        </Box>
      </Stack>
    </Card>
  );
}

function FormatField({ spec, colour, draft, error, onType, onLeave }: FormatFieldProps) {
  const written = spec.write(colour);

  return (
    <TextInput
      label={spec.label}
      value={draft ?? written}
      placeholder={spec.placeholder?.(colour)}
      onChange={(event) => onType(spec.id, event.currentTarget.value)}
      onBlur={onLeave}
      error={error}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      classNames={{ root: "relative-root", error: "absolute-error" }}
      styles={{ input: { fontFamily: "monospace" } }}
      leftSection={spec.id === BACKGROUND_FIELD.id
        ? <ColorSwatch color={writeRgba(colour)} size={18} radius="sm" withShadow={false} />
        : undefined}
      rightSectionPointerEvents="all"
      rightSection={
        <CopyButton value={written} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={copy}
                disabled={!written}
                aria-label={`Copy the ${spec.label} value`}
              >
                {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      }
    />
  );
}

interface FormatFieldProps {
  spec: FormatSpec;
  colour: Rgba;
  draft: string | null;
  error: string | null;
  onType: (format: string, text: string) => void;
  onLeave: () => void;
}

interface ContrastCardProps extends Omit<FormatFieldProps, "spec" | "colour"> {
  colour: Rgba;
  background: Rgba;
  onSwap: () => void;
  previewRef: RefObject<HTMLDivElement | null>;
}

interface SwatchRowProps {
  id: string;
  label: string;
  swatches: Swatch[];
  onPick: (colour: Rgba) => void;
}
