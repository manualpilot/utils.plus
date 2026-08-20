import { ActionIcon, Box, Button, Card, CopyButton, Group, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconPlus, IconTrash } from "../../icons";
import { readUrl } from "./parse";
import { DEFAULT_URL, type Pair, PART_ROWS, type PartKey, type PartSpec, partText, QUERY_PART, type UrlParts } from "./parts";
import { editPair, newPair, withPairs, withPart, writeUrl } from "./write";

export default function Url() {
  const initialState = useInitialHashState<{ url?: string }>();
  const [url, setUrl] = useState(() => typeof initialState?.url === "string" ? initialState.url : DEFAULT_URL);

  useRegisterShareState(() => ({ url }));

  const { parts, pairs, partErrors } = useMemo(() => readUrl(url), [url]);

  const setPart = (key: PartKey, value: string) => setUrl(writeUrl(withPart(parts, key, value)));
  const setPairs = (next: Pair[]) => setUrl(writeUrl(withPairs(parts, next)));
  const patchPair = (index: number, patch: { name?: string; value?: string }) =>
    setPairs(pairs.map((pair, at) => at === index ? editPair(pair, patch) : pair));

  return (
    <Stack gap="md">
      <UtilityTitle directory="url">URL</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>Address</Title>
            <CopyButton value={url} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                  <ActionIcon
                    color={copied ? "teal" : "gray"}
                    variant="subtle"
                    onClick={copy}
                    disabled={url === ""}
                    aria-label="Copy URL"
                  >
                    {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Textarea
            aria-label="URL"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://example.com/path?a=1#top"
            autosize
            minRows={2}
            maxRows={6}
            spellCheck={false}
            autoCapitalize="off"
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Title order={4}>Components</Title>
          {PART_ROWS.map((row) => {
            const rowError = row.some((spec) => partErrors[spec.key]);
            return (
              <Box
                key={row.map((spec) => spec.key).join()}
                className={rowError ? "settings-row has-error" : "settings-row"}
                mb={rowError ? "md" : 0}
              >
                {row.map((spec) => (
                  <PartField
                    key={spec.key}
                    spec={spec}
                    parts={parts}
                    error={partErrors[spec.key]}
                    onChange={setPart}
                  />
                ))}
              </Box>
            );
          })}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Group justify="space-between">
            <Title order={4}>Query parameters</Title>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size="0.9rem" />}
              onClick={() => setPairs([...pairs, newPair()])}
            >
              Add parameter
            </Button>
          </Group>

          <Box className="settings-row">
            <PartField spec={QUERY_PART} parts={parts} error={partErrors.query} onChange={setPart} />
          </Box>

          {pairs.length === 0
            ? <Text size="sm" c="dimmed">This address carries no query</Text>
            : pairs.map((pair, index) => (
              <PairRow
                key={index}
                pair={pair}
                index={index}
                onChange={patchPair}
                onRemove={() => setPairs(pairs.filter((_, at) => at !== index))}
              />
            ))}
        </Stack>
      </Card>
    </Stack>
  );
}

function PartField({ spec, parts, error, onChange }: PartFieldProps) {
  return (
    <TextInput
      label={spec.label}
      description={spec.hint}
      placeholder={spec.placeholder}
      value={partText(parts, spec.key)}
      onChange={(event) => onChange(spec.key, event.currentTarget.value)}
      error={error}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      classNames={{ root: "relative-root", error: "absolute-error" }}
      styles={{ input: { fontFamily: "monospace" } }}
    />
  );
}

function PairRow({ pair, index, onChange, onRemove }: PairRowProps) {
  const rowError = pair.nameError ?? pair.valueError;

  return (
    <Box className={rowError ? "settings-row has-error" : "settings-row"} mb={rowError ? "md" : 0}>
      <TextInput
        label={index === 0 ? "Name" : undefined}
        aria-label={`Parameter ${index + 1} name`}
        value={pair.name}
        onChange={(event) => onChange(index, { name: event.currentTarget.value })}
        error={pair.nameError}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        classNames={{ root: "relative-root", error: "absolute-error" }}
        styles={{ input: { fontFamily: "monospace" } }}
      />
      <TextInput
        label={index === 0 ? "Value" : undefined}
        aria-label={`Parameter ${index + 1} value`}
        placeholder={pair.bare ? "No value" : undefined}
        value={pair.value}
        onChange={(event) => onChange(index, { value: event.currentTarget.value })}
        error={pair.valueError}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        classNames={{ root: "relative-root", error: "absolute-error" }}
        styles={{ input: { fontFamily: "monospace" } }}
        rightSectionPointerEvents="all"
        rightSection={
          <Tooltip label="Remove" withArrow position="left">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onRemove}
              aria-label={`Remove parameter ${index + 1}`}
            >
              <IconTrash size="1.1rem" />
            </ActionIcon>
          </Tooltip>
        }
      />
    </Box>
  );
}

interface PartFieldProps {
  spec: PartSpec;
  parts: UrlParts;
  error: string | null;
  onChange: (key: PartKey, value: string) => void;
}

interface PairRowProps {
  pair: Pair;
  index: number;
  onChange: (index: number, patch: { name?: string; value?: string }) => void;
  onRemove: () => void;
}
