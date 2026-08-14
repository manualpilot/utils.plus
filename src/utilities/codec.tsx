import { ActionIcon, Box, Card, CopyButton, Group, Input, SegmentedControl, Select, Stack, Text, Textarea, Title, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../common/share-state";
import { UtilityTitle } from "../common/utility-title";
import { IconArrowsUpDown, IconCheck, IconCopy, IconX } from "../icons";

export default function Codec() {
  const initialState = useInitialHashState<{
    mode?: string;
    format?: string;
    variant?: string;
    input?: string;
  }>();

  const initialFormat: Format = isFormat(initialState?.format) ? initialState.format : "base64";
  const sharedVariant = initialState?.variant;

  const [mode, setMode] = useState<Mode>(
    initialState?.mode === "decode" ? "decode" : "encode",
  );
  const [format, setFormat] = useState<Format>(initialFormat);
  const [variant, setVariant] = useState<string>(
    sharedVariant !== undefined && VARIANTS[initialFormat].some((item) => item.value === sharedVariant)
      ? sharedVariant
      : defaultVariant(initialFormat),
  );
  const [input, setInput] = useState(initialState?.input ?? "");

  useRegisterShareState(() => ({ mode, format, variant, input: input || undefined }));

  const { output, error, byteLength } = useMemo(
    () => convert(input, mode, format, variant),
    [input, mode, format, variant],
  );

  const formatLabel = FORMATS.find((f) => f.value === format)?.label ?? format;
  const inputLabel = mode === "encode" ? "Plain text" : formatLabel;
  const outputLabel = mode === "encode" ? formatLabel : "Plain text";
  const canSwap = output !== "" && error === "";

  const handleFormatChange = (value: string | null) => {
    if (!isFormat(value)) return;
    setFormat(value);
    setVariant(defaultVariant(value));
  };

  const handleSwap = () => {
    if (!canSwap) return;
    setInput(output);
    setMode(mode === "encode" ? "decode" : "encode");
  };

  return (
    <Stack gap="md">
      <UtilityTitle file="codec.tsx">Codec</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box className="settings-row">
          <Input.Wrapper label="Direction">
            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(value) => setMode(value as Mode)}
              data={[
                { value: "encode", label: "Encode" },
                { value: "decode", label: "Decode" },
              ]}
            />
          </Input.Wrapper>
          <Select
            label="Format"
            data={FORMATS}
            value={format}
            onChange={handleFormatChange}
            allowDeselect={false}
          />
          <Select
            label="Variant"
            description={VARIANT_HINTS[format]}
            data={VARIANTS[format]}
            value={variant}
            onChange={(value) => value && setVariant(value)}
            allowDeselect={false}
          />
        </Box>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>{inputLabel}</Title>
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
            placeholder={mode === "encode" ? "Text to encode" : `${formatLabel} to decode`}
            autosize
            minRows={5}
            maxRows={12}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>

      <Group justify="center">
        <Tooltip label="Swap input and output" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={handleSwap}
            disabled={!canSwap}
            aria-label="Swap input and output"
          >
            <IconArrowsUpDown size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="sm" align="baseline">
              <Title order={4}>{outputLabel}</Title>
              {!error && byteLength > 0 && (
                <Text size="sm" c="dimmed">
                  {byteLength} {byteLength === 1 ? "byte" : "bytes"}
                </Text>
              )}
            </Group>
            <CopyButton value={output} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                  <ActionIcon
                    color={copied ? "teal" : "gray"}
                    variant="subtle"
                    onClick={copy}
                    disabled={output === ""}
                    aria-label="Copy output"
                  >
                    {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Textarea
            value={output}
            readOnly
            error={error || undefined}
            autosize
            minRows={5}
            maxRows={12}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>
    </Stack>
  );
}

type Mode = "encode" | "decode";

export type Format = "base64" | "base32" | "hex" | "decimal" | "binary" | "nato" | "morse";

const FORMATS = [
  { value: "base64", label: "Base64" },
  { value: "base32", label: "Base32" },
  { value: "hex", label: "Hexadecimal" },
  { value: "decimal", label: "Decimal" },
  { value: "binary", label: "Binary" },
  { value: "nato", label: "NATO phonetic" },
  { value: "morse", label: "Morse code" },
];

const VARIANTS: Record<Format, { value: string; label: string }[]> = {
  base64: [
    { value: "standard", label: "Standard (RFC 4648)" },
    { value: "standard-nopad", label: "Standard, no padding" },
    { value: "url", label: "URL-safe" },
    { value: "url-nopad", label: "URL-safe, no padding" },
  ],
  base32: [
    { value: "rfc4648", label: "Standard (RFC 4648)" },
    { value: "rfc4648-nopad", label: "Standard, no padding" },
    { value: "base32hex", label: "Extended hex (RFC 4648)" },
    { value: "crockford", label: "Crockford's Base32" },
  ],
  hex: [
    { value: "lower", label: "Lowercase" },
    { value: "upper", label: "Uppercase" },
    { value: "lower-spaced", label: "Lowercase, spaced" },
    { value: "upper-spaced", label: "Uppercase, spaced" },
  ],
  decimal: [
    { value: "space", label: "Space separated" },
    { value: "comma", label: "Comma separated" },
    { value: "padded", label: "Zero padded, spaced" },
  ],
  binary: [
    { value: "spaced", label: "Space separated bytes" },
    { value: "continuous", label: "Continuous" },
  ],
  nato: [
    { value: "standard", label: "NATO/ICAO (Alfa, Juliett)" },
    { value: "alternate", label: "Common spellings (Alpha, Juliet)" },
    { value: "aviation", label: "Aviation digits (Tree, Fower, Niner)" },
  ],
  morse: [
    { value: "slash", label: "Slash between words" },
    { value: "spaces", label: "Three spaces between words" },
    { value: "symbols", label: "Interpunct and minus (·−)" },
  ],
};

const VARIANT_HINTS: Record<Format, string> = {
  base64: "Decoding accepts either alphabet",
  base32: "Alphabet applies to decoding too",
  hex: "Decoding ignores case and separators",
  decimal: "Decoding ignores separators",
  binary: "Decoding ignores separators",
  nato: "Decoding accepts any spelling",
  morse: "Decoding accepts · and − as well",
};

function defaultVariant(format: Format): string {
  return VARIANTS[format][0].value;
}

function isFormat(value: string | undefined | null): value is Format {
  return FORMATS.some((format) => format.value === value);
}

function convert(
  input: string,
  mode: Mode,
  format: Format,
  variant: string,
): { output: string; error: string; byteLength: number } {
  if (input === "") return { output: "", error: "", byteLength: 0 };

  try {
    if (mode === "encode") {
      const bytes = new TextEncoder().encode(input);
      return { output: encodeBytes(bytes, format, variant), error: "", byteLength: bytes.length };
    }

    const bytes = decodeToBytes(input, format, variant);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Decoded bytes are not valid UTF-8 text");
    }
    return { output: text, error: "", byteLength: bytes.length };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : "Conversion failed", byteLength: 0 };
  }
}

export function encodeBytes(bytes: Uint8Array, format: Format, variant: string): string {
  switch (format) {
    case "base64": {
      const alphabet = variant.startsWith("url") ? BASE64_URL : BASE64_STANDARD;
      const encoded = encodeWithAlphabet(bytes, alphabet, 6);
      return variant.endsWith("nopad") ? encoded : pad(encoded, 4);
    }
    case "base32": {
      const encoded = encodeWithAlphabet(bytes, BASE32_ALPHABETS[variant] ?? BASE32_STANDARD, 5);
      return variant === "rfc4648" || variant === "base32hex" ? pad(encoded, 8) : encoded;
    }
    case "hex": {
      const digits = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
      const joined = digits.join(variant.endsWith("spaced") ? " " : "");
      return variant.startsWith("upper") ? joined.toUpperCase() : joined;
    }
    case "decimal": {
      if (variant === "padded") {
        return Array.from(bytes, (byte) => byte.toString().padStart(3, "0")).join(" ");
      }
      return Array.from(bytes, (byte) => byte.toString()).join(variant === "comma" ? ", " : " ");
    }
    case "binary": {
      const digits = Array.from(bytes, (byte) => byte.toString(2).padStart(8, "0"));
      return digits.join(variant === "continuous" ? "" : " ");
    }
    case "nato":
      return encodeNato(bytesToText(bytes), variant);
    case "morse":
      return encodeMorse(bytesToText(bytes), variant);
  }
}

export function decodeToBytes(text: string, format: Format, variant: string): Uint8Array {
  switch (format) {
    case "base64": {
      const cleaned = text.replace(/\s+/g, "").replace(/=+$/, "");
      return decodeWithAlphabet(cleaned, BASE64_LOOKUP, 6);
    }
    case "base32": {
      let cleaned = text.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
      if (variant === "crockford") cleaned = cleaned.replace(/-/g, "");
      return decodeWithAlphabet(cleaned, base32Lookup(variant), 5);
    }
    case "hex": {
      const cleaned = text.replace(/0x/gi, "").replace(/[\s,:_-]+/g, "");
      if (!/^[0-9a-f]*$/i.test(cleaned)) {
        throw new Error("Input contains characters that are not hexadecimal digits");
      }
      if (cleaned.length % 2 !== 0) {
        throw new Error("Hexadecimal input must have an even number of digits");
      }
      const bytes = new Uint8Array(cleaned.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
    case "decimal": {
      const parts = text.split(/[\s,;]+/).filter((part) => part !== "");
      const bytes = new Uint8Array(parts.length);
      for (let i = 0; i < parts.length; i++) {
        if (!/^\d+$/.test(parts[i])) {
          throw new Error(`"${parts[i]}" is not a decimal number`);
        }
        const value = parseInt(parts[i], 10);
        if (value > 255) {
          throw new Error(`${value} is out of range: each value must be 0-255`);
        }
        bytes[i] = value;
      }
      return bytes;
    }
    case "binary": {
      const cleaned = text.replace(/[\s,_]+/g, "");
      if (!/^[01]*$/.test(cleaned)) {
        throw new Error("Binary input may only contain 0 and 1");
      }
      if (cleaned.length % 8 !== 0) {
        throw new Error("Binary input must be a whole number of 8-bit bytes");
      }
      const bytes = new Uint8Array(cleaned.length / 8);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleaned.slice(i * 8, i * 8 + 8), 2);
      }
      return bytes;
    }
    case "nato":
      return new TextEncoder().encode(decodeNato(text));
    case "morse":
      return new TextEncoder().encode(decodeMorse(text));
  }
}

function bytesToText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("This format spells out text, and the input is not valid UTF-8");
  }
}

const BASE64_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE32_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_HEX = "0123456789ABCDEFGHIJKLMNOPQRSTUV";
const BASE32_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const BASE32_ALPHABETS: Record<string, string> = {
  rfc4648: BASE32_STANDARD,
  "rfc4648-nopad": BASE32_STANDARD,
  base32hex: BASE32_HEX,
  crockford: BASE32_CROCKFORD,
};

function buildLookup(alphabet: string, aliases: Record<string, number> = {}): Map<string, number> {
  const lookup = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) {
    lookup.set(alphabet[i], i);
  }
  for (const [char, value] of Object.entries(aliases)) {
    lookup.set(char, value);
  }
  return lookup;
}

const BASE64_LOOKUP = buildLookup(BASE64_STANDARD, { "-": 62, _: 63 });

function base32Lookup(variant: string): Map<string, number> {
  const alphabet = BASE32_ALPHABETS[variant] ?? BASE32_STANDARD;
  if (variant !== "crockford") return buildLookup(alphabet);
  return buildLookup(alphabet, { I: 1, L: 1, O: 0 });
}

function encodeWithAlphabet(bytes: Uint8Array, alphabet: string, bitsPerChar: number): string {
  const mask = alphabet.length - 1;
  let out = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[(buffer >> bits) & mask];
    }
  }
  if (bits > 0) {
    out += alphabet[(buffer << (bitsPerChar - bits)) & mask];
  }
  return out;
}

function decodeWithAlphabet(chars: string, lookup: Map<string, number>, bitsPerChar: number): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of chars) {
    const value = lookup.get(char);
    if (value === undefined) {
      throw new Error(`"${char}" is not valid for the selected format`);
    }
    buffer = (buffer << bitsPerChar) | value;
    bits += bitsPerChar;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  if (bits >= bitsPerChar) {
    throw new Error("Input is truncated: it does not contain a whole number of bytes");
  }
  return new Uint8Array(out);
}

function pad(encoded: string, blockSize: number): string {
  const remainder = encoded.length % blockSize;
  return remainder === 0 ? encoded : encoded + "=".repeat(blockSize - remainder);
}

const NATO_WORD_BREAK = "Break";

function encodeNato(text: string, variant: string): string {
  const words = NATO_WORDS[variant] ?? NATO_WORDS.standard;
  return splitWords(text)
    .map((word) => Array.from(word, (char) => words[char.toUpperCase()] ?? char).join(" "))
    .join(` ${NATO_WORD_BREAK} `);
}

function decodeNato(text: string): string {
  const words = text
    .split(new RegExp(`\\s*\\b${NATO_WORD_BREAK}\\b\\s*|\\n+`, "i"))
    .map((group) =>
      splitWords(group)
        .map((token) => {
          const char = NATO_LOOKUP.get(token.toLowerCase());
          if (char !== undefined) return char;
          if (Array.from(token).length === 1) return token.toUpperCase();
          throw new Error(`"${token}" is not a NATO phonetic word`);
        })
        .join("")
    );
  return words.filter((word) => word !== "").join(" ");
}

function encodeMorse(text: string, variant: string): string {
  const encoded = splitWords(text)
    .map((word) =>
      Array.from(word, (char) => {
        const code = MORSE_CODES[char.toUpperCase()];
        if (code === undefined) throw new Error(`"${char}" has no Morse code`);
        return code;
      }).join(" ")
    )
    .join(variant === "spaces" ? "   " : " / ");
  return variant === "symbols" ? encoded.replace(/\./g, "·").replace(/-/g, "−") : encoded;
}

function decodeMorse(text: string): string {
  const normalized = text.replace(/[·•∙]/g, ".").replace(/[–—−_]/g, "-");
  const words = normalized
    .split(/\s*\/+\s*|\s{2,}|\n/)
    .map((word) =>
      splitWords(word)
        .map((code) => {
          const char = MORSE_LOOKUP.get(code);
          if (char === undefined) throw new Error(`"${code}" is not a Morse code sequence`);
          return char;
        })
        .join("")
    );
  return words.filter((word) => word !== "").join(" ");
}

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== "");
}

const NATO_LETTER_WORDS =
  "Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec "
  + "Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu";
const NATO_DIGIT_WORDS = "Zero One Two Three Four Five Six Seven Eight Nine";

const NATO_WORDS: Record<string, Record<string, string>> = {
  standard: natoWords(),
  alternate: natoWords({ A: "Alpha", J: "Juliet", X: "X-ray" }),
  aviation: natoWords({ "3": "Tree", "4": "Fower", "5": "Fife", "9": "Niner" }),
};

function natoWords(overrides: Record<string, string> = {}): Record<string, string> {
  const table: Record<string, string> = {};
  NATO_LETTER_WORDS.split(" ").forEach((word, index) => {
    table[String.fromCharCode("A".charCodeAt(0) + index)] = word;
  });
  NATO_DIGIT_WORDS.split(" ").forEach((word, index) => {
    table[String(index)] = word;
  });
  return { ...table, ...overrides };
}

const NATO_LOOKUP = natoLookup();

function natoLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const table of Object.values(NATO_WORDS)) {
    for (const [char, word] of Object.entries(table)) {
      lookup.set(word.toLowerCase(), char);
    }
  }
  for (const [word, char] of Object.entries({ wun: "1", too: "2", ait: "8" })) {
    lookup.set(word, char);
  }
  return lookup;
}

const MORSE_CODES: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  ":": "---...",
  ";": "-.-.-.",
  "?": "..--..",
  "!": "-.-.--",
  "'": ".----.",
  "\"": ".-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  "_": "..--.-",
  "/": "-..-.",
  "@": ".--.-.",
  "$": "...-..-",
};

const MORSE_LOOKUP = new Map(Object.entries(MORSE_CODES).map(([char, code]) => [code, char]));
