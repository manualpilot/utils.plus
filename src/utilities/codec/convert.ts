import { BASE32_ALPHABETS, BASE32_STANDARD, base32Lookup, BASE64_LOOKUP, BASE64_STANDARD, BASE64_URL, decodeWithAlphabet, encodeWithAlphabet, pad } from "./base";
import { deflate, inflate } from "./deflate";
import { type ByteFormat, type Format, type Mode } from "./formats";
import { decodeMorse, encodeMorse } from "./morse";
import { decodeNato, encodeNato } from "./nato";
import { bytesToText } from "./text";

export type Conversion = { output: string; error: string; byteLength: number };

export const NOTHING: Conversion = { output: "", error: "", byteLength: 0 };

export async function convert(input: string, mode: Mode, format: Format, variant: string): Promise<Conversion> {
  if (input === "") return NOTHING;

  try {
    if (mode === "encode") {
      const bytes = new TextEncoder().encode(input);
      if (format === "deflate") {
        const compressed = await deflate(bytes, variant);
        return { output: encodeBytes(compressed, "base64", "standard"), error: "", byteLength: compressed.length };
      }
      return { output: encodeBytes(bytes, format, variant), error: "", byteLength: bytes.length };
    }

    const bytes = format === "deflate"
      ? await inflate(decodeToBytes(input, "base64", "standard"), variant)
      : decodeToBytes(input, format, variant);
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

export function encodeBytes(bytes: Uint8Array, format: ByteFormat, variant: string): string {
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

export function decodeToBytes(text: string, format: ByteFormat, variant: string): Uint8Array<ArrayBuffer> {
  switch (format) {
    case "base64": {
      const unescaped = text.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const cleaned = unescaped.replace(/\s+/g, "").replace(/=+$/, "");
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
