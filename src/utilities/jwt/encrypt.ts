import { compactDecrypt, type CompactJWEHeaderParameters, EncryptJWT } from "jose";
import { EMPTY_RESULT } from "./algorithms";
import { fieldsToObject, message } from "./fields";
import { loadKey, publicKeyPem } from "./keys";
import { readObject, readToken } from "./token";
import type { BuildResult, EncryptRequest, Opened } from "./types";

export async function encryptToken({ alg, enc, headers, claims, secret }: EncryptRequest): Promise<BuildResult> {
  const rest = fieldsToObject(headers);
  let key: CryptoKey | Uint8Array;
  try {
    key = await loadKey(secret, alg, "public", rest.kid);
  } catch (e) {
    return { ...EMPTY_RESULT, keyError: message(e) };
  }

  try {
    delete rest.alg;
    delete rest.enc;
    const header = Object.assign({ alg, enc }, rest, { alg, enc }) as CompactJWEHeaderParameters;
    const token = await new EncryptJWT(fieldsToObject(claims)).setProtectedHeader(header).encrypt(key);
    return { ...EMPTY_RESULT, token, publicKey: await publicKeyPem(key, alg) };
  } catch (e) {
    return { ...EMPTY_RESULT, tokenError: message(e) };
  }
}

export async function decryptToken(token: string, secret: string, alg: string): Promise<Opened> {
  const key = await loadKey(secret, alg, "private", readToken(token).header?.kid);
  const { plaintext } = await compactDecrypt(token.trim(), key);
  const text = new TextDecoder().decode(plaintext);
  return { claims: readObject(text), text };
}

export function isWrongKey(e: unknown): boolean {
  return (e as { code?: string })?.code === "ERR_JWE_DECRYPTION_FAILED";
}
