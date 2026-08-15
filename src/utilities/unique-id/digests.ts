export function md5(bytes: Uint8Array): Uint8Array {
  function F(x: number, y: number, z: number) {
    return (x & y) | (~x & z);
  }
  function G(x: number, y: number, z: number) {
    return (x & z) | (y & ~z);
  }
  function H(x: number, y: number, z: number) {
    return x ^ y ^ z;
  }
  function I(x: number, y: number, z: number) {
    return y ^ (x | ~z);
  }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + F(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + G(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + H(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = (a + I(b, c, d) + x + ac) >>> 0;
    return ((a << s) | (a >>> (32 - s))) + b >>> 0;
  }

  const len = bytes.length * 8;
  const x: number[] = new Array((((len + 64) >>> 9) << 4) + 16).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    x[i >> 2] |= (bytes[i] & 0xff) << ((i % 4) * 8);
  }
  x[len >> 5] |= 0x80 << (len % 32);
  x[x.length - 2] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    a = FF(a, b, c, d, x[i + 0], 7, -680876936);
    d = FF(d, a, b, c, x[i + 1], 12, -389564586);
    c = FF(c, d, a, b, x[i + 2], 17, 606105819);
    b = FF(b, c, d, a, x[i + 3], 22, -1044525330);
    a = FF(a, b, c, d, x[i + 4], 7, -176418897);
    d = FF(d, a, b, c, x[i + 5], 12, 1200080426);
    c = FF(c, d, a, b, x[i + 6], 17, -1473231341);
    b = FF(b, c, d, a, x[i + 7], 22, -45705983);
    a = FF(a, b, c, d, x[i + 8], 7, 1770035416);
    d = FF(d, a, b, c, x[i + 9], 12, -1958414417);
    c = FF(c, d, a, b, x[i + 10], 17, -42063);
    b = FF(b, c, d, a, x[i + 11], 22, -1990404162);
    a = FF(a, b, c, d, x[i + 12], 7, 1804603682);
    d = FF(d, a, b, c, x[i + 13], 12, -40341101);
    c = FF(c, d, a, b, x[i + 14], 17, -1502002290);
    b = FF(b, c, d, a, x[i + 15], 22, 1236535329);

    a = GG(a, b, c, d, x[i + 1], 5, -165796510);
    d = GG(d, a, b, c, x[i + 6], 9, -1069501632);
    c = GG(c, d, a, b, x[i + 11], 14, 643717713);
    b = GG(b, c, d, a, x[i + 0], 20, -373897302);
    a = GG(a, b, c, d, x[i + 5], 5, -701558691);
    d = GG(d, a, b, c, x[i + 10], 9, 38016083);
    c = GG(c, d, a, b, x[i + 15], 14, -660478335);
    b = GG(b, c, d, a, x[i + 4], 20, -405537848);
    a = GG(a, b, c, d, x[i + 9], 5, 568446438);
    d = GG(d, a, b, c, x[i + 14], 9, -1019803690);
    c = GG(c, d, a, b, x[i + 3], 14, -187363961);
    b = GG(b, c, d, a, x[i + 8], 20, 1163531501);
    a = GG(a, b, c, d, x[i + 13], 5, -1444681467);
    d = GG(d, a, b, c, x[i + 2], 9, -51403784);
    c = GG(c, d, a, b, x[i + 7], 14, 1735328473);
    b = GG(b, c, d, a, x[i + 12], 20, -1926607734);

    a = HH(a, b, c, d, x[i + 5], 4, -378558);
    d = HH(d, a, b, c, x[i + 8], 11, -2022574463);
    c = HH(c, d, a, b, x[i + 11], 16, 1839030562);
    b = HH(b, c, d, a, x[i + 14], 23, -35309556);
    a = HH(a, b, c, d, x[i + 1], 4, -1530992060);
    d = HH(d, a, b, c, x[i + 4], 11, 1272893353);
    c = HH(c, d, a, b, x[i + 7], 16, -155497632);
    b = HH(b, c, d, a, x[i + 10], 23, -1094730640);
    a = HH(a, b, c, d, x[i + 13], 4, 681279174);
    d = HH(d, a, b, c, x[i + 0], 11, -358537222);
    c = HH(c, d, a, b, x[i + 3], 16, -722521979);
    b = HH(b, c, d, a, x[i + 6], 23, 76029189);
    a = HH(a, b, c, d, x[i + 9], 4, -640364487);
    d = HH(d, a, b, c, x[i + 12], 11, -421815835);
    c = HH(c, d, a, b, x[i + 15], 16, 530742520);
    b = HH(b, c, d, a, x[i + 2], 23, -995338651);

    a = II(a, b, c, d, x[i + 0], 6, -198630844);
    d = II(d, a, b, c, x[i + 7], 10, 1126891415);
    c = II(c, d, a, b, x[i + 14], 15, -1416354905);
    b = II(b, c, d, a, x[i + 5], 21, -57434055);
    a = II(a, b, c, d, x[i + 12], 6, 1700485571);
    d = II(d, a, b, c, x[i + 3], 10, -1894986606);
    c = II(c, d, a, b, x[i + 10], 15, -1051523);
    b = II(b, c, d, a, x[i + 1], 21, -2054922799);
    a = II(a, b, c, d, x[i + 8], 6, 1873313359);
    d = II(d, a, b, c, x[i + 15], 10, -30611744);
    c = II(c, d, a, b, x[i + 6], 15, -1560198380);
    b = II(b, c, d, a, x[i + 13], 21, 1309151649);
    a = II(a, b, c, d, x[i + 4], 6, -145523070);
    d = II(d, a, b, c, x[i + 11], 10, -1120210379);
    c = II(c, d, a, b, x[i + 2], 15, 718787259);
    b = II(b, c, d, a, x[i + 9], 21, -343485551);

    a = (a + olda) >>> 0;
    b = (b + oldb) >>> 0;
    c = (c + oldc) >>> 0;
    d = (d + oldd) >>> 0;
  }

  const res = new Uint8Array(16);
  res[0] = a & 0xff;
  res[1] = (a >>> 8) & 0xff;
  res[2] = (a >>> 16) & 0xff;
  res[3] = (a >>> 24) & 0xff;
  res[4] = b & 0xff;
  res[5] = (b >>> 8) & 0xff;
  res[6] = (b >>> 16) & 0xff;
  res[7] = (b >>> 24) & 0xff;
  res[8] = c & 0xff;
  res[9] = (c >>> 8) & 0xff;
  res[10] = (c >>> 16) & 0xff;
  res[11] = (c >>> 24) & 0xff;
  res[12] = d & 0xff;
  res[13] = (d >>> 8) & 0xff;
  res[14] = (d >>> 16) & 0xff;
  res[15] = (d >>> 24) & 0xff;
  return res;
}

export function sha1(bytes: Uint8Array): Uint8Array {
  function rotl(n: number, s: number) {
    return (n << s) | (n >>> (32 - s));
  }
  const len = bytes.length * 8;
  const x: number[] = new Array((((len + 64) >>> 9) << 4) + 16).fill(0);
  for (let i = 0; i < bytes.length; i++) {
    x[i >> 2] |= (bytes[i] & 0xff) << (24 - (i % 4) * 8);
  }
  x[len >> 5] |= 0x80 << (24 - (len % 32));
  x[x.length - 1] = len;

  let w = new Array(80);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  let e = -1009589776;

  for (let i = 0; i < x.length; i += 16) {
    let olda = a, oldb = b, oldc = c, oldd = d, olde = e;
    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = x[i + j];
      else w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);

      let t = (rotl(a, 5) + e + w[j] + (
        (j < 20)
          ? 1518500249 + ((b & c) | (~b & d))
          : (j < 40)
          ? 1859775393 + (b ^ c ^ d)
          : (j < 60)
          ? -1894007588 + ((b & c) | (b & d) | (c & d))
          : -899497514 + (b ^ c ^ d)
      )) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    a = (a + olda) >>> 0;
    b = (b + oldb) >>> 0;
    c = (c + oldc) >>> 0;
    d = (d + oldd) >>> 0;
    e = (e + olde) >>> 0;
  }

  const res = new Uint8Array(20);
  res[0] = (a >>> 24) & 0xff;
  res[1] = (a >>> 16) & 0xff;
  res[2] = (a >>> 8) & 0xff;
  res[3] = a & 0xff;
  res[4] = (b >>> 24) & 0xff;
  res[5] = (b >>> 16) & 0xff;
  res[6] = (b >>> 8) & 0xff;
  res[7] = b & 0xff;
  res[8] = (c >>> 24) & 0xff;
  res[9] = (c >>> 16) & 0xff;
  res[10] = (c >>> 8) & 0xff;
  res[11] = c & 0xff;
  res[12] = (d >>> 24) & 0xff;
  res[13] = (d >>> 16) & 0xff;
  res[14] = (d >>> 8) & 0xff;
  res[15] = d & 0xff;
  res[16] = (e >>> 24) & 0xff;
  res[17] = (e >>> 16) & 0xff;
  res[18] = (e >>> 8) & 0xff;
  res[19] = e & 0xff;
  return res;
}

const KECCAK_MASK = 0xffffffffffffffffn;
const KECCAK_ROUNDS = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

export function sha3(bytes: Uint8Array): Uint8Array {
  const rate = 72;
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x06;
  padded[padded.length - 1] |= 0x80;

  const lanes: bigint[] = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let value = 0n;
      for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(padded[offset + lane * 8 + i]);
      lanes[lane] ^= value;
    }
    keccakF1600(lanes);
  }

  const digest = new Uint8Array(64);
  for (let lane = 0; lane < 8; lane++) {
    let value = lanes[lane];
    for (let i = 0; i < 8; i++) {
      digest[lane * 8 + i] = Number(value & 0xffn);
      value >>= 8n;
    }
  }
  return digest;
}

function keccakF1600(lanes: bigint[]): void {
  for (const roundConstant of KECCAK_ROUNDS) {
    const parity: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      parity[x] = lanes[x] ^ lanes[x + 5] ^ lanes[x + 10] ^ lanes[x + 15] ^ lanes[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const mix = parity[(x + 4) % 5] ^ rotl64(parity[(x + 1) % 5], 1n);
      for (let y = 0; y < 25; y += 5) lanes[x + y] ^= mix;
    }

    let x = 1;
    let y = 0;
    let carried = lanes[1];
    for (let step = 0; step < 24; step++) {
      const next = (2 * x + 3 * y) % 5;
      const index = y + 5 * next;
      const held = lanes[index];
      lanes[index] = rotl64(carried, BigInt((((step + 1) * (step + 2)) / 2) % 64));
      carried = held;
      x = y;
      y = next;
    }

    for (let row = 0; row < 25; row += 5) {
      const held = lanes.slice(row, row + 5);
      for (let i = 0; i < 5; i++) lanes[row + i] = held[i] ^ (~held[(i + 1) % 5] & KECCAK_MASK & held[(i + 2) % 5]);
    }

    lanes[0] ^= roundConstant;
  }
}

function rotl64(value: bigint, shift: bigint): bigint {
  return ((value << shift) | (value >> (64n - shift))) & KECCAK_MASK;
}
