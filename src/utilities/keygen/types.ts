export interface KeySettings {
  algorithm: string;
  variant: string;
  comment: string;
  name: string;
  email: string;
  passphrase: string;
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

export interface CertificateSettings {
  algorithm: string;
  variant: string;
  commonName: string;
  altNames: string;
  days: number;
  passphrase: string;
}

export interface Certificate {
  privateKey: string;
  certificate: string;
  fingerprint: string;
}

export interface JwkSettings {
  algorithm: string;
  variant: string;
  keyId: string;
  count: number;
}

export type Jwk = Record<string, string>;

export interface JwkSet {
  privateKeys: Jwk[];
  publicKeys: Jwk[];
  thumbprint: string;
}

export interface WireguardConfigs {
  server: string;
  client: string;
}

export interface KeyResult {
  outputs: Output[];
  fingerprint: string;
}

export interface Generated {
  request: unknown;
  result: KeyResult | null;
  error: string;
}

export interface Output {
  label: string;
  value: string;
  rows: number;
}

export interface AlgorithmSpec {
  value: string;
  label: string;
  group?: string;
  variantLabel?: string;
  variants?: { value: string; label: string }[];
}
