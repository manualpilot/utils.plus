import { exportJWK, exportPKCS8, exportSPKI, generateKeyPair, generateSecret, importJWK, importPKCS8, importSPKI, importX509, type JWK } from "jose";
import { DEFAULT_ENCRYPTION, isEncryption, isSymmetric, SECRET_BYTES, WRAP_BYTES } from "./algorithms";
import { bytesFromBase64Url, toBase64Url } from "./token";
import type { Half } from "./types";

export async function generateKey(alg: string, enc: string = DEFAULT_ENCRYPTION): Promise<string> {
  if (alg.startsWith("HS")) return toBase64Url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES[alg] ?? 32)));
  if (isSymmetric(alg)) {
    return (await exportJWK(await generateSecret(alg === "dir" ? enc : alg, { extractable: true }))).k ?? "";
  }
  const { privateKey } = await generateKeyPair(alg, { extractable: true });
  return exportPKCS8(privateKey);
}

export async function loadKey(secret: string, alg: string, half: Half, kid?: unknown): Promise<CryptoKey | Uint8Array> {
  const text = secret.trim();
  if (!text) throw new Error("Required");
  if (text.startsWith("-----BEGIN")) return loadPem(text, alg, half);
  if (text.startsWith("{")) return loadJwk(text, alg, half, kid);
  if (!isSymmetric(alg)) throw new Error(`${alg} takes a key, so this needs a PEM or a JWK rather than a phrase`);
  if (isEncryption(alg)) return loadBytes(text, alg);
  return new TextEncoder().encode(secret);
}

function loadBytes(text: string, alg: string): Uint8Array {
  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64Url(text);
  } catch {
    throw new Error(`${alg} takes bytes written as base64url, and this is not base64url`);
  }
  const wanted = WRAP_BYTES[alg];
  if (wanted && bytes.length !== wanted) throw new Error(`${alg} takes ${wanted} bytes, and this is ${bytes.length}`);
  return bytes;
}

async function loadPem(pem: string, alg: string, half: Half): Promise<CryptoKey> {
  if (pem.startsWith("-----BEGIN PRIVATE KEY")) {
    const key = await importPKCS8(pem, alg, { extractable: true });
    return half === "private" ? key : publicFromPrivate(key, alg);
  }
  const spki = pem.startsWith("-----BEGIN PUBLIC KEY");
  if (!spki && !pem.startsWith("-----BEGIN CERTIFICATE")) {
    throw new Error(
      "Only PKCS#8 keys, SPKI keys and X.509 certificates are read; openssl pkcs8 -topk8 converts PKCS#1",
    );
  }
  if (half === "private") throw new Error("That is a public key, and this needs the private half");
  return spki ? importSPKI(pem, alg, { extractable: true }) : importX509(pem, alg, { extractable: true });
}

async function loadJwk(text: string, alg: string, half: Half, kid: unknown): Promise<CryptoKey | Uint8Array> {
  let parsed: JWK & { keys?: unknown };
  try {
    parsed = JSON.parse(text) as JWK;
  } catch {
    return Promise.reject(new Error("That key is not JSON"));
  }
  const jwk = parsed.keys === undefined ? parsed : keyFromSet(parsed.keys, kid);
  const wanted = half === "public" && jwk.kty !== "oct" ? publicJwk(jwk) : jwk;
  return importJWK(wanted, alg, { extractable: true });
}

function keyFromSet(keys: unknown, kid: unknown): JWK {
  if (!Array.isArray(keys) || keys.length === 0) throw new Error("That key set holds no keys");
  if (typeof kid !== "string") {
    if (keys.length === 1) return keys[0] as JWK;
    throw new Error(`The token names no kid, and this set holds ${keys.length} keys to choose between`);
  }
  const named = (keys as JWK[]).filter((key) => key?.kid === kid);
  if (named.length === 0) throw new Error(`No key in this set has the kid "${kid}" the token asks for`);
  if (named.length > 1) throw new Error(`This set holds ${named.length} keys with the kid "${kid}"`);
  return named[0];
}

export async function publicFromPrivate(key: CryptoKey, alg: string): Promise<CryptoKey> {
  return await importJWK(publicJwk(await exportJWK(key)), alg, { extractable: true }) as CryptoKey;
}

const PRIVATE_JWK_FIELDS = ["d", "p", "q", "dp", "dq", "qi", "oth", "key_ops", "use", "ext"];

export function publicJwk(jwk: JWK): JWK {
  const copy: Record<string, unknown> = { ...jwk };
  for (const field of PRIVATE_JWK_FIELDS) delete copy[field];
  return copy as JWK;
}

export async function publicKeyPem(key: CryptoKey | Uint8Array, alg: string): Promise<string> {
  if (key instanceof Uint8Array) return "";
  if (key.type === "public") return exportSPKI(key);
  if (key.type !== "private") return "";
  return exportSPKI(await publicFromPrivate(key, alg));
}
