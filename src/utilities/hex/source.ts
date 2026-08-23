import { sniff } from "./signatures";

export interface Loaded {
  name: string;
  type: string;
  size: number;
  modified: number | null;
  bytes: Uint8Array;
  kind: string | null;
}

export const MAX_BYTES = 8 * 1024 * 1024;

export async function load(file: File): Promise<Loaded> {
  if (file.size > MAX_BYTES) throw new Error(`That file is larger than the ${MAX_BYTES / 1024 / 1024} MB this reads.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    name: file.name || "file.bin",
    type: file.type || "application/octet-stream",
    size: bytes.length,
    modified: file.lastModified || null,
    bytes,
    kind: sniff(bytes),
  };
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
