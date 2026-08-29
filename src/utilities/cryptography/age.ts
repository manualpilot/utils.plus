import { fromBase64 } from "./encoding";

export interface AgeSettings {
  recipient: "key" | "password";
  recipients: string;
  identities: string;
  password: string;
}

export async function ageEncrypt(data: Uint8Array, settings: AgeSettings): Promise<Uint8Array> {
  const { Encrypter } = await library();
  const encrypter = new Encrypter();
  if (settings.recipient === "password") {
    encrypter.setPassphrase(settings.password);
  } else {
    const recipients = keyLines(settings.recipients);
    if (recipients.length === 0) throw new Error("That is nobody to seal a file to");
    for (const recipient of recipients) readKey(() => encrypter.addRecipient(recipient), "recipient", recipient);
  }
  return encrypter.encrypt(data);
}

export async function ageDecrypt(payload: Uint8Array, settings: AgeSettings): Promise<Uint8Array> {
  const { Decrypter } = await library();
  const decrypter = new Decrypter();
  if (settings.recipient === "password") {
    decrypter.addPassphrase(settings.password);
  } else {
    const identities = keyLines(settings.identities);
    if (identities.length === 0) throw new Error("That is nobody to open a file as");
    for (const identity of identities) readKey(() => decrypter.addIdentity(identity), "identity", identity);
  }

  try {
    return await decrypter.decrypt(payload);
  } catch (e) {
    if (e instanceof Error && e.message === UNOPENED) {
      throw new Error(
        settings.recipient === "password"
          ? "That passphrase does not open this file"
          : "None of those identities opens this file",
      );
    }
    throw e;
  }
}

export async function ageArmor(payload: Uint8Array): Promise<string> {
  return (await library()).armor.encode(payload);
}

export async function ageUnarmor(text: string): Promise<Uint8Array> {
  const trimmed = text.trim();
  if (!trimmed.startsWith(ARMOR_BEGIN)) {
    try {
      return fromBase64(trimmed);
    } catch {
      throw new Error(`That is not an armoured age file — one opens with ${ARMOR_BEGIN}`);
    }
  }
  return (await library()).armor.decode(trimmed);
}

export async function generateAgeIdentity(): Promise<string> {
  return (await library()).generateX25519Identity();
}

export async function identityRecipients(text: string): Promise<string[]> {
  const { identityToRecipient } = await library();
  return Promise.all(keyLines(text).map((line) => identityToRecipient(line)));
}

function library(): Promise<typeof import("age-encryption")> {
  return import("age-encryption");
}

function keyLines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));
}

function readKey(add: () => void, noun: string, line: string): void {
  try {
    add();
  } catch {
    const shown = line.length > SHOWN ? `${line.slice(0, SHOWN)}…` : line;
    throw new Error(`That is not an age ${noun}: ${shown}`);
  }
}

const UNOPENED = "no identity matched any of the file's recipients";

const ARMOR_BEGIN = "-----BEGIN AGE ENCRYPTED FILE-----";

const SHOWN = 24;
