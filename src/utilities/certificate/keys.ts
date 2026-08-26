import { bitsOf, derOf, inner, type Node, oidOf, TAG, tagged, UNIVERSAL } from "./der";
import { CURVES, DSA_PUBLIC_KEY, EC_PUBLIC_KEY, ED25519, EDWARDS, ENCRYPTION_SCHEMES, named, RSA_ENCRYPTION, RSA_PSS, X25519 } from "./oids";
import { bitLength, hex, minimal } from "./pem";
import type { PublicKey } from "./types";

export interface PrivateReading {
  key: PublicKey | null;
  encrypted: boolean;
  format: string;
  scheme: string;
  error: string;
}

export function rsaKey(modulus: Uint8Array, exponent: Uint8Array): PublicKey {
  const bits = bitLength(modulus);
  return {
    algorithm: "RSA",
    label: `RSA ${bits}`,
    bits,
    curve: "",
    exponent: BigInt(`0x${hex(minimal(exponent)) || "0"}`).toString(),
    identity: `rsa:${hex(minimal(modulus))}:${hex(minimal(exponent))}`,
  };
}

export function ecKey(curveOid: string, point: Uint8Array): PublicKey {
  const curve = CURVES[curveOid];
  return {
    algorithm: "ECDSA",
    label: curve ? `ECDSA ${curve.label}` : "ECDSA",
    bits: curve?.bits ?? 0,
    curve: curve?.label ?? curveOid,
    exponent: "",
    identity: point.length > 0 ? `ec:${curveOid}:${hex(point)}` : "",
  };
}

export function edwardsKey(oid: string, raw: Uint8Array): PublicKey {
  const curve = EDWARDS[oid];
  return {
    algorithm: curve?.label ?? oid,
    label: curve?.label ?? oid,
    bits: curve?.bits ?? 0,
    curve: "",
    exponent: "",
    identity: raw.length > 0 ? `${oid}:${hex(raw)}` : "",
  };
}

export function dsaKey(y: Uint8Array, p: Uint8Array): PublicKey {
  const bits = bitLength(p);
  return {
    algorithm: "DSA",
    label: `DSA ${bits}`,
    bits,
    curve: "",
    exponent: "",
    identity: `dsa:${hex(minimal(p))}:${hex(minimal(y))}`,
  };
}

export function unknownKey(oid: string): PublicKey {
  return { algorithm: oid, label: oid, bits: 0, curve: "", exponent: "", identity: "" };
}

export function readPublicKey(spki: Node): PublicKey {
  const algorithm = spki.items[0];
  const key = spki.items[1];
  if (!algorithm || !key) return unknownKey("");
  return fromAlgorithm(oidOf(algorithm.items[0]), algorithm.items[1], bitsOf(key));
}

function fromAlgorithm(oid: string, params: Node | undefined, keyBytes: Uint8Array): PublicKey {
  if (oid === RSA_ENCRYPTION || oid === RSA_PSS) {
    const written = derOf(keyBytes);
    const modulus = written?.items[0];
    const exponent = written?.items[1];
    return modulus && exponent ? rsaKey(modulus.content, exponent.content) : unknownKey(oid);
  }
  if (oid === EC_PUBLIC_KEY) return ecKey(params ? oidOf(params) : "", keyBytes);
  if (oid in EDWARDS) return edwardsKey(oid, keyBytes);
  if (oid === DSA_PUBLIC_KEY) {
    const y = derOf(keyBytes);
    const prime = params?.items[0];
    return y && prime ? dsaKey(y.content, prime.content) : unknownKey(oid);
  }
  return unknownKey(oid);
}

export async function readPrivateKey(label: string, bytes: Uint8Array): Promise<PrivateReading> {
  const root = derOf(bytes);
  if (!root) return failed("This is not a key this page can read");

  if (label === "ENCRYPTED PRIVATE KEY") return encrypted(root);
  if (label === "RSA PRIVATE KEY") return withKey("PKCS#1", rsaPrivate(root));
  if (label === "EC PRIVATE KEY") return withKey("SEC 1", await ecPrivate(root, ""));
  if (label === "DSA PRIVATE KEY") return withKey("PKCS#1", dsaPrivate(root));
  return await pkcs8(root);
}

async function pkcs8(root: Node): Promise<PrivateReading> {
  const algorithm = root.items[1];
  const material = root.items[2];
  if (!algorithm || !material) return failed("This is not a private key this page can read");

  const oid = oidOf(algorithm.items[0]);
  const written = tagged(root.items, 1);
  if (written) return withKey("PKCS#8", fromAlgorithm(oid, algorithm.items[1], bitsOf(written)));

  if (oid === RSA_ENCRYPTION || oid === RSA_PSS) {
    const inside = derOf(material.content);
    return withKey("PKCS#8", inside ? rsaPrivate(inside) : null);
  }
  if (oid === EC_PUBLIC_KEY) {
    const inside = derOf(material.content);
    const curve = algorithm.items[1] ? oidOf(algorithm.items[1]) : "";
    return withKey("PKCS#8", inside ? await ecPrivate(inside, curve) : null);
  }
  if (oid in EDWARDS) {
    const seed = inner(material);
    return withKey("PKCS#8", seed ? edwardsKey(oid, await derivedEdwards(oid, seed.content)) : null);
  }
  return withKey("PKCS#8", unknownKey(oid));
}

function rsaPrivate(root: Node): PublicKey | null {
  const modulus = root.items[1];
  const exponent = root.items[2];
  return modulus && exponent ? rsaKey(modulus.content, exponent.content) : null;
}

function dsaPrivate(root: Node): PublicKey | null {
  const prime = root.items[1];
  const y = root.items[4];
  return prime && y ? dsaKey(y.content, prime.content) : null;
}

async function ecPrivate(root: Node, fallbackCurve: string): Promise<PublicKey | null> {
  const params = tagged(root.items, 0);
  const curve = params?.items[0] ? oidOf(params.items[0]) : fallbackCurve;
  const written = tagged(root.items, 1);
  if (written) {
    const point = written.items[0];
    return ecKey(curve, bitsOf(point?.cls === UNIVERSAL && point.tag === TAG.bitString ? point : written));
  }
  const scalar = root.items[1];
  return scalar ? ecKey(curve, await derivedPoint(curve, scalar.content)) : null;
}

const NIST = new Set(["1.2.840.10045.3.1.7", "1.3.132.0.34", "1.3.132.0.35"]);

async function derivedPoint(curveOid: string, scalar: Uint8Array): Promise<Uint8Array> {
  if (!NIST.has(curveOid)) return new Uint8Array();
  try {
    const { p256, p384, p521 } = await import("@noble/curves/nist.js");
    const curve = curveOid === "1.3.132.0.34" ? p384 : curveOid === "1.3.132.0.35" ? p521 : p256;
    return curve.getPublicKey(scalar, false);
  } catch {
    return new Uint8Array();
  }
}

async function derivedEdwards(oid: string, seed: Uint8Array): Promise<Uint8Array> {
  if (oid !== ED25519 && oid !== X25519) return new Uint8Array();
  try {
    const { ed25519, x25519 } = await import("@noble/curves/ed25519.js");
    return oid === ED25519 ? ed25519.getPublicKey(seed) : x25519.getPublicKey(seed);
  } catch {
    return new Uint8Array();
  }
}

function encrypted(root: Node): PrivateReading {
  const algorithm = root.items[0];
  const oid = algorithm ? oidOf(algorithm.items[0]) : "";
  const cipher = algorithm?.items[1]?.items[1];
  const inside = cipher ? named(ENCRYPTION_SCHEMES, oidOf(cipher.items[0] ?? cipher)) : "";
  const scheme = named(ENCRYPTION_SCHEMES, oid);
  return {
    key: null,
    encrypted: true,
    format: "PKCS#8",
    scheme: inside && inside !== scheme ? `${scheme} with ${inside}` : scheme,
    error: "",
  };
}

function withKey(format: string, key: PublicKey | null): PrivateReading {
  return key
    ? { key, encrypted: false, format, scheme: "", error: "" }
    : failed("This is not a private key this page can read");
}

function failed(error: string): PrivateReading {
  return { key: null, encrypted: false, format: "", scheme: "", error };
}
