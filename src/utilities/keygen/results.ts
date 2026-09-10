import { ageRecipientsFile, generateAgeIdentity } from "./age";
import { generateNaclKeypair } from "./nacl";
import type { Jwk, JwkSet, KeyPair, KeyResult } from "./types";
import { generateWireguardConfigs } from "./wireguard";

export async function wireguardResult(serverPrivateKey: string): Promise<KeyResult> {
  const { server, client } = await generateWireguardConfigs(serverPrivateKey);
  return {
    outputs: [
      { label: "Server configuration", value: server, rows: 5 },
      { label: "Client configuration", value: client, rows: 5 },
    ],
    fingerprint: "",
  };
}

export async function naclResult(format: string): Promise<KeyResult> {
  const { secretKey, publicKey } = await generateNaclKeypair(format);
  return {
    outputs: [
      { label: "Secret key", value: secretKey, rows: 2 },
      { label: "Public key", value: publicKey, rows: 2 },
    ],
    fingerprint: "",
  };
}

export async function ageResult(postQuantum: boolean): Promise<KeyResult> {
  const { file, recipient } = await generateAgeIdentity(postQuantum);
  return {
    outputs: [
      { label: "Identity file", value: file, rows: 3 },
      { label: "Recipient", value: recipient, rows: 2 },
    ],
    fingerprint: "",
  };
}

export async function ageRecipientsResult(identityFile: string): Promise<KeyResult> {
  return { outputs: [{ label: "Recipients", value: await ageRecipientsFile(identityFile), rows: 2 }], fingerprint: "" };
}

export function jwkResult({ privateKeys, publicKeys, thumbprint }: JwkSet): KeyResult {
  const owned = publicKeys.length === 0 ? "Key" : "Private key";
  const many = privateKeys.length > 1;
  const outputs = [{ label: many ? `${owned} set` : owned, value: writeJwks(privateKeys), rows: 8 }];
  if (publicKeys.length > 0) {
    outputs.push({ label: many ? "Public key set" : "Public key", value: writeJwks(publicKeys), rows: 8 });
  }
  return { outputs, fingerprint: thumbprint };
}

export function writeJwks(keys: Jwk[]): string {
  return JSON.stringify(keys.length === 1 ? keys[0] : { keys }, null, 2);
}

export function pairResult(kind: string, pair: KeyPair): KeyResult {
  return {
    outputs: [
      { label: "Private key", value: pair.privateKey, rows: 6 },
      { label: "Public key", value: pair.publicKey, rows: kind === "ssh" ? 2 : 6 },
    ],
    fingerprint: pair.fingerprint,
  };
}
