import { ageArmor, ageDecrypt, ageEncrypt, ageFile, type AgeSettings, ageUnarmor } from "./age";
import { ALGORITHMS } from "./algorithms";
import { boxCipher } from "./box";
import { decodeBytes, encodeBytes, type Encoding, fromUtf8, utf8 } from "./encoding";
import { pgpDecrypt, pgpEncrypt, type PgpSettings } from "./pgp";
import { openBytes, sealBytes } from "./symmetric";

export type Mode = "encrypt" | "decrypt";
export type Source = "text" | "file";

export interface Job {
  mode: Mode;
  algorithm: string;
  source: Source;
  text: string;
  bytes: Uint8Array | null;
  filename: string;
  encoding: Encoding;
  key: Uint8Array;
  peerKey: Uint8Array;
  nonce: Uint8Array;
  aad: Uint8Array | undefined;
  pgp: PgpSettings;
  age: AgeSettings;
}

export interface Outcome {
  text?: string;
  bytes?: Uint8Array;
  name?: string;
  nonce?: Uint8Array;
}

export async function runJob(job: Job): Promise<Outcome> {
  return job.mode === "encrypt" ? encrypt(job) : decrypt(job);
}

async function encrypt(job: Job): Promise<Outcome> {
  if (ALGORITHMS[job.algorithm].family === "pgp") {
    const message = job.source === "text"
      ? { kind: "text" as const, text: job.text }
      : { kind: "binary" as const, bytes: input(job), filename: job.filename };
    const result = await pgpEncrypt(message, job.pgp);
    return typeof result === "string"
      ? { text: result }
      : { bytes: result, name: `${job.filename || "message"}.pgp` };
  }

  if (ALGORITHMS[job.algorithm].family === "age") {
    const file = await ageEncrypt(input(job), job.age);
    const name = `${job.filename || "message"}.age`;
    if (!job.age.armor) return { bytes: file, name };
    const armoured = await ageArmor(file);
    return job.source === "text" ? { text: armoured } : { bytes: utf8(armoured), name };
  }

  const sealed = await seal(job, input(job));
  const payload = join(job.nonce, sealed);
  return job.source === "text"
    ? { text: encodeBytes(payload, job.encoding) }
    : { bytes: payload, name: `${job.filename || "message"}.enc` };
}

async function decrypt(job: Job): Promise<Outcome> {
  if (ALGORITHMS[job.algorithm].family === "pgp") {
    const opened = await pgpDecrypt(job.source === "text" ? job.text : input(job), job.pgp);
    return plaintext(job, opened);
  }

  if (ALGORITHMS[job.algorithm].family === "age") {
    const file = job.source === "text" ? await ageUnarmor(job.text) : await ageFile(input(job));
    return plaintext(job, await ageDecrypt(file, job.age));
  }

  const payload = job.source === "text" ? decodeBytes(job.text, job.encoding) : input(job);
  const { nonceBytes, nonceNoun } = ALGORITHMS[job.algorithm];
  if (payload.length < nonceBytes) {
    throw new Error(`Too short to hold a ${nonceBytes}-byte ${nonceNoun}`);
  }
  const nonce = payload.subarray(0, nonceBytes);
  const opened = await open({ ...job, nonce }, payload.subarray(nonceBytes));
  return { ...plaintext(job, opened), nonce };
}

function seal(job: Job, data: Uint8Array): Promise<Uint8Array> {
  const { algorithm, key, peerKey, nonce, aad } = job;
  if (ALGORITHMS[algorithm].family === "box") {
    return Promise.resolve(boxCipher(key, peerKey, nonce).encrypt(data));
  }
  return sealBytes({ algorithm, key, nonce, aad, data });
}

function open(job: Job, data: Uint8Array): Promise<Uint8Array> {
  const { algorithm, key, peerKey, nonce, aad } = job;
  if (ALGORITHMS[algorithm].family === "box") {
    return Promise.resolve(boxCipher(key, peerKey, nonce).decrypt(data));
  }
  return openBytes({ algorithm, key, nonce, aad, data });
}

function input(job: Job): Uint8Array {
  if (job.source === "file") return job.bytes ?? new Uint8Array();
  return job.mode === "encrypt" ? utf8(job.text) : decodeBytes(job.text, job.encoding);
}

function plaintext(job: Job, opened: Uint8Array): Outcome {
  if (job.source === "file") return { bytes: opened, name: plainName(job.filename) };
  try {
    return { text: fromUtf8(opened) };
  } catch {
    throw new Error("That decrypted to bytes that are not UTF-8 text — read it back as a file instead");
  }
}

function plainName(filename: string): string {
  const stripped = filename.replace(WRAPPER_SUFFIX, "");
  return stripped === filename ? `${filename || "message"}.decrypted` : stripped;
}

const WRAPPER_SUFFIX = /\.(?:enc|age|pgp|gpg|asc)$/i;

function join(head: Uint8Array, tail: Uint8Array): Uint8Array {
  const joined = new Uint8Array(head.length + tail.length);
  joined.set(head);
  joined.set(tail, head.length);
  return joined;
}
