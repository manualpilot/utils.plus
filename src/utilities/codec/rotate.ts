type Run = { start: number; size: number; shift: number };

const UPPERCASE = 65;
const LOWERCASE = 97;
const DIGITS = 48;
const GRAPHICS = 33;
const GRAPHICS_SIZE = 94;

export function rot13(text: string, variant: string): string {
  switch (variant) {
    case "rot18":
      return rotate(text, [...letters(13), { start: DIGITS, size: 10, shift: 5 }]);
    case "rot47":
      return rotate(text, [{ start: GRAPHICS, size: GRAPHICS_SIZE, shift: 47 }]);
    default:
      return rotate(text, letters(13));
  }
}

export function caesar(text: string, variant: string, shift: number): string {
  switch (variant) {
    case "alphanumeric":
      return rotate(text, [...letters(shift), { start: DIGITS, size: 10, shift }]);
    case "ascii":
      return rotate(text, [{ start: GRAPHICS, size: GRAPHICS_SIZE, shift }]);
    default:
      return rotate(text, letters(shift));
  }
}

export function parseShift(key: string): number {
  const trimmed = key.trim();
  if (trimmed === "") throw new Error("The Caesar cipher needs a shift");
  if (!/^[+-]?\d+$/.test(trimmed)) throw new Error(`"${key}" is not a whole number of positions`);
  return parseInt(trimmed, 10);
}

function letters(shift: number): Run[] {
  return [{ start: UPPERCASE, size: 26, shift }, { start: LOWERCASE, size: 26, shift }];
}

function rotate(text: string, runs: Run[]): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    const run = runs.find((item) => code >= item.start && code < item.start + item.size);
    out += run === undefined ? char : String.fromCodePoint(run.start + mod(code - run.start + run.shift, run.size));
  }
  return out;
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}
