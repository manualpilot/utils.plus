import { generateCUID, generateCUID2, generateKSUID, generateNanoID, generateObjectId, generatePushID, generateSnowflake, generateSonyflake, generateTypeID, generateULID, generateUUIDv1, generateUUIDv2, generateUUIDv3, generateUUIDv4, generateUUIDv5, generateUUIDv6, generateUUIDv7, generateUUIDv8, generateXID } from "./ids";
import { ID_TYPE_VALUES, type IdSettings, LOCAL_DOMAINS, MAX_COUNT, MAX_LOCAL_ID, PREFIX_PATTERN, UUID_PATTERN } from "./types";

export function generateId(type: string, settings: IdSettings): string {
  switch (type) {
    case "uuid-v1":
      return generateUUIDv1();
    case "uuid-v2":
      return generateUUIDv2(settings.localId, settings.domain);
    case "uuid-v3":
      return generateUUIDv3(settings.name, settings.namespace);
    case "uuid-v5":
      return generateUUIDv5(settings.name, settings.namespace);
    case "uuid-v6":
      return generateUUIDv6();
    case "uuid-v7":
      return generateUUIDv7();
    case "uuid-v8":
      return generateUUIDv8();
    case "nanoid":
      return generateNanoID();
    case "cuid":
      return generateCUID();
    case "cuid2":
      return generateCUID2();
    case "ulid":
      return generateULID();
    case "ksuid":
      return generateKSUID();
    case "xid":
      return generateXID();
    case "typeid":
      return generateTypeID(settings.prefix);
    case "objectid":
      return generateObjectId();
    case "pushid":
      return generatePushID();
    case "snowflake":
      return generateSnowflake();
    case "sonyflake":
      return generateSonyflake();
    default:
      return generateUUIDv4();
  }
}

export function namespaceProblem(namespace: string): string | null {
  if (!namespace) return "Required";
  return UUID_PATTERN.test(namespace) ? null : "Enter a valid UUID";
}

export function prefixProblem(prefix: string): string | null {
  if (!prefix) return null;
  return PREFIX_PATTERN.test(prefix) ? null : "Enter lowercase letters, joined by underscores";
}

export function parseCount(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 1 && rounded <= MAX_COUNT ? rounded : null;
}

export function parseLocalId(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 0 && rounded <= MAX_LOCAL_ID ? rounded : null;
}

export function clampCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(MAX_COUNT, Math.max(1, Math.floor(value)));
}

export function clampLocalId(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_LOCAL_ID, Math.max(0, Math.floor(value)));
}

export function pickType(value: unknown): string {
  return ID_TYPE_VALUES.has(value as string) ? value as string : "uuid-v4";
}

export function pickDomain(value: unknown): string {
  return LOCAL_DOMAINS.some((option) => option.value === value) ? value as string : "person";
}

export function pickText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
