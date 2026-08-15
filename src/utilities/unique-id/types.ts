export const MAX_COUNT = 1000;
export const MAX_LOCAL_ID = 4294967295;

export const ID_TYPES = [
  {
    group: "UUID",
    items: [
      { value: "uuid-v4", label: "UUID Version 4 (Random)" },
      { value: "uuid-v1", label: "UUID Version 1 (Timestamp)" },
      { value: "uuid-v2", label: "UUID Version 2 (DCE Security)" },
      { value: "uuid-v3", label: "UUID Version 3 (MD5 Namespace)" },
      { value: "uuid-v5", label: "UUID Version 5 (SHA-1 Namespace)" },
      { value: "uuid-v6", label: "UUID Version 6 (Timestamp ordered)" },
      { value: "uuid-v7", label: "UUID Version 7 (Unix Epoch ordered)" },
      { value: "uuid-v8", label: "UUID Version 8 (Custom/Vendor-specific)" },
    ],
  },
  {
    group: "Web and application",
    items: [
      { value: "nanoid", label: "NanoID" },
      { value: "cuid", label: "CUID" },
      { value: "cuid2", label: "CUID2" },
      { value: "ulid", label: "ULID" },
      { value: "ksuid", label: "KSUID" },
      { value: "xid", label: "XID" },
      { value: "typeid", label: "TypeID" },
    ],
  },
  {
    group: "Database and service",
    items: [
      { value: "objectid", label: "MongoDB ObjectId" },
      { value: "pushid", label: "Firebase PushID" },
      { value: "snowflake", label: "Snowflake" },
      { value: "sonyflake", label: "Sonyflake" },
    ],
  },
];

export const ID_TYPE_VALUES = new Set(ID_TYPES.flatMap((group) => group.items.map((item) => item.value)));

export const LOCAL_DOMAINS = [
  { value: "person", label: "Person (POSIX UID)" },
  { value: "group", label: "Group (POSIX GID)" },
  { value: "org", label: "Organisation" },
];

export const LOCAL_DOMAIN_CODES: Record<string, number> = { person: 0, group: 1, org: 2 };

export const STANDARD_NAMESPACES = [
  { label: "DNS", value: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
  { label: "URL", value: "6ba7b811-9dad-11d1-80b4-00c04fd430c8" },
  { label: "OID", value: "6ba7b812-9dad-11d1-80b4-00c04fd430c8" },
  { label: "X500", value: "6ba7b814-9dad-11d1-80b4-00c04fd430c8" },
];

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PREFIX_PATTERN = /^[a-z]([a-z_]{0,61}[a-z])?$/;

export interface IdSettings {
  name: string;
  namespace: string;
  prefix: string;
  domain: string;
  localId: number;
}
