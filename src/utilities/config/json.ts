import { type ConfigValue, type ReadResult, readValue, unreadable, type WriteOptions, type WriteResult, written } from "./value";

export function readJson(text: string): ReadResult {
  if (text.trim() === "") return readValue(null);

  try {
    return readValue(JSON.parse(text) as ConfigValue);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const at = PLACE.exec(message);
    return unreadable(
      message.replace(POSITION_CLAUSE, "").trim(),
      at ? { line: Number(at[1]), column: Number(at[2]) } : undefined,
    );
  }
}

export function writeJson(value: ConfigValue, { indent }: WriteOptions): WriteResult {
  return written(`${JSON.stringify(value, null, indent)}\n`);
}

const PLACE = /\(line (\d+) column (\d+)\)/;

const POSITION_CLAUSE = /\s*at position \d+(?: \(line \d+ column \d+\))?/;
