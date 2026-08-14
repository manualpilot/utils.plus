import { ActionIcon, Box, Card, CopyButton, Group, Input, NumberInput, Select, Slider, Stack, Text, Textarea, Title, Tooltip } from "@mantine/core";
import { useCallback, useLayoutEffect, useState } from "react";
import adjectiveList from "../../inline/top_english_adjs_lower_10000.json";
import nounList from "../../inline/top_english_nouns_lower_10000.json";
import verbList from "../../inline/top_english_verbs_lower_10000.json";
import { composition } from "../common/composition";
import { randomBelow, shuffle } from "../common/random";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../icons";

export default function Passphrase() {
  const initialState = useInitialHashState<{
    words?: number;
    nouns?: number;
    verbs?: number;
    adjectives?: number;
    casing?: string;
    separator?: string;
  }>();

  const [words, setWords] = useState<number | string>(clampWords(initialState?.words));
  const [weights, setWeights] = useState<Weights>({
    nouns: clampWeight(initialState?.nouns, 40),
    verbs: clampWeight(initialState?.verbs, 20),
    adjectives: clampWeight(initialState?.adjectives, 40),
  });
  const [casing, setCasing] = useState<Casing>(pickKey(CASINGS, initialState?.casing, "lower"));
  const [separator, setSeparator] = useState<Separator>(pickKey(SEPARATORS, initialState?.separator, "space"));
  const [passphrase, setPassphrase] = useState("");

  useRegisterShareState(() => ({ words, ...weights, casing, separator }));

  const parsedWords = parseWords(words);
  const counts = composition(parsedWords ?? 0, weights);
  const hasShare = WEIGHT_KEYS.some((key) => weights[key] > 0);
  const wordCount = WEIGHT_KEYS.reduce((sum, key) => sum + counts[key], 0);

  const regenerate = useCallback(() => {
    setPassphrase(parsedWords === null ? "" : generatePassphrase(parsedWords, weights, casing, separator));
  }, [parsedWords, weights, casing, separator]);

  useLayoutEffect(regenerate, [regenerate]);

  return (
    <Stack gap="md">
      <UtilityTitle file="passphrase.tsx">Generate Passphrase</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <NumberInput
            label="Words"
            description={`How many words the passphrase gets, up to ${MAX_WORDS}`}
            value={words}
            onChange={setWords}
            min={1}
            max={MAX_WORDS}
            allowDecimal={false}
            allowNegative={false}
            stepHoldDelay={500}
            stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
            error={parsedWords === null ? `Enter a count between 1 and ${MAX_WORDS}` : null}
            styles={{
              wrapper: {
                width: `calc(4ch + var(--input-padding-inline-start) + var(--input-padding-inline-end)
                    + 0.125rem * var(--mantine-scale))`,
              },
            }}
          />

          <Box className="settings-row">
            {WEIGHT_KEYS.map((key) => (
              <BiasSlider
                key={key}
                label={WORDS[key].label}
                value={weights[key]}
                count={counts[key]}
                onChange={(value) => setWeights((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </Box>

          <Box className="settings-row">
            <Select
              label="Casing"
              data={CASING_OPTIONS}
              value={casing}
              onChange={(value) => setCasing(pickKey(CASINGS, value, "lower"))}
              allowDeselect={false}
            />
            <Select
              label="Separator"
              data={SEPARATOR_OPTIONS}
              value={separator}
              onChange={(value) => setSeparator(pickKey(SEPARATORS, value, "space"))}
              allowDeselect={false}
            />
          </Box>

          {hasShare
            ? (
              <Text size="sm" c="dimmed">
                The shares are relative to each other and are scaled to fill the word count, so a mix of 50/50/0 and one
                of 100/100/0 produce the same passphrase. A part of speech left at 0% is kept out entirely.
              </Text>
            )
            : (
              <Text size="sm" c="red">
                Raise at least one share above 0% to have something to build a passphrase from.
              </Text>
            )}
        </Stack>
      </Card>

      {passphrase && (
        <Card withBorder shadow="sm" radius="md">
          <Stack>
            <Group justify="space-between">
              <Group gap="sm" align="baseline">
                <Title order={4}>Result</Title>
                <Text size="sm" c="dimmed">
                  {wordCount} {wordCount === 1 ? "word" : "words"}, {passphrase.length} characters
                </Text>
              </Group>
              <Group gap="xs">
                <Tooltip label="Regenerate" withArrow position="left">
                  <ActionIcon
                    color="gray"
                    variant="subtle"
                    onClick={regenerate}
                    aria-label="Regenerate passphrase"
                  >
                    <IconRefresh size="1.2rem" />
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={passphrase} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy passphrase"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Textarea
              value={passphrase}
              aria-label="Generated passphrase"
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
    <Input.Wrapper label={label} description={`${count} ${count === 1 ? "word" : "words"}`}>
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

export type WeightKey = "nouns" | "verbs" | "adjectives";
export type Weights = Record<WeightKey, number>;
export type Casing = keyof typeof CASINGS;
export type Separator = keyof typeof SEPARATORS;

const WEIGHT_KEYS: WeightKey[] = ["nouns", "verbs", "adjectives"];

const MAX_WORDS = 128;
const DEFAULT_WORDS = 8;

export const WORDS: Record<WeightKey, { label: string; list: string[] }> = {
  nouns: { label: "Nouns", list: usable(nounList) },
  verbs: { label: "Verbs", list: usable(verbList) },
  adjectives: { label: "Adjectives", list: usable(adjectiveList) },
};

function usable(list: string[]): string[] {
  return list.filter((word) => /^[a-z]{3,}$/.test(word));
}

const CASINGS = {
  lower: { label: "lowercase", apply: (word: string) => word },
  upper: { label: "UPPERCASE", apply: (word: string) => word.toUpperCase() },
  capital: { label: "Capitalised", apply: (word: string) => word[0].toUpperCase() + word.slice(1) },
};

const SEPARATORS = {
  space: { label: "Space", character: " " },
  dash: { label: "Dash", character: "-" },
  underscore: { label: "Underscore", character: "_" },
  pipe: { label: "Pipe", character: "|" },
  plus: { label: "Plus", character: "+" },
  backslash: { label: "Backslash", character: "\\" },
  slash: { label: "Forward slash", character: "/" },
};

const CASING_OPTIONS = Object.entries(CASINGS).map(([value, { label }]) => ({ value, label }));
const SEPARATOR_OPTIONS = Object.entries(SEPARATORS).map(([value, { label }]) => ({ value, label }));

export function generatePassphrase(words: number, weights: Weights, casing: Casing, separator: Separator): string {
  const counts = composition(words, weights);
  const picked: string[] = [];

  for (const key of WEIGHT_KEYS) {
    const { list } = WORDS[key];
    for (let i = 0; i < counts[key]; i++) {
      picked.push(CASINGS[casing].apply(list[randomBelow(list.length)]));
    }
  }

  shuffle(picked);
  return picked.join(SEPARATORS[separator].character);
}

function parseWords(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= MAX_WORDS ? rounded : null;
}

function clampWords(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_WORDS;
  return Math.min(MAX_WORDS, Math.max(1, Math.floor(value)));
}

function clampWeight(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function pickKey<T extends object>(options: T, value: unknown, fallback: keyof T): keyof T {
  return typeof value === "string" && value in options ? (value as keyof T) : fallback;
}
