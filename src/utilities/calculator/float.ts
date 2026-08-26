import type { Fact } from "../../common/fact-table";
import { type Bits, maskOf } from "./machine";

export interface FloatFormat {
  bits: Bits;
  name: string;
  nickname: string;
  exponentBits: number;
  significandBits: number;
  bias: number;
}

const BINARY64: FloatFormat = {
  bits: 64,
  name: "binary64",
  nickname: "double",
  exponentBits: 11,
  significandBits: 52,
  bias: 1023,
};

export const FLOAT_FORMATS: Partial<Record<Bits, FloatFormat>> = {
  16: { bits: 16, name: "binary16", nickname: "half", exponentBits: 5, significandBits: 10, bias: 15 },
  32: { bits: 32, name: "binary32", nickname: "single", exponentBits: 8, significandBits: 23, bias: 127 },
  64: BINARY64,
};

export function floatFormat(bits: Bits): FloatFormat | null {
  return FLOAT_FORMATS[bits] ?? null;
}

export type FloatKind = "zero" | "subnormal" | "normal" | "infinity" | "nan";

export interface FloatReading {
  format: FloatFormat;
  negative: boolean;
  kind: FloatKind;
  biased: number;
  stored: bigint;
  significand: bigint;
  exponent: number;
  value: number;
}

export function readFloat(pattern: bigint, format: FloatFormat): FloatReading {
  const bits = pattern & maskOf(format.bits);
  const negative = (bits >> BigInt(format.bits - 1)) === 1n;
  const biased = Number((bits >> BigInt(format.significandBits)) & maskOf(format.exponentBits));
  const stored = bits & maskOf(format.significandBits);
  const filled = (1 << format.exponentBits) - 1;

  const kind: FloatKind = biased === filled
    ? (stored === 0n ? "infinity" : "nan")
    : biased === 0
    ? (stored === 0n ? "zero" : "subnormal")
    : "normal";

  const implied = biased === 0 ? 0n : 1n << BigInt(format.significandBits);
  const significand = stored | implied;
  const exponent = Math.max(biased, 1) - format.bias - format.significandBits;
  const value = kind === "nan"
    ? NaN
    : kind === "infinity"
    ? (negative ? -Infinity : Infinity)
    : (negative ? -1 : 1) * Number(significand) * 2 ** exponent;

  return { format, negative, kind, biased, stored, significand, exponent, value };
}

export type FloatField = "sign" | "exponent" | "significand";

export function floatField(index: number, format: FloatFormat): FloatField {
  if (index === format.bits - 1) return "sign";
  return index >= format.significandBits ? "exponent" : "significand";
}

export const FLOAT_FIELDS: FloatField[] = ["sign", "exponent", "significand"];

export const FIELD_NAMES: Record<FloatField, string> = {
  sign: "Sign",
  exponent: "Exponent",
  significand: "Significand",
};

export function floatFacts(reading: FloatReading): Fact[] {
  const { format, kind, negative, biased, stored } = reading;
  const special = kind === "infinity" || kind === "nan";
  const exact = exactDecimal(reading);

  return [
    { label: "Exact", value: exact === shortestDecimal(reading) ? "" : exact },
    { label: "Hex float", value: hexLiteral(reading) },
    { label: "Class", value: CLASS_NAMES[kind] ?? (quiet(reading) ? "Quiet NaN" : "Signalling NaN") },
    { label: "Sign", value: negative ? "1 (negative)" : "0 (positive)" },
    { label: "Exponent", value: special || kind === "zero" ? "" : String(Math.max(biased, 1) - format.bias) },
    { label: "Exponent field", value: String(biased) },
    {
      label: kind === "nan" ? "Payload" : "Significand field",
      value: kind === "infinity" ? "" : `0x${stored.toString(16).toUpperCase()}`,
    },
    { label: "Step", value: special ? "" : String(2 ** reading.exponent) },
  ];
}

const CLASS_NAMES: Partial<Record<FloatKind, string>> = {
  zero: "Zero",
  subnormal: "Subnormal",
  normal: "Normal",
  infinity: "Infinity",
};

function quiet(reading: FloatReading): boolean {
  return (reading.stored >> BigInt(reading.format.significandBits - 1)) === 1n;
}

export function shortestDecimal(reading: FloatReading): string {
  if (reading.kind === "nan") return "NaN";
  if (reading.kind === "infinity") return reading.negative ? "-Infinity" : "Infinity";
  if (reading.kind === "zero") return reading.negative ? "-0" : "0";
  if (reading.format.bits === BINARY64.bits) return String(reading.value);

  const target = encodeValue(reading.value, reading.format);
  for (let digits = 1; digits <= DOUBLE_DIGITS; digits++) {
    const candidate = Number(reading.value.toPrecision(digits));
    if (encodeValue(candidate, reading.format) === target) return String(candidate);
  }
  return String(reading.value);
}

export function exactDecimal(reading: FloatReading): string {
  if (reading.kind === "nan" || reading.kind === "infinity") return "";
  const sign = reading.negative ? "-" : "";
  if (reading.exponent >= 0) return sign + (reading.significand << BigInt(reading.exponent)).toString();

  const places = -reading.exponent;
  const digits = (reading.significand * 5n ** BigInt(places)).toString().padStart(places + 1, "0");
  const fraction = digits.slice(digits.length - places).replace(/0+$/, "");
  return sign + digits.slice(0, digits.length - places) + (fraction === "" ? "" : `.${fraction}`);
}

export function hexLiteral(reading: FloatReading): string {
  const { format, kind, negative, biased, stored } = reading;
  const sign = negative ? "-" : "";
  if (kind === "nan") return "nan";
  if (kind === "infinity") return `${sign}inf`;
  if (kind === "zero") return `${sign}0x0p+0`;

  const width = Math.ceil(format.significandBits / 4);
  const fraction = (stored << BigInt(width * 4 - format.significandBits)).toString(16).toUpperCase()
    .padStart(width, "0").replace(/0+$/, "");
  const power = Math.max(biased, 1) - format.bias;
  return `${sign}0x${kind === "normal" ? 1 : 0}${fraction === "" ? "" : `.${fraction}`}p${
    power < 0 ? "" : "+"
  }${power}`;
}

export function parseFloatText(text: string, format: FloatFormat): bigint | null {
  const trimmed = text.trim().replace(/_/g, "");
  const negative = trimmed.startsWith("-");
  const body = /^[-+]/.test(trimmed) ? trimmed.slice(1) : trimmed;

  if (/^(?:inf|infinity)$/i.test(body)) return infinityOf(negative, format);
  if (/^nan$/i.test(body)) return quietNaN(format);

  const hex = /^0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?(?:[pP]([-+]?\d+))?$/.exec(body);
  if (hex) {
    const [, whole, fraction = "", power = "0"] = hex;
    if (whole === "" && fraction === "") return null;
    return scaled(negative, BigInt(`0x0${whole}${fraction}`), 2n, Number(power) - fraction.length * 4, format);
  }

  const decimal = /^(\d*)(?:\.(\d*))?(?:[eE]([-+]?\d+))?$/.exec(body);
  if (!decimal) return null;
  const [, whole, fraction = "", power = "0"] = decimal;
  if (whole === "" && fraction === "") return null;
  return scaled(negative, BigInt(`0${whole}${fraction}`), 10n, Number(power) - fraction.length, format);
}

export function stepFloat(pattern: bigint, format: FloatFormat, up: boolean): bigint {
  const bits = pattern & maskOf(format.bits);
  const sign = 1n << BigInt(format.bits - 1);
  const magnitude = bits & (sign - 1n);
  const largest = maskOf(format.exponentBits) << BigInt(format.significandBits);
  if (magnitude > largest) return bits;

  if (((bits & sign) === sign) === up) {
    if (magnitude === 0n) return (up ? 0n : sign) | 1n;
    return (bits & sign) | (magnitude - 1n);
  }
  return magnitude === largest ? bits : (bits & sign) | (magnitude + 1n);
}

const DOUBLE_DIGITS = 17;

const MAX_POWER = 1200;

const CONVERTER = new DataView(new ArrayBuffer(8));

function encodeValue(value: number, format: FloatFormat): bigint {
  if (Number.isNaN(value)) return quietNaN(format);
  if (!Number.isFinite(value)) return infinityOf(value < 0, format);

  CONVERTER.setFloat64(0, value);
  const wide = readFloat(CONVERTER.getBigUint64(0), BINARY64);
  return scaled(wide.negative, wide.significand, 2n, wide.exponent, format);
}

function scaled(negative: boolean, digits: bigint, radix: bigint, power: number, format: FloatFormat): bigint {
  if (digits === 0n) return signOf(negative, format);
  if (power > MAX_POWER) return infinityOf(negative, format);
  if (power < -MAX_POWER) return signOf(negative, format);

  const scale = radix ** BigInt(Math.abs(power));
  return power >= 0
    ? roundToFormat(negative, digits * scale, 1n, format)
    : roundToFormat(negative, digits, scale, format);
}

function roundToFormat(negative: boolean, num: bigint, den: bigint, format: FloatFormat): bigint {
  if (num === 0n) return signOf(negative, format);

  const width = format.significandBits + 1;
  const least = 1 - format.bias - format.significandBits;
  let exponent = Math.max(least, bitLength(num) - bitLength(den) - width);
  let quotient = 0n;
  let remainder = 0n;
  let divisor = 0n;

  for (;;) {
    const numerator = exponent < 0 ? num << BigInt(-exponent) : num;
    divisor = exponent > 0 ? den << BigInt(exponent) : den;
    quotient = numerator / divisor;
    remainder = numerator % divisor;
    if (bitLength(quotient) > width) exponent += 1;
    else if (bitLength(quotient) < width && exponent > least) exponent -= 1;
    else break;
  }

  const twice = remainder * 2n;
  if (twice > divisor || (twice === divisor && (quotient & 1n) === 1n)) quotient += 1n;
  if (bitLength(quotient) > width) {
    quotient >>= 1n;
    exponent += 1;
  }

  const implied = 1n << BigInt(format.significandBits);
  const biased = quotient >= implied ? exponent + format.bias + format.significandBits : 0;
  if (biased >= (1 << format.exponentBits) - 1) return infinityOf(negative, format);
  return signOf(negative, format) | (BigInt(biased) << BigInt(format.significandBits))
    | (biased === 0 ? quotient : quotient - implied);
}

function bitLength(value: bigint): number {
  return value === 0n ? 0 : value.toString(2).length;
}

function signOf(negative: boolean, format: FloatFormat): bigint {
  return negative ? 1n << BigInt(format.bits - 1) : 0n;
}

function infinityOf(negative: boolean, format: FloatFormat): bigint {
  return signOf(negative, format) | (maskOf(format.exponentBits) << BigInt(format.significandBits));
}

function quietNaN(format: FloatFormat): bigint {
  return infinityOf(false, format) | (1n << BigInt(format.significandBits - 1));
}
