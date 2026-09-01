import { ActionIcon, Badge, Box, Button, Card, CopyButton, Group, NumberInput, SegmentedControl, Select, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconUpload, IconX } from "../../icons";
import { ALGORITHMS, algorithmSpec, AUTHORITY_DAYS, DEFAULT_DAYS, KIND_OPTIONS, KINDS, MAX_DAYS, pickAlgorithm, pickKind, pickText, pickVariant } from "./algorithms";
import { arrange } from "./chain";
import { checkIssuer, issue, type Issued } from "./issue";
import { fileText, publicText, readItems } from "./read";
import type { Chain, Extension, Item, Match } from "./types";
import { clampWhole, expiryLabel, isCountry, isHostOrAddress, message, parseWhole, splitAltNames } from "./validate";
import { validity } from "./validity";

type Mode = "decode" | "generate";

export default function Certificate() {
  const initialState = useInitialHashState<{
    mode?: string;
    text?: string;
    kind?: string;
    algorithm?: string;
    variant?: string;
    commonName?: string;
    organisation?: string;
    country?: string;
    altNames?: string;
    days?: number;
    issuer?: string;
  }>();

  const initialKind = pickKind(initialState?.kind);
  const initialAlgorithm = pickAlgorithm(initialState?.algorithm);

  const [mode, setMode] = useState<Mode>(initialState?.mode === "generate" ? "generate" : "decode");
  const [text, setText] = useState(() => pickText(initialState?.text, ""));
  const [items, setItems] = useState<Item[]>([]);
  const [fileError, setFileError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const [kind, setKind] = useState(initialKind);
  const [algorithm, setAlgorithm] = useState(initialAlgorithm);
  const [variant, setVariant] = useState(() => pickVariant(initialAlgorithm, initialState?.variant));
  const [commonName, setCommonName] = useState(() => pickText(initialState?.commonName, ""));
  const [organisation, setOrganisation] = useState(() => pickText(initialState?.organisation, ""));
  const [country, setCountry] = useState(() => pickText(initialState?.country, ""));
  const [altNames, setAltNames] = useState(() => pickText(initialState?.altNames, ""));
  const [days, setDays] = useState<number | string>(() =>
    clampWhole(initialState?.days, defaultDays(initialKind), MAX_DAYS)
  );
  const [passphrase, setPassphrase] = useState("");
  const [issuerCertificate, setIssuerCertificate] = useState(() => pickText(initialState?.issuer, ""));
  const [issuerKey, setIssuerKey] = useState("");
  const [issuerError, setIssuerError] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [running, setRunning] = useState(false);
  const [asked, setAsked] = useState(false);

  const readRun = useRef(0);
  const issuerRun = useRef(0);
  const issueRun = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const spec = algorithmSpec(algorithm);
  const shape = KINDS[kind];

  useRegisterShareState(() => ({
    mode,
    text: mode === "decode" ? publicText(text) || undefined : undefined,
    kind: mode === "generate" ? kind : undefined,
    algorithm: mode === "generate" ? algorithm : undefined,
    variant: mode === "generate" && spec?.variants ? variant : undefined,
    commonName: mode === "generate" && commonName ? commonName : undefined,
    organisation: mode === "generate" && organisation ? organisation : undefined,
    country: mode === "generate" && country ? country : undefined,
    altNames: mode === "generate" && !shape.authority && altNames ? altNames : undefined,
    days: mode === "generate" ? days : undefined,
    issuer: mode === "generate" && shape.signed && issuerCertificate ? issuerCertificate : undefined,
  }));

  useEffect(() => {
    const runId = ++readRun.current;
    void readItems(text).then((read) => {
      if (readRun.current === runId) setItems(read);
    });
  }, [text]);

  useEffect(() => {
    if (!shape.signed) return;
    const runId = ++issuerRun.current;
    void checkIssuer(issuerCertificate, issuerKey).then((found) => {
      if (issuerRun.current === runId) setIssuerError(found);
    });
  }, [shape.signed, issuerCertificate, issuerKey]);

  const { items: ordered, chains, matches } = useMemo(() => arrange(items), [items]);
  const dated = items.some((item) => item.notAfter !== null);
  const secrets = items.some((item) => item.secret);

  useEffect(() => {
    if (mode !== "decode" || !dated) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mode, dated]);

  const missingName = commonName.trim() === "";
  const namedWrong = !shape.authority && !missingName && altNames.trim() === ""
    && !isHostOrAddress(commonName.trim());
  const commonNameError = missingName && asked
    ? "Required"
    : namedWrong
    ? "Enter a host name or IP address, or name the hosts below"
    : null;
  const altNamesError = splitAltNames(altNames).some((entry) => !isHostOrAddress(entry))
    ? "Enter host names or IP addresses"
    : null;
  const countryError = country.trim() !== "" && !isCountry(country.trim())
    ? "Two letters"
    : null;
  const parsedDays = parseWhole(days, MAX_DAYS);
  const daysError = parsedDays === null ? `Enter a validity of 1 to ${MAX_DAYS} days` : null;
  const missingIssuer = shape.signed && (issuerCertificate.trim() === "" || issuerKey.trim() === "");
  const issuerMessage = missingIssuer && asked ? "Required" : issuerError;
  const settled = !missingName && !namedWrong && !altNamesError && !countryError && !daysError && !missingIssuer
    && issuerError === "";

  const request = useMemo(
    () => ({
      kind,
      algorithm,
      variant,
      commonName,
      organisation,
      country,
      altNames,
      days,
      passphrase,
      issuerCertificate,
      issuerKey,
    }),
    [
      kind,
      algorithm,
      variant,
      commonName,
      organisation,
      country,
      altNames,
      days,
      passphrase,
      issuerCertificate,
      issuerKey,
    ],
  );
  const stale = made === null || made.request !== request;
  const result = stale ? null : made.result;
  const error = stale ? "" : made.error;

  const generate = useCallback(async () => {
    setAsked(true);
    if (!settled) return;
    const runId = ++issueRun.current;
    setRunning(true);
    try {
      const built = await issue({
        kind,
        algorithm,
        variant,
        commonName,
        organisation,
        country,
        altNames,
        days: parsedDays ?? DEFAULT_DAYS,
        passphrase,
        issuerCertificate,
        issuerKey,
      });
      if (issueRun.current === runId) setMade({ request, result: built, error: "" });
    } catch (e) {
      if (issueRun.current === runId) setMade({ request, result: null, error: message(e) });
    } finally {
      if (issueRun.current === runId) setRunning(false);
    }
  }, [
    settled,
    kind,
    algorithm,
    variant,
    commonName,
    organisation,
    country,
    altNames,
    parsedDays,
    passphrase,
    issuerCertificate,
    issuerKey,
    request,
  ]);

  const takeFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_FILE) {
      setFileError("This file is far too large to be a certificate");
      return;
    }
    const read = fileText(new Uint8Array(await file.arrayBuffer()));
    setFileError(read === "" ? "This file is not a certificate, a request or a key this page can read" : "");
    if (read !== "") setText(read);
  };

  const handleKind = useCallback((value: string) => {
    if (!(value in KINDS)) return;
    setDays((current) => current === defaultDays(kind) ? defaultDays(value) : current);
    setKind(value);
    setAsked(false);
  }, [kind]);

  const handleAlgorithm = (value: string | null) => {
    if (value === null) return;
    setAlgorithm(value);
    setVariant(pickVariant(value, null));
  };

  const useAsIssuer = () => {
    if (!result) return;
    setIssuerCertificate(result.chain || result.certificate);
    setIssuerKey(result.privateKey);
    handleKind("issued");
    setCommonName("");
  };

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="certificate"
        control={
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            data={[{ value: "decode", label: "Decode" }, { value: "generate", label: "Generate" }]}
          />
        }
      >
        Certificate
      </UtilityTitle>

      {mode === "decode" && (
        <>
          <Card withBorder shadow="sm" radius="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Title order={4}>Input</Title>
                <Group gap="xs">
                  <Tooltip label="Open a file" withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => fileInput.current?.click()}
                      aria-label="Open a file"
                    >
                      <IconUpload size="1.2rem" />
                    </ActionIcon>
                  </Tooltip>
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void takeFile(event.currentTarget.files?.item(0) ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Tooltip label="Clear" withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => setText("")}
                      disabled={text === ""}
                      aria-label="Clear input"
                    >
                      <IconX size="1.2rem" />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              <Textarea
                value={text}
                onChange={(event) => {
                  setText(event.currentTarget.value);
                  setFileError("");
                }}
                placeholder="Paste a certificate, a certification request, a public key, a private key or an SSH key"
                aria-label="Input"
                error={fileError}
                autosize
                minRows={6}
                maxRows={16}
                spellCheck={false}
                autoCapitalize="off"
                styles={{ input: { fontFamily: "monospace" } }}
              />
              {secrets && (
                <Text size="xs" c="dimmed">
                  The private key stays in this tab — the share link carries only what is public.
                </Text>
              )}
            </Stack>
          </Card>

          {chains.length > 0 && <ChainCard chains={chains} />}
          {ordered.map((item) => <ItemCard key={item.id} item={item} match={matches[item.id]} now={now} />)}
        </>
      )}

      {mode === "generate" && (
        <>
          <Card withBorder shadow="sm" radius="md">
            <Stack>
              <Box className="settings-row">
                <Select
                  label="Certificate kind"
                  data={KIND_OPTIONS}
                  value={kind}
                  onChange={(value) => value && handleKind(value)}
                  allowDeselect={false}
                />
                <Select
                  label="Algorithm"
                  data={ALGORITHMS.map(({ value, label }) => ({ value, label }))}
                  value={algorithm}
                  onChange={handleAlgorithm}
                  allowDeselect={false}
                />
                {spec?.variants && (
                  <Select
                    label={spec.variantLabel}
                    data={spec.variants}
                    value={variant}
                    onChange={(value) => value && setVariant(value)}
                    allowDeselect={false}
                  />
                )}
              </Box>

              {shape.signed && (
                <Stack gap="xs">
                  <Textarea
                    label="Issuer certificate"
                    description="The authority that is to sign this one, and whatever is above it"
                    aria-label="Issuer certificate"
                    placeholder="-----BEGIN CERTIFICATE-----"
                    value={issuerCertificate}
                    onChange={(event) => setIssuerCertificate(event.currentTarget.value)}
                    error={issuerMessage}
                    autosize
                    minRows={3}
                    maxRows={8}
                    spellCheck={false}
                    autoCapitalize="off"
                    styles={{ input: { fontFamily: "monospace" } }}
                  />
                  <Textarea
                    label="Issuer private key"
                    description="Never sent anywhere, and never written into the share link"
                    aria-label="Issuer private key"
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    value={issuerKey}
                    onChange={(event) => setIssuerKey(event.currentTarget.value)}
                    autosize
                    minRows={3}
                    maxRows={8}
                    spellCheck={false}
                    autoCapitalize="off"
                    styles={{ input: { fontFamily: "monospace" } }}
                  />
                </Stack>
              )}

              <Box
                className={commonNameError || countryError ? "settings-row has-error" : "settings-row"}
                mb={commonNameError || countryError ? "md" : 0}
              >
                <TextInput
                  label="Common name"
                  description={shape.authority ? "What the authority is called" : "The host this is issued to"}
                  placeholder={shape.authority ? "Example Root CA" : "localhost"}
                  value={commonName}
                  onChange={(event) => setCommonName(event.currentTarget.value)}
                  error={commonNameError}
                  spellCheck={false}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                />
                <TextInput
                  label="Organisation"
                  description="Left off when blank"
                  placeholder="Example Pty Ltd"
                  value={organisation}
                  onChange={(event) => setOrganisation(event.currentTarget.value)}
                />
                <TextInput
                  label="Country"
                  description="Two letters, left off when blank"
                  placeholder="AU"
                  value={country}
                  onChange={(event) => setCountry(event.currentTarget.value)}
                  error={countryError}
                  spellCheck={false}
                  classNames={{ root: "relative-root", error: "absolute-error" }}
                />
              </Box>

              {!shape.authority && (
                <Box
                  className={altNamesError ? "settings-row has-error" : "settings-row"}
                  mb={altNamesError ? "md" : 0}
                >
                  <TextInput
                    label="Subject alternative names"
                    description="What a TLS client matches the host against; the common name when blank"
                    placeholder="localhost, 127.0.0.1"
                    value={altNames}
                    onChange={(event) => setAltNames(event.currentTarget.value)}
                    error={altNamesError}
                    spellCheck={false}
                    classNames={{ root: "relative-root", error: "absolute-error" }}
                  />
                </Box>
              )}

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
                <TextInput
                  label="Passphrase"
                  description="Left unencrypted when blank"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.currentTarget.value)}
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </Box>

              <Group justify="flex-end" wrap="nowrap">
                <Text size="sm" c={error ? "red" : "dimmed"} flex={1}>{error}</Text>
                <Button onClick={generate} loading={running}>Generate</Button>
              </Group>
            </Stack>
          </Card>

          {result && (
            <Card withBorder shadow="sm" radius="md" data-made>
              <Stack gap="md">
                <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
                  <Group gap="sm" align="baseline" style={{ minWidth: 0 }}>
                    <Title order={4} style={{ whiteSpace: "nowrap" }}>{shape.label}</Title>
                    <Text size="sm" c="dimmed" ff="monospace" style={{ wordBreak: "break-all" }}>
                      {result.fingerprint}
                    </Text>
                  </Group>
                  {result.authority && !result.locked && (
                    <Button size="xs" variant="light" onClick={useAsIssuer} style={{ flexShrink: 0 }}>
                      Use as issuer
                    </Button>
                  )}
                </Group>
                <Output label="Private key" value={result.privateKey} />
                <Output label="Certificate" value={result.certificate} />
                {result.chain !== "" && <Output label="Certificate chain" value={result.chain} />}
              </Stack>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}

interface Made {
  request: unknown;
  result: Issued | null;
  error: string;
}

const MAX_FILE = 4 * 1024 * 1024;

function defaultDays(kind: string): number {
  return KINDS[kind]?.authority ? AUTHORITY_DAYS : DEFAULT_DAYS;
}

function Output({ label, value }: { label: string; value: string }) {
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
        minRows={6}
        maxRows={12}
        spellCheck={false}
        styles={{ input: { fontFamily: "monospace" } }}
      />
    </Stack>
  );
}

function ItemCard({ item, match, now }: { item: Item; match: Match | undefined; now: number }) {
  const verdict = validity(item.notBefore, item.notAfter, now);

  return (
    <Card withBorder shadow="sm" radius="md" data-item={item.kind}>
      <Stack gap="xs">
        <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
          <Group gap="sm" align="baseline" wrap="nowrap" style={{ minWidth: 0 }}>
            <Title order={4} style={{ whiteSpace: "nowrap" }}>{item.heading}</Title>
            {item.name !== "" && <Text size="sm" c="dimmed" truncate>{item.name}</Text>}
          </Group>
          <Group gap="xs" justify="flex-end">
            {verdict && <Badge color={verdict.colour} variant="light">{verdict.text}</Badge>}
            {item.ca && <Badge color="grape" variant="light">Certificate authority</Badge>}
            {item.selfIssued && <Badge color="gray" variant="light">Self-issued</Badge>}
            {match && <Badge color={match.found ? "teal" : "gray"} variant="light">{match.text}</Badge>}
          </Group>
        </Group>

        {item.error !== "" && <Text size="sm" c={item.kind === "unreadable" ? "red" : "dimmed"}>{item.error}</Text>}
        {item.facts.length > 0 && <FactTable rows={item.facts} />}
        {item.extensions.length > 0 && (
          <>
            <Text size="sm" fw={500} mt="xs">Extensions</Text>
            <ExtensionTable rows={item.extensions} />
          </>
        )}
      </Stack>
    </Card>
  );
}

function ExtensionTable({ rows }: { rows: Extension[] }) {
  return (
    <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
      <Table.Tbody>
        {rows.map((row, index) => (
          <Table.Tr key={`${row.oid}-${index}`} data-extension={row.name}>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap" }} valign="top">
              <Text size="sm" c="dimmed">{row.name}</Text>
              {row.critical && <Text size="xs" c="orange">Critical</Text>}
            </Table.Td>
            <Table.Td valign="top">
              <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>{row.value}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function ChainCard({ chains }: { chains: Chain[] }) {
  return (
    <Card withBorder shadow="sm" radius="md" data-chain>
      <Stack gap="xs">
        <Title order={4}>Chain</Title>
        {chains.map((chain, index) => (
          <Stack key={chain.rows[0]?.id ?? index} gap={4}>
            <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
              <Table.Tbody>
                {chain.rows.map((row) => (
                  <Table.Tr key={row.id} data-link={row.role}>
                    <Table.Td w="1%" style={{ whiteSpace: "nowrap" }} valign="top">
                      <Text size="sm" c="dimmed">{row.role}</Text>
                    </Table.Td>
                    <Table.Td valign="top">
                      <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>{row.name}</Text>
                      {row.issue !== "" && <Text size="xs" c="dimmed">{row.issue}</Text>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {chain.note !== "" && <Text size="sm" c={chain.ordered ? "dimmed" : "orange"}>{chain.note}</Text>}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
