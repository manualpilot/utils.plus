import { ActionIcon, Autocomplete, Badge, Box, Button, Card, CopyButton, Group, SegmentedControl, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNewRowFocus } from "../../common/new-row-focus";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconPlus, IconRefresh, IconTrash, IconX } from "../../icons";
import { ALGORITHM_OPTIONS, DEFAULT_ALGORITHM, DEFAULT_KEY_ALGORITHM, EMPTY_RESULT, ENCRYPTION_OPTIONS, isEncryption, isSymmetric, KEY_ALGORITHM_OPTIONS, PROTECTION_OPTIONS } from "./algorithms";
import { CLAIM_NAMES, CLAIM_SUGGESTIONS, HEADER_NAMES, HEADER_SUGGESTIONS, parameterRows } from "./claims";
import { decryptToken, encryptToken, isWrongKey } from "./encrypt";
import { duplicateErrors, fieldPairs, formFromReading, message, newField, pickAlgorithm, pickEncryption, pickText, sharedForm, starterForm } from "./fields";
import { generateKey } from "./keys";
import { sampleToken } from "./sample";
import { signToken, verifySignature } from "./sign";
import { readToken } from "./token";
import type { BuildResult, Check, Field, FieldCardProps, FieldKind, Form, Mode, Opened, ParameterRow, Protection } from "./types";

export default function Jwt() {
  const initialState = useInitialHashState<{
    mode?: string;
    token?: string;
    secret?: string;
    alg?: string;
    enc?: string;
    headers?: unknown;
    claims?: unknown;
  }>();

  const initialMode: Mode = initialState?.mode === "encode" ? "encode" : "decode";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [token, setToken] = useState(pickText(initialState?.token));
  const [secret, setSecret] = useState(pickText(initialState?.secret));
  const [alg, setAlg] = useState(pickAlgorithm(initialState?.alg));
  const [enc, setEnc] = useState(pickEncryption(initialState?.enc));
  const [form, setForm] = useState<Form | null>(
    () => sharedForm(initialState) ?? (initialMode === "encode" ? starterForm() : null),
  );
  const [built, setBuilt] = useState<BuildResult | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const source = useRef("");
  const sample = useRef({ token: "", secret: "" });
  const showing = useRef({ token, secret });
  const generated = useRef("");
  const buildRun = useRef(0);
  const checkRun = useRef(0);
  const keyRun = useRef(0);

  showing.current = { token, secret };

  const reading = useMemo(() => readToken(token), [token]);
  const headerAlg = typeof reading.header?.alg === "string" ? reading.header.alg : null;
  const protection: Protection = isEncryption(alg) ? "encrypted" : "signed";

  const sampled = mode === "decode" && token === sample.current.token && secret === sample.current.secret;

  useRegisterShareState(() => ({
    mode,
    token: mode === "decode" && token && !sampled ? token : undefined,
    secret: secret && !sampled ? secret : undefined,
    alg: mode === "encode" ? alg : undefined,
    enc: mode === "encode" && protection === "encrypted" ? enc : undefined,
    headers: mode === "encode" ? fieldPairs(form?.headers) : undefined,
    claims: mode === "encode" ? fieldPairs(form?.claims) : undefined,
  }));

  useEffect(() => {
    if (initialState) return;
    const runId = ++buildRun.current;
    sampleToken(alg)
      .then(({ form, secret, signed }) => {
        if (buildRun.current !== runId || !signed.token || showing.current.token || showing.current.secret) return;
        sample.current = { token: signed.token, secret };
        source.current = signed.token;
        generated.current = secret;
        setForm(form);
        setBuilt(signed);
        setSecret(secret);
        setToken(signed.token);
      })
      .catch((e) => {
        if (buildRun.current === runId) setBuilt({ ...EMPTY_RESULT, tokenError: message(e) });
      });
  }, []);

  useEffect(() => {
    if (mode !== "decode") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    const nothingToAsk = mode !== "decode" || !reading.header || !secret.trim() || !headerAlg
      || (!reading.encrypted && headerAlg === "none");
    if (nothingToAsk) {
      setCheck(null);
      setOpened(null);
      return;
    }
    const runId = ++checkRun.current;
    const asked = reading.encrypted
      ? decryptToken(token, secret, headerAlg).then((result) => {
        if (checkRun.current !== runId) return;
        setOpened(result);
        setCheck({ ok: true, error: null });
      })
      : verifySignature(token, secret, headerAlg).then((ok) => {
        if (checkRun.current === runId) setCheck({ ok, error: null });
      });
    asked.catch((e) => {
      if (checkRun.current !== runId) return;
      setOpened(null);
      setCheck({ ok: false, error: isWrongKey(e) ? null : message(e) });
    });
  }, [mode, token, secret, reading, headerAlg]);

  useEffect(() => {
    if (mode !== "encode" || !form) return;
    const runId = ++buildRun.current;
    const request = { alg, headers: form.headers, claims: form.claims, secret };
    (protection === "encrypted" ? encryptToken({ ...request, enc }) : signToken(request))
      .then((result) => {
        if (buildRun.current !== runId) return;
        setBuilt(result);
        if (result.token) source.current = result.token;
      })
      .catch((e) => {
        if (buildRun.current === runId) setBuilt({ ...EMPTY_RESULT, tokenError: message(e) });
      });
  }, [mode, form, alg, enc, protection, secret]);

  const fillKey = useCallback((target: string, targetEnc: string) => {
    const runId = ++keyRun.current;
    generateKey(target, targetEnc)
      .then((key) => {
        if (keyRun.current !== runId) return;
        generated.current = key;
        setSecret(key);
      })
      .catch((e) => {
        if (keyRun.current === runId) setBuilt({ ...EMPTY_RESULT, keyError: message(e) });
      });
  }, []);

  const handleMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "encode") enterEncode();
    else if (built?.token) {
      setToken(built.token);
      source.current = built.token;
    }
    setMode(next);
  };

  const enterEncode = () => {
    const payload = reading.payload ?? opened?.claims ?? null;
    const transferred = reading.header && payload && token.trim() !== source.current
      ? formFromReading(reading, payload)
      : null;
    if (transferred) {
      setForm(transferred.form);
      if (transferred.alg) setAlg(transferred.alg);
      if (transferred.enc) setEnc(transferred.enc);
    } else if (!form) {
      setForm(starterForm());
    }
    source.current = token.trim();
    if (!secret.trim()) fillKey(transferred?.alg ?? alg, transferred?.enc ?? enc);
  };

  const handleAlgorithm = (value: string | null) => {
    const next = pickAlgorithm(value);
    setAlg(next);
    if (!secret.trim() || secret === generated.current) fillKey(next, enc);
  };

  const handleProtection = (value: string | null) => {
    handleAlgorithm(value === "encrypted" ? DEFAULT_KEY_ALGORITHM : DEFAULT_ALGORITHM);
  };

  const handleEncryption = (value: string | null) => {
    const next = pickEncryption(value);
    setEnc(next);
    if (alg === "dir" && (!secret.trim() || secret === generated.current)) fillKey(alg, next);
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

  const keyError = mode === "decode" ? check?.error ?? null : built?.keyError ?? null;
  const claims = reading.payload ?? opened?.claims ?? null;

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="jwt"
        control={
          <SegmentedControl
            value={mode}
            onChange={(value) => handleMode(value as Mode)}
            data={[{ value: "decode", label: "Decode" }, { value: "encode", label: "Encode" }]}
          />
        }
      >
        JWT
      </UtilityTitle>

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
                label="Protection"
                description="Claims anybody can read and nobody can alter, or claims only the key can read"
                data={PROTECTION_OPTIONS}
                value={protection}
                onChange={handleProtection}
                allowDeselect={false}
              />
              <Select
                label="Algorithm"
                description={protection === "encrypted"
                  ? "How the content key is wrapped, and what the key below is generated for"
                  : "What the header will say, and what the key below is generated for"}
                data={protection === "encrypted" ? KEY_ALGORITHM_OPTIONS : ALGORITHM_OPTIONS}
                value={alg}
                onChange={handleAlgorithm}
                allowDeselect={false}
              />
              {protection === "encrypted" && (
                <Select
                  label="Encryption"
                  description="What the claims themselves are encrypted under"
                  data={ENCRYPTION_OPTIONS}
                  value={enc}
                  onChange={handleEncryption}
                  allowDeselect={false}
                />
              )}
            </Box>
          )}
          <Group justify="space-between" gap="sm" wrap="nowrap">
            <Group gap="sm" align="baseline">
              <Title order={4}>{isSymmetric(mode === "decode" ? headerAlg ?? alg : alg) ? "Secret" : "Key"}</Title>
              {mode === "decode" && (
                <VerdictBadge
                  check={check}
                  encrypted={reading.encrypted}
                  unsigned={!reading.encrypted && headerAlg === "none"}
                  given={!!secret.trim()}
                />
              )}
            </Group>
            <Group gap="xs">
              {mode === "encode" && (
                <Tooltip label="Generate a new key" withArrow position="left">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => fillKey(alg, enc)}
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
            onChange={(event) => setSecret(event.currentTarget.value)}
            placeholder={placeholderFor(mode, reading.encrypted)}
            aria-label="Key"
            error={keyError}
            autosize
            minRows={2}
            maxRows={8}
            spellCheck={false}
            autoCapitalize="off"
            styles={{ input: { fontFamily: "monospace" } }}
          />
          {mode === "encode" && built?.publicKey && (
            <>
              <Group justify="space-between" gap="sm" wrap="nowrap">
                <Title order={4}>Public key</Title>
                <CopyButton value={built.publicKey} timeout={2000}>
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
                value={built.publicKey}
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

      {mode === "decode" && (claims || (reading.encrypted && !opened)) && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Title order={4}>Claims</Title>
            <ParameterTable
              rows={parameterRows(claims ?? {}, CLAIM_NAMES, now)}
              empty={reading.encrypted
                ? "The key that opens this token is what reads these"
                : "This token claims nothing"}
            />
          </Stack>
        </Card>
      )}

      {mode === "decode" && opened && !opened.claims && (
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="xs">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Title order={4}>Payload</Title>
              <CopyButton value={opened.text} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      aria-label="Copy payload"
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Text size="sm" c="dimmed">This token wraps something other than a set of claims</Text>
            <Textarea
              value={opened.text}
              aria-label="Payload"
              readOnly
              autosize
              minRows={2}
              maxRows={12}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
            />
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
                  {built?.token && <Text size="sm" c="dimmed">{built.token.length} characters</Text>}
                </Group>
                <CopyButton value={built?.token ?? ""} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        disabled={!built?.token}
                        aria-label="Copy token"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              <Textarea
                value={built?.token ?? ""}
                aria-label="Token"
                readOnly
                error={built?.tokenError}
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

interface VerdictProps {
  check: Check | null;
  encrypted: boolean;
  unsigned: boolean;
  given: boolean;
}

function VerdictBadge({ check, encrypted, unsigned, given }: VerdictProps) {
  if (unsigned) return <Badge color="yellow" variant="light">Unsigned</Badge>;
  if (!given || check?.error) {
    return <Badge color="gray" variant="light">{encrypted ? "Not decrypted" : "Signature not checked"}</Badge>;
  }
  if (!check) return <Badge color="gray" variant="light">{encrypted ? "Decrypting" : "Checking"}</Badge>;
  if (encrypted) {
    return check.ok
      ? <Badge color="teal" variant="light">Decrypted</Badge>
      : <Badge color="red" variant="light">Wrong key</Badge>;
  }
  return check.ok
    ? <Badge color="teal" variant="light">Signature valid</Badge>
    : <Badge color="red" variant="light">Signature invalid</Badge>;
}

function placeholderFor(mode: Mode, encrypted: boolean): string {
  if (mode === "encode") return "";
  return encrypted
    ? "The secret or private key this token was encrypted to"
    : "Optional: a secret or public key to check the signature with";
}

function FieldCard({ title, kind, fields, names, onChange, onAdd, onRemove }: FieldCardProps) {
  const errors = duplicateErrors(fields);
  const singular = kind === "headers" ? "Header" : "Claim";
  const { ref: newRow, focusNewRow } = useNewRowFocus();

  const handleAdd = () => {
    onAdd(kind);
    focusNewRow();
  };

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack>
        <Title order={4}>{title}</Title>

        {fields.length === 0
          ? <Text size="sm" c="dimmed">Nothing here yet</Text>
          : fields.map((field, index) => (
            <Box
              key={field.id}
              className={errors[index] ? "settings-row has-error" : "settings-row"}
              mb={errors[index] ? "md" : 0}
            >
              <Autocomplete
                ref={index === fields.length - 1 ? newRow : undefined}
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

        <Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size="0.9rem" />}
            onClick={handleAdd}
          >
            Add {singular.toLowerCase()}
          </Button>
        </Group>
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
