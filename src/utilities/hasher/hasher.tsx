import { ActionIcon, Box, Button, Card, CopyButton, FileInput, Group, NumberInput, Progress, SegmentedControl, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { byteSize } from "../../common/byte-size";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconRefresh, IconX } from "../../icons";
import { ALGORITHM_OPTIONS, ALGORITHMS, ARGON2_ITERATIONS, ARGON2_MEMORY, BCRYPT_COST, BCRYPT_MAX_BYTES, type Derived, EMPTY_OUTPUT, FORMAT_OPTIONS, type KdfSettings, MAX_SEED, PARALLELISM, type Params, PBKDF2_ITERATIONS, SCRYPT_BLOCK, SCRYPT_COST, sharedParams } from "./algorithms";
import { formatDigest, hashBytes, streams } from "./digest";
import { hashBlob, type Source, SOURCE_OPTIONS } from "./file";
import { deriveKdf } from "./kdf";
import { defaultParams, initialParams, memoryProblem, message, parseInteger, pickAlgorithm, pickFormat, pickVariant, randomSalt, range, saltProblem, scryptMemoryProblem } from "./settings";

export default function Hasher() {
  const initialState = useInitialHashState<{
    algorithm?: string;
    variant?: string;
    format?: string;
    input?: string;
    seed?: number;
    salt?: string;
    memory?: number;
    iterations?: number;
    parallelism?: number;
    cost?: number;
    blockSize?: number;
  }>();

  const initialAlgorithm = pickAlgorithm(initialState?.algorithm);

  const [algorithm, setAlgorithm] = useState(initialAlgorithm);
  const [variant, setVariant] = useState(() => pickVariant(initialAlgorithm, initialState?.variant));
  const [format, setFormat] = useState(() => pickFormat(initialAlgorithm, initialState?.format));
  const [params, setParams] = useState(() => initialParams(initialAlgorithm, initialState));
  const [input, setInput] = useState(typeof initialState?.input === "string" ? initialState.input : "");
  const [source, setSource] = useState<Source>("text");
  const [file, setFile] = useState<File | null>(null);
  const [fileDigest, setFileDigest] = useState<Uint8Array | null>(null);
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [derived, setDerived] = useState<Derived | null>(null);
  const [running, setRunning] = useState(false);
  const runIdRef = useRef(0);

  const spec = ALGORITHMS[algorithm];

  useRegisterShareState(() => ({
    algorithm,
    variant: spec.variants.length > 1 ? variant : undefined,
    format: spec.formats ? format : undefined,
    input: source === "text" ? input || undefined : undefined,
    ...sharedParams(spec, params),
  }));

  const seed = parseInteger(params.seed, 0, MAX_SEED);
  const memory = parseInteger(params.memory, ARGON2_MEMORY.min, ARGON2_MEMORY.max);
  const iterationsRange = algorithm === "pbkdf2" ? PBKDF2_ITERATIONS : ARGON2_ITERATIONS;
  const iterations = parseInteger(params.iterations, iterationsRange.min, iterationsRange.max);
  const parallelism = parseInteger(params.parallelism, PARALLELISM.min, PARALLELISM.max);
  const costRange = algorithm === "bcrypt" ? BCRYPT_COST : SCRYPT_COST;
  const cost = parseInteger(params.cost, costRange.min, costRange.max);
  const blockSize = parseInteger(params.blockSize, SCRYPT_BLOCK.min, SCRYPT_BLOCK.max);

  const seedError = seed === null ? range(0, MAX_SEED) : null;
  const saltError = spec.kdf ? saltProblem(algorithm, params.salt) : null;
  const memoryError = memoryProblem(memory, parallelism);
  const iterationsError = iterations === null ? range(iterationsRange.min, iterationsRange.max) : null;
  const parallelismError = parallelism === null ? range(PARALLELISM.min, PARALLELISM.max) : null;
  const costError = cost === null
    ? range(costRange.min, costRange.max)
    : algorithm === "scrypt"
    ? scryptMemoryProblem(cost, blockSize, parallelism)
    : null;
  const blockSizeError = blockSize === null ? range(SCRYPT_BLOCK.min, SCRYPT_BLOCK.max) : null;

  const settled = !saltError && !memoryError && !iterationsError && !parallelismError && !costError && !blockSizeError;
  const settings: KdfSettings | null =
    settled && memory !== null && iterations !== null && parallelism !== null && cost !== null && blockSize !== null
      ? { salt: params.salt, memory, iterations, parallelism, cost, blockSize }
      : null;

  const request = useMemo(() => ({ variant, input, params }), [variant, input, params]);
  const stale = derived === null || derived.request !== request;

  const compute = useCallback(async () => {
    if (!settings) return;
    const runId = ++runIdRef.current;
    setRunning(true);
    try {
      const result = await deriveKdf(variant, input, settings);
      if (runIdRef.current === runId) setDerived({ request, result, error: "" });
    } catch (e) {
      if (runIdRef.current === runId) setDerived({ request, result: null, error: message(e) });
    } finally {
      if (runIdRef.current === runId) setRunning(false);
    }
  }, [variant, input, settings, request]);

  useEffect(() => {
    if (source !== "file" || file === null) {
      setFileDigest(null);
      setFileError("");
      setProgress(0);
      setRunning(false);
      return;
    }
    const runId = ++runIdRef.current;
    const live = () => runIdRef.current === runId;
    setFileDigest(null);
    setFileError("");
    setProgress(0);
    setRunning(true);
    hashBlob(file, variant, seed ?? 0, (percent) => {
      if (live()) setProgress(percent);
    }, live)
      .then((digest) => {
        if (live() && digest) setFileDigest(digest);
      })
      .catch((e: unknown) => {
        if (live()) setFileError(message(e));
      })
      .finally(() => {
        if (live()) setRunning(false);
      });
    return () => {
      runIdRef.current++;
    };
  }, [source, file, variant, seed]);

  const { output, error, bits } = useMemo(() => {
    if (spec.kdf) {
      if (stale || derived === null) return EMPTY_OUTPUT;
      if (derived.result === null) return { output: "", error: derived.error, bits: 0 };
      const { digest, encoded } = derived.result;
      return { output: encoded, error: "", bits: digest.length * 8 };
    }
    if (source === "file") {
      if (fileError) return { output: "", error: fileError, bits: 0 };
      if (fileDigest === null) return EMPTY_OUTPUT;
      return { output: formatDigest(fileDigest, format), error: "", bits: fileDigest.length * 8 };
    }
    try {
      const digest = hashBytes(variant, new TextEncoder().encode(input), seed ?? 0);
      return { output: formatDigest(digest, format), error: "", bits: digest.length * 8 };
    } catch (e) {
      return { output: "", error: message(e), bits: 0 };
    }
  }, [spec, stale, derived, format, variant, input, seed, source, fileDigest, fileError]);

  const inputBytes = useMemo(() => new TextEncoder().encode(input).length, [input]);
  const size = source === "file" ? file?.size ?? 0 : inputBytes;
  const variants = spec.variants;
  const formats = spec.formats;

  const handleAlgorithmChange = (value: string | null) => {
    if (value === null || !(value in ALGORITHMS)) return;
    setAlgorithm(value);
    if (ALGORITHMS[value].kdf) setSource("text");
    setVariant(ALGORITHMS[value].variants[0].value);
    setFormat(pickFormat(value, null));
    setParams(defaultParams(value));
  };

  const updateParam = <K extends keyof Params>(key: K, value: Params[K]) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="hasher">Hasher</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Box className="settings-row">
            <Select
              label="Algorithm"
              data={ALGORITHM_OPTIONS}
              value={algorithm}
              onChange={handleAlgorithmChange}
              allowDeselect={false}
            />
            {variants.length > 1 && (
              <Select
                label="Variant"
                data={variants}
                value={variant}
                onChange={(value) => value && setVariant(value)}
                allowDeselect={false}
              />
            )}
            {formats && (
              <Select
                label="Output format"
                data={FORMAT_OPTIONS.filter((option) => formats.includes(option.value))}
                value={format}
                onChange={(value) => value && setFormat(value)}
                allowDeselect={false}
              />
            )}
          </Box>

          {spec.seeded && (
            <Box className={seedError ? "settings-row has-error" : "settings-row"} mb={seedError ? "md" : 0}>
              <NumberInput
                label="Seed"
                description="Shifts the whole hash without touching the input"
                value={params.seed}
                onChange={(value) =>
                  updateParam("seed", value)}
                min={0}
                max={MAX_SEED}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) =>
                  Math.max(1000 / t ** 2, 75)}
                error={seedError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {spec.kdf && (
            <Box className={saltError ? "settings-row has-error" : "settings-row"} mb={saltError ? "md" : 0}>
              <TextInput
                label="Salt"
                description={algorithm === "bcrypt"
                  ? "22 characters of bcrypt's own base64"
                  : "Hashed as UTF-8 text, exactly as typed"}
                value={params.salt}
                onChange={(event) => updateParam("salt", event.currentTarget.value)}
                error={saltError}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
                rightSection={
                  <Tooltip label="New random salt" withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => updateParam("salt", randomSalt(algorithm))}
                      aria-label="Generate a new salt"
                    >
                      <IconRefresh size="1.1rem" />
                    </ActionIcon>
                  </Tooltip>
                }
              />
            </Box>
          )}

          {algorithm === "argon2" && (
            <Box
              className={memoryError || iterationsError || parallelismError ? "settings-row has-error" : "settings-row"}
              mb={memoryError || iterationsError || parallelismError ? "md" : 0}
            >
              <NumberInput
                label="Memory"
                description="Kibibytes held while hashing"
                value={params.memory}
                onChange={(value) => updateParam("memory", value)}
                min={ARGON2_MEMORY.min}
                max={ARGON2_MEMORY.max}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={memoryError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <NumberInput
                label="Iterations"
                description="Passes over that memory"
                value={params.iterations}
                onChange={(value) => updateParam("iterations", value)}
                min={ARGON2_ITERATIONS.min}
                max={ARGON2_ITERATIONS.max}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={iterationsError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <NumberInput
                label="Parallelism"
                description="Lanes filled side by side"
                value={params.parallelism}
                onChange={(value) => updateParam("parallelism", value)}
                min={PARALLELISM.min}
                max={PARALLELISM.max}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={parallelismError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {algorithm === "scrypt" && (
            <Box
              className={costError || blockSizeError || parallelismError ? "settings-row has-error" : "settings-row"}
              mb={costError || blockSizeError || parallelismError ? "md" : 0}
            >
              <NumberInput
                label="Cost"
                description="log₂ of N, the work factor"
                value={params.cost}
                onChange={(value) => updateParam("cost", value)}
                min={SCRYPT_COST.min}
                max={SCRYPT_COST.max}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={costError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <NumberInput
                label="Block size"
                description="r, the memory multiplier"
                value={params.blockSize}
                onChange={(value) => updateParam("blockSize", value)}
                min={SCRYPT_BLOCK.min}
                max={SCRYPT_BLOCK.max}
                allowDecimal={false}
                allowNegative={false}
                error={blockSizeError}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <NumberInput
                label="Parallelism"
                description="p, independent mixing runs"
                value={params.parallelism}
                onChange={(value) => updateParam("parallelism", value)}
                min={PARALLELISM.min}
                max={PARALLELISM.max}
                allowDecimal={false}
                allowNegative={false}
                error={parallelismError}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {algorithm === "bcrypt" && (
            <Box className={costError ? "settings-row has-error" : "settings-row"} mb={costError ? "md" : 0}>
              <NumberInput
                label="Cost"
                description="Rounds are doubled for each step up"
                value={params.cost}
                onChange={(value) =>
                  updateParam("cost", value)}
                min={BCRYPT_COST.min}
                max={BCRYPT_COST.max}
                allowDecimal={false}
                allowNegative={false}
                error={costError}
                stepHoldDelay={500}
                stepHoldInterval={(t) =>
                  Math.max(1000 / t ** 2, 75)}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {algorithm === "pbkdf2" && (
            <Box
              className={iterationsError ? "settings-row has-error" : "settings-row"}
              mb={iterationsError ? "md" : 0}
            >
              <NumberInput
                label="Iterations"
                description="Rounds of HMAC, each one fed the last"
                value={params.iterations}
                onChange={(value) => updateParam("iterations", value)}
                min={PBKDF2_ITERATIONS.min}
                max={PBKDF2_ITERATIONS.max}
                allowDecimal={false}
                allowNegative={false}
                thousandSeparator=","
                error={iterationsError}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="sm" align="baseline">
              <Title order={4}>{spec.kdf ? "Password" : "Input"}</Title>
              {size > 0 && <Text size="sm" c="dimmed">{byteSize(size)}</Text>}
            </Group>
            <Group gap="xs">
              {!spec.kdf && (
                <SegmentedControl
                  size="xs"
                  data={SOURCE_OPTIONS}
                  value={source}
                  onChange={(value) => setSource(value as Source)}
                  aria-label="Input source"
                />
              )}
              <Tooltip label="Clear" withArrow position="left">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => source === "file" ? setFile(null) : setInput("")}
                  disabled={source === "file" ? file === null : input === ""}
                  aria-label="Clear input"
                >
                  <IconX size="1.2rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          {source === "file"
            ? (
              <Box
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                }}
                onDrop={handleDrop}
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                  outline: dragging ? "2px dashed var(--mantine-color-blue-5)" : "none",
                  outlineOffset: "4px",
                }}
              >
                <FileInput
                  value={file}
                  onChange={setFile}
                  placeholder="Choose a file, or drop one here"
                  aria-label="File to hash"
                  clearable
                />
              </Box>
            )
            : (
              <Textarea
                value={input}
                onChange={(event) => setInput(event.currentTarget.value)}
                placeholder={spec.kdf ? "Password to hash" : "Text to hash"}
                aria-label={spec.kdf ? "Password" : "Input"}
                autosize
                minRows={4}
                maxRows={12}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            )}
          {source === "file" && running && <Progress value={progress} size="xs" aria-label="Reading the file" />}
          {source === "file" && file !== null && !streams(variant) && (
            <Text size="sm" c="dimmed">
              This one is written as a single pass, so the whole file is held in memory while it runs.
            </Text>
          )}
          {algorithm === "bcrypt" && inputBytes > BCRYPT_MAX_BYTES && (
            <Text size="sm" c="dimmed">
              bcrypt reads the first {BCRYPT_MAX_BYTES} bytes and drops the rest.
            </Text>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="sm" align="baseline">
              <Title order={4}>Digest</Title>
              {bits > 0 && <Text size="sm" c="dimmed">{bits} bits</Text>}
            </Group>
            <Group gap="xs">
              {spec.kdf && (
                <Button size="xs" onClick={compute} loading={running} disabled={!stale || settings === null}>
                  Compute
                </Button>
              )}
              <CopyButton value={output} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      disabled={output === ""}
                      aria-label="Copy digest"
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Group>
          <Textarea
            value={output}
            aria-label="Digest"
            readOnly
            error={error || undefined}
            placeholder={spec.kdf
              ? "Password hashing is deliberately slow — press Compute to run it"
              : source === "file" && file === null
              ? "Choose a file to hash it"
              : ""}
            autosize
            minRows={2}
            maxRows={12}
            spellCheck={false}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>
    </Stack>
  );
}
