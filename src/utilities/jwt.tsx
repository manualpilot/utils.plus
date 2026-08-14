import { ActionIcon, Autocomplete, Badge, Box, Button, Card, CopyButton, Group, SegmentedControl, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { compactVerify, exportJWK, exportPKCS8, exportSPKI, generateKeyPair, importJWK, importPKCS8, importSPKI, importX509, type JWK, type JWTHeaderParameters, SignJWT } from "jose";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy, IconPlus, IconRefresh, IconTrash, IconX } from "../icons";

export default function Jwt() {
  const initialState = useInitialHashState<{
    mode?: string;
    token?: string;
    secret?: string;
    alg?: string;
    headers?: unknown;
    claims?: unknown;
  }>();

  const initialMode: Mode = initialState?.mode === "encode" ? "encode" : "decode";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [token, setToken] = useState(pickText(initialState?.token));
  const [secret, setSecret] = useState(pickText(initialState?.secret));
  const [alg, setAlg] = useState(pickAlgorithm(initialState?.alg));
  const [form, setForm] = useState<Form | null>(
    () => sharedForm(initialState) ?? (initialMode === "encode" ? starterForm() : null),
  );
  const [signed, setSigned] = useState<SignResult | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const source = useRef("");
  const generated = useRef("");
  const signRun = useRef(0);
  const checkRun = useRef(0);
  const keyRun = useRef(0);

  const reading = useMemo(() => readToken(token), [token]);
  const headerAlg = typeof reading.header?.alg === "string" ? reading.header.alg : null;

  useRegisterShareState(() => ({
    mode,
    token: mode === "decode" && token ? token : undefined,
    secret: secret || undefined,
    alg: mode === "encode" ? alg : undefined,
    headers: mode === "encode" ? fieldPairs(form?.headers) : undefined,
    claims: mode === "encode" ? fieldPairs(form?.claims) : undefined,
  }));

  useEffect(() => {
    if (mode !== "decode") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== "decode" || !reading.header || !secret.trim() || !headerAlg || headerAlg === "none") {
      setCheck(null);
      return;
    }
    const runId = ++checkRun.current;
    verifySignature(token, secret, headerAlg)
      .then((ok) => {
        if (checkRun.current === runId) setCheck({ ok, error: null });
      })
      .catch((e) => {
        if (checkRun.current === runId) setCheck({ ok: false, error: message(e) });
      });
  }, [mode, token, secret, reading, headerAlg]);

  useEffect(() => {
    if (mode !== "encode" || !form) return;
    const runId = ++signRun.current;
    signToken({ alg, headers: form.headers, claims: form.claims, secret })
      .then((result) => {
        if (signRun.current !== runId) return;
        setSigned(result);
        if (result.token) source.current = result.token;
      })
      .catch((e) => {
        if (signRun.current === runId) setSigned({ ...EMPTY_SIGNATURE, tokenError: message(e) });
      });
  }, [mode, form, alg, secret]);

  const fillKey = useCallback((target: string) => {
    const runId = ++keyRun.current;
    generateSigningKey(target)
      .then((key) => {
        if (keyRun.current !== runId) return;
        generated.current = key;
        setSecret(key);
      })
      .catch((e) => {
        if (keyRun.current === runId) setSigned({ ...EMPTY_SIGNATURE, keyError: message(e) });
      });
  }, []);

  const handleMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "encode") enterEncode();
    else if (signed?.token) {
      setToken(signed.token);
      source.current = signed.token;
    }
    setMode(next);
  };

  const enterEncode = () => {
    const transferred = reading.header && reading.payload && token.trim() !== source.current
      ? formFromReading(reading)
      : null;
    if (transferred) {
      setForm(transferred.form);
      if (transferred.alg) setAlg(transferred.alg);
    } else if (!form) {
      setForm(starterForm());
    }
    source.current = token.trim();
    if (!secret.trim()) fillKey(transferred?.alg ?? alg);
  };

  const handleAlgorithm = (value: string | null) => {
    const next = pickAlgorithm(value);
    setAlg(next);
    if (!secret.trim() || secret === generated.current) fillKey(next);
  };

  const updateField = (kind: FieldKind, id: string, patch: Partial<Field>) => {
    setForm((current) =>
      current && { ...current, [kind]: current[kind].map((field) => field.id === id ? { ...field, ...patch } : field) }
    );
  };

  const addField = (kind: FieldKind) => {
    setForm((current) => current && { ...current, [kind]: [...current[kind], newField("", "")] });
  };

  const removeField = (kind: FieldKind, id: string) => {
    setForm((current) => current && { ...current, [kind]: current[kind].filter((field) => field.id !== id) });
  };

  const keyError = mode === "decode" ? check?.error ?? null : signed?.keyError ?? null;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="nowrap">
        <UtilityTitle file="jwt.tsx">JWT</UtilityTitle>
        <SegmentedControl
          value={mode}
          onChange={(value) => handleMode(value as Mode)}
          data={[{ value: "decode", label: "Decode" }, { value: "encode", label: "Encode" }]}
        />
      </Group>

      {mode === "decode" && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={4}>Token</Title>
              <Tooltip label="Clear" withArrow position="left">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => setToken("")}
                  disabled={token === ""}
                  aria-label="Clear token"
                >
                  <IconX size="1.2rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Textarea
              value={token}
              onChange={(event) => setToken(event.currentTarget.value)}
              placeholder="Paste an encoded JWT"
              aria-label="Token"
              error={reading.error}
              autosize
              minRows={4}
              maxRows={12}
              spellCheck={false}
              autoCapitalize="off"
              styles={{ input: { fontFamily: "monospace" } }}
            />
          </Stack>
        </Card>
      )}

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          {mode === "encode" && (
            <Box className="settings-row" mb="xs">
              <Select
                label="Algorithm"
                description="What the header will say, and what the key below is generated for"
                data={ALGORITHM_OPTIONS}
                value={alg}
                onChange={handleAlgorithm}
                allowDeselect={false}
              />
            </Box>
          )}
          <Group justify="space-between" gap="sm" wrap="nowrap">
            <Group gap="sm" align="baseline">
              <Title order={4}>{isSymmetric(mode === "decode" ? headerAlg ?? alg : alg) ? "Secret" : "Key"}</Title>
              {mode === "decode" && (
                <VerdictBadge check={check} unsigned={headerAlg === "none"} given={!!secret.trim()} />
              )}
            </Group>
            <Group gap="xs">
              {mode === "encode" && (
                <Tooltip label="Generate a new key" withArrow position="left">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => fillKey(alg)}
                    aria-label="Generate a new key"
                  >
                    <IconRefresh size="1.2rem" />
                  </ActionIcon>
                </Tooltip>
              )}
              <CopyButton value={secret} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      disabled={secret === ""}
                      aria-label="Copy key"
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
            onChange={(event) =>
              setSecret(event.currentTarget.value)}
            placeholder={mode === "decode" ? "Optional: a secret or public key to check the signature with" : ""}
            aria-label="Key"
            error={keyError}
            autosize
            minRows={2}
            maxRows={8}
            spellCheck={false}
            autoCapitalize="off"
            styles={{ input: { fontFamily: "monospace" } }}
          />
          {mode === "encode" && signed?.publicKey && (
            <>
              <Group justify="space-between" gap="sm" wrap="nowrap">
                <Title order={4}>Public key</Title>
                <CopyButton value={signed.publicKey} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy public key"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              <Textarea
                value={signed.publicKey}
                aria-label="Public key"
                readOnly
                autosize
                minRows={2}
                maxRows={8}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            </>
          )}
        </Stack>
      </Card>

      {mode === "decode" && reading.header && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Title order={4}>Header</Title>
            <ParameterTable rows={parameterRows(reading.header, HEADER_NAMES, now)} empty="This header is empty" />
          </Stack>
        </Card>
      )}

      {mode === "decode" && reading.payload && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Title order={4}>Claims</Title>
            <ParameterTable rows={parameterRows(reading.payload, CLAIM_NAMES, now)} empty="This token claims nothing" />
          </Stack>
        </Card>
      )}

      {mode === "encode" && form && (
        <>
          <FieldCard
            title="Header"
            kind="headers"
            fields={form.headers}
            names={HEADER_SUGGESTIONS}
            onChange={updateField}
            onAdd={addField}
            onRemove={removeField}
          />
          <FieldCard
            title="Claims"
            kind="claims"
            fields={form.claims}
            names={CLAIM_SUGGESTIONS}
            onChange={updateField}
            onAdd={addField}
            onRemove={removeField}
          />

          <Card withBorder shadow="sm" radius="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="sm" align="baseline">
                  <Title order={4}>Token</Title>
                  {signed?.token && <Text size="sm" c="dimmed">{signed.token.length} characters</Text>}
                </Group>
                <CopyButton value={signed?.token ?? ""} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        disabled={!signed?.token}
                        aria-label="Copy token"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              <Textarea
                value={signed?.token ?? ""}
                aria-label="Token"
                readOnly
                error={signed?.tokenError}
                autosize
                minRows={3}
                maxRows={12}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}

function VerdictBadge({ check, unsigned, given }: { check: Check | null; unsigned: boolean; given: boolean }) {
  if (unsigned) return <Badge color="yellow" variant="light">Unsigned</Badge>;
  if (!given || check?.error) return <Badge color="gray" variant="light">Signature not checked</Badge>;
  if (!check) return <Badge color="gray" variant="light">Checking</Badge>;
  return check.ok
    ? <Badge color="teal" variant="light">Signature valid</Badge>
    : <Badge color="red" variant="light">Signature invalid</Badge>;
}

function FieldCard({ title, kind, fields, names, onChange, onAdd, onRemove }: FieldCardProps) {
  const errors = duplicateErrors(fields);
  const singular = kind === "headers" ? "Header" : "Claim";

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack>
        <Group justify="space-between">
          <Title order={4}>{title}</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size="0.9rem" />}
            onClick={() => onAdd(kind)}
          >
            Add {singular.toLowerCase()}
          </Button>
        </Group>

        {fields.length === 0
          ? <Text size="sm" c="dimmed">Nothing here yet</Text>
          : fields.map((field, index) => (
            <Box
              key={field.id}
              className={errors[index] ? "settings-row has-error" : "settings-row"}
              mb={errors[index] ? "md" : 0}
            >
              <Autocomplete
                label={index === 0 ? "Name" : undefined}
                aria-label={`${singular} ${index + 1} name`}
                data={names}
                value={field.name}
                onChange={(value) => onChange(kind, field.id, { name: value })}
                error={errors[index]}
                spellCheck={false}
                autoCapitalize="off"
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
              />
              <TextInput
                label={index === 0 ? "Value" : undefined}
                description={index === 0 ? "JSON where it parses, text where it does not" : undefined}
                aria-label={`${singular} ${index + 1} value`}
                value={field.value}
                onChange={(event) => onChange(kind, field.id, { value: event.currentTarget.value })}
                spellCheck={false}
                autoCapitalize="off"
                styles={{ input: { fontFamily: "monospace" } }}
                rightSectionPointerEvents="all"
                rightSection={
                  <Tooltip label="Remove" withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => onRemove(kind, field.id)}
                      aria-label={`Remove ${singular.toLowerCase()} ${index + 1}`}
                    >
                      <IconTrash size="1.1rem" />
                    </ActionIcon>
                  </Tooltip>
                }
              />
            </Box>
          ))}
      </Stack>
    </Card>
  );
}

function ParameterTable({ rows, empty }: { rows: ParameterRow[]; empty: string }) {
  if (rows.length === 0) return <Text size="sm" c="dimmed">{empty}</Text>;

  return (
    <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.name}>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap" }} valign="top">
              <Text size="sm" ff="monospace">{row.name}</Text>
              {row.meaning && <Text size="xs" c="dimmed">{row.meaning}</Text>}
            </Table.Td>
            <Table.Td valign="top">
              <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>{row.value}</Text>
              {row.note && <Text size="xs" c={row.warn ? "red" : "dimmed"}>{row.note}</Text>}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

type Mode = "decode" | "encode";
type FieldKind = "headers" | "claims";

export interface Field {
  id: string;
  name: string;
  value: string;
}

interface Form {
  headers: Field[];
  claims: Field[];
}

interface Check {
  ok: boolean;
  error: string | null;
}

interface ParameterRow {
  name: string;
  meaning: string;
  value: string;
  note: string;
  warn: boolean;
}

interface FieldCardProps {
  title: string;
  kind: FieldKind;
  fields: Field[];
  names: string[];
  onChange: (kind: FieldKind, id: string, patch: Partial<Field>) => void;
  onAdd: (kind: FieldKind) => void;
  onRemove: (kind: FieldKind, id: string) => void;
}

export interface TokenReading {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signature: string;
  error: string | null;
}

export interface SignRequest {
  alg: string;
  headers: Field[];
  claims: Field[];
  secret: string;
}

export interface SignResult {
  token: string;
  publicKey: string;
  keyError: string | null;
  tokenError: string | null;
}

const EMPTY_SIGNATURE: SignResult = { token: "", publicKey: "", keyError: null, tokenError: null };

const DEFAULT_LIFETIME = 3600;

const ALGORITHM_OPTIONS = [
  { group: "Edwards curve", items: [{ value: "EdDSA", label: "EdDSA (Ed25519)" }] },
  {
    group: "HMAC with a shared secret",
    items: [
      { value: "HS256", label: "HS256 (SHA-256)" },
      { value: "HS384", label: "HS384 (SHA-384)" },
      { value: "HS512", label: "HS512 (SHA-512)" },
    ],
  },
  {
    group: "RSA",
    items: [
      { value: "RS256", label: "RS256 (PKCS#1 v1.5, SHA-256)" },
      { value: "RS384", label: "RS384 (PKCS#1 v1.5, SHA-384)" },
      { value: "RS512", label: "RS512 (PKCS#1 v1.5, SHA-512)" },
      { value: "PS256", label: "PS256 (PSS, SHA-256)" },
      { value: "PS384", label: "PS384 (PSS, SHA-384)" },
      { value: "PS512", label: "PS512 (PSS, SHA-512)" },
    ],
  },
  {
    group: "ECDSA",
    items: [
      { value: "ES256", label: "ES256 (P-256)" },
      { value: "ES384", label: "ES384 (P-384)" },
      { value: "ES512", label: "ES512 (P-521)" },
    ],
  },
];

const ALGORITHMS = new Set(ALGORITHM_OPTIONS.flatMap((group) => group.items.map((item) => item.value)));

const SECRET_BYTES: Record<string, number> = { HS256: 32, HS384: 48, HS512: 64 };

const HEADER_NAMES: Record<string, string> = {
  alg: "Algorithm",
  typ: "Type",
  cty: "Content type",
  kid: "Key ID",
  jku: "JWK set URL",
  jwk: "Public key",
  x5u: "X.509 URL",
  x5c: "X.509 chain",
  x5t: "X.509 thumbprint",
  "x5t#S256": "X.509 thumbprint",
  crit: "Critical",
};

const CLAIM_NAMES: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expires",
  nbf: "Not before",
  iat: "Issued at",
  jti: "JWT ID",
  azp: "Authorised party",
  scope: "Scope",
  nonce: "Nonce",
  auth_time: "Authenticated at",
  client_id: "Client ID",
  sid: "Session ID",
};

const HEADER_SUGGESTIONS = Object.keys(HEADER_NAMES).filter((name) => name !== "alg");
const CLAIM_SUGGESTIONS = Object.keys(CLAIM_NAMES);

const TIME_CLAIMS = new Set(["exp", "nbf", "iat", "auth_time"]);

export function readToken(token: string): TokenReading {
  const text = token.trim();
  if (!text) return { header: null, payload: null, signature: "", error: null };

  const parts = text.split(".");
  if (parts.length === 5) {
    return {
      header: null,
      payload: null,
      signature: "",
      error: "That is an encrypted JWE; this page reads signed tokens",
    };
  }
  if (parts.length !== 3) {
    return {
      header: null,
      payload: null,
      signature: "",
      error: `A JWT is three parts separated by dots; this has ${parts.length}`,
    };
  }

  const header = readSegment(parts[0], "header");
  if (typeof header === "string") return { header: null, payload: null, signature: "", error: header };
  const payload = readSegment(parts[1], "payload");
  if (typeof payload === "string") return { header, payload: null, signature: "", error: payload };

  return { header, payload, signature: parts[2], error: null };
}

function readSegment(segment: string, name: string): Record<string, unknown> | string {
  let text: string;
  try {
    text = fromBase64Url(segment);
  } catch {
    return `The ${name} is not base64url`;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return `The ${name} is not JSON`;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return `The ${name} is not a JSON object`;
  return value as Record<string, unknown>;
}

export async function verifySignature(token: string, secret: string, alg: string): Promise<boolean> {
  const key = await loadKey(secret, alg, "verify");
  try {
    await compactVerify(token.trim(), key);
    return true;
  } catch (e) {
    if (isSignatureMismatch(e)) return false;
    throw e;
  }
}

export async function signToken({ alg, headers, claims, secret }: SignRequest): Promise<SignResult> {
  let key: CryptoKey | Uint8Array;
  try {
    key = await loadKey(secret, alg, "sign");
  } catch (e) {
    return { ...EMPTY_SIGNATURE, keyError: message(e) };
  }

  try {
    const rest = fieldsToObject(headers);
    delete rest.alg;
    const header = Object.assign({ alg }, rest, { alg }) as JWTHeaderParameters;
    const token = await new SignJWT(fieldsToObject(claims)).setProtectedHeader(header).sign(key);
    return { ...EMPTY_SIGNATURE, token, publicKey: await publicKeyPem(key, alg) };
  } catch (e) {
    return { ...EMPTY_SIGNATURE, tokenError: message(e) };
  }
}

export async function generateSigningKey(alg: string): Promise<string> {
  if (isSymmetric(alg)) return toBase64Url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES[alg] ?? 32)));
  const { privateKey } = await generateKeyPair(alg, { extractable: true });
  return exportPKCS8(privateKey);
}

type Usage = "sign" | "verify";

async function loadKey(secret: string, alg: string, usage: Usage): Promise<CryptoKey | Uint8Array> {
  const text = secret.trim();
  if (!text) throw new Error("Required");
  if (text.startsWith("-----BEGIN")) return loadPem(text, alg, usage);
  if (text.startsWith("{")) return loadJwk(text, alg, usage);
  if (!isSymmetric(alg)) throw new Error(`${alg} signs with a key, so this needs a PEM or a JWK rather than a phrase`);
  return new TextEncoder().encode(secret);
}

async function loadPem(pem: string, alg: string, usage: Usage): Promise<CryptoKey> {
  if (pem.startsWith("-----BEGIN PRIVATE KEY")) {
    const key = await importPKCS8(pem, alg, { extractable: true });
    return usage === "sign" ? key : publicFromPrivate(key, alg);
  }
  const spki = pem.startsWith("-----BEGIN PUBLIC KEY");
  if (!spki && !pem.startsWith("-----BEGIN CERTIFICATE")) {
    throw new Error(
      "Only PKCS#8 keys, SPKI keys and X.509 certificates are read; openssl pkcs8 -topk8 converts PKCS#1",
    );
  }
  if (usage === "sign") throw new Error("That is a public key; signing needs the private half");
  return spki ? importSPKI(pem, alg) : importX509(pem, alg);
}

async function loadJwk(text: string, alg: string, usage: Usage): Promise<CryptoKey | Uint8Array> {
  let jwk: JWK;
  try {
    jwk = JSON.parse(text) as JWK;
  } catch {
    return Promise.reject(new Error("That key is not JSON"));
  }
  const wanted = usage === "verify" && jwk.kty !== "oct" ? publicJwk(jwk) : jwk;
  return importJWK(wanted, alg, { extractable: true });
}

async function publicFromPrivate(key: CryptoKey, alg: string): Promise<CryptoKey> {
  return await importJWK(publicJwk(await exportJWK(key)), alg, { extractable: true }) as CryptoKey;
}

const PRIVATE_JWK_FIELDS = ["d", "p", "q", "dp", "dq", "qi", "oth", "key_ops", "use", "ext"];

function publicJwk(jwk: JWK): JWK {
  const copy: Record<string, unknown> = { ...jwk };
  for (const field of PRIVATE_JWK_FIELDS) delete copy[field];
  return copy as JWK;
}

async function publicKeyPem(key: CryptoKey | Uint8Array, alg: string): Promise<string> {
  if (key instanceof Uint8Array || key.type !== "private") return "";
  return exportSPKI(await publicFromPrivate(key, alg));
}

function isSignatureMismatch(e: unknown): boolean {
  return (e as { code?: string })?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
}

export function isSymmetric(alg: string): boolean {
  return alg.startsWith("HS");
}

export function parseFieldValue(text: string): unknown {
  if (!text.trim()) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function writeFieldValue(value: unknown): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value) ?? "";
}

function fieldsToObject(fields: Field[]): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  for (const field of fields) {
    const name = field.name.trim();
    if (name) object[name] = parseFieldValue(field.value);
  }
  return object;
}

function duplicateErrors(fields: Field[]): (string | null)[] {
  const seen = new Set<string>();
  return fields.map((field) => {
    const name = field.name.trim();
    if (!name) return null;
    const repeated = seen.has(name);
    seen.add(name);
    return repeated ? "Already used above" : null;
  });
}

function parameterRows(source: Record<string, unknown>, names: Record<string, string>, nowMs: number): ParameterRow[] {
  return Object.entries(source).map(([name, value]) => {
    const row: ParameterRow = {
      name,
      meaning: names[name] ?? "",
      value: JSON.stringify(value) ?? "undefined",
      note: "",
      warn: false,
    };
    if (!TIME_CLAIMS.has(name) || typeof value !== "number" || !Number.isFinite(value)) return row;
    const ms = value * 1000;
    row.note = `${TIME_FORMATTER.format(ms)} · ${agoOrIn(ms, nowMs)}`;
    row.warn = name === "exp" ? ms <= nowMs : ms > nowMs;
    return row;
  });
}

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31556952],
  ["month", 2629746],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

function agoOrIn(ms: number, nowMs: number): string {
  const seconds = Math.round((ms - nowMs) / 1000);
  const size = Math.abs(seconds);
  const unit = RELATIVE_UNITS.find(([, span]) => size >= span) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return RELATIVE_FORMATTER.format(Math.trunc(seconds / unit[1]), unit[0]);
}

let nextFieldId = 0;

function newField(name: string, value: string): Field {
  return { id: `field-${nextFieldId++}`, name, value };
}

function starterForm(): Form {
  const issued = Math.floor(Date.now() / 1000);
  return {
    headers: [newField("typ", "JWT")],
    claims: [
      newField("sub", crypto.randomUUID()),
      newField("iat", String(issued)),
      newField("exp", String(issued + DEFAULT_LIFETIME)),
    ],
  };
}

function formFromReading(reading: TokenReading): { form: Form; alg: string | null } {
  const header = reading.header ?? {};
  const payload = reading.payload ?? {};
  return {
    form: {
      headers: Object.entries(header).filter(([name]) => name !== "alg").map(toField),
      claims: Object.entries(payload).map(toField),
    },
    alg: typeof header.alg === "string" && ALGORITHMS.has(header.alg) ? header.alg : null,
  };
}

function toField([name, value]: [string, unknown]): Field {
  return newField(name, writeFieldValue(value));
}

function fieldPairs(fields: Field[] | undefined): [string, string][] | undefined {
  return fields?.map((field) => [field.name, field.value]);
}

function sharedForm(state: { headers?: unknown; claims?: unknown } | null): Form | null {
  const headers = pickPairs(state?.headers);
  const claims = pickPairs(state?.claims);
  if (!headers && !claims) return null;
  return { headers: headers ?? [], claims: claims ?? [] };
}

function pickPairs(value: unknown): Field[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string")
    .map((pair) => newField(pair[0], pair[1]));
}

function pickAlgorithm(value: unknown): string {
  return ALGORITHMS.has(value as string) ? value as string : "EdDSA";
}

function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "That did not work";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}
