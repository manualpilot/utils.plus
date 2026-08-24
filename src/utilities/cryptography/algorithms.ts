export type Family = "symmetric" | "box" | "pgp";

export interface Spec {
  label: string;
  family: Family;
  group: string;
  keyBytes: number | null;
  keySizes?: number[];
  nonceBytes: number;
  nonceLabel: string;
  nonceNoun: string;
  aad: boolean;
  authenticated: boolean;
  note: string;
}

export const ALGORITHMS: Record<string, Spec> = {
  "aes-gcm": {
    label: "AES-GCM",
    family: "symmetric",
    group: "Symmetric",
    keyBytes: null,
    keySizes: [16, 24, 32],
    nonceBytes: 12,
    nonceLabel: "IV",
    nonceNoun: "IV",
    aad: true,
    authenticated: true,
    note: "Web Crypto, with the 128-bit tag on the end of the ciphertext.",
  },
  "aes-ctr": {
    label: "AES-CTR",
    family: "symmetric",
    group: "Symmetric",
    keyBytes: null,
    keySizes: [16, 24, 32],
    nonceBytes: 16,
    nonceLabel: "Counter block",
    nonceNoun: "counter block",
    aad: false,
    authenticated: false,
    note: "Web Crypto, counting the whole 128-bit block. Nothing here notices an edited ciphertext.",
  },
  "aes-cbc": {
    label: "AES-CBC",
    family: "symmetric",
    group: "Symmetric",
    keyBytes: null,
    keySizes: [16, 24, 32],
    nonceBytes: 16,
    nonceLabel: "IV",
    nonceNoun: "IV",
    aad: false,
    authenticated: false,
    note: "Web Crypto, PKCS#7 padded. Nothing here notices an edited ciphertext.",
  },
  "chacha20-poly1305": {
    label: "ChaCha20-Poly1305",
    family: "symmetric",
    group: "Symmetric",
    keyBytes: 32,
    nonceBytes: 12,
    nonceLabel: "Nonce",
    nonceNoun: "nonce",
    aad: true,
    authenticated: true,
    note: "RFC 8439, the AEAD behind TLS 1.3 and WireGuard.",
  },
  "xchacha20-poly1305": {
    label: "XChaCha20-Poly1305",
    family: "symmetric",
    group: "Symmetric",
    keyBytes: 32,
    nonceBytes: 24,
    nonceLabel: "Nonce",
    nonceNoun: "nonce",
    aad: true,
    authenticated: true,
    note: "The 192-bit nonce is long enough to pick at random for every message.",
  },
  "nacl-secretbox": {
    label: "NaCl secretbox",
    family: "symmetric",
    group: "NaCl",
    keyBytes: 32,
    nonceBytes: 24,
    nonceLabel: "Nonce",
    nonceNoun: "nonce",
    aad: false,
    authenticated: true,
    note: "XSalsa20-Poly1305, byte for byte what TweetNaCl's crypto_secretbox writes, tag first.",
  },
  "nacl-box": {
    label: "NaCl box",
    family: "box",
    group: "NaCl",
    keyBytes: 32,
    nonceBytes: 24,
    nonceLabel: "Nonce",
    nonceNoun: "nonce",
    aad: false,
    authenticated: true,
    note: "TweetNaCl's crypto_box: an X25519 agreement, then the same secretbox over the result.",
  },
  pgp: {
    label: "OpenPGP",
    family: "pgp",
    group: "OpenPGP",
    keyBytes: null,
    nonceBytes: 0,
    nonceLabel: "",
    nonceNoun: "",
    aad: false,
    authenticated: true,
    note: "RFC 9580 messages, to a public key or to a password. The packet carries its own session key.",
  },
};

export const ALGORITHM_OPTIONS = groupOptions();

export function keyLength(algorithm: string, keySize: number): number {
  return ALGORITHMS[algorithm].keyBytes ?? keySize;
}

function groupOptions(): { group: string; items: { value: string; label: string }[] }[] {
  const groups: { group: string; items: { value: string; label: string }[] }[] = [];
  for (const [value, spec] of Object.entries(ALGORITHMS)) {
    const existing = groups.find((entry) => entry.group === spec.group);
    const items = existing?.items ?? [];
    if (!existing) groups.push({ group: spec.group, items });
    items.push({ value, label: spec.label });
  }
  return groups;
}
