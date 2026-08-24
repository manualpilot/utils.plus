import { chacha20poly1305, xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { xsalsa20poly1305 } from "@noble/ciphers/salsa.js";

export async function sealBytes(request: Sealing): Promise<Uint8Array> {
  if (request.algorithm.startsWith("aes-")) return webCrypto("encrypt", request);
  return cipher(request).encrypt(request.data);
}

export async function openBytes(request: Sealing): Promise<Uint8Array> {
  if (request.algorithm.startsWith("aes-")) return webCrypto("decrypt", request);
  return cipher(request).decrypt(request.data);
}

export interface Sealing {
  algorithm: string;
  key: Uint8Array;
  nonce: Uint8Array;
  aad: Uint8Array | undefined;
  data: Uint8Array;
}

async function webCrypto(direction: "encrypt" | "decrypt", request: Sealing): Promise<Uint8Array> {
  const name = ALGORITHM_NAMES[request.algorithm];
  const key = await crypto.subtle.importKey("raw", asBuffer(request.key), name, false, [direction]);
  const result = await crypto.subtle[direction](aesParams(request, name), key, asBuffer(request.data));
  return new Uint8Array(result);
}

function aesParams(request: Sealing, name: string): AesCtrParams | AesCbcParams | AesGcmParams {
  if (request.algorithm === "aes-ctr") return { name, counter: asBuffer(request.nonce), length: 128 };
  if (request.algorithm === "aes-cbc") return { name, iv: asBuffer(request.nonce) };
  const gcm: AesGcmParams = { name, iv: asBuffer(request.nonce) };
  if (request.aad) gcm.additionalData = asBuffer(request.aad);
  return gcm;
}

function cipher(request: Sealing) {
  const build = CIPHERS[request.algorithm];
  if (!build) throw new Error(`No cipher for ${request.algorithm}`);
  return build(request.key, request.nonce, request.aad);
}

const CIPHERS: Record<string, (key: Uint8Array, nonce: Uint8Array, aad: Uint8Array | undefined) => Cipher> = {
  "chacha20-poly1305": chacha20poly1305,
  "xchacha20-poly1305": xchacha20poly1305,
  "nacl-secretbox": (key, nonce) => xsalsa20poly1305(key, nonce),
};

interface Cipher {
  encrypt: (data: Uint8Array) => Uint8Array;
  decrypt: (data: Uint8Array) => Uint8Array;
}

const ALGORITHM_NAMES: Record<string, string> = {
  "aes-gcm": "AES-GCM",
  "aes-ctr": "AES-CTR",
  "aes-cbc": "AES-CBC",
};

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
