import type { BuildResult } from "./types";

export const EMPTY_RESULT: BuildResult = { token: "", publicKey: "", keyError: null, tokenError: null };

export const DEFAULT_LIFETIME = 3600;

export const DEFAULT_ALGORITHM = "EdDSA";
export const DEFAULT_KEY_ALGORITHM = "ECDH-ES+A256KW";
export const DEFAULT_ENCRYPTION = "A256GCM";

export const PROTECTION_OPTIONS = [
  { value: "signed", label: "Signed (JWS)" },
  { value: "encrypted", label: "Encrypted (JWE)" },
];

export const ALGORITHM_OPTIONS = [
  { group: "Edwards curve", items: [{ value: "EdDSA", label: "EdDSA (Ed25519)" }] },
  {
    group: "ECDSA",
    items: [
      { value: "ES256", label: "ES256 (P-256)" },
      { value: "ES384", label: "ES384 (P-384)" },
      { value: "ES512", label: "ES512 (P-521)" },
    ],
  },
  {
    group: "HMAC with a shared secret",
    items: [
      { value: "HS256", label: "HS256 (SHA-256)" },
      { value: "HS384", label: "HS384 (SHA-384)" },
      { value: "HS512", label: "HS512 (SHA-512)" },
    ],
  },
  {
    group: "RSA",
    items: [
      { value: "RS256", label: "RS256 (PKCS#1 v1.5, SHA-256)" },
      { value: "RS384", label: "RS384 (PKCS#1 v1.5, SHA-384)" },
      { value: "RS512", label: "RS512 (PKCS#1 v1.5, SHA-512)" },
      { value: "PS256", label: "PS256 (PSS, SHA-256)" },
      { value: "PS384", label: "PS384 (PSS, SHA-384)" },
      { value: "PS512", label: "PS512 (PSS, SHA-512)" },
    ],
  },
];

export const ALGORITHMS = new Set(ALGORITHM_OPTIONS.flatMap((group) => group.items.map((item) => item.value)));

export const KEY_ALGORITHM_OPTIONS = [
  {
    group: "Elliptic curve Diffie-Hellman",
    items: [
      { value: "ECDH-ES", label: "ECDH-ES (P-256, direct)" },
      { value: "ECDH-ES+A128KW", label: "ECDH-ES+A128KW" },
      { value: "ECDH-ES+A256KW", label: "ECDH-ES+A256KW" },
    ],
  },
  { group: "Direct", items: [{ value: "dir", label: "dir (the secret is the content key)" }] },
  {
    group: "AES key wrap with a shared secret",
    items: [
      { value: "A128KW", label: "A128KW" },
      { value: "A256KW", label: "A256KW" },
      { value: "A128GCMKW", label: "A128GCMKW" },
      { value: "A256GCMKW", label: "A256GCMKW" },
    ],
  },
  {
    group: "RSA-OAEP",
    items: [
      { value: "RSA-OAEP", label: "RSA-OAEP (SHA-1)" },
      { value: "RSA-OAEP-256", label: "RSA-OAEP-256 (SHA-256)" },
      { value: "RSA-OAEP-384", label: "RSA-OAEP-384 (SHA-384)" },
      { value: "RSA-OAEP-512", label: "RSA-OAEP-512 (SHA-512)" },
    ],
  },
];

export const KEY_ALGORITHMS = new Set(
  KEY_ALGORITHM_OPTIONS.flatMap((group) => group.items.map((item) => item.value)),
);

export const ENCRYPTION_OPTIONS = [
  { group: "AES-GCM", items: [{ value: "A128GCM", label: "A128GCM" }, { value: "A256GCM", label: "A256GCM" }] },
  {
    group: "AES-CBC with an HMAC",
    items: [
      { value: "A128CBC-HS256", label: "A128CBC-HS256" },
      { value: "A256CBC-HS512", label: "A256CBC-HS512" },
    ],
  },
];

export const ENCRYPTIONS = new Set(ENCRYPTION_OPTIONS.flatMap((group) => group.items.map((item) => item.value)));

export const SECRET_BYTES: Record<string, number> = { HS256: 32, HS384: 48, HS512: 64 };

export const WRAP_BYTES: Record<string, number> = { A128KW: 16, A256KW: 32, A128GCMKW: 16, A256GCMKW: 32 };

export function isEncryption(alg: string): boolean {
  return KEY_ALGORITHMS.has(alg);
}

export function isSymmetric(alg: string): boolean {
  return alg.startsWith("HS") || alg === "dir" || alg in WRAP_BYTES;
}
