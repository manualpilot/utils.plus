import { compactVerify, exportJWK, exportPKCS8, exportSPKI, generateKeyPair, importJWK, importPKCS8, importSPKI, importX509, type JWK, type JWTHeaderParameters, SignJWT } from "jose";
import { EMPTY_SIGNATURE, isSymmetric, SECRET_BYTES } from "./algorithms";
import { fieldsToObject, message } from "./fields";
import { toBase64Url } from "./token";
import type { SignRequest, SignResult } from "./types";

export async function verifySignature(token: string, secret: string, alg: string): Promise<boolean> {
  const key = await loadKey(secret, alg, "verify");
  try {
    await compactVerify(token.trim(), key);
    return true;
  } catch (e) {
    if (isSignatureMismatch(e)) return false;
    throw e;
  }
}

export async function signToken({ alg, headers, claims, secret }: SignRequest): Promise<SignResult> {
  let key: CryptoKey | Uint8Array;
  try {
    key = await loadKey(secret, alg, "sign");
  } catch (e) {
    return { ...EMPTY_SIGNATURE, keyError: message(e) };
  }

  try {
    const rest = fieldsToObject(headers);
    delete rest.alg;
    const header = Object.assign({ alg }, rest, { alg }) as JWTHeaderParameters;
    const token = await new SignJWT(fieldsToObject(claims)).setProtectedHeader(header).sign(key);
    return { ...EMPTY_SIGNATURE, token, publicKey: await publicKeyPem(key, alg) };
  } catch (e) {
    return { ...EMPTY_SIGNATURE, tokenError: message(e) };
  }
}

export async function generateSigningKey(alg: string): Promise<string> {
  if (isSymmetric(alg)) return toBase64Url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES[alg] ?? 32)));
  const { privateKey } = await generateKeyPair(alg, { extractable: true });
  return exportPKCS8(privateKey);
}

type Usage = "sign" | "verify";

async function loadKey(secret: string, alg: string, usage: Usage): Promise<CryptoKey | Uint8Array> {
  const text = secret.trim();
  if (!text) throw new Error("Required");
  if (text.startsWith("-----BEGIN")) return loadPem(text, alg, usage);
  if (text.startsWith("{")) return loadJwk(text, alg, usage);
  if (!isSymmetric(alg)) throw new Error(`${alg} signs with a key, so this needs a PEM or a JWK rather than a phrase`);
  return new TextEncoder().encode(secret);
}

async function loadPem(pem: string, alg: string, usage: Usage): Promise<CryptoKey> {
  if (pem.startsWith("-----BEGIN PRIVATE KEY")) {
    const key = await importPKCS8(pem, alg, { extractable: true });
    return usage === "sign" ? key : publicFromPrivate(key, alg);
  }
  const spki = pem.startsWith("-----BEGIN PUBLIC KEY");
  if (!spki && !pem.startsWith("-----BEGIN CERTIFICATE")) {
    throw new Error(
      "Only PKCS#8 keys, SPKI keys and X.509 certificates are read; openssl pkcs8 -topk8 converts PKCS#1",
    );
  }
  if (usage === "sign") throw new Error("That is a public key; signing needs the private half");
  return spki ? importSPKI(pem, alg) : importX509(pem, alg);
}

async function loadJwk(text: string, alg: string, usage: Usage): Promise<CryptoKey | Uint8Array> {
  let jwk: JWK;
  try {
    jwk = JSON.parse(text) as JWK;
  } catch {
    return Promise.reject(new Error("That key is not JSON"));
  }
  const wanted = usage === "verify" && jwk.kty !== "oct" ? publicJwk(jwk) : jwk;
  return importJWK(wanted, alg, { extractable: true });
}

async function publicFromPrivate(key: CryptoKey, alg: string): Promise<CryptoKey> {
  return await importJWK(publicJwk(await exportJWK(key)), alg, { extractable: true }) as CryptoKey;
}

const PRIVATE_JWK_FIELDS = ["d", "p", "q", "dp", "dq", "qi", "oth", "key_ops", "use", "ext"];

export function publicJwk(jwk: JWK): JWK {
  const copy: Record<string, unknown> = { ...jwk };
  for (const field of PRIVATE_JWK_FIELDS) delete copy[field];
  return copy as JWK;
}

async function publicKeyPem(key: CryptoKey | Uint8Array, alg: string): Promise<string> {
  if (key instanceof Uint8Array || key.type !== "private") return "";
  return exportSPKI(await publicFromPrivate(key, alg));
}

export function isSignatureMismatch(e: unknown): boolean {
  return (e as { code?: string })?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
}
