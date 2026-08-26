import { useEffect, useState } from "react";
import algorithmic from "./tables/algorithmic.json";
import jamo from "./tables/jamo.json";

const FILES = import.meta.glob("./names/*.json", { query: "?url", import: "default", eager: true }) as Record<
  string,
  string
>;

export interface Names {
  nameOf: (code: number) => string;
  reading: boolean;
}

export function useNames(codes: number[]): Names {
  const files = [...new Set(codes.map(fileOf))].filter((file) => file in FILES).sort();
  const wanted = files.join(" ");
  const [, arrived] = useState(0);

  useEffect(() => {
    const asked = wanted === "" ? [] : wanted.split(" ");
    if (asked.every((file) => loaded.has(file))) return;

    let waiting = true;
    Promise.all(asked.map(read)).then(() => waiting && arrived((drawn) => drawn + 1));
    return () => {
      waiting = false;
    };
  }, [wanted]);

  return { nameOf, reading: files.some((file) => !settled.has(file)) };
}

export function nameOf(code: number): string {
  const computed = computedName(code);
  if (computed !== "") return computed;
  return loaded.get(fileOf(code))?.[offsetOf(code)] ?? "";
}

function computedName(code: number): string {
  for (const range of algorithmic) {
    if (code < range.start || code > range.end) continue;
    if (range.kind !== "hangul") return range.prefix + code.toString(16).toUpperCase().padStart(4, "0");
    const index = code - range.start;
    const trailing = index % jamo.trailing.length;
    const vowel = Math.floor(index / jamo.trailing.length) % jamo.vowel.length;
    const leading = Math.floor(index / (jamo.trailing.length * jamo.vowel.length));
    return range.prefix + jamo.leading[leading] + jamo.vowel[vowel] + jamo.trailing[trailing];
  }
  return "";
}

const loaded = new Map<string, Record<string, string>>();
const asking = new Map<string, Promise<void>>();
const settled = new Set<string>();

function read(file: string): Promise<void> {
  const held = asking.get(file);
  if (held) return held;

  const asked = fetch(FILES[file])
    .then((response) => response.ok ? response.json() as Promise<Record<string, string>> : undefined)
    .catch(() => undefined)
    .then((names) => {
      settled.add(file);
      if (names) loaded.set(file, names);
      else asking.delete(file);
    });

  asking.set(file, asked);
  return asked;
}

function fileOf(code: number): string {
  return `./names/${(code >> 12).toString(16).toUpperCase().padStart(3, "0")}.json`;
}

function offsetOf(code: number): string {
  return (code & 0xFFF).toString(16).toUpperCase().padStart(3, "0");
}
