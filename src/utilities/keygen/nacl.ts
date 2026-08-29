import { formatSecret } from "./encoding";
import type { NaclKeypair } from "./types";

export async function generateNaclKeypair(format: string): Promise<NaclKeypair> {
  const { x25519 } = await import("@noble/curves/ed25519.js");
  const { secretKey, publicKey } = x25519.keygen();
  return { secretKey: formatSecret(secretKey, format), publicKey: formatSecret(publicKey, format) };
}
