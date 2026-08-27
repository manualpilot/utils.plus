export type Mode = "decode" | "encode";
export type Protection = "signed" | "encrypted";
export type FieldKind = "headers" | "claims";
export type Half = "private" | "public";

export interface Field {
  id: string;
  name: string;
  value: string;
}

export interface Form {
  headers: Field[];
  claims: Field[];
}

export interface Check {
  ok: boolean;
  error: string | null;
}

export interface ParameterRow {
  name: string;
  meaning: string;
  value: string;
  note: string;
  warn: boolean;
}

export interface FieldCardProps {
  title: string;
  kind: FieldKind;
  fields: Field[];
  names: string[];
  onChange: (kind: FieldKind, id: string, patch: Partial<Field>) => void;
  onAdd: (kind: FieldKind) => void;
  onRemove: (kind: FieldKind, id: string) => void;
}

export interface TokenReading {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signature: string;
  encrypted: boolean;
  error: string | null;
}

export interface Opened {
  claims: Record<string, unknown> | null;
  text: string;
}

export interface BuildRequest {
  alg: string;
  headers: Field[];
  claims: Field[];
  secret: string;
}

export interface EncryptRequest extends BuildRequest {
  enc: string;
}

export interface BuildResult {
  token: string;
  publicKey: string;
  keyError: string | null;
  tokenError: string | null;
}
