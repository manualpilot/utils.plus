export function randomBelow(bound: number): number {
  const limit = Math.floor(0x100000000 / bound) * bound;
  let value: number;
  do {
    value = randomWord();
  } while (value >= limit);
  return value % bound;
}

export function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

const ENTROPY_POOL = new Uint32Array(512);
let poolNext = ENTROPY_POOL.length;

function randomWord(): number {
  if (poolNext >= ENTROPY_POOL.length) {
    crypto.getRandomValues(ENTROPY_POOL);
    poolNext = 0;
  }
  return ENTROPY_POOL[poolNext++];
}
