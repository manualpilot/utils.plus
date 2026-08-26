import type { Fact } from "../../common/fact-table";
import type { Character } from "./characters";

export function encodings(character: Character): Fact[] {
  const { code } = character;
  const alone = character.category === "Cs";

  return [
    { label: "Code point", value: `U+${hex(code, 4)}` },
    { label: "Decimal", value: String(code) },
    { label: "UTF-8", value: alone ? "" : utf8(code).map((byte) => hex(byte, 2)).join(" ") },
    { label: "UTF-16", value: utf16(code).map((unit) => hex(unit, 4)).join(" ") },
    { label: "UTF-32", value: hex(code, 8) },
    { label: "Binary", value: code.toString(2).padStart(8, "0") },
  ];
}

export function escapes(character: Character, name: string): Fact[] {
  const { code } = character;
  const units = utf16(code);
  const alone = character.category === "Cs";

  return [
    { label: "JavaScript, Rust", value: `\\u{${hex(code, 2)}}` },
    { label: "JSON, Java, C#", value: units.map((unit) => `\\u${hex(unit, 4)}`).join("") },
    { label: "C, Python", value: `\\U${hex(code, 8)}` },
    { label: "Python name", value: name === "" ? "" : `\\N{${name}}` },
    { label: "CSS", value: `\\${hex(code, 6)}` },
    { label: "HTML, XML", value: `&#x${hex(code, 4)};` },
    { label: "HTML decimal", value: `&#${code};` },
    { label: "URL", value: alone ? "" : utf8(code).map((byte) => `%${hex(byte, 2)}`).join("") },
  ];
}

export function utf8(code: number): number[] {
  return [...new TextEncoder().encode(String.fromCodePoint(code))];
}

export function utf16(code: number): number[] {
  if (code <= 0xFFFF) return [code];
  const above = code - 0x10000;
  return [0xD800 + (above >> 10), 0xDC00 + (above & 0x3FF)];
}

function hex(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, "0");
}
