import { hashStream } from "./digest";

export type Source = "text" | "file";

export const SOURCE_OPTIONS = [{ value: "text", label: "Text" }, { value: "file", label: "File" }];

export async function hashBlob(
  blob: Blob,
  variant: string,
  seed: number,
  onProgress: (percent: number) => void,
  live: () => boolean,
): Promise<Uint8Array | null> {
  const hash = hashStream(variant, seed);
  const reader = blob.stream().getReader();
  let read = 0;
  let reported = -1;
  while (true) {
    if (!live()) {
      await reader.cancel();
      return null;
    }
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
    read += value.length;
    const percent = blob.size > 0 ? Math.min(100, Math.floor((read / blob.size) * 100)) : 100;
    if (percent !== reported) {
      reported = percent;
      onProgress(percent);
    }
  }
  return hash.digest();
}

export function byteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

const BYTE_UNITS = ["KiB", "MiB", "GiB", "TiB"];
