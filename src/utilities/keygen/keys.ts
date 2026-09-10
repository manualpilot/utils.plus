import { WEB_CRYPTO_CURVES } from "./algorithms";
import { fingerprint, privateKeyFile, publicLine, sshKey } from "./openssh";
import type { KeyPair, KeySettings } from "./types";

type Curve = Parameters<typeof import("openpgp").generateKey>[0]["curve"];

export async function generateSshKey(settings: KeySettings): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(sshKeyParams(settings), true, ["sign", "verify"]) as CryptoKeyPair;
  const key = sshKey(await crypto.subtle.exportKey("jwk", pair.privateKey));

  return {
    privateKey: await privateKeyFile(key, settings.comment, settings.passphrase),
    publicKey: publicLine(key, settings.comment),
    fingerprint: await fingerprint(key),
  };
}

export async function generatePgpKey(settings: KeySettings): Promise<KeyPair> {
  const openpgp = await import("openpgp");
  const algorithm = settings.algorithm === "rsa"
    ? { type: "rsa" as const, rsaBits: Number(settings.variant) }
    : { type: "ecc" as const, curve: (settings.algorithm === "ecc" ? settings.variant : "curve25519Legacy") as Curve };

  const { privateKey, publicKey } = await openpgp.generateKey({
    ...algorithm,
    userIDs: [{ name: settings.name.trim(), email: settings.email || undefined }],
    passphrase: settings.passphrase || undefined,
    format: "object",
  });

  return {
    privateKey: privateKey.armor(),
    publicKey: publicKey.armor(),
    fingerprint: privateKey.getFingerprint().toUpperCase(),
  };
}

function sshKeyParams({ algorithm, variant }: KeySettings): RsaHashedKeyGenParams | EcKeyGenParams | Algorithm {
  if (algorithm === "rsa") {
    return {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: Number(variant),
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    };
  }
  if (algorithm === "ecdsa") return { name: "ECDSA", namedCurve: WEB_CRYPTO_CURVES[variant] ?? "P-256" };
  return { name: "Ed25519" };
}
