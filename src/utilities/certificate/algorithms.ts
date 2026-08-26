import { CURVES, EC_PUBLIC_KEY, ED25519, RSA_ENCRYPTION } from "./oids";
import type { PublicKey } from "./types";
import { nul, oid, sequence } from "./write";

export interface Kind {
  label: string;
  authority: boolean;
  signed: boolean;
  pathLength: number | null;
}

export const KINDS: Record<string, Kind> = {
  "self-signed": { label: "Self-signed certificate", authority: false, signed: false, pathLength: null },
  root: { label: "Root certificate authority", authority: true, signed: false, pathLength: null },
  issued: { label: "Certificate", authority: false, signed: true, pathLength: null },
  intermediate: { label: "Intermediate certificate authority", authority: true, signed: true, pathLength: 0 },
};

export const KIND_OPTIONS = [
  { value: "self-signed", label: "Self-signed certificate" },
  { value: "root", label: "Root certificate authority" },
  { value: "issued", label: "Certificate signed by a CA" },
  { value: "intermediate", label: "Intermediate CA signed by a root" },
];

export interface AlgorithmSpec {
  value: string;
  label: string;
  variantLabel?: string;
  variants?: { value: string; label: string }[];
}

export const ALGORITHMS: AlgorithmSpec[] = [
  {
    value: "ecdsa",
    label: "ECDSA",
    variantLabel: "Curve",
    variants: [
      { value: "P-256", label: "NIST P-256" },
      { value: "P-384", label: "NIST P-384" },
      { value: "P-521", label: "NIST P-521" },
    ],
  },
  {
    value: "rsa",
    label: "RSA",
    variantLabel: "Key size",
    variants: [
      { value: "2048", label: "2048 bits" },
      { value: "3072", label: "3072 bits" },
      { value: "4096", label: "4096 bits" },
    ],
  },
  { value: "ed25519", label: "Ed25519" },
];

export const MAX_DAYS = 36525;
export const DEFAULT_DAYS = 825;
export const AUTHORITY_DAYS = 3650;
export const DAY_MS = 24 * 60 * 60 * 1000;

const ECDSA: Record<string, { oid: string; hash: string }> = {
  "P-256": { oid: "1.2.840.10045.4.3.2", hash: "SHA-256" },
  "P-384": { oid: "1.2.840.10045.4.3.3", hash: "SHA-384" },
  "P-521": { oid: "1.2.840.10045.4.3.4", hash: "SHA-512" },
};

const RSA_SHA256 = "1.2.840.113549.1.1.11";

export function algorithmSpec(algorithm: string): AlgorithmSpec | undefined {
  return ALGORITHMS.find((spec) => spec.value === algorithm);
}

export function generateParams(algorithm: string, variant: string): RsaHashedKeyGenParams | EcKeyGenParams | Algorithm {
  if (algorithm === "rsa") {
    return {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: Number(variant) || 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    };
  }
  if (algorithm === "ed25519") return { name: "Ed25519" };
  return { name: "ECDSA", namedCurve: variant in ECDSA ? variant : "P-256" };
}

export function signParams(algorithm: string, variant: string): AlgorithmIdentifier | EcdsaParams {
  if (algorithm === "rsa") return "RSASSA-PKCS1-v1_5";
  if (algorithm === "ed25519") return "Ed25519";
  return { name: "ECDSA", hash: ECDSA[variant]?.hash ?? "SHA-256" };
}

export function importParams(
  algorithm: string,
  variant: string,
): RsaHashedImportParams | EcKeyImportParams | Algorithm {
  if (algorithm === "rsa") return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  if (algorithm === "ed25519") return { name: "Ed25519" };
  return { name: "ECDSA", namedCurve: variant in ECDSA ? variant : "P-256" };
}

export function signatureAlgorithm(algorithm: string, variant: string): Uint8Array {
  if (algorithm === "rsa") return sequence([oid(RSA_SHA256), nul()]);
  if (algorithm === "ed25519") return sequence([oid(ED25519)]);
  return sequence([oid(ECDSA[variant]?.oid ?? ECDSA["P-256"].oid)]);
}

export function keyAlgorithm(algorithm: string, variant: string): Uint8Array {
  if (algorithm === "rsa") return sequence([oid(RSA_ENCRYPTION), nul()]);
  if (algorithm === "ed25519") return sequence([oid(ED25519)]);
  return sequence([oid(EC_PUBLIC_KEY), oid(curveOid(variant))]);
}

function curveOid(variant: string): string {
  const found = Object.entries(CURVES).find(([, curve]) => curve.label === variant);
  return found ? found[0] : "1.2.840.10045.3.1.7";
}

export function algorithmOf(key: PublicKey): { algorithm: string; variant: string } | null {
  if (key.algorithm === "RSA") return { algorithm: "rsa", variant: "" };
  if (key.algorithm === "Ed25519") return { algorithm: "ed25519", variant: "" };
  if (key.algorithm === "ECDSA" && key.curve in ECDSA) return { algorithm: "ecdsa", variant: key.curve };
  return null;
}

export function pickKind(value: unknown): string {
  return typeof value === "string" && value in KINDS ? value : "self-signed";
}

export function pickAlgorithm(value: unknown): string {
  return ALGORITHMS.some((spec) => spec.value === value) ? value as string : ALGORITHMS[0].value;
}

export function pickVariant(algorithm: string, value: unknown): string {
  const variants = algorithmSpec(algorithm)?.variants;
  if (!variants) return "";
  return variants.some((item) => item.value === value) ? value as string : variants[0].value;
}

export function pickText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
