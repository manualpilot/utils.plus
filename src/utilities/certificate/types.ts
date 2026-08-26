import type { Fact } from "../../common/fact-table";

export type Kind = "certificate" | "request" | "key" | "unreadable";

export interface PublicKey {
  algorithm: string;
  label: string;
  bits: number;
  curve: string;
  exponent: string;
  identity: string;
}

export interface Extension {
  oid: string;
  name: string;
  critical: boolean;
  value: string;
}

export interface Item {
  id: string;
  kind: Kind;
  heading: string;
  name: string;
  facts: Fact[];
  extensions: Extension[];
  identity: string;
  secret: boolean;
  error: string;
  subject: string;
  issuer: string;
  ski: string;
  aki: string;
  selfIssued: boolean;
  ca: boolean;
  notBefore: Date | null;
  notAfter: Date | null;
}

export interface ChainRow {
  id: string;
  name: string;
  role: string;
  issue: string;
}

export interface Chain {
  rows: ChainRow[];
  ordered: boolean;
  complete: boolean;
  note: string;
}

export interface Match {
  text: string;
  found: boolean;
}

export interface Arrangement {
  items: Item[];
  chains: Chain[];
  matches: Record<string, Match>;
}
