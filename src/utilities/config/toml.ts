import { parse, stringify, TomlError, type TomlTable } from "smol-toml";
import { displayPath } from "./flatten";
import { type ConfigValue, describe, isRecord, type ReadResult, readValue, unreadable, unwritable, type WriteResult, written } from "./value";

export function readToml(text: string): ReadResult {
  try {
    return readValue(normalise(parse(text)));
  } catch (error) {
    if (!(error instanceof TomlError)) return unreadable(error instanceof Error ? error.message : String(error));
    return unreadable(error.message.split("\n")[0].trim(), { line: error.line, column: error.column });
  }
}

export function writeToml(value: ConfigValue): WriteResult {
  if (!isRecord(value)) return unwritable(`A TOML document is a table of keys, and this one is ${describe(value)}.`);

  const lost: string[] = [];
  const table = withoutNulls(value, [], lost) as TomlTable;

  try {
    return written(stringify(table), lost);
  } catch (error) {
    return unwritable(error instanceof Error ? error.message : String(error));
  }
}

function normalise(node: unknown): ConfigValue {
  if (node instanceof Date) return node.toJSON();
  if (Array.isArray(node)) return node.map(normalise);
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, normalise(item)]));
  }
  return node as ConfigValue;
}

function withoutNulls(node: ConfigValue, path: string[], lost: string[]): ConfigValue | undefined {
  if (node === null) {
    lost.push(displayPath(path));
    return undefined;
  }

  if (Array.isArray(node)) {
    const mark = lost.length;
    const items = node.map((item, index) => withoutNulls(item, [...path, String(index)], lost));
    if (items.some((item) => item === undefined)) {
      lost.length = mark;
      lost.push(displayPath(path));
      return undefined;
    }
    return items as ConfigValue[];
  }

  if (isRecord(node)) {
    const kept: { [key: string]: ConfigValue } = {};
    for (const [key, item] of Object.entries(node)) {
      const value = withoutNulls(item, [...path, key], lost);
      if (value !== undefined) kept[key] = value;
    }
    return kept;
  }

  return node;
}
