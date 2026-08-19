import type { ReadResult, SchemaDocument } from "./ir";
import { readJsonSchema, writeJsonSchema } from "./json-schema";
import { readPydantic, writePydantic } from "./pydantic";
import { readZod, writeZod } from "./zod";

export type LanguageId = "json-schema" | "zod" | "pydantic";

export interface Language {
  id: LanguageId;
  label: string;
  read: (text: string) => ReadResult;
  write: (doc: SchemaDocument) => string;
}

export const LANGUAGES: Record<LanguageId, Language> = {
  "json-schema": { id: "json-schema", label: "JSON Schema", read: readJsonSchema, write: writeJsonSchema },
  zod: { id: "zod", label: "Zod", read: readZod, write: writeZod },
  pydantic: { id: "pydantic", label: "Pydantic", read: readPydantic, write: writePydantic },
};

export const LANGUAGE_OPTIONS = Object.values(LANGUAGES).map(({ id, label }) => ({ value: id, label }));

export function isLanguage(value: string | null | undefined): value is LanguageId {
  return value === "json-schema" || value === "zod" || value === "pydantic";
}
