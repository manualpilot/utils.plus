import { identityRecipients, keyLines, shortened } from "../../common/age-identity";
import type { AgeKeypair } from "./types";

export async function generateAgeIdentity(postQuantum: boolean): Promise<AgeKeypair> {
  const { generateHybridIdentity, generateX25519Identity, identityToRecipient } = await import("age-encryption");
  const identity = postQuantum ? await generateHybridIdentity() : await generateX25519Identity();
  const recipient = await identityToRecipient(identity);
  const created = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return { recipient, file: `# created: ${created}\n# public key: ${recipient}\n${identity}\n` };
}

export async function ageRecipientsFile(text: string): Promise<string> {
  const recipients = await identityRecipients(text);
  if (recipients.length === 0) throw new Error("There is no identity in that file");
  return `${recipients.join("\n")}\n`;
}

export function identityProblem(text: string): string {
  const bad = keyLines(text).find((line) => !IDENTITY.test(line));
  return bad === undefined ? "" : `That is not an age identity: ${shortened(bad)}`;
}

const IDENTITY = /^AGE-SECRET-KEY(-PQ)?-1[0-9A-Z]+$/;
