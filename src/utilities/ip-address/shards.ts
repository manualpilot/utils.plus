import { useEffect, useState } from "react";

export function shardFor(index: string[], key: bigint): number {
  let low = 0;
  let high = index.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (BigInt(`0x${index[middle]}`) <= key) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

export function shardStart(index: string[], shard: number): bigint {
  return BigInt(`0x${index[shard]}`);
}

export function load<T>(url: string | undefined): Promise<T | undefined> {
  if (!url) return Promise.resolve(undefined);

  const held = files.get(url);
  if (held) return held as Promise<T | undefined>;

  const asked = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json() as Promise<T>;
  });
  const file = asked.catch(() => {
    files.delete(url);
    return undefined;
  });
  files.set(url, file);
  return file;
}

const files = new Map<string, Promise<unknown>>();

export interface Reading<T> {
  answer: T | undefined;
  reading: boolean;
}

export function useShard<T>(question: string | undefined, read: (asked: string) => Promise<T | undefined>): Reading<T> {
  const [reading, setReading] = useState<Reading<T>>({ answer: undefined, reading: question !== undefined });

  useEffect(() => {
    if (question === undefined) {
      setReading({ answer: undefined, reading: false });
      return;
    }

    let live = true;
    setReading({ answer: undefined, reading: true });
    read(question).then(
      (answer) => live && setReading({ answer, reading: false }),
      () => live && setReading({ answer: undefined, reading: false }),
    );
    return () => {
      live = false;
    };
  }, [question]);

  return reading;
}
