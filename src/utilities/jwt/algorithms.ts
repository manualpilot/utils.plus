import type { SignResult } from "./types";

export const EMPTY_SIGNATURE: SignResult = { token: "", publicKey: "", keyError: null, tokenError: null };

export const DEFAULT_LIFETIME = 3600;

export const ALGORITHM_OPTIONS = [
  { group: "Edwards curve", items: [{ value: "EdDSA", label: "EdDSA (Ed25519)" }] },
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
  {
    group: "ECDSA",
    items: [
      { value: "ES256", label: "ES256 (P-256)" },
      { value: "ES384", label: "ES384 (P-384)" },
      { value: "ES512", label: "ES512 (P-521)" },
    ],
  },
];

export const ALGORITHMS = new Set(ALGORITHM_OPTIONS.flatMap((group) => group.items.map((item) => item.value)));

export const SECRET_BYTES: Record<string, number> = { HS256: 32, HS384: 48, HS512: 64 };

export function isSymmetric(alg: string): boolean {
  return alg.startsWith("HS");
}
