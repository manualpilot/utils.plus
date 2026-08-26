import { randomBelow } from "../../common/random";

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string) {
    [this.a, this.b, this.c, this.d] = seedWords(seed);
    for (let i = 0; i < WARMUP; i++) this.next();
  }

  next(): number {
    const t = (this.a + this.b | 0) + this.d | 0;
    this.d = this.d + 1 | 0;
    this.a = this.b ^ this.b >>> 9;
    this.b = this.c + (this.c << 3) | 0;
    this.c = this.c << 21 | this.c >>> 11;
    this.c = this.c + t | 0;
    return (t >>> 0) / 4294967296;
  }

  below(bound: number): number {
    return bound <= 0 ? 0 : Math.floor(this.next() * bound);
  }

  between(min: number, max: number): number {
    return max <= min ? min : min + this.below(max - min + 1);
  }

  float(min: number, max: number, places: number): number {
    const scale = 10 ** places;
    return Math.round((min + this.next() * (max - min)) * scale) / scale;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.below(items.length)];
  }

  shuffled<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.below(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  digits(count: number): string {
    let out = "";
    for (let i = 0; i < count; i++) out += this.below(10);
    return out;
  }
}

export function rowRng(seed: string, index: number): Rng {
  return new Rng(`${seed} ${index}`);
}

export function freshSeed(): string {
  const out: string[] = [];
  for (let i = 0; i < SEED_LENGTH; i++) out.push(SEED_ALPHABET[randomBelow(SEED_ALPHABET.length)]);
  return out.join("");
}

const WARMUP = 12;

const SEED_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

const SEED_LENGTH = 8;

function seedWords(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ h1 >>> 18, 597399067);
  h2 = Math.imul(h4 ^ h2 >>> 22, 2869860233);
  h3 = Math.imul(h1 ^ h3 >>> 17, 951274213);
  h4 = Math.imul(h2 ^ h4 >>> 19, 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
