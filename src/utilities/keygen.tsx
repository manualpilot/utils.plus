import { ActionIcon, Box, Button, Card, CopyButton, Group, NumberInput, PasswordInput, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { randomBytes } from "@noble/hashes/utils.js";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../icons";

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
      <UtilityTitle file="keygen.tsx">Keygen</UtilityTitle>

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

export interface KeySettings {
  algorithm: string;
  variant: string;
  comment: string;
  name: string;
  email: string;
  passphrase: string;
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

export interface CertificateSettings {
  algorithm: string;
  variant: string;
  commonName: string;
  altNames: string;
  days: number;
  passphrase: string;
}

export interface Certificate {
  privateKey: string;
  certificate: string;
  fingerprint: string;
}

export interface JwkSettings {
  algorithm: string;
  variant: string;
  keyId: string;
  count: number;
}

export type Jwk = Record<string, string>;

export interface JwkSet {
  privateKeys: Jwk[];
  publicKeys: Jwk[];
  thumbprint: string;
}

export interface WireguardConfigs {
  server: string;
  client: string;
}

interface KeyResult {
  outputs: Output[];
  fingerprint: string;
}

interface Generated {
  request: unknown;
  result: KeyResult | null;
  error: string;
}

interface Output {
  label: string;
  value: string;
  rows: number;
}

interface AlgorithmSpec {
  value: string;
  label: string;
  group?: string;
  variantLabel?: string;
  variants?: { value: string; label: string }[];
}

const KIND_OPTIONS = [
  { value: "ssh", label: "SSH key" },
  { value: "pgp", label: "PGP key" },
  { value: "tls", label: "TLS certificate" },
  { value: "jwk", label: "JSON Web Key" },
  { value: "wireguard", label: "WireGuard keys" },
  { value: "secret", label: "Random secret" },
];

const KIND_LABELS: Record<string, string> = {
  ssh: "SSH key pair",
  pgp: "PGP key pair",
  tls: "TLS certificate",
  jwk: "JSON Web Key",
  wireguard: "WireGuard configuration",
  secret: "Random secret",
};

const RSA_SIZES = [
  { value: "3072", label: "3072 bits" },
  { value: "2048", label: "2048 bits" },
  { value: "4096", label: "4096 bits" },
];

const SIGNATURE = "Signature";
const ENCRYPTION = "Encryption";

const RSA_SIZE = { variantLabel: "Key size", variants: RSA_SIZES };

const ECDH_CURVE = {
  variantLabel: "Curve",
  variants: [
    { value: "P-256", label: "NIST P-256" },
    { value: "P-384", label: "NIST P-384" },
    { value: "P-521", label: "NIST P-521" },
    { value: "X25519", label: "X25519" },
  ],
};

const NIST_CURVES = [
  { value: "nistp256", label: "NIST P-256" },
  { value: "nistp384", label: "NIST P-384" },
  { value: "nistp521", label: "NIST P-521" },
];

const ALGORITHMS: Record<string, AlgorithmSpec[]> = {
  ssh: [
    { value: "ed25519", label: "Ed25519" },
    { value: "ecdsa", label: "ECDSA", variantLabel: "Curve", variants: NIST_CURVES },
    { value: "rsa", label: "RSA", variantLabel: "Key size", variants: RSA_SIZES },
  ],
  pgp: [
    { value: "curve25519", label: "Curve25519" },
    {
      value: "ecc",
      label: "ECDSA",
      variantLabel: "Curve",
      variants: [
        { value: "nistP256", label: "NIST P-256" },
        { value: "nistP384", label: "NIST P-384" },
        { value: "nistP521", label: "NIST P-521" },
      ],
    },
    { value: "rsa", label: "RSA", variantLabel: "Key size", variants: RSA_SIZES },
  ],
  tls: [
    { value: "rsa", label: "RSA", variantLabel: "Key size", variants: RSA_SIZES },
    { value: "ecdsa", label: "ECDSA", variantLabel: "Curve", variants: NIST_CURVES },
  ],
  jwk: [
    { group: SIGNATURE, value: "EdDSA", label: "EdDSA (Ed25519)" },
    { group: SIGNATURE, value: "ES256", label: "ES256 (P-256)" },
    { group: SIGNATURE, value: "ES384", label: "ES384 (P-384)" },
    { group: SIGNATURE, value: "ES512", label: "ES512 (P-521)" },
    { group: SIGNATURE, value: "RS256", label: "RS256 (PKCS#1 v1.5, SHA-256)", ...RSA_SIZE },
    { group: SIGNATURE, value: "RS384", label: "RS384 (PKCS#1 v1.5, SHA-384)", ...RSA_SIZE },
    { group: SIGNATURE, value: "RS512", label: "RS512 (PKCS#1 v1.5, SHA-512)", ...RSA_SIZE },
    { group: SIGNATURE, value: "PS256", label: "PS256 (PSS, SHA-256)", ...RSA_SIZE },
    { group: SIGNATURE, value: "PS384", label: "PS384 (PSS, SHA-384)", ...RSA_SIZE },
    { group: SIGNATURE, value: "PS512", label: "PS512 (PSS, SHA-512)", ...RSA_SIZE },
    { group: SIGNATURE, value: "HS256", label: "HS256 (SHA-256)" },
    { group: SIGNATURE, value: "HS384", label: "HS384 (SHA-384)" },
    { group: SIGNATURE, value: "HS512", label: "HS512 (SHA-512)" },
    { group: ENCRYPTION, value: "ECDH-ES", label: "ECDH-ES (direct agreement)", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "ECDH-ES+A128KW", label: "ECDH-ES+A128KW", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "ECDH-ES+A192KW", label: "ECDH-ES+A192KW", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "ECDH-ES+A256KW", label: "ECDH-ES+A256KW", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "RSA-OAEP-256", label: "RSA-OAEP-256 (SHA-256)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "RSA-OAEP-384", label: "RSA-OAEP-384 (SHA-384)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "RSA-OAEP-512", label: "RSA-OAEP-512 (SHA-512)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "RSA-OAEP", label: "RSA-OAEP (SHA-1)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "A128KW", label: "A128KW (AES key wrap)" },
    { group: ENCRYPTION, value: "A192KW", label: "A192KW (AES key wrap)" },
    { group: ENCRYPTION, value: "A256KW", label: "A256KW (AES key wrap)" },
    { group: ENCRYPTION, value: "A128GCMKW", label: "A128GCMKW (AES-GCM key wrap)" },
    { group: ENCRYPTION, value: "A192GCMKW", label: "A192GCMKW (AES-GCM key wrap)" },
    { group: ENCRYPTION, value: "A256GCMKW", label: "A256GCMKW (AES-GCM key wrap)" },
  ],
  wireguard: [],
  secret: [],
};

const KEY_ID_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uuid", label: "Random UUID" },
  { value: "timestamp", label: "Timestamp" },
  { value: "iso", label: "ISO date" },
  { value: "sha256", label: "SHA-256 thumbprint" },
  { value: "sha1", label: "SHA-1 thumbprint" },
];

const FORMAT_OPTIONS = [
  { value: "hex", label: "Hexadecimal" },
  { value: "hex-upper", label: "Hexadecimal (uppercase)" },
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64 (URL-safe)" },
  { value: "base32", label: "Base32" },
  { value: "decimal", label: "Decimal" },
];

const MAX_SECRET_BYTES = 512;
const DEFAULT_SECRET_BYTES = 32;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const MAX_DAYS = 3650;
const DEFAULT_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_JWK_KEYS = 8;

const JWK_CURVES: Record<string, string> = { ES256: "P-256", ES384: "P-384", ES512: "P-521" };

const JWK_SECRET_BYTES: Record<string, number> = {
  HS256: 32,
  HS384: 48,
  HS512: 64,
  A128KW: 16,
  A192KW: 24,
  A256KW: 32,
  A128GCMKW: 16,
  A192GCMKW: 24,
  A256GCMKW: 32,
};

const JWK_MEMBERS = ["crv", "n", "e", "x", "y", "d", "p", "q", "dp", "dq", "qi", "k"];

const THUMBPRINT_MEMBERS: Record<string, string[]> = {
  EC: ["crv", "kty", "x", "y"],
  OKP: ["crv", "kty", "x"],
  RSA: ["e", "kty", "n"],
  oct: ["k", "kty"],
};

const WEB_CRYPTO_CURVES: Record<string, string> = {
  nistp256: "P-256",
  nistp384: "P-384",
  nistp521: "P-521",
};

const ECDSA_SIGNATURES: Record<string, { oid: string; hash: string }> = {
  nistp256: { oid: "1.2.840.10045.4.3.2", hash: "SHA-256" },
  nistp384: { oid: "1.2.840.10045.4.3.3", hash: "SHA-384" },
  nistp521: { oid: "1.2.840.10045.4.3.4", hash: "SHA-512" },
};

export async function generateSshKey(settings: KeySettings): Promise<KeyPair> {
  const sshpk = await import("sshpk");
  const key = settings.algorithm === "ed25519"
    ? sshpk.generatePrivateKey("ed25519")
    : sshpk.parsePrivateKey(await webCryptoPkcs8(settings.algorithm, settings.variant), "pkcs8");

  key.comment = settings.comment;
  const options = settings.passphrase
    ? { passphrase: settings.passphrase, cipher: "aes256-ctr" as const }
    : undefined;

  return {
    privateKey: key.toString("ssh-private", options),
    publicKey: key.toPublic().toString("ssh"),
    fingerprint: key.fingerprint("sha256").toString(),
  };
}

export async function generatePgpKey(settings: KeySettings): Promise<KeyPair> {
  const openpgp = await import("openpgp");
  const algorithm = settings.algorithm === "rsa"
    ? { type: "rsa" as const, rsaBits: Number(settings.variant) }
    : { type: "ecc" as const, curve: (settings.algorithm === "ecc" ? settings.variant : "curve25519Legacy") as Curve };

  const { privateKey, publicKey } = await openpgp.generateKey({
    ...algorithm,
    userIDs: [{ name: settings.name.trim(), email: settings.email || undefined }],
    passphrase: settings.passphrase || undefined,
    format: "object",
  });

  return {
    privateKey: privateKey.armor(),
    publicKey: publicKey.armor(),
    fingerprint: privateKey.getFingerprint().toUpperCase(),
  };
}

type Curve = Parameters<typeof import("openpgp").generateKey>[0]["curve"];

type Forge = typeof import("node-forge");
type ForgeCertificate = ReturnType<Forge["pki"]["createCertificate"]>;

export async function generateCertificate(settings: CertificateSettings): Promise<Certificate> {
  const forge = await loadForge();
  const pair = await webCryptoKeyPair(settings.algorithm, settings.variant);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));

  const cert = forge.pki.createCertificate();
  cert.version = 2;
  cert.serialNumber = serialNumber();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(cert.validity.notBefore.getTime() + settings.days * DAY_MS);
  const subject = [{ name: "commonName", value: settings.commonName.trim() }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions(certificateExtensions(settings));

  const der = settings.algorithm === "rsa"
    ? signWithForge(forge, cert, pkcs8)
    : await signWithWebCrypto(forge, cert, pair, settings.variant);

  return {
    privateKey: settings.passphrase
      ? unixPem(forge.pki.encryptedPrivateKeyToPem(encryptedPrivateKey(forge, pkcs8, settings.passphrase)))
      : toPem(pkcs8, "PRIVATE KEY"),
    certificate: unixPem(forge.pem.encode({ type: "CERTIFICATE", body: der })),
    fingerprint: forge.md.sha256.create().update(der).digest().toHex().toUpperCase().replace(/..\B/g, "$&:"),
  };
}

function signWithForge(forge: Forge, cert: ForgeCertificate, pkcs8: Uint8Array): string {
  const privateKey = forge.pki.privateKeyFromPem(toPem(pkcs8, "PRIVATE KEY"));
  cert.publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
  cert.sign(privateKey, forge.md.sha256.create());
  return forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
}

async function signWithWebCrypto(
  forge: Forge,
  cert: ForgeCertificate,
  pair: CryptoKeyPair,
  variant: string,
): Promise<string> {
  const { asn1, pki, util } = forge;
  const { oid, hash } = ECDSA_SIGNATURES[variant] ?? ECDSA_SIGNATURES.nistp256;
  const algorithm = () =>
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
    ]);

  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const tbs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(cert.version).getBytes()),
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, util.hexToBytes(cert.serialNumber)),
    algorithm(),
    pki.distinguishedNameToAsn1(cert.issuer),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      timeToAsn1(forge, cert.validity.notBefore),
      timeToAsn1(forge, cert.validity.notAfter),
    ]),
    pki.distinguishedNameToAsn1(cert.subject),
    asn1.fromDer(util.createBuffer(toBinary(spki))),
    pki.certificateExtensionsToAsn1(cert.extensions),
  ]);

  const body = asn1.toDer(tbs).getBytes();
  const signed = await crypto.subtle.sign({ name: "ECDSA", hash }, pair.privateKey, fromBinary(body));
  const certificate = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    tbs,
    algorithm(),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false, "\0" + derSignature(forge, new Uint8Array(signed))),
  ]);
  return asn1.toDer(certificate).getBytes();
}

function certificateExtensions({ algorithm, altNames, commonName }: CertificateSettings) {
  return [
    { name: "basicConstraints", critical: true, cA: false },
    { name: "keyUsage", critical: true, digitalSignature: true, keyEncipherment: algorithm === "rsa" },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames: altNameList(altNames, commonName) },
  ];
}

function altNameList(altNames: string, commonName: string) {
  const listed = splitAltNames(altNames);
  const names = listed.length > 0 ? listed : [commonName.trim()];
  return names.map((name) => isAddress(name) ? { type: 7, ip: name } : { type: 2, value: name });
}

function splitAltNames(value: string): string[] {
  return value.split(/[,\s]+/).filter((entry) => entry !== "");
}

function timeToAsn1(forge: Forge, date: Date) {
  const { asn1 } = forge;
  return date.getUTCFullYear() < 2050
    ? asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false, asn1.dateToUtcTime(date))
    : asn1.create(asn1.Class.UNIVERSAL, asn1.Type.GENERALIZEDTIME, false, asn1.dateToGeneralizedTime(date));
}

function derSignature(forge: Forge, signature: Uint8Array): string {
  const { asn1 } = forge;
  const half = signature.length / 2;
  const pair = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    unsignedInteger(forge, signature.subarray(0, half)),
    unsignedInteger(forge, signature.subarray(half)),
  ]);
  return asn1.toDer(pair).getBytes();
}

function unsignedInteger(forge: Forge, bytes: Uint8Array) {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  const trimmed = bytes.subarray(start);
  const value = (trimmed[0] & 0x80 ? "\0" : "") + toBinary(trimmed);
  return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, value);
}

function encryptedPrivateKey(forge: Forge, pkcs8: Uint8Array, passphrase: string) {
  const info = forge.asn1.fromDer(forge.util.createBuffer(toBinary(pkcs8)));
  return forge.pki.encryptPrivateKeyInfo(info, passphrase, { algorithm: "aes256" });
}

function unixPem(pem: string): string {
  return pem.replace(/\r\n/g, "\n");
}

function serialNumber(): string {
  return `00${toHex(randomBytes(16))}`;
}

async function loadForge(): Promise<Forge> {
  const forge = await import("node-forge");
  return (forge as unknown as { default: Forge }).default;
}

export async function generateWireguardConfigs(serverPrivateKey: string): Promise<WireguardConfigs> {
  const { x25519 } = await import("@noble/curves/ed25519.js");
  const server = parseWireguardKey(serverPrivateKey) ?? randomWireguardKey();
  const client = randomWireguardKey();

  return {
    server: wireguardConfig(server, x25519.getPublicKey(client)),
    client: wireguardConfig(client, x25519.getPublicKey(server)),
  };
}

function wireguardConfig(privateKey: Uint8Array, peerPublicKey: Uint8Array): string {
  return `[Interface]\nPrivateKey = ${toBase64(privateKey)}\n\n[Peer]\nPublicKey = ${toBase64(peerPublicKey)}\n`;
}

function randomWireguardKey(): Uint8Array {
  const key = randomBytes(32);
  key[0] &= 248;
  key[31] &= 127;
  key[31] |= 64;
  return key;
}

function parseWireguardKey(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) return null;
  return Uint8Array.from(atob(trimmed), (character) => character.charCodeAt(0));
}

export async function generateJwkSet(settings: JwkSettings): Promise<JwkSet> {
  const count = Math.min(Math.max(settings.count, 1), MAX_JWK_KEYS);
  const stamp = Math.floor(Date.now() / 1000) * 1000;
  const privateKeys: Jwk[] = [];
  const publicKeys: Jwk[] = [];

  for (let index = 0; index < count; index += 1) {
    const [privateJwk, publicJwk] = await jwkMaterial(settings.algorithm, settings.variant);
    const kid = await keyIdFor(settings.keyId, publicJwk ?? privateJwk, stamp + index * 1000);
    privateKeys.push(withHeader(privateJwk, settings.algorithm, kid));
    if (publicJwk) publicKeys.push(withHeader(publicJwk, settings.algorithm, kid));
  }

  return {
    privateKeys,
    publicKeys,
    thumbprint: count === 1 ? await thumbprint(publicKeys[0] ?? privateKeys[0], "SHA-256") : "",
  };
}

async function jwkMaterial(algorithm: string, variant: string): Promise<[Jwk, Jwk | null]> {
  const bytes = JWK_SECRET_BYTES[algorithm];
  if (bytes) return [{ kty: "oct", k: formatSecret(randomBytes(bytes), "base64url") }, null];

  const [params, usages] = jwkKeyParams(algorithm, variant);
  const pair = await crypto.subtle.generateKey(params, true, usages) as CryptoKeyPair;
  return [
    keyMaterial(await crypto.subtle.exportKey("jwk", pair.privateKey)),
    keyMaterial(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  ];
}

function jwkKeyParams(algorithm: string, variant: string): [KeyGenParams, KeyUsage[]] {
  if (algorithm.startsWith("RSA-OAEP")) {
    const hash = algorithm === "RSA-OAEP" ? "SHA-1" : `SHA-${algorithm.slice("RSA-OAEP-".length)}`;
    return [rsaParams("RSA-OAEP", variant, hash), ["encrypt", "decrypt"]];
  }
  if (algorithm.startsWith("ECDH-ES")) {
    const params = variant === "X25519" ? { name: "X25519" } : { name: "ECDH", namedCurve: variant };
    return [params, ["deriveKey", "deriveBits"]];
  }
  if (algorithm.startsWith("RS") || algorithm.startsWith("PS")) {
    const name = algorithm.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5";
    return [rsaParams(name, variant, `SHA-${algorithm.slice(2)}`), ["sign", "verify"]];
  }
  if (algorithm.startsWith("ES")) {
    return [{ name: "ECDSA", namedCurve: JWK_CURVES[algorithm] ?? "P-256" }, ["sign", "verify"]];
  }
  return [{ name: "Ed25519" }, ["sign", "verify"]];
}

function rsaParams(name: string, variant: string, hash: string): RsaHashedKeyGenParams {
  return { name, modulusLength: Number(variant), publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash };
}

type KeyGenParams = RsaHashedKeyGenParams | EcKeyGenParams | Algorithm;

function keyMaterial(exported: JsonWebKey): Jwk {
  const jwk: Jwk = { kty: exported.kty ?? "" };
  for (const member of JWK_MEMBERS) {
    const value = (exported as Record<string, unknown>)[member];
    if (typeof value === "string") jwk[member] = value;
  }
  return jwk;
}

function withHeader(material: Jwk, algorithm: string, kid: string): Jwk {
  const { kty, ...rest } = material;
  return { kty, ...(kid ? { kid } : {}), use: jwkUse(algorithm), alg: algorithm, ...rest };
}

function jwkUse(algorithm: string): string {
  const encrypts = algorithm.startsWith("RSA-OAEP") || algorithm.startsWith("ECDH-ES") || algorithm.endsWith("KW");
  return encrypts ? "enc" : "sig";
}

async function keyIdFor(source: string, jwk: Jwk, at: number): Promise<string> {
  switch (source) {
    case "uuid":
      return crypto.randomUUID();
    case "timestamp":
      return `${at / 1000}`;
    case "iso":
      return new Date(at).toISOString().replace(".000", "");
    case "sha256":
      return await thumbprint(jwk, "SHA-256");
    case "sha1":
      return await thumbprint(jwk, "SHA-1");
    default:
      return "";
  }
}

async function thumbprint(jwk: Jwk, hash: string): Promise<string> {
  const members = THUMBPRINT_MEMBERS[jwk.kty] ?? [];
  const canonical = `{${members.map((name) => `${JSON.stringify(name)}:${JSON.stringify(jwk[name] ?? "")}`)}}`;
  const digest = await crypto.subtle.digest(hash, new TextEncoder().encode(canonical));
  return formatSecret(new Uint8Array(digest), "base64url");
}

async function wireguardResult(serverPrivateKey: string): Promise<KeyResult> {
  const { server, client } = await generateWireguardConfigs(serverPrivateKey);
  return {
    outputs: [
      { label: "Server configuration", value: server, rows: 5 },
      { label: "Client configuration", value: client, rows: 5 },
    ],
    fingerprint: "",
  };
}

function jwkResult({ privateKeys, publicKeys, thumbprint }: JwkSet): KeyResult {
  const owned = publicKeys.length === 0 ? "Key" : "Private key";
  const many = privateKeys.length > 1;
  const outputs = [{ label: many ? `${owned} set` : owned, value: writeJwks(privateKeys), rows: 8 }];
  if (publicKeys.length > 0) {
    outputs.push({ label: many ? "Public key set" : "Public key", value: writeJwks(publicKeys), rows: 8 });
  }
  return { outputs, fingerprint: thumbprint };
}

function writeJwks(keys: Jwk[]): string {
  return JSON.stringify(keys.length === 1 ? keys[0] : { keys }, null, 2);
}

function certificateResult(certificate: Certificate): KeyResult {
  return {
    outputs: [
      { label: "Private key", value: certificate.privateKey, rows: 6 },
      { label: "Certificate", value: certificate.certificate, rows: 6 },
    ],
    fingerprint: certificate.fingerprint,
  };
}

function pairResult(kind: string, pair: KeyPair): KeyResult {
  return {
    outputs: [
      { label: "Private key", value: pair.privateKey, rows: 6 },
      { label: "Public key", value: pair.publicKey, rows: kind === "ssh" ? 2 : 6 },
    ],
    fingerprint: pair.fingerprint,
  };
}

async function webCryptoKeyPair(algorithm: string, variant: string): Promise<CryptoKeyPair> {
  const params: RsaHashedKeyGenParams | EcKeyGenParams = algorithm === "rsa"
    ? {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: Number(variant),
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    }
    : { name: "ECDSA", namedCurve: WEB_CRYPTO_CURVES[variant] ?? "P-256" };

  return await crypto.subtle.generateKey(params, true, ["sign", "verify"]) as CryptoKeyPair;
}

async function webCryptoPkcs8(algorithm: string, variant: string): Promise<string> {
  const pair = await webCryptoKeyPair(algorithm, variant);
  return toPem(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)), "PRIVATE KEY");
}

function toPem(der: Uint8Array, label: string): string {
  const body = toBase64(der).replace(/(.{64})/g, "$1\n").replace(/\n$/, "");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

export function formatSecret(bytes: Uint8Array, format: string): string {
  switch (format) {
    case "hex-upper":
      return toHex(bytes).toUpperCase();
    case "base64":
      return toBase64(bytes);
    case "base64url":
      return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "base32":
      return toBase32(bytes);
    case "decimal":
      return bytesToBigInt(bytes).toString();
    default:
      return toHex(bytes);
  }
}

function algorithmSpec(kind: string, algorithm: string): AlgorithmSpec | undefined {
  return ALGORITHMS[kind]?.find((spec) => spec.value === algorithm);
}

function algorithmData(specs: AlgorithmSpec[]) {
  const items = specs.map(({ value, label }) => ({ value, label }));
  if (!specs.some((spec) => spec.group)) return items;

  const groups: { group: string; items: typeof items }[] = [];
  specs.forEach((spec, index) => {
    const last = groups[groups.length - 1];
    if (last?.group === spec.group) last.items.push(items[index]);
    else groups.push({ group: spec.group ?? "", items: [items[index]] });
  });
  return groups;
}

function pickKind(value: unknown): string {
  return typeof value === "string" && value in ALGORITHMS ? value : "ssh";
}

function pickAlgorithm(kind: string, value: unknown): string {
  const specs = ALGORITHMS[kind] ?? [];
  if (specs.length === 0) return "";
  return specs.some((spec) => spec.value === value) ? value as string : specs[0].value;
}

function pickVariant(kind: string, algorithm: string, value: unknown): string {
  const variants = algorithmSpec(kind, algorithm)?.variants;
  if (!variants) return "";
  return variants.some((item) => item.value === value) ? value as string : variants[0].value;
}

function pickKeyIdSource(value: unknown): string {
  return KEY_ID_OPTIONS.some((option) => option.value === value) ? value as string : "sha256";
}

function pickFormat(value: unknown): string {
  return FORMAT_OPTIONS.some((option) => option.value === value) ? value as string : "hex";
}

function pickText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function isHostOrAddress(value: string): boolean {
  return isAddress(value) || isHostName(value);
}

function isHostName(value: string): boolean {
  if (value.length > 253) return false;
  const labels = value.split(".");
  if (labels[0] === "*") labels.shift();
  if (labels.length === 0 || !labels.every((label) => HOST_LABEL.test(label))) return false;
  return !/^\d+$/.test(labels[labels.length - 1]);
}

function isAddress(value: string): boolean {
  if (value.includes(":")) return isIpv6(value);
  const octets = value.split(".");
  return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

function isIpv6(value: string): boolean {
  const halves = value.split("::");
  if (halves.length > 2) return false;
  const groups = halves.map((half) => half === "" ? [] : half.split(":"));
  if (groups.some((half) => half.some((group) => !/^[0-9a-f]{1,4}$/i.test(group)))) return false;
  const written = groups.reduce((count, half) => count + half.length, 0);
  return halves.length === 2 ? written < 8 : written === 8;
}

function parseWhole(value: number | string, max: number): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= max ? rounded : null;
}

function clampWhole(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

function expiryLabel(days: number): string {
  return `Until ${new Date(Date.now() + days * DAY_MS).toLocaleDateString()}`;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Key generation failed";
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  return btoa(toBinary(bytes));
}

function toBinary(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function fromBinary(binary: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += "=";
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}
