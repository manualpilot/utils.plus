import { randomBelow } from "../../common/random";
import { md5, sha1, sha3 } from "./digests";
import { LOCAL_DOMAIN_CODES } from "./types";

export function generateUUIDv4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const hex = "0123456789abcdef";
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += hex[a[i] >> 4] + hex[a[i] & 15];
    if (i === 3 || i === 5 || i === 7 || i === 9) id += "-";
  }
  return id;
}

let lastTime = 0;
let clockSequence = 0;
const node = new Uint8Array(6);
crypto.getRandomValues(node);
node[0] |= 0x01;

function getG1582(): { time: bigint; seq: number } {
  const now = Date.now();
  let time = BigInt(now) * 10000n + 122192928000000000n;
  if (now === lastTime) {
    clockSequence = (clockSequence + 1) & 0x3fff;
    time += BigInt(clockSequence);
  } else {
    lastTime = now;
    clockSequence = (crypto.getRandomValues(new Uint16Array(1))[0]) & 0x3fff;
  }
  return { time, seq: clockSequence };
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatUUID(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

export function toBase32(value: bigint, digits: number, alphabet: string): string {
  let text = "";
  for (let i = 0; i < digits; i++) {
    text = alphabet[Number(value & 31n)] + text;
    value >>= 5n;
  }
  return text;
}

function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint24BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 16) & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = value & 0xff;
}

export function generateUUIDv1(): string {
  const { time, seq } = getG1582();
  const bytes = new Uint8Array(16);
  const timeMid = Number((time >> 32n) & 0xffffn);
  const timeHi = Number((time >> 48n) & 0x0fffn) | 0x1000;

  writeUint32BE(bytes, 0, Number(time & 0xffffffffn));
  bytes[4] = timeMid >>> 8;
  bytes[5] = timeMid & 0xff;
  bytes[6] = timeHi >>> 8;
  bytes[7] = timeHi & 0xff;
  bytes[8] = (seq >>> 8) | 0x80;
  bytes[9] = seq & 0xff;
  bytes.set(node, 10);
  return formatUUID(bytes);
}

export function generateUUIDv2(localId: number, domain: string): string {
  const { time, seq } = getG1582();
  const bytes = new Uint8Array(16);
  const timeMid = Number((time >> 32n) & 0xffffn);
  const timeHi = Number((time >> 48n) & 0x0fffn) | 0x2000;

  writeUint32BE(bytes, 0, localId);
  bytes[4] = timeMid >>> 8;
  bytes[5] = timeMid & 0xff;
  bytes[6] = timeHi >>> 8;
  bytes[7] = timeHi & 0xff;
  bytes[8] = (seq >>> 8) | 0x80;
  bytes[9] = LOCAL_DOMAIN_CODES[domain] ?? 0;
  crypto.getRandomValues(bytes.subarray(10));
  bytes[10] |= 0x01;
  return formatUUID(bytes);
}

export function generateUUIDv6(): string {
  const { time, seq } = getG1582();
  const bytes = new Uint8Array(16);
  const timeMid = Number((time >> 12n) & 0xffffn);
  const timeLow = Number(time & 0x0fffn) | 0x6000;

  writeUint32BE(bytes, 0, Number((time >> 28n) & 0xffffffffn));
  bytes[4] = timeMid >>> 8;
  bytes[5] = timeMid & 0xff;
  bytes[6] = timeLow >>> 8;
  bytes[7] = timeLow & 0xff;
  bytes[8] = (seq >>> 8) | 0x80;
  bytes[9] = seq & 0xff;
  bytes.set(node, 10);
  return formatUUID(bytes);
}

export function generateUUIDv7(): string {
  return formatUUID(uuidV7Bytes());
}

function uuidV7Bytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const time = Date.now();

  bytes[0] = Math.floor(time / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(time / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(time / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(time / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(time / 2 ** 8) & 0xff;
  bytes[5] = time & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

export function generateUUIDv8(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUUID(bytes);
}

export function generateNanoID(size = 21): string {
  const urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i++) {
    id += urlAlphabet[bytes[i] & 63];
  }
  return id;
}

const CUID_BLOCK_SIZE = 4;
const CUID_BLOCK_VALUES = 36 ** CUID_BLOCK_SIZE;
const cuidFingerprint = cuidBlock();
let cuidCounter = 0;

export function generateCUID(): string {
  const counter = cuidCounter.toString(36).padStart(CUID_BLOCK_SIZE, "0");
  cuidCounter = (cuidCounter + 1) % CUID_BLOCK_VALUES;
  return `c${Date.now().toString(36)}${counter}${cuidFingerprint}${cuidBlock()}${cuidBlock()}`;
}

function cuidBlock(): string {
  return randomBelow(CUID_BLOCK_VALUES).toString(36).padStart(CUID_BLOCK_SIZE, "0");
}

const CUID2_LENGTH = 24;
const CUID2_LETTERS = "abcdefghijklmnopqrstuvwxyz";
const CUID2_FIRST_COUNT = 476782367;
let cuid2Fingerprint = "";
let cuid2Counter = randomBelow(CUID2_FIRST_COUNT);

export function generateCUID2(): string {
  cuid2Fingerprint ||= cuid2Hash(cuid2Entropy(32)).slice(0, 32);
  const time = Date.now().toString(36);
  const count = (cuid2Counter++).toString(36);
  const hashed = cuid2Hash(time + cuid2Entropy(CUID2_LENGTH) + count + cuid2Fingerprint);
  return CUID2_LETTERS[randomBelow(CUID2_LETTERS.length)] + hashed.slice(1, CUID2_LENGTH);
}

function cuid2Hash(input: string): string {
  return bytesToBigInt(sha3(stringToUTF8Bytes(input))).toString(36).slice(1);
}

function cuid2Entropy(length: number): string {
  let entropy = "";
  while (entropy.length < length) entropy += randomBelow(36).toString(36);
  return entropy;
}

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
export function generateULID(): string {
  const now = Date.now();
  let timeStr = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    const mod = t % ENCODING_LEN;
    timeStr = ENCODING.charAt(mod) + timeStr;
    t = (t - mod) / ENCODING_LEN;
  }

  let randomStr = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) {
    randomStr += ENCODING.charAt(bytes[i] % ENCODING_LEN);
  }

  return timeStr + randomStr;
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export function generateKSUID(): string {
  const payload = new Uint8Array(16);
  crypto.getRandomValues(payload);
  const time = Math.floor(Date.now() / 1000) - 1400000000;

  const buffer = new Uint8Array(20);
  buffer[0] = (time >>> 24) & 0xff;
  buffer[1] = (time >>> 16) & 0xff;
  buffer[2] = (time >>> 8) & 0xff;
  buffer[3] = time & 0xff;
  buffer.set(payload, 4);

  let value = 0n;
  for (let i = 0; i < buffer.length; i++) {
    value = (value * 256n) + BigInt(buffer[i]);
  }

  let result = "";
  while (value > 0n) {
    const rem = Number(value % 62n);
    result = BASE62[rem] + result;
    value /= 62n;
  }
  return result.padStart(27, "0");
}

const XID_ALPHABET = "0123456789abcdefghijklmnopqrstuv";
const xidMachine = crypto.getRandomValues(new Uint8Array(3));
const xidProcess = crypto.getRandomValues(new Uint16Array(1))[0];
let xidCounter = randomBelow(0x1000000);

export function generateXID(): string {
  const bytes = new Uint8Array(12);
  writeUint32BE(bytes, 0, Math.floor(Date.now() / 1000));
  bytes.set(xidMachine, 4);
  bytes[7] = xidProcess >>> 8;
  bytes[8] = xidProcess & 0xff;
  xidCounter = (xidCounter + 1) & 0xffffff;
  writeUint24BE(bytes, 9, xidCounter);
  return toBase32(bytesToBigInt(bytes) << 4n, 20, XID_ALPHABET);
}

const CROCKFORD_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function generateTypeID(prefix: string): string {
  const suffix = toBase32(bytesToBigInt(uuidV7Bytes()), 26, CROCKFORD_ALPHABET);
  return prefix ? `${prefix}_${suffix}` : suffix;
}

const objectIdRandom = crypto.getRandomValues(new Uint8Array(5));
let objectIdCounter = randomBelow(0x1000000);

export function generateObjectId(): string {
  const bytes = new Uint8Array(12);
  writeUint32BE(bytes, 0, Math.floor(Date.now() / 1000));
  bytes.set(objectIdRandom, 4);
  objectIdCounter = (objectIdCounter + 1) & 0xffffff;
  writeUint24BE(bytes, 9, objectIdCounter);
  return toHex(bytes);
}

const PUSH_ALPHABET = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const pushRandom = new Uint8Array(12);
let pushLastTime = 0;

export function generatePushID(): string {
  const now = Date.now();
  let remaining = now;
  let id = "";
  for (let i = 0; i < 8; i++) {
    id = PUSH_ALPHABET[remaining % 64] + id;
    remaining = Math.floor(remaining / 64);
  }

  if (now === pushLastTime) {
    let i = pushRandom.length - 1;
    while (i >= 0 && pushRandom[i] === 63) pushRandom[i--] = 0;
    if (i >= 0) pushRandom[i]++;
  } else {
    crypto.getRandomValues(pushRandom);
    for (let i = 0; i < pushRandom.length; i++) pushRandom[i] &= 63;
  }
  pushLastTime = now;

  for (const value of pushRandom) id += PUSH_ALPHABET[value];
  return id;
}

let sfSequence = 0n;
let sfLastTime = -1n;
const sfMachineId = 1n;
export function generateSnowflake(): string {
  const epoch = 1288834974657n;
  let time = BigInt(Date.now());

  if (time === sfLastTime) {
    sfSequence = (sfSequence + 1n) & 4095n;
    if (sfSequence === 0n) {
      while (time <= sfLastTime) {
        time = BigInt(Date.now());
      }
    }
  } else {
    sfSequence = 0n;
  }

  sfLastTime = time;

  const id = ((time - epoch) << 22n) | (sfMachineId << 12n) | sfSequence;
  return id.toString();
}

const SONYFLAKE_EPOCH = Date.UTC(2014, 8, 1);
const sonyflakeMachine = BigInt(crypto.getRandomValues(new Uint16Array(1))[0]);
let sonyflakeSequence = 0;
let sonyflakeLastTick = -1n;

export function generateSonyflake(): string {
  let tick = sonyflakeTick();
  if (tick === sonyflakeLastTick) {
    sonyflakeSequence = (sonyflakeSequence + 1) & 0xff;
    while (sonyflakeSequence === 0 && tick <= sonyflakeLastTick) tick = sonyflakeTick();
  } else {
    sonyflakeSequence = 0;
  }

  sonyflakeLastTick = tick;
  return ((tick << 24n) | (BigInt(sonyflakeSequence) << 16n) | sonyflakeMachine).toString();
}

function sonyflakeTick(): bigint {
  return BigInt(Math.floor((Date.now() - SONYFLAKE_EPOCH) / 10));
}

export function parseUUID(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function stringToUTF8Bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function generateUUIDv3(name: string, namespace: string): string {
  const nsBytes = parseUUID(namespace);
  const nameBytes = stringToUTF8Bytes(name);
  const bytes = new Uint8Array(16 + nameBytes.length);
  bytes.set(nsBytes, 0);
  bytes.set(nameBytes, 16);

  const hash = md5(bytes);
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return formatUUID(hash);
}

export function generateUUIDv5(name: string, namespace: string): string {
  const nsBytes = parseUUID(namespace);
  const nameBytes = stringToUTF8Bytes(name);
  const bytes = new Uint8Array(16 + nameBytes.length);
  bytes.set(nsBytes, 0);
  bytes.set(nameBytes, 16);

  const hash = sha1(bytes);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  return formatUUID(hash.slice(0, 16));
}
