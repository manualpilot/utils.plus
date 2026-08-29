import { ActionIcon, Box, Button, Card, CopyButton, Group, PasswordInput, SegmentedControl, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { byteSize } from "../../common/byte-size";
import { download } from "../../common/download";
import { shareLink, useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCertificate, IconCheck, IconCopy, IconDownload, IconRefresh, IconUpload, IconX } from "../../icons";
import { generateAgeIdentity } from "./age";
import { ALGORITHM_OPTIONS, ALGORITHMS, keyLength } from "./algorithms";
import { encodeBytes, type Encoding, ENCODING_OPTIONS, respell, utf8 } from "./encoding";
import { type Job, type Mode, type Outcome, runJob, type Source } from "./run";
import { derivedPublicKey, derivedRecipients, message, pickAlgorithm, pickEncoding, pickKeySize, pickMode, pickRecipient, pickText, randomKey, randomNonce, readField } from "./settings";
import { type Loaded, MAX_BYTES, readFileBytes } from "./source";

export default function Cryptography() {
  const initialState = useInitialHashState<{
    mode?: string;
    algorithm?: string;
    keySize?: number;
    keyEncoding?: string;
    messageEncoding?: string;
    key?: string;
    peerKey?: string;
    nonce?: string;
    aad?: string;
    recipient?: string;
    recipients?: string;
    identities?: string;
    publicKey?: string;
    privateKey?: string;
    passphrase?: string;
    password?: string;
    text?: string;
  }>();

  const initialAlgorithm = pickAlgorithm(initialState?.algorithm);

  const [mode, setMode] = useState<Mode>(pickMode(initialState?.mode));
  const [algorithm, setAlgorithm] = useState(initialAlgorithm);
  const [keySize, setKeySize] = useState(pickKeySize(initialAlgorithm, initialState?.keySize));
  const [keyEncoding, setKeyEncoding] = useState<Encoding>(pickEncoding(initialState?.keyEncoding, "hex"));
  const [messageEncoding, setMessageEncoding] = useState<Encoding>(
    pickEncoding(initialState?.messageEncoding, "base64"),
  );
  const [key, setKey] = useState(() => pickText(initialState?.key));
  const [peerKey, setPeerKey] = useState(() => pickText(initialState?.peerKey));
  const [nonce, setNonce] = useState(() => pickText(initialState?.nonce));
  const [aad, setAad] = useState(pickText(initialState?.aad));
  const [recipient, setRecipient] = useState(pickRecipient(initialState?.recipient));
  const [recipients, setRecipients] = useState(pickText(initialState?.recipients));
  const [identities, setIdentities] = useState(pickText(initialState?.identities));
  const [identityHalves, setIdentityHalves] = useState<string[]>([]);
  const [publicKey, setPublicKey] = useState(pickText(initialState?.publicKey));
  const [privateKey, setPrivateKey] = useState(pickText(initialState?.privateKey));
  const [passphrase, setPassphrase] = useState(pickText(initialState?.passphrase));
  const [password, setPassword] = useState(pickText(initialState?.password));
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState(pickText(initialState?.text));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState("");
  const [running, setRunning] = useState(false);
  const runRef = useRef(0);

  const spec = ALGORITHMS[algorithm];
  const symmetric = spec.family === "symmetric" || spec.family === "box";
  const sealed = spec.family === "pgp" || spec.family === "age";

  useRegisterShareState(() => ({
    mode,
    algorithm,
    keySize: spec.keySizes ? keySize : undefined,
    keyEncoding: symmetric ? keyEncoding : undefined,
    messageEncoding: symmetric ? messageEncoding : undefined,
    key: symmetric ? key || undefined : undefined,
    peerKey: spec.family === "box" ? peerKey || undefined : undefined,
    nonce: symmetric && mode === "encrypt" ? nonce || undefined : undefined,
    aad: spec.aad ? aad || undefined : undefined,
    recipient: sealed ? recipient : undefined,
    recipients: spec.family === "age" && recipient === "key" && mode === "encrypt"
      ? recipients || undefined
      : undefined,
    identities: spec.family === "age" && recipient === "key" && mode === "decrypt"
      ? identities || undefined
      : undefined,
    publicKey: spec.family === "pgp" && recipient === "key" && mode === "encrypt" ? publicKey || undefined : undefined,
    privateKey: spec.family === "pgp" && recipient === "key" && mode === "decrypt"
      ? privateKey || undefined
      : undefined,
    passphrase: spec.family === "pgp" && recipient === "key" && mode === "decrypt"
      ? passphrase || undefined
      : undefined,
    password: sealed && recipient === "password" ? password || undefined : undefined,
    text: source === "text" ? text || undefined : undefined,
  }));

  const keyBytes = keyLength(algorithm, keySize);
  const keyField = useMemo(() => readField(key, keyEncoding, keyBytes), [key, keyEncoding, keyBytes]);
  const peerField = useMemo(() => readField(peerKey, keyEncoding, 32), [peerKey, keyEncoding]);
  const nonceField = useMemo(() => readField(nonce, keyEncoding, spec.nonceBytes), [
    nonce,
    keyEncoding,
    spec.nonceBytes,
  ]);
  const aadBytes = useMemo(() => (spec.aad && aad ? utf8(aad) : undefined), [spec.aad, aad]);
  const pgp = useMemo(
    () => ({ recipient, publicKey, privateKey, passphrase, password }),
    [recipient, publicKey, privateKey, passphrase, password],
  );
  const publicHalf = useMemo(
    () => (spec.family === "box" ? derivedPublicKey(key, keyEncoding) : ""),
    [spec.family, key, keyEncoding],
  );
  const age = useMemo(
    () => ({ recipient, recipients, identities, password }),
    [recipient, recipients, identities, password],
  );
  useEffect(() => {
    if (spec.family !== "age" || mode !== "decrypt" || identities.trim() === "") {
      setIdentityHalves([]);
      return;
    }
    let live = true;
    void derivedRecipients(identities).then((halves) => {
      if (live) setIdentityHalves(halves);
    });
    return () => {
      live = false;
    };
  }, [spec.family, mode, identities]);

  const awaited = useMemo(() => {
    const fields: string[] = [];
    if (spec.family === "pgp") {
      if (recipient === "password") {
        if (!password) fields.push("the password");
      } else if (!(mode === "encrypt" ? publicKey : privateKey).trim()) {
        fields.push(mode === "encrypt" ? "the recipient's public key" : "the private key");
      }
      return fields;
    }
    if (spec.family === "age") {
      if (recipient === "password") {
        if (!password) fields.push("the passphrase");
      } else if (!(mode === "encrypt" ? recipients : identities).trim()) {
        fields.push(mode === "encrypt" ? "a recipient" : "an identity");
      }
      return fields;
    }
    if (!key.trim()) fields.push(spec.family === "box" ? "your secret key" : "the key");
    if (spec.family === "box" && !peerKey.trim()) fields.push("their public key");
    if (mode === "encrypt" && !nonce.trim()) fields.push(`the ${spec.nonceNoun}`);
    return fields;
  }, [
    spec.family,
    spec.nonceNoun,
    recipient,
    password,
    publicKey,
    privateKey,
    recipients,
    identities,
    mode,
    key,
    peerKey,
    nonce,
  ]);

  const job = useMemo<Job | null>(() => {
    const filled = source === "text" ? text !== "" : loaded !== null;
    if (!filled || !keysReady()) return null;
    return {
      mode,
      algorithm,
      source,
      text,
      bytes: loaded?.bytes ?? null,
      filename: loaded?.name ?? "",
      encoding: messageEncoding,
      key: keyField.bytes ?? EMPTY,
      peerKey: peerField.bytes ?? EMPTY,
      nonce: nonceField.bytes ?? EMPTY,
      aad: aadBytes,
      pgp,
      age,
    };

    function keysReady(): boolean {
      if (spec.family === "pgp") {
        if (recipient === "password") return password !== "";
        return (mode === "encrypt" ? publicKey : privateKey).trim() !== "";
      }
      if (spec.family === "age") {
        if (recipient === "password") return password !== "";
        return (mode === "encrypt" ? recipients : identities).trim() !== "";
      }
      if (spec.family === "box" && peerField.bytes === null) return false;
      return keyField.bytes !== null && (mode === "decrypt" || nonceField.bytes !== null);
    }
  }, [
    mode,
    algorithm,
    source,
    text,
    loaded,
    messageEncoding,
    keyField,
    peerField,
    nonceField,
    aadBytes,
    pgp,
    age,
    spec.family,
    recipient,
    password,
    publicKey,
    privateKey,
    recipients,
    identities,
  ]);

  useEffect(() => {
    if (job === null) {
      setResult(null);
      setFailure("");
      setRunning(false);
      return;
    }
    const runId = ++runRef.current;
    const live = () => runRef.current === runId;
    setRunning(true);
    runJob(job)
      .then((outcome) => {
        if (!live()) return;
        setResult(outcome);
        setFailure("");
      })
      .catch((e: unknown) => {
        if (!live()) return;
        setResult(null);
        setFailure(message(e, job.mode));
      })
      .finally(() => {
        if (live()) setRunning(false);
      });
    return () => {
      runRef.current++;
    };
  }, [job]);

  const generateIdentity = async () => {
    try {
      setIdentities(await generateAgeIdentity());
    } catch (e) {
      setFailure(message(e, mode));
    }
  };

  const handleMode = (next: Mode) => {
    setMode(next);
    setText(result?.text ?? "");
    setLoaded(null);
    setFailure("");
  };

  const handleAlgorithm = (value: string | null) => {
    if (value === null || !(value in ALGORITHMS)) return;
    setAlgorithm(value);
    const sizes = ALGORITHMS[value].keySizes;
    if (sizes && !sizes.includes(keySize)) setKeySize(sizes[sizes.length - 1]);
  };

  const handleKeyEncoding = (value: string | null) => {
    const next = pickEncoding(value, keyEncoding);
    if (next === keyEncoding) return;
    setKey(respell(key, keyEncoding, next));
    setPeerKey(respell(peerKey, keyEncoding, next));
    setNonce(respell(nonce, keyEncoding, next));
    setKeyEncoding(next);
  };

  const handleFile = async (file: File | null) => {
    if (file === null) return;
    try {
      setLoaded({ name: file.name, size: file.size, bytes: await readFileBytes(file) });
      setFailure("");
    } catch (e) {
      setLoaded(null);
      setFailure(message(e, mode));
    }
  };

  const inputTitle = mode === "encrypt" ? "Message" : "Ciphertext";
  const outputTitle = mode === "encrypt" ? "Ciphertext" : "Message";
  const output = result?.text ?? "";
  const saved = result?.bytes ?? null;

  return (
    <Stack gap="md">
      <UtilityTitle
        directory="cryptography"
        control={
          <SegmentedControl
            size="xs"
            data={MODE_OPTIONS}
            value={mode}
            onChange={(value) => handleMode(value as Mode)}
            aria-label="Direction"
          />
        }
      >
        Cryptography
      </UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Box className="settings-row">
            <Select
              label="Algorithm"
              data={ALGORITHM_OPTIONS}
              value={algorithm}
              onChange={handleAlgorithm}
              allowDeselect={false}
            />
            {spec.keySizes && (
              <Select
                label="Key size"
                data={spec.keySizes.map((size) => ({ value: String(size), label: `${size * 8} bits` }))}
                value={String(keySize)}
                onChange={(value) => value && setKeySize(Number(value))}
                allowDeselect={false}
              />
            )}
            {symmetric && (
              <Select
                label="Key encoding"
                description="How the key and the nonce are written"
                data={ENCODING_OPTIONS}
                value={keyEncoding}
                onChange={handleKeyEncoding}
                allowDeselect={false}
              />
            )}
            {symmetric && (
              <Select
                label="Ciphertext encoding"
                description="How the sealed bytes are written"
                data={ENCODING_OPTIONS}
                value={messageEncoding}
                onChange={(value) => setMessageEncoding(pickEncoding(value, messageEncoding))}
                allowDeselect={false}
              />
            )}
            {sealed && (
              <Select
                label="Encrypted to"
                data={spec.family === "age" ? AGE_RECIPIENT_OPTIONS : RECIPIENT_OPTIONS}
                value={recipient}
                onChange={(value) => setRecipient(pickRecipient(value))}
                allowDeselect={false}
              />
            )}
          </Box>
          <Text size="sm" c="dimmed">{spec.note}</Text>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Title order={4}>Keys</Title>

          {symmetric && (
            <Box className={keyField.error ? "settings-row has-error" : "settings-row"} mb={keyField.error ? "md" : 0}>
              <TextInput
                label={spec.family === "box" ? "Your secret key" : "Key"}
                description={`${keyBytes} bytes, spelled in ${keyEncoding === "hex" ? "hex" : "Base64"}`}
                value={key}
                onChange={(event) =>
                  setKey(event.currentTarget.value)}
                placeholder={spec.family === "box"
                  ? "Paste your secret key, or generate one"
                  : "Paste a key, or generate one"}
                error={keyField.error}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
                rightSection={
                  <GenerateButton
                    label={spec.family === "box" ? "Generate a secret key" : "Generate a random key"}
                    onClick={() => setKey(randomKey(algorithm, keySize, keyEncoding))}
                  />
                }
              />
            </Box>
          )}

          {spec.family === "box" && publicHalf !== "" && (
            <Text size="xs" c="dimmed" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
              Your public key: {publicHalf}
            </Text>
          )}

          {spec.family === "box" && (
            <Box
              className={peerField.error ? "settings-row has-error" : "settings-row"}
              mb={peerField.error ? "md" : 0}
            >
              <TextInput
                label="Their public key"
                description="Whose message this is, or whose it was"
                value={peerKey}
                onChange={(event) => setPeerKey(event.currentTarget.value)}
                placeholder="Paste their public key"
                error={peerField.error}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
                rightSection={
                  <KeygenLink label="Mint a NaCl box pair on Keygen" state={{ kind: "nacl", format: keyEncoding }} />
                }
              />
            </Box>
          )}

          {symmetric && mode === "encrypt" && (
            <Box
              className={nonceField.error ? "settings-row has-error" : "settings-row"}
              mb={nonceField.error ? "md" : 0}
            >
              <TextInput
                label={spec.nonceLabel}
                description={`${spec.nonceBytes} bytes, written in front of the ciphertext`}
                value={nonce}
                onChange={(event) => setNonce(event.currentTarget.value)}
                placeholder="Paste one, or generate one"
                error={nonceField.error}
                spellCheck={false}
                classNames={{ root: "relative-root", error: "absolute-error" }}
                styles={{ input: { fontFamily: "monospace" } }}
                rightSection={
                  <GenerateButton
                    label={`Generate a random ${spec.nonceNoun}`}
                    onClick={() => setNonce(randomNonce(algorithm, keyEncoding))}
                  />
                }
              />
            </Box>
          )}

          {symmetric && mode === "decrypt" && (
            <Text size="sm" c="dimmed">
              The {spec.nonceNoun} is read off the first {spec.nonceBytes} bytes of the ciphertext.
              {result?.nonce && ` It is ${encodeBytes(result.nonce, keyEncoding)}.`}
            </Text>
          )}

          {spec.aad && (
            <Box className="settings-row">
              <TextInput
                label="Additional data"
                description="Authenticated but not encrypted, and needed again to open it"
                value={aad}
                onChange={(event) => setAad(event.currentTarget.value)}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            </Box>
          )}

          {sealed && recipient === "password" && (
            <Box className="settings-row">
              <PasswordInput
                label={spec.family === "age" ? "Passphrase" : "Password"}
                description={spec.family === "age"
                  ? "The file carries its own salt and wraps its key under scrypt over this"
                  : "The message carries its own salt and derives the session key from this"}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </Box>
          )}

          {spec.family === "age" && recipient === "key" && mode === "encrypt" && (
            <Textarea
              label="Recipients"
              description="One age1 recipient, or several to seal the file to every one of them"
              value={recipients}
              onChange={(event) => setRecipients(event.currentTarget.value)}
              placeholder="age1…"
              autosize
              minRows={3}
              maxRows={8}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
              rightSection={<KeygenLink label="Mint an age identity on Keygen" state={AGE_IDENTITY} />}
              rightSectionProps={TEXTAREA_SECTION}
            />
          )}

          {spec.family === "age" && recipient === "key" && mode === "decrypt" && (
            <Stack gap="xs">
              <Textarea
                label="Identities"
                description="Read in this tab and never sent anywhere — the file age-keygen wrote goes in whole"
                value={identities}
                onChange={(event) => setIdentities(event.currentTarget.value)}
                placeholder="AGE-SECRET-KEY-1…"
                autosize
                minRows={3}
                maxRows={8}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
                rightSection={<GenerateButton label="Generate an identity" onClick={() => void generateIdentity()} />}
                rightSectionProps={TEXTAREA_SECTION}
              />
              {identityHalves.length > 0 && (
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ fontFamily: "monospace", wordBreak: "break-all", maxHeight: "4.5em", overflowY: "auto" }}
                >
                  {identityHalves.length === 1 ? "Its recipient" : "Their recipients"}: {identityHalves.join(", ")}
                </Text>
              )}
            </Stack>
          )}

          {spec.family === "pgp" && recipient === "key" && mode === "encrypt" && (
            <Textarea
              label="Recipient public key"
              description="One armoured block, or several to encrypt to every one of them"
              value={publicKey}
              onChange={(event) => setPublicKey(event.currentTarget.value)}
              placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
              autosize
              minRows={3}
              maxRows={8}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
              rightSection={<KeygenLink label="Mint a PGP key pair on Keygen" state={PGP_PAIR} />}
              rightSectionProps={TEXTAREA_SECTION}
            />
          )}

          {spec.family === "pgp" && recipient === "key" && mode === "decrypt" && (
            <>
              <Textarea
                label="Private key"
                description="Read in this tab and never sent anywhere"
                value={privateKey}
                onChange={(event) => setPrivateKey(event.currentTarget.value)}
                placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
                autosize
                minRows={3}
                maxRows={8}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
              <Box className="settings-row">
                <PasswordInput
                  label="Key passphrase"
                  description="Left blank for a key that carries none"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.currentTarget.value)}
                />
              </Box>
            </>
          )}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="sm" align="baseline">
              <Title order={4}>{inputTitle}</Title>
              {source === "file" && loaded !== null && <Text size="sm" c="dimmed">{byteSize(loaded.size)}</Text>}
            </Group>
            <Group gap="xs">
              <SegmentedControl
                size="xs"
                data={SOURCE_OPTIONS}
                value={source}
                onChange={(value) => setSource(value as Source)}
                aria-label="Input source"
              />
              <Tooltip label="Clear" withArrow position="left">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => (source === "file" ? setLoaded(null) : setText(""))}
                  disabled={source === "file" ? loaded === null : text === ""}
                  aria-label={`Clear ${inputTitle.toLowerCase()}`}
                >
                  <IconX size="1.2rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {source === "text"
            ? (
              <Textarea
                value={text}
                onChange={(event) => setText(event.currentTarget.value)}
                placeholder={mode === "encrypt" ? "Text to encrypt" : "Ciphertext to read back"}
                aria-label={inputTitle}
                autosize
                minRows={4}
                maxRows={12}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            )
            : loaded === null
            ? (
              <Box
                component="label"
                className="file-dropzone"
                data-dragging={dragging || undefined}
                onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event: DragEvent<HTMLLabelElement>) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                }}
                onDrop={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  setDragging(false);
                  void handleFile(event.dataTransfer.files.item(0));
                }}
              >
                <Stack align="center" gap={4}>
                  <IconUpload size="2rem" stroke={1.3} />
                  <Text size="sm">Click to choose any file, or drop one here</Text>
                  <Text size="xs" c="dimmed">
                    Read in this tab and never uploaded, up to {byteSize(MAX_BYTES)}
                  </Text>
                </Stack>
                <input
                  type="file"
                  hidden
                  aria-label={`${inputTitle} file`}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    void handleFile(event.currentTarget.files?.item(0) ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </Box>
            )
            : <Text size="sm" style={{ fontFamily: "monospace" }}>{loaded.name}</Text>}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="sm" align="baseline">
              <Title order={4}>{outputTitle}</Title>
              {saved !== null && <Text size="sm" c="dimmed">{byteSize(saved.length)}</Text>}
            </Group>
            <Group gap="xs">
              {saved !== null && result?.name && (
                <Button
                  size="xs"
                  leftSection={<IconDownload size="1rem" />}
                  onClick={() => download(result.name ?? "message", new Blob([saved as BlobPart]))}
                >
                  Download
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
                      aria-label={`Copy ${outputTitle.toLowerCase()}`}
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Group>
          {source === "file" && saved !== null
            ? <Text size="sm" c="dimmed" style={{ fontFamily: "monospace" }}>{result?.name}</Text>
            : (
              <Textarea
                value={output}
                aria-label={outputTitle}
                readOnly
                error={failure || undefined}
                placeholder={running
                  ? "Working…"
                  : awaited.length > 0
                  ? waitingFor(awaited)
                  : placeholder(mode, source)}
                autosize
                minRows={4}
                maxRows={14}
                spellCheck={false}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            )}
        </Stack>
      </Card>
    </Stack>
  );
}

function GenerateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip label={label} withArrow position="left">
      <ActionIcon variant="subtle" color="gray" onClick={onClick} aria-label={label}>
        <IconRefresh size="1.1rem" />
      </ActionIcon>
    </Tooltip>
  );
}

function KeygenLink({ label, state }: { label: string; state: Record<string, unknown> }) {
  return (
    <Tooltip label={label} withArrow position="left">
      <ActionIcon
        component="a"
        href={shareLink("/keygen", state)}
        target="_blank"
        rel="noopener noreferrer"
        variant="subtle"
        color="gray"
        aria-label={label}
      >
        <IconCertificate size="1.1rem" />
      </ActionIcon>
    </Tooltip>
  );
}

function waitingFor(fields: string[]): string {
  const list = fields.length > 1 ? `${fields.slice(0, -1).join(", ")} and ${fields[fields.length - 1]}` : fields[0];
  return `Waiting for ${list}`;
}

function placeholder(mode: Mode, source: Source): string {
  if (source === "file") return mode === "encrypt" ? "Choose a file to encrypt it" : "Choose a file to decrypt it";
  return mode === "encrypt" ? "The ciphertext lands here" : "The message lands here";
}

const TEXTAREA_SECTION = { style: { alignItems: "flex-start", paddingTop: "0.35rem" } };

const MODE_OPTIONS = [{ value: "encrypt", label: "Encrypt" }, { value: "decrypt", label: "Decrypt" }];

const SOURCE_OPTIONS = [{ value: "text", label: "Text" }, { value: "file", label: "File" }];

const RECIPIENT_OPTIONS = [{ value: "key", label: "A public key" }, { value: "password", label: "A password" }];

const AGE_RECIPIENT_OPTIONS = [{ value: "key", label: "A recipient" }, { value: "password", label: "A passphrase" }];

const PGP_PAIR = { kind: "pgp", algorithm: "curve25519" };

const AGE_IDENTITY = { kind: "age", algorithm: "x25519" };

const EMPTY = new Uint8Array();
