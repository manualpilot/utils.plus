import { ActionIcon, Box, Card, CopyButton, Group, Input, NumberInput, Slider, Stack, Text, Textarea, Title, Tooltip } from "@mantine/core";
import { useCallback, useLayoutEffect, useState } from "react";
import { composition } from "../../common/composition";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../../icons";
import { clampLength, clampWeight, generatePassword, MAX_LENGTH, parseLength, WEIGHT_KEYS, type Weights } from "./generate";

export default function Password() {
  const initialState = useInitialHashState<{
    length?: number;
    lowercase?: number;
    uppercase?: number;
    numbers?: number;
    symbols?: number;
  }>();

  const [length, setLength] = useState<number | string>(clampLength(initialState?.length));
  const [weights, setWeights] = useState<Weights>({
    lowercase: clampWeight(initialState?.lowercase, 40),
    uppercase: clampWeight(initialState?.uppercase, 30),
    numbers: clampWeight(initialState?.numbers, 20),
    symbols: clampWeight(initialState?.symbols, 10),
  });
  const [password, setPassword] = useState("");

  useRegisterShareState(() => ({ length, ...weights }));

  const parsedLength = parseLength(length);
  const counts = composition(parsedLength ?? 0, weights);
  const hasShare = WEIGHT_KEYS.some((key) => weights[key] > 0);

  const regenerate = useCallback(() => {
    setPassword(parsedLength === null ? "" : generatePassword(parsedLength, weights));
  }, [parsedLength, weights]);

  useLayoutEffect(regenerate, [regenerate]);

  return (
    <Stack gap="md">
      <UtilityTitle directory="password">Generate Password</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <NumberInput
            label="Length"
            description={`How many characters the password gets, up to ${MAX_LENGTH}`}
            value={length}
            onChange={setLength}
            min={1}
            max={MAX_LENGTH}
            allowDecimal={false}
            allowNegative={false}
            stepHoldDelay={500}
            stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
            error={parsedLength === null ? `Enter a length between 1 and ${MAX_LENGTH}` : null}
            styles={{
              wrapper: {
                width: `calc(5ch + var(--input-padding-inline-start) + var(--input-padding-inline-end)
                    + 0.125rem * var(--mantine-scale))`,
              },
            }}
          />

          <Box className="settings-row">
            <BiasSlider
              label="Lowercase"
              value={weights.lowercase}
              count={counts.lowercase}
              onChange={(value) => setWeights((current) => ({ ...current, lowercase: value }))}
            />
            <BiasSlider
              label="Uppercase"
              value={weights.uppercase}
              count={counts.uppercase}
              onChange={(value) => setWeights((current) => ({ ...current, uppercase: value }))}
            />
          </Box>

          <Box className="settings-row">
            <BiasSlider
              label="Numbers"
              value={weights.numbers}
              count={counts.numbers}
              onChange={(value) => setWeights((current) => ({ ...current, numbers: value }))}
            />
            <BiasSlider
              label="Special characters"
              value={weights.symbols}
              count={counts.symbols}
              onChange={(value) => setWeights((current) => ({ ...current, symbols: value }))}
            />
          </Box>

          {hasShare
            ? (
              <Text size="sm" c="dimmed">
                The shares are relative to each other and are scaled to fill the length, so a mix of 50/50/0/0 and one
                of 100/100/0/0 produce the same password. A type left at 0% is kept out entirely.
              </Text>
            )
            : (
              <Text size="sm" c="red">
                Raise at least one share above 0% to have something to build a password from.
              </Text>
            )}
        </Stack>
      </Card>

      {password && (
        <Card withBorder shadow="sm" radius="md">
          <Stack>
            <Group justify="space-between">
              <Group gap="sm" align="baseline">
                <Title order={4}>Result</Title>
                <Text size="sm" c="dimmed">
                  {password.length} {password.length === 1 ? "character" : "characters"}
                </Text>
              </Group>
              <Group gap="xs">
                <Tooltip label="Regenerate" withArrow position="left">
                  <ActionIcon
                    color="gray"
                    variant="subtle"
                    onClick={regenerate}
                    aria-label="Regenerate password"
                  >
                    <IconRefresh size="1.2rem" />
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={password} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy password"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Textarea
              value={password}
              aria-label="Generated password"
              readOnly
              autosize
              minRows={1}
              maxRows={12}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function BiasSlider(
  { label, value, count, onChange }: {
    label: string;
    value: number;
    count: number;
    onChange: (value: number) => void;
  },
) {
  return (
    <Input.Wrapper label={label} description={`${count} ${count === 1 ? "character" : "characters"}`}>
      <Slider
        value={value}
        onChange={onChange}
        min={0}
        max={100}
        step={1}
        label={(current) => `${current}%`}
        thumbLabel={`${label} share`}
      />
    </Input.Wrapper>
  );
}
