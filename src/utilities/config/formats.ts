import { readEnv, writeEnv } from "./env";
import { readJson, writeJson } from "./json";
import { readProperties, writeProperties } from "./properties";
import { readToml, writeToml } from "./toml";
import type { ConfigValue, ReadResult, WriteOptions, WriteResult } from "./value";
import { readYaml, writeYaml } from "./yaml";

export type FormatId = "yaml" | "json" | "toml" | "env" | "properties";

export interface Format {
  id: FormatId;
  label: string;
  indents: boolean;
  read: (text: string) => ReadResult;
  write: (value: ConfigValue, options: WriteOptions) => WriteResult;
}

export const FORMATS: { [id in FormatId]: Format } = {
  yaml: { id: "yaml", label: "YAML", indents: true, read: readYaml, write: writeYaml },
  json: { id: "json", label: "JSON", indents: true, read: readJson, write: writeJson },
  toml: { id: "toml", label: "TOML", indents: false, read: readToml, write: writeToml },
  env: { id: "env", label: ".env", indents: false, read: readEnv, write: writeEnv },
  properties: { id: "properties", label: ".properties", indents: false, read: readProperties, write: writeProperties },
};

export const FORMAT_OPTIONS = Object.values(FORMATS).map(({ id, label }) => ({ value: id, label }));

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export function isFormat(value: string | null | undefined): value is FormatId {
  return value !== null && value !== undefined && value in FORMATS;
}
