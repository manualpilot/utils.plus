import { concatBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { WEB_CRYPTO_CURVES } from "./algorithms";
import { fromBase64Url, toBase64 } from "./encoding";

const MAGIC = "openssh-key-v1\0";

const CIPHER = "aes256-ctr";
const ROUNDS = 16;

export interface SshKey {
  type: string;
  blob: Uint8Array;
  secret: Uint8Array;
}

export function sshKey(jwk: JsonWebKey): SshKey {
  if (jwk.kty === "RSA") {
    const [n, e, d, p, q, qi] = [jwk.n, jwk.e, jwk.d, jwk.p, jwk.q, jwk.qi].map((value) => mpint(fromBase64Url(value)));
    return withBlob("ssh-rsa", [e, n], [n, e, d, qi, p, q]);
  }
  if (jwk.kty === "EC") {
    const curve = Object.keys(WEB_CRYPTO_CURVES).find((name) => WEB_CRYPTO_CURVES[name] === jwk.crv) ?? "nistp256";
    const point = sshString(concatBytes(new Uint8Array([4]), fromBase64Url(jwk.x), fromBase64Url(jwk.y)));
    return withBlob(`ecdsa-sha2-${curve}`, [sshString(curve), point], [
      sshString(curve),
      point,
      mpint(fromBase64Url(jwk.d)),
    ]);
  }
  const point = fromBase64Url(jwk.x);
  return withBlob("ssh-ed25519", [sshString(point)], [
    sshString(point),
    sshString(concatBytes(fromBase64Url(jwk.d), point)),
  ]);
}

export function publicLine(key: SshKey, comment: string): string {
  const line = `${key.type} ${toBase64(key.blob)}`;
  return comment ? `${line} ${comment}` : line;
}

export async function fingerprint(key: SshKey): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", key.blob as Uint8Array<ArrayBuffer>));
  return `SHA256:${toBase64(digest).replace(/=+$/, "")}`;
}

export async function privateKeyFile(key: SshKey, comment: string, passphrase: string): Promise<string> {
  const encrypted = passphrase !== "";
  const check = randomBytes(4);
  const section = padded(
    concatBytes(check, check, sshString(key.type), key.secret, sshString(comment)),
    encrypted ? 16 : 8,
  );
  const salt = randomBytes(16);

  const file = concatBytes(
    utf8ToBytes(MAGIC),
    sshString(encrypted ? CIPHER : "none"),
    sshString(encrypted ? "bcrypt" : "none"),
    sshString(encrypted ? concatBytes(sshString(salt), uint32(ROUNDS)) : new Uint8Array(0)),
    uint32(1),
    sshString(key.blob),
    sshString(encrypted ? await encrypt(section, passphrase, salt) : section),
  );
  const body = toBase64(file).replace(/(.{70})/g, "$1\n").replace(/\n$/, "");
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

async function encrypt(section: Uint8Array, passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const { default: bcrypt } = await import("bcrypt-pbkdf");
  const password = utf8ToBytes(passphrase);
  const derived = new Uint8Array(48);
  if (bcrypt.pbkdf(password, password.length, salt, salt.length, derived, derived.length, ROUNDS) !== 0) {
    throw new Error("bcrypt_pbkdf refused its parameters");
  }
  const aes = await crypto.subtle.importKey("raw", derived.slice(0, 32), "AES-CTR", false, ["encrypt"]);
  const params = { name: "AES-CTR", counter: derived.slice(32), length: 128 };
  return new Uint8Array(await crypto.subtle.encrypt(params, aes, section as Uint8Array<ArrayBuffer>));
}

function withBlob(type: string, fields: Uint8Array[], secret: Uint8Array[]): SshKey {
  return { type, blob: concatBytes(sshString(type), ...fields), secret: concatBytes(...secret) };
}

function padded(section: Uint8Array, blockSize: number): Uint8Array {
  const length = Math.ceil(section.length / blockSize) * blockSize;
  return concatBytes(section, Uint8Array.from({ length: length - section.length }, (_, index) => index + 1));
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function sshString(value: Uint8Array | string): Uint8Array {
  const bytes = typeof value === "string" ? utf8ToBytes(value) : value;
  return concatBytes(uint32(bytes.length), bytes);
}

function mpint(bytes: Uint8Array): Uint8Array {
  const start = bytes.findIndex((byte) => byte !== 0);
  const magnitude = start === -1 ? new Uint8Array(0) : bytes.subarray(start);
  return sshString(magnitude[0] & 0x80 ? concatBytes(new Uint8Array([0]), magnitude) : magnitude);
}
