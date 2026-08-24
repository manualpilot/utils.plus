export interface PgpSettings {
  recipient: "key" | "password";
  publicKey: string;
  privateKey: string;
  passphrase: string;
  password: string;
}

export async function pgpEncrypt(message: Message, settings: PgpSettings): Promise<string | Uint8Array> {
  const openpgp = await import("openpgp");
  const encryptionKeys = settings.recipient === "key" ? await readPublicKeys(openpgp, settings.publicKey) : undefined;
  const passwords = settings.recipient === "password" ? [settings.password] : undefined;
  const options = { message: await createMessage(openpgp, message), encryptionKeys, passwords };
  return message.kind === "text"
    ? openpgp.encrypt({ ...options, format: "armored" })
    : openpgp.encrypt({ ...options, format: "binary" });
}

export async function pgpDecrypt(payload: string | Uint8Array, settings: PgpSettings): Promise<Uint8Array> {
  const openpgp = await import("openpgp");
  const message = typeof payload === "string"
    ? await openpgp.readMessage({ armoredMessage: payload })
    : await openpgp.readMessage({ binaryMessage: payload });
  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: settings.recipient === "key" ? await readPrivateKeys(openpgp, settings) : undefined,
    passwords: settings.recipient === "password" ? [settings.password] : undefined,
    format: "binary",
  });
  return data;
}

export type Message = { kind: "text"; text: string } | { kind: "binary"; bytes: Uint8Array; filename: string };

type OpenPgp = typeof import("openpgp");

function createMessage(openpgp: OpenPgp, message: Message) {
  return message.kind === "text"
    ? openpgp.createMessage({ text: message.text })
    : openpgp.createMessage({ binary: message.bytes, filename: message.filename });
}

async function readPublicKeys(openpgp: OpenPgp, armored: string) {
  const keys = await openpgp.readKeys({ armoredKeys: armored });
  if (keys.length === 0) throw new Error("That block holds no public key");
  return keys;
}

async function readPrivateKeys(openpgp: OpenPgp, settings: PgpSettings) {
  const keys = await openpgp.readPrivateKeys({ armoredKeys: settings.privateKey });
  if (keys.length === 0) throw new Error("That block holds no private key");
  return Promise.all(
    keys.map((privateKey) =>
      privateKey.isDecrypted() ? privateKey : openpgp.decryptKey({ privateKey, passphrase: settings.passphrase })
    ),
  );
}
