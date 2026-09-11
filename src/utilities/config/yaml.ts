import { parse, stringify, YAMLParseError } from "yaml";
import { type ConfigValue, exactInteger, type ReadResult, readValue, unreadable, type WriteOptions, type WriteResult, written } from "./value";

export function readYaml(text: string): ReadResult {
  try {
    return readValue(exactIntegers((parse(text, { intAsBigInt: true }) ?? null) as ConfigValue));
  } catch (error) {
    if (!(error instanceof YAMLParseError)) return unreadable(error instanceof Error ? error.message : String(error));
    const at = error.linePos?.[0];
    return unreadable(error.message.split("\n")[0].replace(PLACE, "").trim(), at && { line: at.line, column: at.col });
  }
}

export function writeYaml(value: ConfigValue, { indent }: WriteOptions): WriteResult {
  return written(stringify(value, { indent, compat: "yaml-1.1" }));
}

function exactIntegers(node: ConfigValue): ConfigValue {
  if (typeof node === "bigint") return exactInteger(node);
  if (Array.isArray(node)) return node.map(exactIntegers);
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, exactIntegers(item)]));
  }
  return node;
}

const PLACE = /\s*at line \d+, column \d+:?$/;
