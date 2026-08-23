import { type ContainerInfo, readContainer } from "./container";
import { CONTAINER_LABELS } from "./embed";
import { type Exif, readExif } from "./exif";

export interface Loaded {
  name: string;
  type: string;
  size: number;
  modified: number | null;
  bytes: Uint8Array;
  element: HTMLImageElement;
  url: string;
  info: ContainerInfo;
  exif: Exif | null;
}

export const MAX_BYTES = 64 * 1024 * 1024;

export const ACCEPT = "image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,.heic,.tif,.tiff";

export async function load(file: File): Promise<Loaded> {
  if (file.size > MAX_BYTES) throw new Error(`That file is larger than the ${MAX_BYTES / 1024 / 1024} MB this reads.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return loadBytes(bytes, file.name, file.type, file.lastModified);
}

export async function loadBytes(
  bytes: Uint8Array,
  name: string,
  type: string,
  modified: number | null,
): Promise<Loaded> {
  const info = await readContainer(bytes);
  if (info.container === "unknown") throw new Error("Nothing here reads as a picture this page knows.");

  const mime = MIME_TYPES[info.container] ?? type;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  try {
    const element = await decode(url);
    return {
      name: name || `image.${info.container}`,
      type: mime,
      size: bytes.length,
      modified,
      bytes,
      element,
      url,
      info,
      exif: info.exif ? readExif(info.exif) : null,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error(`This browser will not decode ${CONTAINER_LABELS[info.container]}.`, { cause: error });
  }
}

function decode(url: string): Promise<HTMLImageElement> {
  const element = new Image();
  element.src = url;
  return element.decode().then(() => element);
}

export interface Pasted {
  bytes: Uint8Array;
  type: string;
  name: string;
}

export function readDataUri(text: string): Pasted | null {
  const trimmed = text.trim();
  const match = /^data:([^;,]*)((?:;[^;,]*)*),([\s\S]*)$/.exec(trimmed);
  if (!match) return null;
  const [, type, parameters, payload] = match;
  const base64 = /(?:^|;)base64(?:;|$)/i.test(parameters);

  try {
    const bytes = base64 ? fromBase64(payload) : new TextEncoder().encode(decodeURIComponent(payload));
    if (bytes.length === 0) return null;
    return { bytes, type: type || "application/octet-stream", name: nameFor(type) };
  } catch {
    return null;
  }
}

export function toDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read back."));
    reader.readAsDataURL(blob);
  });
}

export function stem(name: string): string {
  const at = name.lastIndexOf(".");
  return at > 0 ? name.slice(0, at) : name || "image";
}

function nameFor(type: string): string {
  const extension = type.split("/")[1]?.split("+")[0];
  return `pasted.${extension && /^[a-z0-9]+$/i.test(extension) ? extension : "bin"}`;
}

function fromBase64(payload: string): Uint8Array {
  const clean = payload.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const MIME_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  bmp: "image/bmp",
  tiff: "image/tiff",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};
