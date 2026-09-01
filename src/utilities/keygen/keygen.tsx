import { ActionIcon, Box, Button, Card, Checkbox, CopyButton, Group, NumberInput, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { randomBytes } from "@noble/hashes/utils.js";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EMAIL_PATTERN } from "../../common/email";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../../icons";
import { identityProblem } from "./age";
import { AGE_OUTPUT_OPTIONS, algorithmData, ALGORITHMS, algorithmSpec, DEFAULT_SECRET_BYTES, FORMAT_OPTIONS, KEY_ID_OPTIONS, KIND_LABELS, KIND_OPTIONS, MAX_JWK_KEYS, MAX_SECRET_BYTES, pickAgeOutput, pickAlgorithm, pickFormat, pickKeyIdSource, pickKind, pickPostQuantum, pickText, pickVariant } from "./algorithms";
import { formatSecret } from "./encoding";
import { generateJwkSet } from "./jwk";
import { generatePgpKey, generateSshKey } from "./keys";
import { ageRecipientsResult, ageResult, jwkResult, naclResult, pairResult, wireguardResult } from "./results";
import type { Generated, Output } from "./types";
import { clampWhole, message, parseWhole } from "./validate";
import { parseWireguardKey } from "./wireguard";

export default function Keygen() {
  const initialState = useInitialHashState<{
    kind?: string;
    algorithm?: string;
    variant?: string;
    comment?: string;
    name?: string;
    email?: string;
    keyId?: string;
    count?: number;
    size?: number;
    format?: string;
    output?: string;
    postQuantum?: boolean;
  }>();

  const initialKind = pickKind(initialState?.kind);
  const initialAlgorithm = pickAlgorithm(initialKind, initialState?.algorithm);

  const [kind, setKind] = useState(initialKind);
  const [algorithm, setAlgorithm] = useState(initialAlgorithm);
  const [variant, setVariant] = useState(() => pickVariant(initialKind, initialAlgorithm, initialState?.variant));
  const [comment, setComment] = useState(() => pickText(initialState?.comment, ""));
  const [name, setName] = useState(() => pickText(initialState?.name, ""));
  const [email, setEmail] = useState(() => pickText(initialState?.email, ""));
  const [passphrase, setPassphrase] = useState("");
  const [serverKey, setServerKey] = useState("");
  const [keyIdSource, setKeyIdSource] = useState(() => pickKeyIdSource(initialState?.keyId));
  const [count, setCount] = useState<number | string>(() => clampWhole(initialState?.count, 1, MAX_JWK_KEYS));
  const [size, setSize] = useState<number | string>(() =>
    clampWhole(initialState?.size, DEFAULT_SECRET_BYTES, MAX_SECRET_BYTES)
  );
  const [format, setFormat] = useState(() => pickFormat(initialState?.format));
  const [ageOutput, setAgeOutput] = useState(() => pickAgeOutput(initialState?.output));
  const [postQuantum, setPostQuantum] = useState(() => pickPostQuantum(initialState?.postQuantum));
  const [identityFile, setIdentityFile] = useState("");
  const [secret, setSecret] = useState("");
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [running, setRunning] = useState(false);
  const [asked, setAsked] = useState(false);
  const runIdRef = useRef(0);

  const converting = kind === "age" && ageOutput === "recipients";

  const algorithms = ALGORITHMS[kind];
  const algorithmOptions = useMemo(() => algorithmData(algorithms), [algorithms]);
  const spec = algorithmSpec(kind, algorithm);

  useRegisterShareState(() => ({
    kind,
    algorithm: algorithms.length > 0 ? algorithm : undefined,
    variant: spec?.variants ? variant : undefined,
    comment: kind === "ssh" && comment ? comment : undefined,
    name: kind === "pgp" && name ? name : undefined,
    email: kind === "pgp" && email ? email : undefined,
    keyId: kind === "jwk" ? keyIdSource : undefined,
    count: kind === "jwk" ? count : undefined,
    size: kind === "secret" ? size : undefined,
    format: kind === "secret" || kind === "nacl" ? format : undefined,
    output: kind === "age" ? ageOutput : undefined,
    postQuantum: kind === "age" && !converting ? postQuantum : undefined,
  }));

  const parsedSize = parseWhole(size, MAX_SECRET_BYTES);
  const sizeError = kind === "secret" && parsedSize === null
    ? `Enter a size between 1 and ${MAX_SECRET_BYTES} bytes`
    : null;
  const commentError = /[\r\n]/.test(comment) ? "Enter a single line" : null;
  const missingName = kind === "pgp" && name.trim() === "";
  const nameError = missingName && asked ? "Required" : null;
  const emailError = kind === "pgp" && email !== "" && !EMAIL_PATTERN.test(email) ? "Enter a valid address" : null;
  const serverKeyError = kind === "wireguard" && serverKey.trim() !== "" && parseWireguardKey(serverKey) === null
    ? "Enter a 44-character base64 key"
    : null;
  const parsedCount = parseWhole(count, MAX_JWK_KEYS);
  const countError = kind === "jwk" && parsedCount === null ? `Enter a count of 1 to ${MAX_JWK_KEYS}` : null;
  const missingIdentity = converting && identityFile.trim() === "";
  const identityShapeError = converting ? identityProblem(identityFile) : "";
  const identityError = missingIdentity && asked ? "Required" : identityShapeError || null;
  const settled = kind === "ssh"
    ? !commentError
    : kind === "wireguard"
    ? !serverKeyError
    : kind === "jwk"
    ? !countError
    : kind === "age"
    ? !missingIdentity && !identityShapeError
    : !missingName && !emailError;

  const request = useMemo(() => ({
    kind,
    algorithm,
    variant,
    comment,
    name,
    email,
    passphrase,
    serverKey,
    keyIdSource,
    count,
    format,
    ageOutput,
    postQuantum,
    identityFile,
  }), [
    kind,
    algorithm,
    variant,
    comment,
    name,
    email,
    passphrase,
    serverKey,
    keyIdSource,
    count,
    format,
    ageOutput,
    postQuantum,
    identityFile,
  ]);
  const stale = generated === null || generated.request !== request;
  const result = stale || generated === null ? null : generated.result;
  const error = stale || generated === null ? "" : generated.error;

  const generate = useCallback(async () => {
    setAsked(true);
    if (!settled) return;
    const runId = ++runIdRef.current;
    setRunning(true);
    try {
      const settings = { algorithm, variant, comment, name, email, passphrase };
      const built = kind === "wireguard"
        ? await wireguardResult(serverKey)
        : kind === "nacl"
        ? await naclResult(format)
        : kind === "age"
        ? converting ? await ageRecipientsResult(identityFile) : await ageResult(postQuantum)
        : kind === "jwk"
        ? jwkResult(
          await generateJwkSet({ algorithm, variant, keyId: keyIdSource, count: parsedCount ?? 1 }),
        )
        : pairResult(kind, kind === "pgp" ? await generatePgpKey(settings) : await generateSshKey(settings));
      if (runIdRef.current === runId) setGenerated({ request, result: built, error: "" });
    } catch (e) {
      if (runIdRef.current === runId) setGenerated({ request, result: null, error: message(e) });
    } finally {
      if (runIdRef.current === runId) setRunning(false);
    }
  }, [
    settled,
    kind,
    algorithm,
    variant,
    comment,
    name,
    email,
    passphrase,
    serverKey,
    keyIdSource,
    parsedCount,
    format,
    converting,
    postQuantum,
    identityFile,
    request,
  ]);

  const regenerateSecret = useCallback(() => {
    setSecret(parsedSize === null ? "" : formatSecret(randomBytes(parsedSize), format));
  }, [parsedSize, format]);

  useLayoutEffect(() => {
    if (kind === "secret") regenerateSecret();
  }, [kind, regenerateSecret]);

  const outputs = kind === "secret"
    ? secret === "" ? [] : [{ label: "Secret", value: secret, rows: 2 }]
    : result?.outputs ?? [];
  const heading = kind === "jwk" && parsedCount !== 1
    ? "JSON Web Key Set"
    : converting
    ? "age recipients file"
    : KIND_LABELS[kind];

  const handleKindChange = (value: string | null) => {
    if (value === null || !(value in ALGORITHMS)) return;
    const next = pickAlgorithm(value, null);
    setKind(value);
    setAlgorithm(next);
    setVariant(pickVariant(value, next, null));
    setAsked(false);
  };

  const handleAgeOutputChange = (value: string | null) => {
    if (value === null) return;
    setAgeOutput(value);
    setAsked(false);
  };

  const handleAlgorithmChange = (value: string | null) => {
    if (value === null) return;
    setAlgorithm(value);
    setVariant(pickVariant(kind, value, null));
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="keygen">Keygen</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Box className={sizeError ? "settings-row has-error" : "settings-row"} mb={sizeError ? "md" : 0}>
            <Select
              label="Key kind"
              data={KIND_OPTIONS}
              value={kind}
              onChange={handleKindChange}
              allowDeselect={false}
            />
            {algorithms.length > 0 && (
              <Select
                label="Algorithm"
                data={algorithmOptions}
                value={algorithm}
                onChange={handleAlgorithmChange}
                allowDeselect={false}
              />
            )}
            {kind === "age" && (
              <Select
                label="Output"
                data={AGE_OUTPUT_OPTIONS}
                value={ageOutput}
                onChange={handleAgeOutputChange}
                allowDeselect={false}
              />
            )}
            {spec?.variants && (
              <Select
                label={spec.variantLabel}
                data={spec.variants}
                value={variant}
                onChange={(value) => value && setVariant(value)}
                allowDeselect={false}
              />
            )}
            {kind === "secret" && (
              <NumberInput
                label="Size"
                description={parsedSize === null ? "In bytes" : `${parsedSize * 8} bits`}
                value={size}
                onChange={setSize}
                min={1}
                max={MAX_SECRET_BYTES}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={sizeError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            )}
            {(kind === "secret" || kind === "nacl") && (
              <Select
                label="Encoding"
                data={FORMAT_OPTIONS}
                value={format}
                onChange={(value) => value && setFormat(value)}
                allowDeselect={false}
              />
            )}
          </Box>

          {kind === "age" && !converting && (
            <Checkbox
              label="Post-quantum"
              description="An ML-KEM-768 hybrid, whose recipient runs to two kilobytes against X25519's 62 characters"
              checked={postQuantum}
              onChange={(event) => setPostQuantum(event.currentTarget.checked)}
            />
          )}

          {converting && (
            <Box className={identityError ? "settings-row has-error" : "settings-row"} mb={identityError ? "md" : 0}>
              <Textarea
                label="Identity file"
                description="Read in this tab and never sent anywhere — the file age-keygen wrote goes in whole"
                placeholder="AGE-SECRET-KEY-1…"
                value={identityFile}
                onChange={(event) =>
                  setIdentityFile(event.currentTarget.value)}
                error={identityError}
                autosize
                minRows={3}
                maxRows={10}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            </Box>
          )}

          {kind === "ssh" && (
            <Box className={commentError ? "settings-row has-error" : "settings-row"} mb={commentError ? "md" : 0}>
              <TextInput
                label="Comment"
                description="Trails the public key, to say whose it is"
                placeholder="you@example.com"
                value={comment}
                onChange={(event) =>
                  setComment(event.currentTarget.value)}
                error={commentError}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <TextInput
                label="Passphrase"
                description="Left unencrypted when blank"
                value={passphrase}
                onChange={(event) =>
                  setPassphrase(event.currentTarget.value)}
                spellCheck={false}
              />
            </Box>
          )}

          {kind === "wireguard" && (
            <Box className={serverKeyError ? "settings-row has-error" : "settings-row"} mb={serverKeyError ? "md" : 0}>
              <TextInput
                label="Server private key"
                description="Generated alongside the client's when blank"
                value={serverKey}
                onChange={(event) =>
                  setServerKey(event.currentTarget.value)}
                error={serverKeyError}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            </Box>
          )}

          {kind === "jwk" && (
            <Box className={countError ? "settings-row has-error" : "settings-row"} mb={countError ? "md" : 0}>
              <Select
                label="Key ID"
                description="What the kid member is written from"
                data={KEY_ID_OPTIONS}
                value={keyIdSource}
                onChange={(value) =>
                  value && setKeyIdSource(value)}
                allowDeselect={false}
              />
              <NumberInput
                label="Count"
                description={parsedCount === 1 ? "Written on its own" : "Written as a JWK Set"}
                value={count}
                onChange={setCount}
                min={1}
                max={MAX_JWK_KEYS}
                allowDecimal={false}
                allowNegative={false}
                error={countError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {kind === "pgp" && (
            <Box
              className={nameError || emailError ? "settings-row has-error" : "settings-row"}
              mb={nameError || emailError ? "md" : 0}
            >
              <TextInput
                label="Name"
                description="The user ID the key is issued to"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                error={nameError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <TextInput
                label="Email"
                description="Left off the user ID when blank"
                placeholder="ada@example.com"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                error={emailError}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
              <TextInput
                label="Passphrase"
                description="Left unencrypted when blank"
                value={passphrase}
                onChange={(event) => setPassphrase(event.currentTarget.value)}
                spellCheck={false}
              />
            </Box>
          )}

          {kind !== "secret" && (
            <Group justify="flex-end" wrap="nowrap">
              <Text size="sm" c={error ? "red" : "dimmed"} flex={1}>
                {error}
              </Text>
              <Button onClick={generate} loading={running}>
                {converting ? "Convert" : "Generate"}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      {outputs.length > 0 && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="sm" align="baseline">
                <Title order={4}>{heading}</Title>
                {result?.fingerprint && (
                  <Text size="sm" c="dimmed" ff="monospace" style={{ wordBreak: "break-all" }}>
                    {result.fingerprint}
                  </Text>
                )}
              </Group>
              {kind === "secret" && (
                <Tooltip label="Regenerate" withArrow position="left">
                  <ActionIcon
                    color="gray"
                    variant="subtle"
                    onClick={regenerateSecret}
                    aria-label="Regenerate secret"
                  >
                    <IconRefresh size="1.2rem" />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            {outputs.map((output) => <KeyOutput key={output.label} {...output} />)}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function KeyOutput({ label, value, rows }: Output) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>{label}</Text>
        <CopyButton value={value} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={copy}
                aria-label={`Copy ${label.toLowerCase()}`}
              >
                {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Textarea
        value={value}
        aria-label={label}
        readOnly
        autosize
        minRows={rows}
        maxRows={12}
        spellCheck={false}
        styles={{ input: { fontFamily: "monospace" } }}
      />
    </Stack>
  );
}
