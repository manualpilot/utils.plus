import { ActionIcon, Autocomplete, Badge, Box, Button, Card, CopyButton, Group, SegmentedControl, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconPlus, IconRefresh, IconTrash, IconX } from "../../icons";
import { ALGORITHM_OPTIONS, EMPTY_SIGNATURE, isSymmetric } from "./algorithms";
import { CLAIM_NAMES, CLAIM_SUGGESTIONS, HEADER_NAMES, HEADER_SUGGESTIONS, parameterRows } from "./claims";
import { duplicateErrors, fieldPairs, formFromReading, message, newField, pickAlgorithm, pickText, sharedForm, starterForm } from "./fields";
import { generateSigningKey, signToken, verifySignature } from "./sign";
import { readToken } from "./token";
import type { Check, Field, FieldCardProps, FieldKind, Form, Mode, ParameterRow, SignResult } from "./types";

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
