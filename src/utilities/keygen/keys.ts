import { webCryptoPkcs8 } from "./results";
import type { KeyPair, KeySettings } from "./types";

type Curve = Parameters<typeof import("openpgp").generateKey>[0]["curve"];

export async function generateSshKey(settings: KeySettings): Promise<KeyPair> {
  const sshpk = await import("sshpk");
  const key = settings.algorithm === "ed25519"
    ? sshpk.generatePrivateKey("ed25519")
    : sshpk.parsePrivateKey(await webCryptoPkcs8(settings.algorithm, settings.variant), "pkcs8");

  key.comment = settings.comment;
  const options = settings.passphrase
    ? { passphrase: settings.passphrase, cipher: "aes256-ctr" as const }
    : undefined;

  return {
    privateKey: key.toString("ssh-private", options),
    publicKey: key.toPublic().toString("ssh"),
    fingerprint: key.fingerprint("sha256").toString(),
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
