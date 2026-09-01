import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Index = string[];

export async function shard<Row>(
  directory: string,
  name: string,
  rows: Row[],
  per: number,
  keyOf: (row: Row) => bigint,
  encode: (run: Row[]) => unknown,
): Promise<Index> {
  const index: Index = [];
  for (let start = 0; start < rows.length; start += per) {
    const run = rows.slice(start, start + per);
    index.push(keyOf(run[0]).toString(16));
    await writeFile(join(directory, `${name}-${index.length - 1}.json`), JSON.stringify(encode(run)));
  }
  return index;
}

export async function shardCovering<Row>(
  directory: string,
  name: string,
  rows: Row[],
  per: number,
  startOf: (row: Row) => bigint,
  endOf: (row: Row) => bigint,
  encode: (run: Row[], from: bigint) => unknown,
): Promise<{ index: Index; written: number }> {
  const index: Index = [];
  let written = 0;
  let open: Row[] = [];

  for (let start = 0; start < rows.length; start += per) {
    const run = rows.slice(start, start + per);
    const from = startOf(run[0]);
    open = open.filter((row) => endOf(row) >= from);

    const held = [...open, ...run].sort((left, right) => compare(startOf(left), startOf(right)));
    index.push(from.toString(16));
    written += held.length;
    await writeFile(join(directory, `${name}-${index.length - 1}.json`), JSON.stringify(encode(held, from)));
    open = [...open, ...run];
  }
  return { index, written };
}

function compare(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
