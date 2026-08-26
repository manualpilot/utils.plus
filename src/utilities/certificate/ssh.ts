import { md5 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { dsaKey, ecKey, edwardsKey, rsaKey, unknownKey } from "./keys";
import { ED25519 } from "./oids";
import { decodeBase64, hex, toBase64 } from "./pem";
import type { PublicKey } from "./types";

export interface SshKey {
  type: string;
  comment: string;
  key: PublicKey;
  sha256: string;
  md5: string;
  certificate: boolean;
}

export function readSshLine(line: string): SshKey | null {
  const parts = /^(\S+)[ \t]+([A-Za-z0-9+/]+={0,2})(?:[ \t]+(.*))?$/.exec(line.trim());
  if (!parts) return null;
  const blob = decodeBase64(parts[2]);
  if (!blob) return null;
  const key = readSshBlob(blob, parts[3] ?? "");
  return key && key.type === parts[1] ? key : null;
}

export function readSshBlob(blob: Uint8Array, comment: string): SshKey | null {
  const fields = reader(blob);
  const type = fields.text();
  if (type === null || !/^[\x20-\x7e]+$/.test(type)) return null;

  return {
    type,
    comment: comment.trim(),
    key: material(type, fields),
    sha256: `SHA256:${toBase64(sha256(blob)).replace(/=+$/, "")}`,
    md5: `MD5:${hex(md5(blob), ":")}`,
    certificate: type.endsWith("-cert-v01@openssh.com"),
  };
}

function material(type: string, fields: Reader): PublicKey {
  if (type.endsWith("-cert-v01@openssh.com")) return unknownKey(type);

  if (type === "ssh-rsa") {
    const exponent = fields.string();
    const modulus = fields.string();
    return exponent && modulus ? rsaKey(modulus, exponent) : unknownKey(type);
  }
  if (type === "ssh-dss") {
    const prime = fields.string();
    fields.string();
    fields.string();
    const y = fields.string();
    return prime && y ? dsaKey(y, prime) : unknownKey(type);
  }
  if (type === "ssh-ed25519" || type === "sk-ssh-ed25519@openssh.com") {
    const raw = fields.string();
    return raw ? edwardsKey(ED25519, raw) : unknownKey(type);
  }
  if (type.startsWith("ecdsa-sha2-")) {
    const curve = fields.text();
    const point = fields.string();
    return curve && point ? ecKey(SSH_CURVES[curve] ?? "", point) : unknownKey(type);
  }
  return unknownKey(type);
}

const SSH_CURVES: Record<string, string> = {
  nistp256: "1.2.840.10045.3.1.7",
  nistp384: "1.3.132.0.34",
  nistp521: "1.3.132.0.35",
};

export interface OpenSshReading {
  key: SshKey | null;
  encrypted: boolean;
  cipher: string;
}

const MAGIC = "openssh-key-v1\0";

export function readOpenSshPrivate(bytes: Uint8Array): OpenSshReading | null {
  const magic = bytes.subarray(0, MAGIC.length);
  if (String.fromCharCode(...magic) !== MAGIC) return null;

  const fields = reader(bytes.subarray(MAGIC.length));
  const cipher = fields.text();
  fields.text();
  fields.string();
  const count = fields.uint32();
  const blob = fields.string();
  if (cipher === null || count === null || !blob) return null;

  return { key: readSshBlob(blob, ""), encrypted: cipher !== "none", cipher };
}

interface Reader {
  string(): Uint8Array | null;
  text(): string | null;
  uint32(): number | null;
}

function reader(bytes: Uint8Array): Reader {
  let offset = 0;
  const uint32 = (): number | null => {
    if (offset + 4 > bytes.length) return null;
    const value = (bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8)
      + bytes[offset + 3];
    offset += 4;
    return value;
  };
  const string = (): Uint8Array | null => {
    const length = uint32();
    if (length === null || offset + length > bytes.length) return null;
    const value = bytes.subarray(offset, offset + length);
    offset += length;
    return value;
  };
  return {
    uint32,
    string,
    text: () => {
      const value = string();
      return value === null ? null : new TextDecoder().decode(value);
    },
  };
}
