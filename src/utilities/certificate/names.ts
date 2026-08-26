import { CONTEXT, type Node, oidOf, textOf } from "./der";
import { ATTRIBUTES } from "./oids";

export interface Name {
  text: string;
  common: string;
}

export function readName(node: Node): Name {
  const groups: string[] = [];
  let common = "";
  let first = "";

  for (const rdn of node.items) {
    const pairs: string[] = [];
    for (const attribute of rdn.items) {
      const type = attribute.items[0];
      const value = attribute.items[1];
      if (!type || !value) continue;
      const oid = oidOf(type);
      const text = textOf(value);
      pairs.push(`${ATTRIBUTES[oid]?.short ?? oid}=${escapeValue(text)}`);
      if (oid === COMMON_NAME && !common) common = text;
      if (!first) first = text;
    }
    if (pairs.length > 0) groups.push(pairs.join("+"));
  }

  return { text: groups.join(", "), common: common || first };
}

const COMMON_NAME = "2.5.4.3";

function escapeValue(value: string): string {
  return value.replace(/([\\,+"<>;=])/g, "\\$1").replace(/^ | $/g, "\\ ").replace(/^#/, "\\#");
}

export function generalName(node: Node): string {
  if (node.cls !== CONTEXT) return textOf(node);
  switch (node.tag) {
    case 0:
      return `otherName:${node.items[0] ? oidOf(node.items[0]) : ""}`;
    case 1:
      return `email:${textOf(node)}`;
    case 2:
      return `DNS:${textOf(node)}`;
    case 4:
      return `dirName:${node.items[0] ? readName(node.items[0]).text : ""}`;
    case 6:
      return `URI:${textOf(node)}`;
    case 7:
      return `IP:${addressText(node.content)}`;
    case 8:
      return `RID:${oidOf(node)}`;
    default:
      return `unnamed:${node.tag}`;
  }
}

export function generalNames(node: Node): string[] {
  return node.items.map(generalName).filter((name) => name !== "");
}

export function addressText(bytes: Uint8Array): string {
  if (bytes.length === 4) return ipv4(bytes);
  if (bytes.length === 16) return ipv6(bytes);
  if (bytes.length === 8) return `${ipv4(bytes.subarray(0, 4))}/${ipv4(bytes.subarray(4))}`;
  if (bytes.length === 32) return `${ipv6(bytes.subarray(0, 16))}/${ipv6(bytes.subarray(16))}`;
  return "";
}

export function addressBytes(value: string): Uint8Array | null {
  return value.includes(":") ? sixteen(value) : four(value);
}

function four(value: string): Uint8Array | null {
  const octets = value.split(".");
  if (octets.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let index = 0; index < 4; index += 1) {
    if (!/^\d{1,3}$/.test(octets[index]) || Number(octets[index]) > 255) return null;
    bytes[index] = Number(octets[index]);
  }
  return bytes;
}

function sixteen(value: string): Uint8Array | null {
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const groups = halves.map((half) => half === "" ? [] : half.split(":"));
  if (groups.some((half) => half.some((group) => !/^[0-9a-f]{1,4}$/i.test(group)))) return null;

  const written = groups.reduce((count, half) => count + half.length, 0);
  if (halves.length === 2 ? written >= 8 : written !== 8) return null;
  const all = halves.length === 2
    ? [...groups[0], ...Array<string>(8 - written).fill("0"), ...groups[1]]
    : groups[0];

  const bytes = new Uint8Array(16);
  all.forEach((group, index) => {
    const pair = parseInt(group, 16);
    bytes[index * 2] = pair >> 8;
    bytes[index * 2 + 1] = pair & 0xff;
  });
  return bytes;
}

function ipv4(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String(byte)).join(".");
}

function ipv6(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let index = 0; index < 16; index += 2) groups.push(((bytes[index] << 8) | bytes[index + 1]).toString(16));

  let bestStart = -1;
  let bestLength = 0;
  let start = -1;
  for (let index = 0; index <= groups.length; index += 1) {
    if (index < groups.length && groups[index] === "0") {
      if (start < 0) start = index;
      continue;
    }
    if (start >= 0 && index - start > bestLength) {
      bestStart = start;
      bestLength = index - start;
    }
    start = -1;
  }

  if (bestLength < 2) return groups.join(":");
  return `${groups.slice(0, bestStart).join(":")}::${groups.slice(bestStart + bestLength).join(":")}`;
}
