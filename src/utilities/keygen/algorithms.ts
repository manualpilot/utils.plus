import type { AlgorithmSpec } from "./types";

export const KIND_OPTIONS = [
  { value: "ssh", label: "SSH key" },
  { value: "pgp", label: "PGP key" },
  { value: "tls", label: "TLS certificate" },
  { value: "jwk", label: "JSON Web Key" },
  { value: "wireguard", label: "WireGuard keys" },
  { value: "secret", label: "Random secret" },
];

export const KIND_LABELS: Record<string, string> = {
  ssh: "SSH key pair",
  pgp: "PGP key pair",
  tls: "TLS certificate",
  jwk: "JSON Web Key",
  wireguard: "WireGuard configuration",
  secret: "Random secret",
};

export const RSA_SIZES = [
  { value: "3072", label: "3072 bits" },
  { value: "2048", label: "2048 bits" },
  { value: "4096", label: "4096 bits" },
];

export const SIGNATURE = "Signature";
export const ENCRYPTION = "Encryption";

export const RSA_SIZE = { variantLabel: "Key size", variants: RSA_SIZES };

export const ECDH_CURVE = {
  variantLabel: "Curve",
  variants: [
    { value: "P-256", label: "NIST P-256" },
    { value: "P-384", label: "NIST P-384" },
    { value: "P-521", label: "NIST P-521" },
    { value: "X25519", label: "X25519" },
  ],
};

export const NIST_CURVES = [
  { value: "nistp256", label: "NIST P-256" },
  { value: "nistp384", label: "NIST P-384" },
  { value: "nistp521", label: "NIST P-521" },
];

export const ALGORITHMS: Record<string, AlgorithmSpec[]> = {
  ssh: [
    { value: "ed25519", label: "Ed25519" },
    { value: "ecdsa", label: "ECDSA", variantLabel: "Curve", variants: NIST_CURVES },
    { value: "rsa", label: "RSA", variantLabel: "Key size", variants: RSA_SIZES },
  ],
  pgp: [
    { value: "curve25519", label: "Curve25519" },
    {
      value: "ecc",
      label: "ECDSA",
      variantLabel: "Curve",
      variants: [
        { value: "nistP256", label: "NIST P-256" },
        { value: "nistP384", label: "NIST P-384" },
        { value: "nistP521", label: "NIST P-521" },
      ],
    },
    { value: "rsa", label: "RSA", variantLabel: "Key size", variants: RSA_SIZES },
  ],
  tls: [
    { value: "rsa", label: "RSA", variantLabel: "Key size", variants: RSA_SIZES },
    { value: "ecdsa", label: "ECDSA", variantLabel: "Curve", variants: NIST_CURVES },
  ],
  jwk: [
    { group: SIGNATURE, value: "EdDSA", label: "EdDSA (Ed25519)" },
    { group: SIGNATURE, value: "ES256", label: "ES256 (P-256)" },
    { group: SIGNATURE, value: "ES384", label: "ES384 (P-384)" },
    { group: SIGNATURE, value: "ES512", label: "ES512 (P-521)" },
    { group: SIGNATURE, value: "RS256", label: "RS256 (PKCS#1 v1.5, SHA-256)", ...RSA_SIZE },
    { group: SIGNATURE, value: "RS384", label: "RS384 (PKCS#1 v1.5, SHA-384)", ...RSA_SIZE },
    { group: SIGNATURE, value: "RS512", label: "RS512 (PKCS#1 v1.5, SHA-512)", ...RSA_SIZE },
    { group: SIGNATURE, value: "PS256", label: "PS256 (PSS, SHA-256)", ...RSA_SIZE },
    { group: SIGNATURE, value: "PS384", label: "PS384 (PSS, SHA-384)", ...RSA_SIZE },
    { group: SIGNATURE, value: "PS512", label: "PS512 (PSS, SHA-512)", ...RSA_SIZE },
    { group: SIGNATURE, value: "HS256", label: "HS256 (SHA-256)" },
    { group: SIGNATURE, value: "HS384", label: "HS384 (SHA-384)" },
    { group: SIGNATURE, value: "HS512", label: "HS512 (SHA-512)" },
    { group: ENCRYPTION, value: "ECDH-ES", label: "ECDH-ES (direct agreement)", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "ECDH-ES+A128KW", label: "ECDH-ES+A128KW", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "ECDH-ES+A192KW", label: "ECDH-ES+A192KW", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "ECDH-ES+A256KW", label: "ECDH-ES+A256KW", ...ECDH_CURVE },
    { group: ENCRYPTION, value: "RSA-OAEP-256", label: "RSA-OAEP-256 (SHA-256)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "RSA-OAEP-384", label: "RSA-OAEP-384 (SHA-384)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "RSA-OAEP-512", label: "RSA-OAEP-512 (SHA-512)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "RSA-OAEP", label: "RSA-OAEP (SHA-1)", ...RSA_SIZE },
    { group: ENCRYPTION, value: "A128KW", label: "A128KW (AES key wrap)" },
    { group: ENCRYPTION, value: "A192KW", label: "A192KW (AES key wrap)" },
    { group: ENCRYPTION, value: "A256KW", label: "A256KW (AES key wrap)" },
    { group: ENCRYPTION, value: "A128GCMKW", label: "A128GCMKW (AES-GCM key wrap)" },
    { group: ENCRYPTION, value: "A192GCMKW", label: "A192GCMKW (AES-GCM key wrap)" },
    { group: ENCRYPTION, value: "A256GCMKW", label: "A256GCMKW (AES-GCM key wrap)" },
  ],
  wireguard: [],
  secret: [],
};

export const KEY_ID_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uuid", label: "Random UUID" },
  { value: "timestamp", label: "Timestamp" },
  { value: "iso", label: "ISO date" },
  { value: "sha256", label: "SHA-256 thumbprint" },
  { value: "sha1", label: "SHA-1 thumbprint" },
];

export const FORMAT_OPTIONS = [
  { value: "hex", label: "Hexadecimal" },
  { value: "hex-upper", label: "Hexadecimal (uppercase)" },
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64 (URL-safe)" },
  { value: "base32", label: "Base32" },
  { value: "decimal", label: "Decimal" },
];

export const MAX_SECRET_BYTES = 512;
export const DEFAULT_SECRET_BYTES = 32;

export const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export const MAX_DAYS = 3650;
export const DEFAULT_DAYS = 365;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_JWK_KEYS = 8;

export const JWK_CURVES: Record<string, string> = { ES256: "P-256", ES384: "P-384", ES512: "P-521" };

export const JWK_SECRET_BYTES: Record<string, number> = {
  HS256: 32,
  HS384: 48,
  HS512: 64,
  A128KW: 16,
  A192KW: 24,
  A256KW: 32,
  A128GCMKW: 16,
  A192GCMKW: 24,
  A256GCMKW: 32,
};

export const JWK_MEMBERS = ["crv", "n", "e", "x", "y", "d", "p", "q", "dp", "dq", "qi", "k"];

export const THUMBPRINT_MEMBERS: Record<string, string[]> = {
  EC: ["crv", "kty", "x", "y"],
  OKP: ["crv", "kty", "x"],
  RSA: ["e", "kty", "n"],
  oct: ["k", "kty"],
};

export const WEB_CRYPTO_CURVES: Record<string, string> = {
  nistp256: "P-256",
  nistp384: "P-384",
  nistp521: "P-521",
};

export const ECDSA_SIGNATURES: Record<string, { oid: string; hash: string }> = {
  nistp256: { oid: "1.2.840.10045.4.3.2", hash: "SHA-256" },
  nistp384: { oid: "1.2.840.10045.4.3.3", hash: "SHA-384" },
  nistp521: { oid: "1.2.840.10045.4.3.4", hash: "SHA-512" },
};

export function algorithmSpec(kind: string, algorithm: string): AlgorithmSpec | undefined {
  return ALGORITHMS[kind]?.find((spec) => spec.value === algorithm);
}

export function algorithmData(specs: AlgorithmSpec[]) {
  const items = specs.map(({ value, label }) => ({ value, label }));
  if (!specs.some((spec) => spec.group)) return items;

  const groups: { group: string; items: typeof items }[] = [];
  specs.forEach((spec, index) => {
    const last = groups[groups.length - 1];
    if (last?.group === spec.group) last.items.push(items[index]);
    else groups.push({ group: spec.group ?? "", items: [items[index]] });
  });
  return groups;
}

export function pickKind(value: unknown): string {
  return typeof value === "string" && value in ALGORITHMS ? value : "ssh";
}

export function pickAlgorithm(kind: string, value: unknown): string {
  const specs = ALGORITHMS[kind] ?? [];
  if (specs.length === 0) return "";
  return specs.some((spec) => spec.value === value) ? value as string : specs[0].value;
}

export function pickVariant(kind: string, algorithm: string, value: unknown): string {
  const variants = algorithmSpec(kind, algorithm)?.variants;
  if (!variants) return "";
  return variants.some((item) => item.value === value) ? value as string : variants[0].value;
}

export function pickKeyIdSource(value: unknown): string {
  return KEY_ID_OPTIONS.some((option) => option.value === value) ? value as string : "sha256";
}

export function pickFormat(value: unknown): string {
  return FORMAT_OPTIONS.some((option) => option.value === value) ? value as string : "hex";
}

export function pickText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
