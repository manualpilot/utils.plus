import { parse, stringify, YAMLParseError } from "yaml";
import { type ConfigValue, type ReadResult, readValue, unreadable, type WriteOptions, type WriteResult, written } from "./value";

export function readYaml(text: string): ReadResult {
  try {
    return readValue((parse(text) ?? null) as ConfigValue);
  } catch (error) {
    if (!(error instanceof YAMLParseError)) return unreadable(error instanceof Error ? error.message : String(error));
    const at = error.linePos?.[0];
    return unreadable(error.message.split("\n")[0].replace(PLACE, "").trim(), at && { line: at.line, column: at.col });
  }
}

export function writeYaml(value: ConfigValue, { indent }: WriteOptions): WriteResult {
  return written(stringify(value, { indent }));
}

const PLACE = /\s*at line \d+, column \d+:?$/;
