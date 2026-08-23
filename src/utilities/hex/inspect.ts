import type { Fact } from "../../common/fact-table";
import { formatHex, toBase64 } from "./bytes";

export function valueReadings(bytes: Uint8Array, offset: number, little: boolean): Fact[] {
  if (offset < 0 || offset >= bytes.length) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const left = bytes.length - offset;

  return [
    { label: "Binary", value: bytes[offset].toString(2).padStart(8, "0") },
    { label: "Int8", value: String(view.getInt8(offset)) },
    { label: "UInt8", value: String(view.getUint8(offset)) },
    { label: "Int16", value: left >= 2 ? String(view.getInt16(offset, little)) : "" },
    { label: "UInt16", value: left >= 2 ? String(view.getUint16(offset, little)) : "" },
    { label: "Int32", value: left >= 4 ? String(view.getInt32(offset, little)) : "" },
    { label: "UInt32", value: left >= 4 ? String(view.getUint32(offset, little)) : "" },
    { label: "Int64", value: left >= 8 ? String(view.getBigInt64(offset, little)) : "" },
    { label: "UInt64", value: left >= 8 ? String(view.getBigUint64(offset, little)) : "" },
    { label: "Float32", value: left >= 4 ? String(view.getFloat32(offset, little)) : "" },
    { label: "Float64", value: left >= 8 ? String(view.getFloat64(offset, little)) : "" },
    { label: "Unix time", value: left >= 4 ? unixTime(view.getUint32(offset, little)) : "" },
    { label: "GUID", value: left >= 16 ? guid(bytes.subarray(offset, offset + 16), little) : "" },
  ];
}

export function textReadings(bytes: Uint8Array, start: number, end: number, limit = MAX_TEXT): Fact[] {
  const run = bytes.subarray(start, Math.min(end, start + limit));
  if (run.length === 0) return [];

  return [
    { label: "UTF-8", value: printable(new TextDecoder("utf-8").decode(run)) },
    { label: "UTF-16 LE", value: run.length >= 2 ? printable(new TextDecoder("utf-16le").decode(run)) : "" },
    { label: "Hex", value: formatHex(run) },
    { label: "Base64", value: toBase64(run) },
  ];
}

export const MAX_TEXT = 1024;

export const PEEK = 64;

function printable(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, "·");
}

function unixTime(seconds: number): string {
  const at = new Date(seconds * 1000);
  return Number.isNaN(at.getTime()) ? "" : at.toISOString().replace(".000Z", "Z");
}

function guid(bytes: Uint8Array, little: boolean): string {
  const group = (from: number, until: number) => {
    const run = bytes.subarray(from, until);
    return formatHex(little && until <= 8 ? run.slice().reverse() : run);
  };
  return [group(0, 4), group(4, 6), group(6, 8), group(8, 10), group(10, 16)].join("-");
}
