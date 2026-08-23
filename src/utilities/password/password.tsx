import { ActionIcon, Box, Button, Card, CopyButton, Group, Input, Loader, NumberInput, SegmentedControl, Select, Slider, Stack, Text, Textarea, Title, Tooltip } from "@mantine/core";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { composition } from "../../common/composition";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../../icons";
import { CHARACTER_KEYS, type CharacterWeights, clampLength, generatePassword, MAX_LENGTH, parseLength } from "./characters";
import { clampWeight, countWidth, type Mode, MODE_OPTIONS, MODES, pickKey } from "./settings";
import { type Casing, CASING_OPTIONS, CASINGS, clampWords, MAX_WORDS, parseWords, type PassphraseBuilder, type Separator, SEPARATOR_OPTIONS, SEPARATORS, WORD_KEYS, WORD_KINDS, type WordWeights } from "./words";

export default function Password() {
  const initialState = useInitialHashState<{
    mode?: string;
    length?: number;
    lowercase?: number;
    uppercase?: number;
    numbers?: number;
    symbols?: number;
    words?: number;
    nouns?: number;
    verbs?: number;
    adjectives?: number;
    casing?: string;
    separator?: string;
  }>();

  const [mode, setMode] = useState<Mode>(pickKey(MODES, initialState?.mode, "password"));

  const [length, setLength] = useState<number | string>(clampLength(initialState?.length));
  const [characters, setCharacters] = useState<CharacterWeights>({
    lowercase: clampWeight(initialState?.lowercase, 40),
    uppercase: clampWeight(initialState?.uppercase, 30),
    numbers: clampWeight(initialState?.numbers, 20),
    symbols: clampWeight(initialState?.symbols, 10),
  });

  const [words, setWords] = useState<number | string>(clampWords(initialState?.words));
  const [parts, setParts] = useState<WordWeights>({
    nouns: clampWeight(initialState?.nouns, 40),
    verbs: clampWeight(initialState?.verbs, 20),
    adjectives: clampWeight(initialState?.adjectives, 40),
  });
  const [casing, setCasing] = useState<Casing>(pickKey(CASINGS, initialState?.casing, "lower"));
  const [separator, setSeparator] = useState<Separator>(pickKey(SEPARATORS, initialState?.separator, "space"));

  const [secret, setSecret] = useState("");
  const [buildPassphrase, setBuildPassphrase] = useState<PassphraseBuilder | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useRegisterShareState(() => ({
    mode,
    ...(mode === "password" ? characters : parts),
    length: mode === "password" ? length : undefined,
    words: mode === "passphrase" ? words : undefined,
    casing: mode === "passphrase" ? casing : undefined,
    separator: mode === "passphrase" ? separator : undefined,
  }));

  const parsedLength = parseLength(length);
  const characterCounts = composition(parsedLength ?? 0, characters);
  const parsedWords = parseWords(words);
  const wordCounts = composition(parsedWords ?? 0, parts);
  const wordTotal = WORD_KEYS.reduce((sum, key) => sum + wordCounts[key], 0);

  const hasShare = mode === "password"
    ? CHARACTER_KEYS.some((key) => characters[key] > 0)
    : WORD_KEYS.some((key) => parts[key] > 0);
  const waiting = mode === "passphrase" && buildPassphrase === null;

  useEffect(() => {
    if (mode !== "passphrase" || buildPassphrase !== null) return;
    let live = true;
    setFailed(false);

    import("./vocabulary").then(({ generatePassphrase }) => {
      if (live) setBuildPassphrase(() => generatePassphrase);
    }, () => {
      if (live) setFailed(true);
    });

    return () => {
      live = false;
    };
  }, [mode, buildPassphrase, attempt]);

  const regenerate = useCallback(() => {
    if (mode === "password") {
      setSecret(parsedLength === null ? "" : generatePassword(parsedLength, characters));
      return;
    }
    if (buildPassphrase === null || parsedWords === null) {
      setSecret("");
      return;
    }
    setSecret(buildPassphrase(parsedWords, parts, casing, separator));
  }, [mode, parsedLength, characters, buildPassphrase, parsedWords, parts, casing, separator]);

  useLayoutEffect(regenerate, [regenerate]);

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="password"
        control={
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(pickKey(MODES, value, "password"))}
            aria-label="What to generate"
            data={MODE_OPTIONS}
          />
        }
      >
        {MODES[mode].title}
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          {mode === "password"
            ? (
              <>
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
                  styles={{ wrapper: { width: countWidth(MAX_LENGTH) } }}
                />

                <Box className="settings-row">
                  <BiasSlider
                    label="Lowercase"
                    noun="character"
                    value={characters.lowercase}
                    count={characterCounts.lowercase}
                    onChange={(value) => setCharacters((current) => ({ ...current, lowercase: value }))}
                  />
                  <BiasSlider
                    label="Uppercase"
                    noun="character"
                    value={characters.uppercase}
                    count={characterCounts.uppercase}
                    onChange={(value) => setCharacters((current) => ({ ...current, uppercase: value }))}
                  />
                </Box>

                <Box className="settings-row">
                  <BiasSlider
                    label="Numbers"
                    noun="character"
                    value={characters.numbers}
                    count={characterCounts.numbers}
                    onChange={(value) => setCharacters((current) => ({ ...current, numbers: value }))}
                  />
                  <BiasSlider
                    label="Special characters"
                    noun="character"
                    value={characters.symbols}
                    count={characterCounts.symbols}
                    onChange={(value) => setCharacters((current) => ({ ...current, symbols: value }))}
                  />
                </Box>
              </>
            )
            : (
              <>
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
                  styles={{ wrapper: { width: countWidth(MAX_WORDS) } }}
                />

                <Box className="settings-row">
                  {WORD_KEYS.map((key) => (
                    <BiasSlider
                      key={key}
                      label={WORD_KINDS[key]}
                      noun="word"
                      value={parts[key]}
                      count={wordCounts[key]}
                      onChange={(value) => setParts((current) => ({ ...current, [key]: value }))}
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
              </>
            )}

          {hasShare
            ? <Text size="sm" c="dimmed">{MODES[mode].shares}</Text>
            : <Text size="sm" c="red">{MODES[mode].empty}</Text>}
        </Stack>
      </Card>

      {waiting && (
        <Card withBorder shadow="sm" radius="md">
          {failed
            ? (
              <Group gap="sm">
                <Text size="sm" c="red">The word lists could not be fetched.</Text>
                <Button size="compact-sm" variant="default" onClick={() => setAttempt((count) => count + 1)}>
                  Try again
                </Button>
              </Group>
            )
            : (
              <Group gap="sm">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">Fetching the word lists…</Text>
              </Group>
            )}
        </Card>
      )}

      {secret && (
        <Card withBorder shadow="sm" radius="md">
          <Stack>
            <Group justify="space-between">
              <Group gap="sm" align="baseline">
                <Title order={4}>Result</Title>
                <Text size="sm" c="dimmed">
                  {mode === "passphrase" && `${wordTotal} ${wordTotal === 1 ? "word" : "words"}, `}
                  {secret.length} {secret.length === 1 ? "character" : "characters"}
                </Text>
              </Group>
              <Group gap="xs">
                <Tooltip label="Regenerate" withArrow position="left">
                  <ActionIcon
                    color="gray"
                    variant="subtle"
                    onClick={regenerate}
                    aria-label={`Regenerate ${mode}`}
                  >
                    <IconRefresh size="1.2rem" />
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={secret} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label={`Copy ${mode}`}
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Textarea
              value={secret}
              aria-label={`Generated ${mode}`}
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

function BiasSlider({ label, noun, value, count, onChange }: BiasSliderProps) {
  return (
    <Input.Wrapper label={label} description={`${count} ${count === 1 ? noun : `${noun}s`}`}>
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

interface BiasSliderProps {
  label: string;
  noun: "character" | "word";
  value: number;
  count: number;
  onChange: (value: number) => void;
}
