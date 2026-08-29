import type { AgeKeypair } from "./types";

export async function generateAgeIdentity(algorithm: string): Promise<AgeKeypair> {
  const { generateHybridIdentity, generateX25519Identity, identityToRecipient } = await import("age-encryption");
  const identity = algorithm === "hybrid" ? await generateHybridIdentity() : await generateX25519Identity();
  const recipient = await identityToRecipient(identity);
  const created = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return { recipient, file: `# created: ${created}\n# public key: ${recipient}\n${identity}\n` };
}
