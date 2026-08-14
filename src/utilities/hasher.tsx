import { ActionIcon, Box, Button, Card, CopyButton, Group, NumberInput, Select, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { blake2b, blake2s } from "@noble/hashes/blake2.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512, sha512_224, sha512_256 } from "@noble/hashes/sha2.js";
import { keccak_256, sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js";
import type { CHash } from "@noble/hashes/utils.js";
import { useCallback, useMemo, useRef, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconCheck, IconCopy, IconRefresh, IconX } from "../icons";

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
  const [derived, setDerived] = useState<Derived | null>(null);
  const [running, setRunning] = useState(false);
  const runIdRef = useRef(0);

  const spec = ALGORITHMS[algorithm];

  useRegisterShareState(() => ({
    algorithm,
    variant: spec.variants.length > 1 ? variant : undefined,
    format: spec.formats ? format : undefined,
    input: input || undefined,
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

  const { output, error, bits } = useMemo(() => {
    if (spec.kdf) {
      if (stale || derived === null) return EMPTY_OUTPUT;
      if (derived.result === null) return { output: "", error: derived.error, bits: 0 };
      const { digest, encoded } = derived.result;
      return { output: encoded, error: "", bits: digest.length * 8 };
    }
    try {
      const digest = hashBytes(variant, new TextEncoder().encode(input), seed ?? 0);
      return { output: formatDigest(digest, format), error: "", bits: digest.length * 8 };
    } catch (e) {
      return { output: "", error: message(e), bits: 0 };
    }
  }, [spec, stale, derived, format, variant, input, seed]);

  const inputBytes = useMemo(() => new TextEncoder().encode(input).length, [input]);
  const variants = spec.variants;
  const formats = spec.formats;

  const handleAlgorithmChange = (value: string | null) => {
    if (value === null || !(value in ALGORITHMS)) return;
    setAlgorithm(value);
    setVariant(ALGORITHMS[value].variants[0].value);
    setFormat(pickFormat(value, null));
    setParams(defaultParams(value));
  };

  const updateParam = <K extends keyof Params>(key: K, value: Params[K]) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  return (
    <Stack gap="md">
      <UtilityTitle file="hasher.tsx">Hasher</UtilityTitle>

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
              {inputBytes > 0 && (
                <Text size="sm" c="dimmed">
                  {inputBytes} {inputBytes === 1 ? "byte" : "bytes"}
                </Text>
              )}
            </Group>
            <Tooltip label="Clear" withArrow position="left">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setInput("")}
                disabled={input === ""}
                aria-label="Clear input"
              >
                <IconX size="1.2rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
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
            placeholder={spec.kdf ? "Password hashing is deliberately slow — press Compute to run it" : ""}
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

interface Params {
  seed: number | string;
  salt: string;
  memory: number | string;
  iterations: number | string;
  parallelism: number | string;
  cost: number | string;
  blockSize: number | string;
}

export interface KdfSettings {
  salt: string;
  memory: number;
  iterations: number;
  parallelism: number;
  cost: number;
  blockSize: number;
}

export interface KdfResult {
  digest: Uint8Array;
  encoded: string;
}

interface Derived {
  request: unknown;
  result: KdfResult | null;
  error: string;
}

interface Algorithm {
  variants: { value: string; label: string }[];
  formats?: string[];
  seeded?: boolean;
  kdf?: boolean;
  params?: (keyof Params)[];
}

function sharedParams(spec: Algorithm, params: Params): Record<string, unknown> {
  return Object.fromEntries((spec.params ?? []).map((key) => [key, params[key]]));
}

const DIGEST_FORMATS = ["hex", "hex-upper", "base64", "base64url"];
const CHECKSUM_FORMATS = ["hex", "hex-upper", "decimal", "base64"];

const ALGORITHMS: Record<string, Algorithm> = {
  md5: { variants: [{ value: "md5", label: "MD5" }], formats: DIGEST_FORMATS },
  "sha-1": { variants: [{ value: "sha-1", label: "SHA-1" }], formats: DIGEST_FORMATS },
  "sha-256": {
    variants: [{ value: "sha-256", label: "SHA-256" }, { value: "sha-224", label: "SHA-224" }],
    formats: DIGEST_FORMATS,
  },
  "sha-512": {
    variants: [
      { value: "sha-512", label: "SHA-512" },
      { value: "sha-384", label: "SHA-384" },
      { value: "sha-512-256", label: "SHA-512/256" },
      { value: "sha-512-224", label: "SHA-512/224" },
    ],
    formats: DIGEST_FORMATS,
  },
  "sha-3": {
    variants: [
      { value: "sha3-256", label: "SHA3-256" },
      { value: "sha3-512", label: "SHA3-512" },
      { value: "sha3-384", label: "SHA3-384" },
      { value: "sha3-224", label: "SHA3-224" },
      { value: "keccak-256", label: "Keccak-256 (pre-standard)" },
    ],
    formats: DIGEST_FORMATS,
  },
  blake2: {
    variants: [
      { value: "blake2b-512", label: "BLAKE2b-512" },
      { value: "blake2b-256", label: "BLAKE2b-256" },
      { value: "blake2s-256", label: "BLAKE2s-256" },
      { value: "blake2s-128", label: "BLAKE2s-128" },
    ],
    formats: DIGEST_FORMATS,
  },
  blake3: {
    variants: [
      { value: "blake3-256", label: "BLAKE3 (256-bit)" },
      { value: "blake3-512", label: "BLAKE3 (512-bit)" },
      { value: "blake3-128", label: "BLAKE3 (128-bit)" },
    ],
    formats: DIGEST_FORMATS,
  },
  crc32: {
    variants: [
      { value: "crc32", label: "CRC-32 (IEEE 802.3)" },
      { value: "crc32c", label: "CRC-32C (Castagnoli)" },
    ],
    formats: CHECKSUM_FORMATS,
  },
  xxhash: {
    variants: [{ value: "xxh64", label: "XXH64" }, { value: "xxh32", label: "XXH32" }],
    formats: CHECKSUM_FORMATS,
    seeded: true,
    params: ["seed"],
  },
  murmur: {
    variants: [
      { value: "murmur3-32", label: "MurmurHash3 (32-bit)" },
      { value: "murmur3-128", label: "MurmurHash3 (128-bit, x64)" },
    ],
    formats: CHECKSUM_FORMATS,
    seeded: true,
    params: ["seed"],
  },
  argon2: {
    variants: [
      { value: "argon2id", label: "Argon2id" },
      { value: "argon2i", label: "Argon2i" },
      { value: "argon2d", label: "Argon2d" },
    ],
    kdf: true,
    params: ["salt", "memory", "iterations", "parallelism"],
  },
  bcrypt: { variants: [{ value: "bcrypt", label: "bcrypt" }], kdf: true, params: ["salt", "cost"] },
  scrypt: {
    variants: [{ value: "scrypt", label: "scrypt" }],
    kdf: true,
    params: ["salt", "cost", "blockSize", "parallelism"],
  },
  pbkdf2: {
    variants: [
      { value: "pbkdf2-sha256", label: "PBKDF2-HMAC-SHA256" },
      { value: "pbkdf2-sha512", label: "PBKDF2-HMAC-SHA512" },
      { value: "pbkdf2-sha1", label: "PBKDF2-HMAC-SHA1" },
    ],
    kdf: true,
    params: ["salt", "iterations"],
  },
};

const ALGORITHM_OPTIONS = [
  {
    group: "Cryptographic",
    items: [
      { value: "md5", label: "MD5" },
      { value: "sha-1", label: "SHA-1" },
      { value: "sha-256", label: "SHA-256" },
      { value: "sha-512", label: "SHA-512" },
      { value: "sha-3", label: "SHA-3" },
      { value: "blake2", label: "BLAKE2" },
      { value: "blake3", label: "BLAKE3" },
    ],
  },
  {
    group: "Checksums and non-cryptographic",
    items: [
      { value: "crc32", label: "CRC32" },
      { value: "xxhash", label: "xxHash" },
      { value: "murmur", label: "MurmurHash" },
    ],
  },
  {
    group: "Password hashing",
    items: [
      { value: "argon2", label: "Argon2" },
      { value: "bcrypt", label: "bcrypt" },
      { value: "scrypt", label: "scrypt" },
      { value: "pbkdf2", label: "PBKDF2" },
    ],
  },
];

const FORMAT_OPTIONS = [
  { value: "hex", label: "Hexadecimal" },
  { value: "hex-upper", label: "Hexadecimal (uppercase)" },
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64 (URL-safe)" },
  { value: "decimal", label: "Decimal" },
];

const MAX_SEED = 0xffffffff;
const BCRYPT_MAX_BYTES = 72;
const ARGON2_MEMORY = { min: 8, max: 262144 };
const ARGON2_ITERATIONS = { min: 1, max: 16 };
const PBKDF2_ITERATIONS = { min: 1, max: 10000000 };
const PBKDF2_DEFAULT_ITERATIONS = 600000;
const PARALLELISM = { min: 1, max: 16 };
const SCRYPT_COST = { min: 1, max: 20 };
const SCRYPT_BLOCK = { min: 1, max: 32 };
const BCRYPT_COST = { min: 4, max: 14 };
const MAX_KDF_MEMORY = 512 * 1024 * 1024;
const ARGON2_SALT_MIN = 8;
const BCRYPT_SALT_PATTERN = /^[./A-Za-z0-9]{22}$/;

const EMPTY_OUTPUT = { output: "", error: "", bits: 0 };

const HASHES: Record<string, (bytes: Uint8Array, seed: number) => Uint8Array> = {
  md5: (bytes) => md5(bytes),
  "sha-1": (bytes) => sha1(bytes),
  "sha-256": (bytes) => sha256(bytes),
  "sha-224": (bytes) => sha224(bytes),
  "sha-512": (bytes) => sha512(bytes),
  "sha-384": (bytes) => sha384(bytes),
  "sha-512-256": (bytes) => sha512_256(bytes),
  "sha-512-224": (bytes) => sha512_224(bytes),
  "sha3-224": (bytes) => sha3_224(bytes),
  "sha3-256": (bytes) => sha3_256(bytes),
  "sha3-384": (bytes) => sha3_384(bytes),
  "sha3-512": (bytes) => sha3_512(bytes),
  "keccak-256": (bytes) => keccak_256(bytes),
  "blake2b-512": (bytes) => blake2b(bytes, { dkLen: 64 }),
  "blake2b-256": (bytes) => blake2b(bytes, { dkLen: 32 }),
  "blake2s-256": (bytes) => blake2s(bytes, { dkLen: 32 }),
  "blake2s-128": (bytes) => blake2s(bytes, { dkLen: 16 }),
  "blake3-256": (bytes) => blake3(bytes, { dkLen: 32 }),
  "blake3-512": (bytes) => blake3(bytes, { dkLen: 64 }),
  "blake3-128": (bytes) => blake3(bytes, { dkLen: 16 }),
  crc32: (bytes) => bigIntToBytes(BigInt(crc(bytes, CRC32_TABLE)), 4),
  crc32c: (bytes) => bigIntToBytes(BigInt(crc(bytes, CRC32C_TABLE)), 4),
  xxh32: (bytes, seed) => bigIntToBytes(BigInt(xxh32(bytes, seed)), 4),
  xxh64: (bytes, seed) => bigIntToBytes(xxh64(bytes, seed), 8),
  "murmur3-32": (bytes, seed) => bigIntToBytes(BigInt(murmur3x8632(bytes, seed)), 4),
  "murmur3-128": (bytes, seed) => bigIntToBytes(murmur3x64128(bytes, seed), 16),
};

export function hashBytes(variant: string, bytes: Uint8Array, seed = 0): Uint8Array {
  const hash = HASHES[variant];
  if (!hash) throw new Error(`"${variant}" is not an algorithm this page knows`);
  return hash(bytes, seed);
}

export function formatDigest(digest: Uint8Array, format: string): string {
  switch (format) {
    case "hex-upper":
      return toHex(digest).toUpperCase();
    case "base64":
      return toBase64(digest);
    case "base64url":
      return toBase64(digest).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "decimal":
      return bytesToBigInt(digest).toString();
    default:
      return toHex(digest);
  }
}

export async function deriveKdf(variant: string, password: string, settings: KdfSettings): Promise<KdfResult> {
  if (variant === "bcrypt") {
    const { default: bcrypt } = await import("bcryptjs");
    const encoded = await bcrypt.hash(password, `$2b$${String(settings.cost).padStart(2, "0")}$${settings.salt}`);
    return { digest: bcryptBase64Decode(encoded.slice(BCRYPT_PREFIX_LENGTH), 23), encoded };
  }

  const saltBytes = new TextEncoder().encode(settings.salt);
  const passwordBytes = new TextEncoder().encode(password);

  if (variant === "scrypt") {
    const { scryptAsync } = await import("@noble/hashes/scrypt.js");
    const { cost, blockSize, parallelism } = settings;
    const digest = await scryptAsync(passwordBytes, saltBytes, {
      N: 2 ** cost,
      r: blockSize,
      p: parallelism,
      dkLen: KDF_LENGTH,
      asyncTick: ASYNC_TICK,
    });
    const suffix = `${phcBase64(saltBytes)}$${phcBase64(digest)}`;
    return { digest, encoded: `$scrypt$ln=${cost},r=${blockSize},p=${parallelism}$${suffix}` };
  }

  const prf = PBKDF2_HASHES[variant];
  if (prf) {
    const { pbkdf2Async } = await import("@noble/hashes/pbkdf2.js");
    const { iterations } = settings;
    const digest = await pbkdf2Async(prf, passwordBytes, saltBytes, {
      c: iterations,
      dkLen: KDF_LENGTH,
      asyncTick: ASYNC_TICK,
    });
    return { digest, encoded: `$${variant}$i=${iterations}$${phcBase64(saltBytes)}$${phcBase64(digest)}` };
  }

  const argon2 = await import("@noble/hashes/argon2.js");
  const derivers: Record<string, typeof argon2.argon2idAsync> = {
    argon2id: argon2.argon2idAsync,
    argon2i: argon2.argon2iAsync,
    argon2d: argon2.argon2dAsync,
  };
  const derive = derivers[variant];
  if (!derive) throw new Error(`"${variant}" is not an algorithm this page knows`);
  const { memory, iterations, parallelism } = settings;
  const digest = await derive(passwordBytes, saltBytes, {
    t: iterations,
    m: memory,
    p: parallelism,
    dkLen: KDF_LENGTH,
    asyncTick: ASYNC_TICK,
  });
  const header = `$${variant}$v=${ARGON2_VERSION}$m=${memory},t=${iterations},p=${parallelism}`;
  return { digest, encoded: `${header}$${phcBase64(saltBytes)}$${phcBase64(digest)}` };
}

const PBKDF2_HASHES: Record<string, CHash> = {
  "pbkdf2-sha1": sha1,
  "pbkdf2-sha256": sha256,
  "pbkdf2-sha512": sha512,
};

const KDF_LENGTH = 32;
const ARGON2_VERSION = 19;
const ASYNC_TICK = 20;
const BCRYPT_PREFIX_LENGTH = 29;

function defaultParams(algorithm: string): Params {
  return {
    seed: 0,
    salt: ALGORITHMS[algorithm].kdf ? randomSalt(algorithm) : "",
    memory: 19456,
    iterations: algorithm === "pbkdf2" ? PBKDF2_DEFAULT_ITERATIONS : 2,
    parallelism: 1,
    cost: algorithm === "bcrypt" ? 10 : 15,
    blockSize: 8,
  };
}

function initialParams(algorithm: string, state: Record<string, unknown> | null): Params {
  const defaults = defaultParams(algorithm);
  return {
    seed: clamp(state?.seed, 0, MAX_SEED, defaults.seed),
    salt: typeof state?.salt === "string" ? state.salt : defaults.salt,
    memory: clamp(state?.memory, ARGON2_MEMORY.min, ARGON2_MEMORY.max, defaults.memory),
    iterations: clamp(state?.iterations, ARGON2_ITERATIONS.min, PBKDF2_ITERATIONS.max, defaults.iterations),
    parallelism: clamp(state?.parallelism, PARALLELISM.min, PARALLELISM.max, defaults.parallelism),
    cost: clamp(state?.cost, BCRYPT_COST.min, SCRYPT_COST.max, defaults.cost),
    blockSize: clamp(state?.blockSize, SCRYPT_BLOCK.min, SCRYPT_BLOCK.max, defaults.blockSize),
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number | string): number | string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function pickAlgorithm(value: unknown): string {
  return typeof value === "string" && value in ALGORITHMS ? value : "sha-256";
}

function pickVariant(algorithm: string, value: unknown): string {
  const variants = ALGORITHMS[algorithm].variants;
  return variants.some((item) => item.value === value) ? value as string : variants[0].value;
}

function pickFormat(algorithm: string, value: unknown): string {
  const formats = ALGORITHMS[algorithm].formats ?? DIGEST_FORMATS;
  return formats.includes(value as string) ? value as string : formats[0];
}

function parseInteger(value: number | string, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function range(min: number, max: number): string {
  return `Enter a value between ${min} and ${max}`;
}

function saltProblem(algorithm: string, salt: string): string | null {
  if (algorithm === "bcrypt") {
    return BCRYPT_SALT_PATTERN.test(salt) ? null : "Enter 22 characters of bcrypt's base64 (./A-Za-z0-9)";
  }
  const length = new TextEncoder().encode(salt).length;
  if (algorithm === "argon2" && length < ARGON2_SALT_MIN) return `Argon2 needs at least ${ARGON2_SALT_MIN} bytes`;
  return length > 0 ? null : "Required";
}

function memoryProblem(memory: number | null, parallelism: number | null): string | null {
  if (memory === null) return range(ARGON2_MEMORY.min, ARGON2_MEMORY.max);
  if (parallelism !== null && memory < parallelism * 8) return `At least ${parallelism * 8} for ${parallelism} lanes`;
  return null;
}

function scryptMemoryProblem(cost: number, blockSize: number | null, parallelism: number | null): string | null {
  if (blockSize === null || parallelism === null) return null;
  const bytes = 128 * 2 ** cost * blockSize * parallelism;
  if (bytes <= MAX_KDF_MEMORY) return null;
  return `These settings need ${Math.round(bytes / 1024 / 1024)} MiB, past the 512 MiB cap`;
}

function randomSalt(algorithm: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return algorithm === "bcrypt" ? bcryptBase64Encode(bytes) : toHex(bytes);
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Hashing failed";
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function phcBase64(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/=+$/, "");
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

const BCRYPT_ALPHABET = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function bcryptBase64Encode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const remaining = bytes.length - i;
    out += BCRYPT_ALPHABET[bytes[i] >> 2];
    if (remaining === 1) {
      out += BCRYPT_ALPHABET[(bytes[i] & 0x03) << 4];
      break;
    }
    out += BCRYPT_ALPHABET[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
    if (remaining === 2) {
      out += BCRYPT_ALPHABET[(bytes[i + 1] & 0x0f) << 2];
      break;
    }
    out += BCRYPT_ALPHABET[((bytes[i + 1] & 0x0f) << 2) | (bytes[i + 2] >> 6)];
    out += BCRYPT_ALPHABET[bytes[i + 2] & 0x3f];
  }
  return out;
}

export function bcryptBase64Decode(text: string, length: number): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const value = BCRYPT_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`"${char}" is not part of bcrypt's alphabet`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8 && out.length < length) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function crcTable(polynomial: number): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ polynomial : value >>> 1;
    table[i] = value;
  }
  return table;
}

const CRC32_TABLE = crcTable(0xedb88320);
const CRC32C_TABLE = crcTable(0x82f63b78);

function crc(bytes: Uint8Array, table: Uint32Array): number {
  let register = 0xffffffff;
  for (const byte of bytes) register = (register >>> 8) ^ table[(register ^ byte) & 0xff];
  return (register ^ 0xffffffff) >>> 0;
}

function rotl32(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

const XXH32_P1 = 0x9e3779b1;
const XXH32_P2 = 0x85ebca77;
const XXH32_P3 = 0xc2b2ae3d;
const XXH32_P4 = 0x27d4eb2f;
const XXH32_P5 = 0x165667b1;

function xxh32(bytes: Uint8Array, seed: number): number {
  const length = bytes.length;
  let offset = 0;
  let hash: number;

  if (length >= 16) {
    let v1 = (seed + XXH32_P1 + XXH32_P2) | 0;
    let v2 = (seed + XXH32_P2) | 0;
    let v3 = seed | 0;
    let v4 = (seed - XXH32_P1) | 0;
    const limit = length - 16;
    do {
      v1 = xxh32Round(v1, readU32LE(bytes, offset));
      v2 = xxh32Round(v2, readU32LE(bytes, offset + 4));
      v3 = xxh32Round(v3, readU32LE(bytes, offset + 8));
      v4 = xxh32Round(v4, readU32LE(bytes, offset + 12));
      offset += 16;
    } while (offset <= limit);
    hash = (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) | 0;
  } else {
    hash = (seed + XXH32_P5) | 0;
  }

  hash = (hash + length) | 0;
  for (; offset + 4 <= length; offset += 4) {
    hash = Math.imul(rotl32((hash + Math.imul(readU32LE(bytes, offset), XXH32_P3)) | 0, 17), XXH32_P4);
  }
  for (; offset < length; offset++) {
    hash = Math.imul(rotl32((hash + Math.imul(bytes[offset], XXH32_P5)) | 0, 11), XXH32_P1);
  }

  hash = Math.imul(hash ^ (hash >>> 15), XXH32_P2);
  hash = Math.imul(hash ^ (hash >>> 13), XXH32_P3);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function xxh32Round(accumulator: number, value: number): number {
  return Math.imul(rotl32((accumulator + Math.imul(value, XXH32_P2)) | 0, 13), XXH32_P1);
}

const U64 = (1n << 64n) - 1n;
const XXH64_P1 = 11400714785074694791n;
const XXH64_P2 = 14029467366897019727n;
const XXH64_P3 = 1609587929392839161n;
const XXH64_P4 = 9650029242287828579n;
const XXH64_P5 = 2870177450012600261n;

function rotl64(value: bigint, bits: bigint): bigint {
  return ((value << bits) | (value >> (64n - bits))) & U64;
}

function mul64(a: bigint, b: bigint): bigint {
  return (a * b) & U64;
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[offset + i]);
  return value;
}

function xxh64(bytes: Uint8Array, seed: number): bigint {
  const length = bytes.length;
  const seed64 = BigInt(seed) & U64;
  let offset = 0;
  let hash: bigint;

  if (length >= 32) {
    let v1 = (seed64 + XXH64_P1 + XXH64_P2) & U64;
    let v2 = (seed64 + XXH64_P2) & U64;
    let v3 = seed64;
    let v4 = (seed64 - XXH64_P1) & U64;
    const limit = length - 32;
    do {
      v1 = xxh64Round(v1, readU64LE(bytes, offset));
      v2 = xxh64Round(v2, readU64LE(bytes, offset + 8));
      v3 = xxh64Round(v3, readU64LE(bytes, offset + 16));
      v4 = xxh64Round(v4, readU64LE(bytes, offset + 24));
      offset += 32;
    } while (offset <= limit);
    hash = (rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n)) & U64;
    for (const accumulator of [v1, v2, v3, v4]) {
      hash = (mul64(hash ^ xxh64Round(0n, accumulator), XXH64_P1) + XXH64_P4) & U64;
    }
  } else {
    hash = (seed64 + XXH64_P5) & U64;
  }

  hash = (hash + BigInt(length)) & U64;
  for (; offset + 8 <= length; offset += 8) {
    hash = (mul64(rotl64(hash ^ xxh64Round(0n, readU64LE(bytes, offset)), 27n), XXH64_P1) + XXH64_P4) & U64;
  }
  for (; offset + 4 <= length; offset += 4) {
    const lane = mul64(BigInt(readU32LE(bytes, offset)), XXH64_P1);
    hash = (mul64(rotl64(hash ^ lane, 23n), XXH64_P2) + XXH64_P3) & U64;
  }
  for (; offset < length; offset++) {
    hash = mul64(rotl64(hash ^ mul64(BigInt(bytes[offset]), XXH64_P5), 11n), XXH64_P1);
  }

  hash = mul64(hash ^ (hash >> 33n), XXH64_P2);
  hash = mul64(hash ^ (hash >> 29n), XXH64_P3);
  return hash ^ (hash >> 32n);
}

function xxh64Round(accumulator: bigint, value: bigint): bigint {
  return mul64(rotl64((accumulator + mul64(value, XXH64_P2)) & U64, 31n), XXH64_P1);
}

const MURMUR32_C1 = 0xcc9e2d51;
const MURMUR32_C2 = 0x1b873593;

function murmur3x8632(bytes: Uint8Array, seed: number): number {
  const length = bytes.length;
  const blocks = length >>> 2;
  let hash = seed | 0;

  for (let i = 0; i < blocks; i++) {
    const block = Math.imul(rotl32(Math.imul(readU32LE(bytes, i * 4), MURMUR32_C1), 15), MURMUR32_C2);
    hash = rotl32(hash ^ block, 13);
    hash = (Math.imul(hash, 5) + 0xe6546b64) | 0;
  }

  const tail = blocks * 4;
  const remainder = length & 3;
  let last = 0;
  if (remainder === 3) last ^= bytes[tail + 2] << 16;
  if (remainder >= 2) last ^= bytes[tail + 1] << 8;
  if (remainder >= 1) {
    last ^= bytes[tail];
    hash ^= Math.imul(rotl32(Math.imul(last, MURMUR32_C1), 15), MURMUR32_C2);
  }

  return fmix32(hash ^ length) >>> 0;
}

function fmix32(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return value ^ (value >>> 16);
}

const MURMUR128_C1 = 0x87c37b91114253d5n;
const MURMUR128_C2 = 0x4cf5ad432745937fn;

function murmur3x64128(bytes: Uint8Array, seed: number): bigint {
  const length = bytes.length;
  const blocks = Math.floor(length / 16);
  const seed64 = BigInt(seed >>> 0);
  let h1 = seed64;
  let h2 = seed64;

  for (let i = 0; i < blocks; i++) {
    const k1 = mul64(rotl64(mul64(readU64LE(bytes, i * 16), MURMUR128_C1), 31n), MURMUR128_C2);
    h1 = rotl64(h1 ^ k1, 27n);
    h1 = (mul64((h1 + h2) & U64, 5n) + 0x52dce729n) & U64;

    const k2 = mul64(rotl64(mul64(readU64LE(bytes, i * 16 + 8), MURMUR128_C2), 33n), MURMUR128_C1);
    h2 = rotl64(h2 ^ k2, 31n);
    h2 = (mul64((h2 + h1) & U64, 5n) + 0x38495ab5n) & U64;
  }

  const tail = blocks * 16;
  const remainder = length & 15;
  let k1 = 0n;
  let k2 = 0n;
  for (let i = remainder; i > 0; i--) {
    const byte = BigInt(bytes[tail + i - 1]);
    if (i > 8) k2 = (k2 << 8n) | byte;
    else k1 = (k1 << 8n) | byte;
  }
  if (remainder > 8) h2 ^= mul64(rotl64(mul64(k2, MURMUR128_C2), 33n), MURMUR128_C1);
  if (remainder > 0) h1 ^= mul64(rotl64(mul64(k1, MURMUR128_C1), 31n), MURMUR128_C2);

  h1 ^= BigInt(length);
  h2 ^= BigInt(length);
  h1 = (h1 + h2) & U64;
  h2 = (h2 + h1) & U64;
  h1 = fmix64(h1);
  h2 = fmix64(h2);
  h1 = (h1 + h2) & U64;
  h2 = (h2 + h1) & U64;

  return (h1 << 64n) | h2;
}

function fmix64(value: bigint): bigint {
  value = mul64(value ^ (value >> 33n), 0xff51afd7ed558ccdn);
  value = mul64(value ^ (value >> 33n), 0xc4ceb9fe1a85ec53n);
  return value ^ (value >> 33n);
}
