import { hsalsa, xsalsa20poly1305 } from "@noble/ciphers/salsa.js";
import { x25519 } from "@noble/curves/ed25519.js";

export function boxCipher(secretKey: Uint8Array, peerPublicKey: Uint8Array, nonce: Uint8Array) {
  return xsalsa20poly1305(boxKey(secretKey, peerPublicKey), nonce);
}

export function boxKeypair(): { secretKey: Uint8Array; publicKey: Uint8Array } {
  return x25519.keygen();
}

export function boxPublicKey(secretKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(secretKey);
}

function boxKey(secretKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(secretKey, peerPublicKey);
  const derived = new Uint32Array(8);
  hsalsa(SIGMA, words(shared), ZERO_NONCE, derived);
  const key = new Uint8Array(32);
  const view = new DataView(key.buffer);
  for (let i = 0; i < derived.length; i++) view.setUint32(i * 4, derived[i], true);
  return key;
}

const SIGMA = new Uint32Array([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);

const ZERO_NONCE = new Uint32Array(4);

function words(bytes: Uint8Array): Uint32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Uint32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getUint32(i * 4, true);
  return out;
}
