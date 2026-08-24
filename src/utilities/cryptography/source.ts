import { byteSize } from "../../common/byte-size";

export const MAX_BYTES = 16 * 1024 * 1024;

export async function readFileBytes(file: File): Promise<Uint8Array> {
  if (file.size > MAX_BYTES) throw new Error(`That file is larger than the ${byteSize(MAX_BYTES)} this reads`);
  return new Uint8Array(await file.arrayBuffer());
}

export interface Loaded {
  name: string;
  size: number;
  bytes: Uint8Array;
}
