import { randomBytes } from "@noble/hashes/utils.js";
import { JWK_CURVES, JWK_MEMBERS, JWK_SECRET_BYTES, MAX_JWK_KEYS, THUMBPRINT_MEMBERS } from "./algorithms";
import { formatSecret } from "./encoding";
import type { Jwk, JwkSet, JwkSettings } from "./types";

export async function generateJwkSet(settings: JwkSettings): Promise<JwkSet> {
  const count = Math.min(Math.max(settings.count, 1), MAX_JWK_KEYS);
  const stamp = Math.floor(Date.now() / 1000) * 1000;
  const privateKeys: Jwk[] = [];
  const publicKeys: Jwk[] = [];

  for (let index = 0; index < count; index += 1) {
    const [privateJwk, publicJwk] = await jwkMaterial(settings.algorithm, settings.variant);
    const kid = await keyIdFor(settings.keyId, publicJwk ?? privateJwk, stamp + index * 1000);
    privateKeys.push(withHeader(privateJwk, settings.algorithm, kid));
    if (publicJwk) publicKeys.push(withHeader(publicJwk, settings.algorithm, kid));
  }

  return {
    privateKeys,
    publicKeys,
    thumbprint: count === 1 ? await thumbprint(publicKeys[0] ?? privateKeys[0], "SHA-256") : "",
  };
}

async function jwkMaterial(algorithm: string, variant: string): Promise<[Jwk, Jwk | null]> {
  const bytes = JWK_SECRET_BYTES[algorithm];
  if (bytes) return [{ kty: "oct", k: formatSecret(randomBytes(bytes), "base64url") }, null];

  const [params, usages] = jwkKeyParams(algorithm, variant);
  const pair = await crypto.subtle.generateKey(params, true, usages) as CryptoKeyPair;
  return [
    keyMaterial(await crypto.subtle.exportKey("jwk", pair.privateKey)),
    keyMaterial(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  ];
}

function jwkKeyParams(algorithm: string, variant: string): [KeyGenParams, KeyUsage[]] {
  if (algorithm.startsWith("RSA-OAEP")) {
    const hash = algorithm === "RSA-OAEP" ? "SHA-1" : `SHA-${algorithm.slice("RSA-OAEP-".length)}`;
    return [rsaParams("RSA-OAEP", variant, hash), ["encrypt", "decrypt"]];
  }
  if (algorithm.startsWith("ECDH-ES")) {
    const params = variant === "X25519" ? { name: "X25519" } : { name: "ECDH", namedCurve: variant };
    return [params, ["deriveKey", "deriveBits"]];
  }
  if (algorithm.startsWith("RS") || algorithm.startsWith("PS")) {
    const name = algorithm.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5";
    return [rsaParams(name, variant, `SHA-${algorithm.slice(2)}`), ["sign", "verify"]];
  }
  if (algorithm.startsWith("ES")) {
    return [{ name: "ECDSA", namedCurve: JWK_CURVES[algorithm] ?? "P-256" }, ["sign", "verify"]];
  }
  return [{ name: "Ed25519" }, ["sign", "verify"]];
}

function rsaParams(name: string, variant: string, hash: string): RsaHashedKeyGenParams {
  return { name, modulusLength: Number(variant), publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash };
}

type KeyGenParams = RsaHashedKeyGenParams | EcKeyGenParams | Algorithm;

function keyMaterial(exported: JsonWebKey): Jwk {
  const jwk: Jwk = { kty: exported.kty ?? "" };
  for (const member of JWK_MEMBERS) {
    const value = (exported as Record<string, unknown>)[member];
    if (typeof value === "string") jwk[member] = value;
  }
  return jwk;
}

function withHeader(material: Jwk, algorithm: string, kid: string): Jwk {
  const { kty, ...rest } = material;
  return { kty, ...(kid ? { kid } : {}), use: jwkUse(algorithm), alg: algorithm, ...rest };
}

function jwkUse(algorithm: string): string {
  const encrypts = algorithm.startsWith("RSA-OAEP") || algorithm.startsWith("ECDH-ES") || algorithm.endsWith("KW");
  return encrypts ? "enc" : "sig";
}

async function keyIdFor(source: string, jwk: Jwk, at: number): Promise<string> {
  switch (source) {
    case "uuid":
      return crypto.randomUUID();
    case "timestamp":
      return `${at / 1000}`;
    case "iso":
      return new Date(at).toISOString().replace(".000", "");
    case "sha256":
      return await thumbprint(jwk, "SHA-256");
    case "sha1":
      return await thumbprint(jwk, "SHA-1");
    default:
      return "";
  }
}

async function thumbprint(jwk: Jwk, hash: string): Promise<string> {
  const members = THUMBPRINT_MEMBERS[jwk.kty] ?? [];
  const canonical = `{${members.map((name) => `${JSON.stringify(name)}:${JSON.stringify(jwk[name] ?? "")}`)}}`;
  const digest = await crypto.subtle.digest(hash, new TextEncoder().encode(canonical));
  return formatSecret(new Uint8Array(digest), "base64url");
}
