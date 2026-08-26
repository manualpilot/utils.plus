export interface Reading {
  text: string;
  error: string;
}

export function readPoints(value: string): Reading {
  const codes: number[] = [];
  for (const token of value.split(SEPARATORS)) {
    if (token === "") continue;
    const code = readPoint(token);
    if (code === undefined) return { text: "", error: `${token} is not a code point` };
    if (code > 0x10FFFF) return { text: "", error: `${token} is past U+10FFFF, which is the last one there is` };
    codes.push(code);
  }
  return { text: String.fromCodePoint(...codes), error: "" };
}

export function writePoints(text: string): string {
  return [...text].map((character) =>
    `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`
  )
    .join(" ");
}

const SEPARATORS = /[\s,]+/;

function readPoint(token: string): number | undefined {
  const decimal = /^&#(\d+);?$/.exec(token);
  if (decimal) return Number(decimal[1]);

  const hex = /^(?:u\+|0x|\\u\{|\\u|\\x|&#x)?([0-9a-f]{1,6})[};]*$/i.exec(token);
  return hex ? Number.parseInt(hex[1], 16) : undefined;
}
