import { ActionIcon, Box, Card, CopyButton, Group, Input, SegmentedControl, Select, Stack, Text, Textarea, Title, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconArrowsUpDown, IconCheck, IconCopy, IconX } from "../../icons";
import { convert } from "./convert";
import { defaultVariant, type Format, FORMATS, isFormat, type Mode, VARIANT_HINTS, VARIANTS } from "./formats";

export default function Codec() {
  const initialState = useInitialHashState<{
    mode?: string;
    format?: string;
    variant?: string;
    input?: string;
  }>();

  const initialFormat: Format = isFormat(initialState?.format) ? initialState.format : "base64";
  const sharedVariant = initialState?.variant;

  const [mode, setMode] = useState<Mode>(
    initialState?.mode === "decode" ? "decode" : "encode",
  );
  const [format, setFormat] = useState<Format>(initialFormat);
  const [variant, setVariant] = useState<string>(
    sharedVariant !== undefined && VARIANTS[initialFormat].some((item) => item.value === sharedVariant)
      ? sharedVariant
      : defaultVariant(initialFormat),
  );
  const [input, setInput] = useState(initialState?.input ?? "");

  useRegisterShareState(() => ({ mode, format, variant, input: input || undefined }));

  const { output, error, byteLength } = useMemo(
    () => convert(input, mode, format, variant),
    [input, mode, format, variant],
  );

  const formatLabel = FORMATS.find((f) => f.value === format)?.label ?? format;
  const inputLabel = mode === "encode" ? "Plain text" : formatLabel;
  const outputLabel = mode === "encode" ? formatLabel : "Plain text";
  const canSwap = output !== "" && error === "";

  const handleFormatChange = (value: string | null) => {
    if (!isFormat(value)) return;
    setFormat(value);
    setVariant(defaultVariant(value));
  };

  const handleSwap = () => {
    if (!canSwap) return;
    setInput(output);
    setMode(mode === "encode" ? "decode" : "encode");
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="codec">Codec</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box className="settings-row">
          <Input.Wrapper label="Direction">
            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(value) => setMode(value as Mode)}
              data={[
                { value: "encode", label: "Encode" },
                { value: "decode", label: "Decode" },
              ]}
            />
          </Input.Wrapper>
          <Select
            label="Format"
            data={FORMATS}
            value={format}
            onChange={handleFormatChange}
            allowDeselect={false}
          />
          <Select
            label="Variant"
            description={VARIANT_HINTS[format]}
            data={VARIANTS[format]}
            value={variant}
            onChange={(value) => value && setVariant(value)}
            allowDeselect={false}
          />
        </Box>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>{inputLabel}</Title>
            <Tooltip label="Clear" withArrow position="left">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setInput("")}
                disabled={input === ""}
                aria-label="Clear input"
              >
                <IconX size="1.2rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder={mode === "encode" ? "Text to encode" : `${formatLabel} to decode`}
            autosize
            minRows={5}
            maxRows={12}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>

      <Group justify="center">
        <Tooltip label="Swap input and output" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={handleSwap}
            disabled={!canSwap}
            aria-label="Swap input and output"
          >
            <IconArrowsUpDown size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="sm" align="baseline">
              <Title order={4}>{outputLabel}</Title>
              {!error && byteLength > 0 && (
                <Text size="sm" c="dimmed">
                  {byteLength} {byteLength === 1 ? "byte" : "bytes"}
                </Text>
              )}
            </Group>
            <CopyButton value={output} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                  <ActionIcon
                    color={copied ? "teal" : "gray"}
                    variant="subtle"
                    onClick={copy}
                    disabled={output === ""}
                    aria-label="Copy output"
                  >
                    {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Textarea
            value={output}
            readOnly
            error={error || undefined}
            autosize
            minRows={5}
            maxRows={12}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>
    </Stack>
  );
}
