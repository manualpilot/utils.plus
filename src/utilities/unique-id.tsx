import { ActionIcon, Box, Button, Card, Combobox, CopyButton, Group, NumberInput, Select, Stack, Textarea, TextInput, Title, Tooltip, useCombobox } from "@mantine/core";
import { useCallback, useLayoutEffect, useState } from "react";
import { randomBelow } from "../common/random";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../icons";

export default function UniqueId() {
  const initialState = useInitialHashState<{
    type?: string;
    count?: number;
    name?: string;
    namespace?: string;
    prefix?: string;
    domain?: string;
    localId?: number;
  }>();

  const [type, setType] = useState(pickType(initialState?.type));
  const [count, setCount] = useState<number | string>(clampCount(initialState?.count));
  const [name, setName] = useState(pickText(initialState?.name));
  const [namespace, setNamespace] = useState(pickText(initialState?.namespace));
  const [prefix, setPrefix] = useState(pickText(initialState?.prefix));
  const [domain, setDomain] = useState(pickDomain(initialState?.domain));
  const [localId, setLocalId] = useState<number | string>(clampLocalId(initialState?.localId));
  const [generatedIds, setGeneratedIds] = useState("");
  const [asked, setAsked] = useState(false);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const options = STANDARD_NAMESPACES.map((item) => (
    <Combobox.Option value={item.value} key={item.value}>
      {item.label} ({item.value})
    </Combobox.Option>
  ));

  const isNamespaced = type === "uuid-v3" || type === "uuid-v5";
  const isDceSecurity = type === "uuid-v2";
  const isTypeId = type === "typeid";

  useRegisterShareState(() => ({
    type,
    count: isNamespaced ? undefined : count,
    name: isNamespaced && name ? name : undefined,
    namespace: isNamespaced && namespace ? namespace : undefined,
    prefix: isTypeId && prefix ? prefix : undefined,
    domain: isDceSecurity ? domain : undefined,
    localId: isDceSecurity ? localId : undefined,
  }));

  const parsedCount = isNamespaced ? 1 : parseCount(count);
  const countError = parsedCount === null ? `Enter a count between 1 and ${MAX_COUNT}` : null;
  const missingName = isNamespaced && !name;
  const namespaceIssue = isNamespaced ? namespaceProblem(namespace) : null;
  const nameError = missingName && asked ? "Required" : null;
  const namespaceError = asked || namespace ? namespaceIssue : null;
  const hasPairError = Boolean(nameError || namespaceError);
  const prefixError = isTypeId ? prefixProblem(prefix) : null;
  const parsedLocalId = isDceSecurity ? parseLocalId(localId) : 0;
  const localIdError = parsedLocalId === null ? `Enter an ID between 0 and ${MAX_LOCAL_ID}` : null;

  const regenerate = useCallback(() => {
    if (parsedCount === null || parsedLocalId === null || missingName || namespaceIssue || prefixError) {
      setGeneratedIds("");
      return;
    }
    const settings = { name, namespace, prefix, domain, localId: parsedLocalId };
    const ids: string[] = [];
    for (let i = 0; i < parsedCount; i++) ids.push(generateId(type, settings));
    setGeneratedIds(ids.join("\n"));
  }, [parsedCount, parsedLocalId, missingName, namespaceIssue, prefixError, type, name, namespace, prefix, domain]);

  useLayoutEffect(regenerate, [regenerate]);

  const generate = () => {
    setAsked(true);
    regenerate();
  };

  const handleTypeChange = (value: string | null) => {
    setType(pickType(value));
    setAsked(false);
  };

  return (
    <Stack gap="md">
      <UtilityTitle file="unique-id.tsx">Generate Unique ID</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Box className={countError ? "settings-row has-error" : "settings-row"} mb={countError ? "md" : 0}>
            <Select
              label="ID Type"
              data={ID_TYPES}
              value={type}
              onChange={handleTypeChange}
              allowDeselect={false}
            />
            <NumberInput
              label="Count"
              description={isNamespaced ? "Namespaced UUIDs are deterministic" : ""}
              value={isNamespaced ? 1 : count}
              onChange={setCount}
              min={1}
              max={MAX_COUNT}
              allowDecimal={false}
              allowNegative={false}
              stepHoldDelay={500}
              stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
              disabled={isNamespaced}
              error={countError}
              classNames={{ root: "relative-root", error: "absolute-error" }}
            />
          </Box>

          {isNamespaced && (
            <Box
              className={hasPairError ? "settings-row has-error" : "settings-row"}
              mb={hasPairError ? "md" : 0}
            >
              <Combobox
                store={combobox}
                onOptionSubmit={(val) => {
                  setNamespace(val);
                  combobox.closeDropdown();
                }}
              >
                <Combobox.Target>
                  <TextInput
                    label="Namespace (UUID)"
                    placeholder="e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8"
                    value={namespace}
                    onChange={(e) => {
                      setNamespace(e.currentTarget.value);
                      combobox.openDropdown();
                      combobox.updateSelectedOptionIndex();
                    }}
                    onClick={() => combobox.openDropdown()}
                    onFocus={() => combobox.openDropdown()}
                    onBlur={() => combobox.closeDropdown()}
                    error={namespaceError}
                    classNames={{ root: "relative-root", error: "absolute-error" }}
                  />
                </Combobox.Target>
                <Combobox.Dropdown>
                  <Combobox.Options>
                    {options}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>
              <TextInput
                label="Name"
                placeholder="e.g. example.com"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                error={nameError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {isDceSecurity && (
            <Box
              className={localIdError ? "settings-row has-error" : "settings-row"}
              mb={localIdError ? "md" : 0}
            >
              <Select
                label="Local Domain"
                data={LOCAL_DOMAINS}
                value={domain}
                onChange={(value) => setDomain(pickDomain(value))}
                allowDeselect={false}
              />
              <NumberInput
                label="Local ID"
                description="The UID, GID or organisation ID to embed"
                value={localId}
                onChange={setLocalId}
                min={0}
                max={MAX_LOCAL_ID}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={localIdError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {isTypeId && (
            <Box
              className={prefixError ? "settings-row has-error" : "settings-row"}
              mb={prefixError ? "md" : 0}
            >
              <TextInput
                label="Prefix"
                description="Left off the ID when blank"
                placeholder="e.g. user"
                value={prefix}
                onChange={(e) => setPrefix(e.currentTarget.value)}
                error={prefixError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          <Group justify="flex-end">
            <Button onClick={generate}>Generate</Button>
          </Group>
        </Stack>
      </Card>

      {generatedIds && (
        <Card withBorder shadow="sm" radius="md">
          <Stack>
            <Group justify="space-between">
              <Title order={4}>{parsedCount === 1 ? "Result" : "Results"}</Title>
              <Group gap="xs">
                {!isNamespaced && (
                  <Tooltip label="Regenerate" withArrow position="left">
                    <ActionIcon
                      color="gray"
                      variant="subtle"
                      onClick={regenerate}
                      aria-label="Regenerate IDs"
                    >
                      <IconRefresh size="1.2rem" />
                    </ActionIcon>
                  </Tooltip>
                )}
                <CopyButton value={generatedIds} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy IDs"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Textarea
              value={generatedIds}
              aria-label="Generated IDs"
              readOnly
              autosize
              minRows={1}
              maxRows={15}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

const MAX_COUNT = 1000;
const MAX_LOCAL_ID = 4294967295;

export const ID_TYPES = [
  {
    group: "UUID",
    items: [
      { value: "uuid-v4", label: "UUID Version 4 (Random)" },
      { value: "uuid-v1", label: "UUID Version 1 (Timestamp)" },
      { value: "uuid-v2", label: "UUID Version 2 (DCE Security)" },
      { value: "uuid-v3", label: "UUID Version 3 (MD5 Namespace)" },
      { value: "uuid-v5", label: "UUID Version 5 (SHA-1 Namespace)" },
      { value: "uuid-v6", label: "UUID Version 6 (Timestamp ordered)" },
      { value: "uuid-v7", label: "UUID Version 7 (Unix Epoch ordered)" },
      { value: "uuid-v8", label: "UUID Version 8 (Custom/Vendor-specific)" },
    ],
  },
  {
    group: "Web and application",
    items: [
      { value: "nanoid", label: "NanoID" },
      { value: "cuid", label: "CUID" },
      { value: "cuid2", label: "CUID2" },
      { value: "ulid", label: "ULID" },
      { value: "ksuid", label: "KSUID" },
      { value: "xid", label: "XID" },
      { value: "typeid", label: "TypeID" },
    ],
  },
  {
    group: "Database and service",
    items: [
      { value: "objectid", label: "MongoDB ObjectId" },
      { value: "pushid", label: "Firebase PushID" },
      { value: "snowflake", label: "Snowflake" },
      { value: "sonyflake", label: "Sonyflake" },
    ],
  },
];

const ID_TYPE_VALUES = new Set(ID_TYPES.flatMap((group) => group.items.map((item) => item.value)));

const LOCAL_DOMAINS = [
  { value: "person", label: "Person (POSIX UID)" },
  { value: "group", label: "Group (POSIX GID)" },
  { value: "org", label: "Organisation" },
];

const LOCAL_DOMAIN_CODES: Record<string, number> = { person: 0, group: 1, org: 2 };

const STANDARD_NAMESPACES = [
  { label: "DNS", value: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
  { label: "URL", value: "6ba7b811-9dad-11d1-80b4-00c04fd430c8" },
  { label: "OID", value: "6ba7b812-9dad-11d1-80b4-00c04fd430c8" },
  { label: "X500", value: "6ba7b814-9dad-11d1-80b4-00c04fd430c8" },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX_PATTERN = /^[a-z]([a-z_]{0,61}[a-z])?$/;

export interface IdSettings {
  name: string;
  namespace: string;
  prefix: string;
  domain: string;
  localId: number;
}

export function generateId(type: string, settings: IdSettings): string {
  switch (type) {
    case "uuid-v1":
      return generateUUIDv1();
    case "uuid-v2":
      return generateUUIDv2(settings.localId, settings.domain);
    case "uuid-v3":
      return generateUUIDv3(settings.name, settings.namespace);
    case "uuid-v5":
      return generateUUIDv5(settings.name, settings.namespace);
    case "uuid-v6":
      return generateUUIDv6();
    case "uuid-v7":
      return generateUUIDv7();
    case "uuid-v8":
      return generateUUIDv8();
    case "nanoid":
      return generateNanoID();
    case "cuid":
      return generateCUID();
    case "cuid2":
      return generateCUID2();
    case "ulid":
      return generateULID();
    case "ksuid":
      return generateKSUID();
    case "xid":
      return generateXID();
    case "typeid":
      return generateTypeID(settings.prefix);
    case "objectid":
      return generateObjectId();
    case "pushid":
      return generatePushID();
    case "snowflake":
      return generateSnowflake();
    case "sonyflake":
      return generateSonyflake();
    default:
      return generateUUIDv4();
  }
}

function namespaceProblem(namespace: string): string | null {
  if (!namespace) return "Required";
  return UUID_PATTERN.test(namespace) ? null : "Enter a valid UUID";
}

function prefixProblem(prefix: string): string | null {
  if (!prefix) return null;
  return PREFIX_PATTERN.test(prefix) ? null : "Enter lowercase letters, joined by underscores";
}

function parseCount(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= MAX_COUNT ? rounded : null;
}

function parseLocalId(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 0 && rounded <= MAX_LOCAL_ID ? rounded : null;
}

function clampCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(MAX_COUNT, Math.max(1, Math.floor(value)));
}

function clampLocalId(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_LOCAL_ID, Math.max(0, Math.floor(value)));
}

function pickType(value: unknown): string {
  return ID_TYPE_VALUES.has(value as string) ? value as string : "uuid-v4";
}

function pickDomain(value: unknown): string {
  return LOCAL_DOMAINS.some((option) => option.value === value) ? value as string : "person";
}

function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function generateUUIDv4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const hex = "0123456789abcdef";
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += hex[a[i] >> 4] + hex[a[i] & 15];
    if (i === 3 || i === 5 || i === 7 || i === 9) id += "-";
  }
  return id;
}

let lastTime = 0;
let clockSequence = 0;
const node = new Uint8Array(6);
crypto.getRandomValues(node);
node[0] |= 0x01;

function getG1582(): { time: bigint; seq: number } {
  const now = Date.now();
  let time = BigInt(now) * 10000n + 122192928000000000n;
  if (now === lastTime) {
    clockSequence = (clockSequence + 1) & 0x3fff;
    time += BigInt(clockSequence);
  } else {
    lastTime = now;
    clockSequence = (crypto.getRandomValues(new Uint16Array(1))[0]) & 0x3fff;
  }
  return { time, seq: clockSequence };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatUUID(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function toBase32(value: bigint, digits: number, alphabet: string): string {
  let text = "";
  for (let i = 0; i < digits; i++) {
    text = alphabet[Number(value & 31n)] + text;
    value >>= 5n;
  }
  return text;
}

function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint24BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 16) & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = value & 0xff;
}

function generateUUIDv1(): string {
  const { time, seq } = getG1582();
  const bytes = new Uint8Array(16);
  const timeMid = Number((time >> 32n) & 0xffffn);
  const timeHi = Number((time >> 48n) & 0x0fffn) | 0x1000;

  writeUint32BE(bytes, 0, Number(time & 0xffffffffn));
  bytes[4] = timeMid >>> 8;
  bytes[5] = timeMid & 0xff;
  bytes[6] = timeHi >>> 8;
  bytes[7] = timeHi & 0xff;
  bytes[8] = (seq >>> 8) | 0x80;
  bytes[9] = seq & 0xff;
  bytes.set(node, 10);
  return formatUUID(bytes);
}

function generateUUIDv2(localId: number, domain: string): string {
  const { time, seq } = getG1582();
  const bytes = new Uint8Array(16);
  const timeMid = Number((time >> 32n) & 0xffffn);
  const timeHi = Number((time >> 48n) & 0x0fffn) | 0x2000;

  writeUint32BE(bytes, 0, localId);
  bytes[4] = timeMid >>> 8;
  bytes[5] = timeMid & 0xff;
  bytes[6] = timeHi >>> 8;
  bytes[7] = timeHi & 0xff;
  bytes[8] = (seq >>> 8) | 0x80;
  bytes[9] = LOCAL_DOMAIN_CODES[domain] ?? 0;
  crypto.getRandomValues(bytes.subarray(10));
  bytes[10] |= 0x01;
  return formatUUID(bytes);
}

function generateUUIDv6(): string {
  const { time, seq } = getG1582();
  const bytes = new Uint8Array(16);
  const timeMid = Number((time >> 12n) & 0xffffn);
  const timeLow = Number(time & 0x0fffn) | 0x6000;

  writeUint32BE(bytes, 0, Number((time >> 28n) & 0xffffffffn));
  bytes[4] = timeMid >>> 8;
  bytes[5] = timeMid & 0xff;
  bytes[6] = timeLow >>> 8;
  bytes[7] = timeLow & 0xff;
  bytes[8] = (seq >>> 8) | 0x80;
  bytes[9] = seq & 0xff;
  bytes.set(node, 10);
  return formatUUID(bytes);
}

function generateUUIDv7(): string {
  return formatUUID(uuidV7Bytes());
}

function uuidV7Bytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const time = Date.now();

  bytes[0] = Math.floor(time / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(time / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(time / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(time / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(time / 2 ** 8) & 0xff;
  bytes[5] = time & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function generateUUIDv8(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUUID(bytes);
}

function generateNanoID(size = 21): string {
  const urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += urlAlphabet[bytes[i] & 63];
  }
  return id;
}

const CUID_BLOCK_SIZE = 4;
const CUID_BLOCK_VALUES = 36 ** CUID_BLOCK_SIZE;
const cuidFingerprint = cuidBlock();
let cuidCounter = 0;

function generateCUID(): string {
  const counter = cuidCounter.toString(36).padStart(CUID_BLOCK_SIZE, "0");
  cuidCounter = (cuidCounter + 1) % CUID_BLOCK_VALUES;
  return `c${Date.now().toString(36)}${counter}${cuidFingerprint}${cuidBlock()}${cuidBlock()}`;
}

function cuidBlock(): string {
  return randomBelow(CUID_BLOCK_VALUES).toString(36).padStart(CUID_BLOCK_SIZE, "0");
}

const CUID2_LENGTH = 24;
const CUID2_LETTERS = "abcdefghijklmnopqrstuvwxyz";
const CUID2_FIRST_COUNT = 476782367;
let cuid2Fingerprint = "";
let cuid2Counter = randomBelow(CUID2_FIRST_COUNT);

function generateCUID2(): string {
  cuid2Fingerprint ||= cuid2Hash(cuid2Entropy(32)).slice(0, 32);
  const time = Date.now().toString(36);
  const count = (cuid2Counter++).toString(36);
  const hashed = cuid2Hash(time + cuid2Entropy(CUID2_LENGTH) + count + cuid2Fingerprint);
  return CUID2_LETTERS[randomBelow(CUID2_LETTERS.length)] + hashed.slice(1, CUID2_LENGTH);
}

function cuid2Hash(input: string): string {
  return bytesToBigInt(sha3(stringToUTF8Bytes(input))).toString(36).slice(1);
}

function cuid2Entropy(length: number): string {
  let entropy = "";
  while (entropy.length < length) entropy += randomBelow(36).toString(36);
  return entropy;
}

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
function generateULID(): string {
  const now = Date.now();
  let timeStr = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    const mod = t % ENCODING_LEN;
    timeStr = ENCODING.charAt(mod) + timeStr;
    t = (t - mod) / ENCODING_LEN;
  }

  let randomStr = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    randomStr += ENCODING.charAt(bytes[i] % ENCODING_LEN);
  }

  return timeStr + randomStr;
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function generateKSUID(): string {
  const payload = new Uint8Array(16);
  crypto.getRandomValues(payload);
  const time = Math.floor(Date.now() / 1000) - 1400000000;

  const buffer = new Uint8Array(20);
  buffer[0] = (time >>> 24) & 0xff;
  buffer[1] = (time >>> 16) & 0xff;
  buffer[2] = (time >>> 8) & 0xff;
  buffer[3] = time & 0xff;
  buffer.set(payload, 4);

  let value = 0n;
  for (let i = 0; i < buffer.length; i++) {
    value = (value * 256n) + BigInt(buffer[i]);
  }

  let result = "";
  while (value > 0n) {
    const rem = Number(value % 62n);
    result = BASE62[rem] + result;
    value /= 62n;
  }
  return result.padStart(27, "0");
}

const XID_ALPHABET = "0123456789abcdefghijklmnopqrstuv";
const xidMachine = crypto.getRandomValues(new Uint8Array(3));
const xidProcess = crypto.getRandomValues(new Uint16Array(1))[0];
let xidCounter = randomBelow(0x1000000);

function generateXID(): string {
  const bytes = new Uint8Array(12);
  writeUint32BE(bytes, 0, Math.floor(Date.now() / 1000));
  bytes.set(xidMachine, 4);
  bytes[7] = xidProcess >>> 8;
  bytes[8] = xidProcess & 0xff;
  xidCounter = (xidCounter + 1) & 0xffffff;
  writeUint24BE(bytes, 9, xidCounter);
  return toBase32(bytesToBigInt(bytes) << 4n, 20, XID_ALPHABET);
}

const CROCKFORD_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

function generateTypeID(prefix: string): string {
  const suffix = toBase32(bytesToBigInt(uuidV7Bytes()), 26, CROCKFORD_ALPHABET);
  return prefix ? `${prefix}_${suffix}` : suffix;
}

const objectIdRandom = crypto.getRandomValues(new Uint8Array(5));
let objectIdCounter = randomBelow(0x1000000);

function generateObjectId(): string {
  const bytes = new Uint8Array(12);
  writeUint32BE(bytes, 0, Math.floor(Date.now() / 1000));
  bytes.set(objectIdRandom, 4);
  objectIdCounter = (objectIdCounter + 1) & 0xffffff;
  writeUint24BE(bytes, 9, objectIdCounter);
  return toHex(bytes);
}

const PUSH_ALPHABET = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const pushRandom = new Uint8Array(12);
let pushLastTime = 0;

function generatePushID(): string {
  const now = Date.now();
  let remaining = now;
  let id = "";
  for (let i = 0; i < 8; i++) {
    id = PUSH_ALPHABET[remaining % 64] + id;
    remaining = Math.floor(remaining / 64);
  }

  if (now === pushLastTime) {
    let i = pushRandom.length - 1;
    while (i >= 0 && pushRandom[i] === 63) pushRandom[i--] = 0;
    if (i >= 0) pushRandom[i]++;
  } else {
    crypto.getRandomValues(pushRandom);
    for (let i = 0; i < pushRandom.length; i++) pushRandom[i] &= 63;
  }
  pushLastTime = now;

  for (const value of pushRandom) id += PUSH_ALPHABET[value];
  return id;
}

let sfSequence = 0n;
let sfLastTime = -1n;
const sfMachineId = 1n;
function generateSnowflake(): string {
  const epoch = 1288834974657n;
  let time = BigInt(Date.now());

  if (time === sfLastTime) {
    sfSequence = (sfSequence + 1n) & 4095n;
    if (sfSequence === 0n) {
      while (time <= sfLastTime) {
        time = BigInt(Date.now());
      }
    }
  } else {
    sfSequence = 0n;
  }

  sfLastTime = time;

  const id = ((time - epoch) << 22n) | (sfMachineId << 12n) | sfSequence;
  return id.toString();
}

const SONYFLAKE_EPOCH = Date.UTC(2014, 8, 1);
const sonyflakeMachine = BigInt(crypto.getRandomValues(new Uint16Array(1))[0]);
let sonyflakeSequence = 0;
let sonyflakeLastTick = -1n;

function generateSonyflake(): string {
  let tick = sonyflakeTick();
  if (tick === sonyflakeLastTick) {
    sonyflakeSequence = (sonyflakeSequence + 1) & 0xff;
    while (sonyflakeSequence === 0 && tick <= sonyflakeLastTick) tick = sonyflakeTick();
  } else {
    sonyflakeSequence = 0;
  }

  sonyflakeLastTick = tick;
  return ((tick << 24n) | (BigInt(sonyflakeSequence) << 16n) | sonyflakeMachine).toString();
}

function sonyflakeTick(): bigint {
  return BigInt(Math.floor((Date.now() - SONYFLAKE_EPOCH) / 10));
}

function parseUUID(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function stringToUTF8Bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function md5(bytes: Uint8Array): Uint8Array {
  function F(x: number, y: number, z: number) {
    return (x & y) | (~x & z);
  }
  function G(x: number, y: number, z: number) {
    return (x & z) | (y & ~z);
  }
  function H(x: number, y: number, z: number) {
    return x ^ y ^ z;
  }
  function I(x: number, y: number, z: number) {
    return y ^ (x | ~z);
  }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + F(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + G(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + H(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + I(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }

  const len = bytes.length * 8;
  const x: number[] = new Array((((len + 64) >>> 9) << 4) + 16).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    x[i >> 2] |= (bytes[i] & 0xff) << ((i % 4) * 8);
  }
  x[len >> 5] |= 0x80 << (len % 32);
  x[x.length - 2] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    a = FF(a, b, c, d, x[i + 0], 7, -680876936);
    d = FF(d, a, b, c, x[i + 1], 12, -389564586);
    c = FF(c, d, a, b, x[i + 2], 17, 606105819);
    b = FF(b, c, d, a, x[i + 3], 22, -1044525330);
    a = FF(a, b, c, d, x[i + 4], 7, -176418897);
    d = FF(d, a, b, c, x[i + 5], 12, 1200080426);
    c = FF(c, d, a, b, x[i + 6], 17, -1473231341);
    b = FF(b, c, d, a, x[i + 7], 22, -45705983);
    a = FF(a, b, c, d, x[i + 8], 7, 1770035416);
    d = FF(d, a, b, c, x[i + 9], 12, -1958414417);
    c = FF(c, d, a, b, x[i + 10], 17, -42063);
    b = FF(b, c, d, a, x[i + 11], 22, -1990404162);
    a = FF(a, b, c, d, x[i + 12], 7, 1804603682);
    d = FF(d, a, b, c, x[i + 13], 12, -40341101);
    c = FF(c, d, a, b, x[i + 14], 17, -1502002290);
    b = FF(b, c, d, a, x[i + 15], 22, 1236535329);

    a = GG(a, b, c, d, x[i + 1], 5, -165796510);
    d = GG(d, a, b, c, x[i + 6], 9, -1069501632);
    c = GG(c, d, a, b, x[i + 11], 14, 643717713);
    b = GG(b, c, d, a, x[i + 0], 20, -373897302);
    a = GG(a, b, c, d, x[i + 5], 5, -701558691);
    d = GG(d, a, b, c, x[i + 10], 9, 38016083);
    c = GG(c, d, a, b, x[i + 15], 14, -660478335);
    b = GG(b, c, d, a, x[i + 4], 20, -405537848);
    a = GG(a, b, c, d, x[i + 9], 5, 568446438);
    d = GG(d, a, b, c, x[i + 14], 9, -1019803690);
    c = GG(c, d, a, b, x[i + 3], 14, -187363961);
    b = GG(b, c, d, a, x[i + 8], 20, 1163531501);
    a = GG(a, b, c, d, x[i + 13], 5, -1444681467);
    d = GG(d, a, b, c, x[i + 2], 9, -51403784);
    c = GG(c, d, a, b, x[i + 7], 14, 1735328473);
    b = GG(b, c, d, a, x[i + 12], 20, -1926607734);

    a = HH(a, b, c, d, x[i + 5], 4, -378558);
    d = HH(d, a, b, c, x[i + 8], 11, -2022574463);
    c = HH(c, d, a, b, x[i + 11], 16, 1839030562);
    b = HH(b, c, d, a, x[i + 14], 23, -35309556);
    a = HH(a, b, c, d, x[i + 1], 4, -1530992060);
    d = HH(d, a, b, c, x[i + 4], 11, 1272893353);
    c = HH(c, d, a, b, x[i + 7], 16, -155497632);
    b = HH(b, c, d, a, x[i + 10], 23, -1094730640);
    a = HH(a, b, c, d, x[i + 13], 4, 681279174);
    d = HH(d, a, b, c, x[i + 0], 11, -358537222);
    c = HH(c, d, a, b, x[i + 3], 16, -722521979);
    b = HH(b, c, d, a, x[i + 6], 23, 76029189);
    a = HH(a, b, c, d, x[i + 9], 4, -640364487);
    d = HH(d, a, b, c, x[i + 12], 11, -421815835);
    c = HH(c, d, a, b, x[i + 15], 16, 530742520);
    b = HH(b, c, d, a, x[i + 2], 23, -995338651);

    a = II(a, b, c, d, x[i + 0], 6, -198630844);
    d = II(d, a, b, c, x[i + 7], 10, 1126891415);
    c = II(c, d, a, b, x[i + 14], 15, -1416354905);
    b = II(b, c, d, a, x[i + 5], 21, -57434055);
    a = II(a, b, c, d, x[i + 12], 6, 1700485571);
    d = II(d, a, b, c, x[i + 3], 10, -1894986606);
    c = II(c, d, a, b, x[i + 10], 15, -1051523);
    b = II(b, c, d, a, x[i + 1], 21, -2054922799);
    a = II(a, b, c, d, x[i + 8], 6, 1873313359);
    d = II(d, a, b, c, x[i + 15], 10, -30611744);
    c = II(c, d, a, b, x[i + 6], 15, -1560198380);
    b = II(b, c, d, a, x[i + 13], 21, 1309151649);
    a = II(a, b, c, d, x[i + 4], 6, -145523070);
    d = II(d, a, b, c, x[i + 11], 10, -1120210379);
    c = II(c, d, a, b, x[i + 2], 15, 718787259);
    b = II(b, c, d, a, x[i + 9], 21, -343485551);

    a = (a + olda) >>> 0;
    b = (b + oldb) >>> 0;
    c = (c + oldc) >>> 0;
    d = (d + oldd) >>> 0;
  }

  const res = new Uint8Array(16);
  res[0] = a & 0xff;
  res[1] = (a >>> 8) & 0xff;
  res[2] = (a >>> 16) & 0xff;
  res[3] = (a >>> 24) & 0xff;
  res[4] = b & 0xff;
  res[5] = (b >>> 8) & 0xff;
  res[6] = (b >>> 16) & 0xff;
  res[7] = (b >>> 24) & 0xff;
  res[8] = c & 0xff;
  res[9] = (c >>> 8) & 0xff;
  res[10] = (c >>> 16) & 0xff;
  res[11] = (c >>> 24) & 0xff;
  res[12] = d & 0xff;
  res[13] = (d >>> 8) & 0xff;
  res[14] = (d >>> 16) & 0xff;
  res[15] = (d >>> 24) & 0xff;
  return res;
}

function sha1(bytes: Uint8Array): Uint8Array {
  function rotl(n: number, s: number) {
    return (n << s) | (n >>> (32 - s));
  }
  const len = bytes.length * 8;
  const x: number[] = new Array((((len + 64) >>> 9) << 4) + 16).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    x[i >> 2] |= (bytes[i] & 0xff) << (24 - (i % 4) * 8);
  }
  x[len >> 5] |= 0x80 << (24 - (len % 32));
  x[x.length - 1] = len;

  let w = new Array(80);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  let e = -1009589776;

  for (let i = 0; i < x.length; i += 16) {
    let olda = a, oldb = b, oldc = c, oldd = d, olde = e;
    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = x[i + j];
      else w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);

      let t = (rotl(a, 5) + e + w[j] + (
        (j < 20)
          ? 1518500249 + ((b & c) | (~b & d))
          : (j < 40)
          ? 1859775393 + (b ^ c ^ d)
          : (j < 60)
          ? -1894007588 + ((b & c) | (b & d) | (c & d))
          : -899497514 + (b ^ c ^ d)
      )) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    a = (a + olda) >>> 0;
    b = (b + oldb) >>> 0;
    c = (c + oldc) >>> 0;
    d = (d + oldd) >>> 0;
    e = (e + olde) >>> 0;
  }

  const res = new Uint8Array(20);
  res[0] = (a >>> 24) & 0xff;
  res[1] = (a >>> 16) & 0xff;
  res[2] = (a >>> 8) & 0xff;
  res[3] = a & 0xff;
  res[4] = (b >>> 24) & 0xff;
  res[5] = (b >>> 16) & 0xff;
  res[6] = (b >>> 8) & 0xff;
  res[7] = b & 0xff;
  res[8] = (c >>> 24) & 0xff;
  res[9] = (c >>> 16) & 0xff;
  res[10] = (c >>> 8) & 0xff;
  res[11] = c & 0xff;
  res[12] = (d >>> 24) & 0xff;
  res[13] = (d >>> 16) & 0xff;
  res[14] = (d >>> 8) & 0xff;
  res[15] = d & 0xff;
  res[16] = (e >>> 24) & 0xff;
  res[17] = (e >>> 16) & 0xff;
  res[18] = (e >>> 8) & 0xff;
  res[19] = e & 0xff;
  return res;
}

const KECCAK_MASK = 0xffffffffffffffffn;
const KECCAK_ROUNDS = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

function sha3(bytes: Uint8Array): Uint8Array {
  const rate = 72;
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x06;
  padded[padded.length - 1] |= 0x80;

  const lanes: bigint[] = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let value = 0n;
      for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(padded[offset + lane * 8 + i]);
      lanes[lane] ^= value;
    }
    keccakF1600(lanes);
  }

  const digest = new Uint8Array(64);
  for (let lane = 0; lane < 8; lane++) {
    let value = lanes[lane];
    for (let i = 0; i < 8; i++) {
      digest[lane * 8 + i] = Number(value & 0xffn);
      value >>= 8n;
    }
  }
  return digest;
}

function keccakF1600(lanes: bigint[]): void {
  for (const roundConstant of KECCAK_ROUNDS) {
    const parity: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      parity[x] = lanes[x] ^ lanes[x + 5] ^ lanes[x + 10] ^ lanes[x + 15] ^ lanes[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const mix = parity[(x + 4) % 5] ^ rotl64(parity[(x + 1) % 5], 1n);
      for (let y = 0; y < 25; y += 5) lanes[x + y] ^= mix;
    }

    let x = 1;
    let y = 0;
    let carried = lanes[1];
    for (let step = 0; step < 24; step++) {
      const next = (2 * x + 3 * y) % 5;
      const index = y + 5 * next;
      const held = lanes[index];
      lanes[index] = rotl64(carried, BigInt((((step + 1) * (step + 2)) / 2) % 64));
      carried = held;
      x = y;
      y = next;
    }

    for (let row = 0; row < 25; row += 5) {
      const held = lanes.slice(row, row + 5);
      for (let i = 0; i < 5; i++) lanes[row + i] = held[i] ^ (~held[(i + 1) % 5] & KECCAK_MASK & held[(i + 2) % 5]);
    }

    lanes[0] ^= roundConstant;
  }
}

function rotl64(value: bigint, shift: bigint): bigint {
  return ((value << shift) | (value >> (64n - shift))) & KECCAK_MASK;
}

function generateUUIDv3(name: string, namespace: string): string {
  const nsBytes = parseUUID(namespace);
  const nameBytes = stringToUTF8Bytes(name);
  const bytes = new Uint8Array(16 + nameBytes.length);
  bytes.set(nsBytes, 0);
  bytes.set(nameBytes, 16);

  const hash = md5(bytes);
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return formatUUID(hash);
}

function generateUUIDv5(name: string, namespace: string): string {
  const nsBytes = parseUUID(namespace);
  const nameBytes = stringToUTF8Bytes(name);
  const bytes = new Uint8Array(16 + nameBytes.length);
  bytes.set(nsBytes, 0);
  bytes.set(nameBytes, 16);

  const hash = sha1(bytes);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  return formatUUID(hash.slice(0, 16));
}
