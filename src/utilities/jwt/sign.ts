import { compactVerify, type JWTHeaderParameters, SignJWT } from "jose";
import { EMPTY_RESULT } from "./algorithms";
import { fieldsToObject, message } from "./fields";
import { loadKey, publicKeyPem } from "./keys";
import type { BuildRequest, BuildResult } from "./types";

export async function verifySignature(token: string, secret: string, alg: string): Promise<boolean> {
  const key = await loadKey(secret, alg, "public");
  try {
    await compactVerify(token.trim(), key);
    return true;
  } catch (e) {
    if (isSignatureMismatch(e)) return false;
    throw e;
  }
}

export async function signToken({ alg, headers, claims, secret }: BuildRequest): Promise<BuildResult> {
  let key: CryptoKey | Uint8Array;
  try {
    key = await loadKey(secret, alg, "private");
  } catch (e) {
    return { ...EMPTY_RESULT, keyError: message(e) };
  }

  try {
    const rest = fieldsToObject(headers);
    delete rest.alg;
    const header = Object.assign({ alg }, rest, { alg }) as JWTHeaderParameters;
    const token = await new SignJWT(fieldsToObject(claims)).setProtectedHeader(header).sign(key);
    return { ...EMPTY_RESULT, token, publicKey: await publicKeyPem(key, alg) };
  } catch (e) {
    return { ...EMPTY_RESULT, tokenError: message(e) };
  }
}

export function isSignatureMismatch(e: unknown): boolean {
  return (e as { code?: string })?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
}
