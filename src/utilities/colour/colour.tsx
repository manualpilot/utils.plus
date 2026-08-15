import { ActionIcon, Box, Card, ColorPicker, ColorSwatch, CopyButton, Group, Stack, TextInput, Tooltip } from "@mantine/core";
import { useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy } from "../../icons";
import { DEFAULT_COLOUR, FORMAT_ROWS, type FormatSpec, SWATCHES } from "./formats";
import { parseColour } from "./parse";
import type { Rgba } from "./rgba";
import { writeHex, writeRgba } from "./write";

export default function Colour() {
  const initialState = useInitialHashState<{ colour?: string }>();

  const [colour, setColour] = useState<Rgba>(() => parseColour(initialState?.colour ?? "") ?? DEFAULT_COLOUR);
  const [draft, setDraft] = useState<{ format: string; text: string } | null>(null);

  useRegisterShareState(() => ({ colour: writeHex(colour) }));

  const draftError = draft && draft.text.trim() && !parseColour(draft.text) ? "Cannot read that as a colour" : null;

  const handleType = (format: string, text: string) => {
    setDraft({ format, text });
    const typed = parseColour(text);
    if (typed) setColour(typed);
  };

  const handlePick = (value: string) => {
    const picked = parseColour(value);
    if (!picked) return;
    setColour(picked);
    setDraft(null);
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="colour">Colour</UtilityTitle>

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
    </Stack>
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
