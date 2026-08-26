export interface Block {
  label: string;
  headers: Record<string, string>;
  bytes: Uint8Array<ArrayBuffer> | null;
  text: string;
}

const BLOCK = /-----BEGIN ([A-Za-z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;

export function pemBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const match of text.matchAll(BLOCK)) {
    const { headers, body } = splitHeaders(match[2]);
    blocks.push({ label: match[1].toUpperCase(), headers, bytes: decodeBase64(body), text: match[0] });
  }
  return blocks;
}

function splitHeaders(body: string): { headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};
  const lines = body.replace(/^\r?\n/, "").split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const header = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(lines[index]);
    if (!header) break;
    headers[header[1]] = header[2].trim();
    index += 1;
  }
  if (index === 0 || lines[index]?.trim() !== "") return { headers: {}, body };
  return { headers, body: lines.slice(index + 1).join("\n") };
}

export function decodeBase64(text: string): Uint8Array<ArrayBuffer> | null {
  const packed = text.replace(/[\s\r\n]+/g, "");
  if (packed === "" || !/^[A-Za-z0-9+/]*={0,2}$/.test(packed)) return null;
  try {
    const binary = atob(packed);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function armour(bytes: Uint8Array, label: string): string {
  const body = toBase64(bytes).replace(/(.{64})/g, "$1\n").replace(/\n$/, "");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

export function hex(bytes: Uint8Array, separator = ""): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(separator);
}

export function fingerprintHex(bytes: Uint8Array): string {
  return hex(bytes, ":").toUpperCase();
}

export function minimal(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  return bytes.subarray(start);
}

export function bitLength(bytes: Uint8Array): number {
  const trimmed = minimal(bytes);
  if (trimmed.length === 0 || trimmed[0] === 0) return 0;
  return (trimmed.length - 1) * 8 + (32 - Math.clz32(trimmed[0]));
}
