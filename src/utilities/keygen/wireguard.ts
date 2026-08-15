import { randomBytes } from "@noble/hashes/utils.js";
import { toBase64 } from "./encoding";
import type { WireguardConfigs } from "./types";

export async function generateWireguardConfigs(serverPrivateKey: string): Promise<WireguardConfigs> {
  const { x25519 } = await import("@noble/curves/ed25519.js");
  const server = parseWireguardKey(serverPrivateKey) ?? randomWireguardKey();
  const client = randomWireguardKey();

  return {
    server: wireguardConfig(server, x25519.getPublicKey(client)),
    client: wireguardConfig(client, x25519.getPublicKey(server)),
  };
}

export function wireguardConfig(privateKey: Uint8Array, peerPublicKey: Uint8Array): string {
  return `[Interface]\nPrivateKey = ${toBase64(privateKey)}\n\n[Peer]\nPublicKey = ${toBase64(peerPublicKey)}\n`;
}

export function randomWireguardKey(): Uint8Array {
  const key = randomBytes(32);
  key[0] &= 248;
  key[31] &= 127;
  key[31] |= 64;
  return key;
}

export function parseWireguardKey(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) return null;
  return Uint8Array.from(atob(trimmed), (character) => character.charCodeAt(0));
}
