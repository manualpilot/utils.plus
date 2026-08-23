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
