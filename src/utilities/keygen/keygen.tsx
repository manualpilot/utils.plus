import { ActionIcon, Box, Button, Card, CopyButton, Group, NumberInput, PasswordInput, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { randomBytes } from "@noble/hashes/utils.js";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EMAIL_PATTERN } from "../../common/email";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../../icons";
import { algorithmData, ALGORITHMS, algorithmSpec, DEFAULT_DAYS, DEFAULT_SECRET_BYTES, FORMAT_OPTIONS, KEY_ID_OPTIONS, KIND_LABELS, KIND_OPTIONS, MAX_DAYS, MAX_JWK_KEYS, MAX_SECRET_BYTES, pickAlgorithm, pickFormat, pickKeyIdSource, pickKind, pickText, pickVariant } from "./algorithms";
import { generateCertificate, splitAltNames } from "./certificate";
import { formatSecret } from "./encoding";
import { generateJwkSet } from "./jwk";
import { generatePgpKey, generateSshKey } from "./keys";
import { certificateResult, jwkResult, pairResult, wireguardResult } from "./results";
import type { Generated, Output } from "./types";
import { clampWhole, expiryLabel, isHostOrAddress, message, parseWhole } from "./validate";
import { parseWireguardKey } from "./wireguard";

export default function Keygen() {
  const initialState = useInitialHashState<{
    kind?: string;
    algorithm?: string;
    variant?: string;
    comment?: string;
    name?: string;
    email?: string;
    commonName?: string;
    altNames?: string;
    days?: number;
    keyId?: string;
    count?: number;
    size?: number;
    format?: string;
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
  const [commonName, setCommonName] = useState(() => pickText(initialState?.commonName, ""));
  const [altNames, setAltNames] = useState(() => pickText(initialState?.altNames, ""));
  const [days, setDays] = useState<number | string>(() => clampWhole(initialState?.days, DEFAULT_DAYS, MAX_DAYS));
  const [keyIdSource, setKeyIdSource] = useState(() => pickKeyIdSource(initialState?.keyId));
  const [count, setCount] = useState<number | string>(() => clampWhole(initialState?.count, 1, MAX_JWK_KEYS));
  const [size, setSize] = useState<number | string>(() =>
    clampWhole(initialState?.size, DEFAULT_SECRET_BYTES, MAX_SECRET_BYTES)
  );
  const [format, setFormat] = useState(() => pickFormat(initialState?.format));
  const [secret, setSecret] = useState("");
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [running, setRunning] = useState(false);
  const [asked, setAsked] = useState(false);
  const runIdRef = useRef(0);

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
    commonName: kind === "tls" && commonName ? commonName : undefined,
    altNames: kind === "tls" && altNames ? altNames : undefined,
    days: kind === "tls" ? days : undefined,
    keyId: kind === "jwk" ? keyIdSource : undefined,
    count: kind === "jwk" ? count : undefined,
    size: kind === "secret" ? size : undefined,
    format: kind === "secret" ? format : undefined,
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
  const missingCommonName = kind === "tls" && commonName.trim() === "";
  const namedWrong = kind === "tls" && !missingCommonName && !isHostOrAddress(commonName.trim());
  const commonNameError = missingCommonName && asked
    ? "Required"
    : namedWrong
    ? "Enter a host name or IP address"
    : null;
  const altNamesError = kind === "tls" && splitAltNames(altNames).some((entry) => !isHostOrAddress(entry))
    ? "Enter host names or IP addresses"
    : null;
  const parsedDays = parseWhole(days, MAX_DAYS);
  const daysError = kind === "tls" && parsedDays === null ? `Enter a validity of 1 to ${MAX_DAYS} days` : null;
  const parsedCount = parseWhole(count, MAX_JWK_KEYS);
  const countError = kind === "jwk" && parsedCount === null ? `Enter a count of 1 to ${MAX_JWK_KEYS}` : null;
  const settled = kind === "ssh"
    ? !commentError
    : kind === "wireguard"
    ? !serverKeyError
    : kind === "tls"
    ? !missingCommonName && !namedWrong && !altNamesError && !daysError
    : kind === "jwk"
    ? !countError
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
    commonName,
    altNames,
    days,
    keyIdSource,
    count,
  }), [
    kind,
    algorithm,
    variant,
    comment,
    name,
    email,
    passphrase,
    serverKey,
    commonName,
    altNames,
    days,
    keyIdSource,
    count,
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
        : kind === "jwk"
        ? jwkResult(
          await generateJwkSet({ algorithm, variant, keyId: keyIdSource, count: parsedCount ?? 1 }),
        )
        : kind === "tls"
        ? certificateResult(
          await generateCertificate({
            algorithm,
            variant,
            commonName,
            altNames,
            days: parsedDays ?? DEFAULT_DAYS,
            passphrase,
          }),
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
    commonName,
    altNames,
    parsedDays,
    keyIdSource,
    parsedCount,
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

  const handleKindChange = (value: string | null) => {
    if (value === null || !(value in ALGORITHMS)) return;
    const next = pickAlgorithm(value, null);
    setKind(value);
    setAlgorithm(next);
    setVariant(pickVariant(value, next, null));
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
              <>
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
                <Select
                  label="Encoding"
                  data={FORMAT_OPTIONS}
                  value={format}
                  onChange={(value) => value && setFormat(value)}
                  allowDeselect={false}
                />
              </>
            )}
          </Box>

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
              <PasswordInput
                label="Passphrase"
                description="Left unencrypted when blank"
                value={passphrase}
                onChange={(event) =>
                  setPassphrase(event.currentTarget.value)}
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

          {kind === "tls" && (
            <>
              <Box
                className={commonNameError || altNamesError ? "settings-row has-error" : "settings-row"}
                mb={commonNameError || altNamesError ? "md" : 0}
              >
                <TextInput
                  label="Common name"
                  description="The host the certificate is issued to"
                  placeholder="localhost"
                  value={commonName}
                  onChange={(event) => setCommonName(event.currentTarget.value)}
                  error={commonNameError}
                  spellCheck={false}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                />
                <TextInput
                  label="Subject alternative names"
                  description="The common name when blank"
                  placeholder="localhost, 127.0.0.1"
                  value={altNames}
                  onChange={(event) => setAltNames(event.currentTarget.value)}
                  error={altNamesError}
                  spellCheck={false}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                />
              </Box>
              <Box className={daysError ? "settings-row has-error" : "settings-row"} mb={daysError ? "md" : 0}>
                <NumberInput
                  label="Validity"
                  description={parsedDays === null ? "In days" : expiryLabel(parsedDays)}
                  value={days}
                  onChange={setDays}
                  min={1}
                  max={MAX_DAYS}
                  allowDecimal={false}
                  allowNegative={false}
                  stepHoldDelay={500}
                  stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                  error={daysError}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                />
                <PasswordInput
                  label="Passphrase"
                  description="Left unencrypted when blank"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.currentTarget.value)}
                />
              </Box>
            </>
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
              <PasswordInput
                label="Passphrase"
                description="Left unencrypted when blank"
                value={passphrase}
                onChange={(event) => setPassphrase(event.currentTarget.value)}
              />
            </Box>
          )}

          {kind !== "secret" && (
            <Group justify="flex-end" wrap="nowrap">
              <Text size="sm" c={error ? "red" : "dimmed"} flex={1}>
                {error}
              </Text>
              <Button onClick={generate} loading={running}>
                Generate
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
                <Title order={4}>{kind === "jwk" && parsedCount !== 1 ? "JSON Web Key Set" : KIND_LABELS[kind]}</Title>
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
