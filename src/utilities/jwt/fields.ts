import { ALGORITHMS, DEFAULT_LIFETIME } from "./algorithms";
import type { Field, Form, TokenReading } from "./types";

let nextFieldId = 0;

export function parseFieldValue(text: string): unknown {
  if (!text.trim()) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function writeFieldValue(value: unknown): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value) ?? "";
}

export function fieldsToObject(fields: Field[]): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  for (const field of fields) {
    const name = field.name.trim();
    if (name) object[name] = parseFieldValue(field.value);
  }
  return object;
}

export function duplicateErrors(fields: Field[]): (string | null)[] {
  const seen = new Set<string>();
  return fields.map((field) => {
    const name = field.name.trim();
    if (!name) return null;
    const repeated = seen.has(name);
    seen.add(name);
    return repeated ? "Already used above" : null;
  });
}

export function newField(name: string, value: string): Field {
  return { id: `field-${nextFieldId++}`, name, value };
}

export function starterForm(): Form {
  const issued = Math.floor(Date.now() / 1000);
  return {
    headers: [newField("typ", "JWT")],
    claims: [
      newField("sub", crypto.randomUUID()),
      newField("iat", String(issued)),
      newField("exp", String(issued + DEFAULT_LIFETIME)),
    ],
  };
}

export function formFromReading(reading: TokenReading): { form: Form; alg: string | null } {
  const header = reading.header ?? {};
  const payload = reading.payload ?? {};
  return {
    form: {
      headers: Object.entries(header).filter(([name]) => name !== "alg").map(toField),
      claims: Object.entries(payload).map(toField),
    },
    alg: typeof header.alg === "string" && ALGORITHMS.has(header.alg) ? header.alg : null,
  };
}

export function toField([name, value]: [string, unknown]): Field {
  return newField(name, writeFieldValue(value));
}

export function fieldPairs(fields: Field[] | undefined): [string, string][] | undefined {
  return fields?.map((field) => [field.name, field.value]);
}

export function sharedForm(state: { headers?: unknown; claims?: unknown } | null): Form | null {
  const headers = pickPairs(state?.headers);
  const claims = pickPairs(state?.claims);
  if (!headers && !claims) return null;
  return { headers: headers ?? [], claims: claims ?? [] };
}

export function pickPairs(value: unknown): Field[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string")
    .map((pair) => newField(pair[0], pair[1]));
}

export function pickAlgorithm(value: unknown): string {
  return ALGORITHMS.has(value as string) ? value as string : "EdDSA";
}

export function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function message(e: unknown): string {
  return e instanceof Error ? e.message : "That did not work";
}
