export const BITS_PER_ROW = 32;

export function chunk(indexes: number[], size: number): number[][] {
  const groups: number[][] = [];
  for (let start = 0; start < indexes.length; start += size) groups.push(indexes.slice(start, start + size));
  return groups;
}
