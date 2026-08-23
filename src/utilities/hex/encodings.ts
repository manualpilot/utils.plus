export interface TextEncoding {
  value: string;
  label: string;
  glyph(byte: number): string | null;
  byteFor(character: string): number | null;
}

export const TEXT_ENCODINGS: TextEncoding[] = [
  {
    value: "ascii",
    label: "ASCII",
    glyph: (byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : null),
    byteFor: (character) => {
      const code = character.codePointAt(0) ?? -1;
      return code >= 0x20 && code <= 0x7e ? code : null;
    },
  },
  {
    value: "latin1",
    label: "Latin-1",
    glyph: (byte) => (printableLatin1(byte) ? String.fromCharCode(byte) : null),
    byteFor: (character) => {
      const code = character.codePointAt(0) ?? -1;
      return printableLatin1(code) ? code : null;
    },
  },
  {
    value: "cp437",
    label: "CP437",
    glyph: (byte) => (byte === 0 ? null : CP437[byte]),
    byteFor: (character) => {
      const at = CP437.indexOf(character, 1);
      return at > 0 ? at : null;
    },
  },
];

export function pickEncoding(value: string | undefined): TextEncoding {
  return TEXT_ENCODINGS.find((encoding) => encoding.value === value) ?? TEXT_ENCODINGS[0];
}

export function textLine(bytes: Uint8Array, encoding: TextEncoding): string {
  let line = "";
  for (const byte of bytes) line += encoding.glyph(byte) ?? ".";
  return line;
}

export function encodeText(text: string, encoding: TextEncoding): Uint8Array | { missing: string } {
  const characters = [...text];
  const bytes = new Uint8Array(characters.length);
  for (const [at, character] of characters.entries()) {
    const byte = encoding.byteFor(character);
    if (byte === null) return { missing: character };
    bytes[at] = byte;
  }
  return bytes;
}

function printableLatin1(code: number): boolean {
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
}

const CP437 = " ☺☻♥♦♣♠•◘○◙♂♀♪♫☼"
  + "►◄↕‼¶§▬↨↑↓→←∟↔▲▼"
  + " !\"#$%&'()*+,-./"
  + "0123456789:;<=>?"
  + "@ABCDEFGHIJKLMNO"
  + "PQRSTUVWXYZ[\\]^_"
  + "`abcdefghijklmno"
  + "pqrstuvwxyz{|}~⌂"
  + "ÇüéâäàåçêëèïîìÄÅ"
  + "ÉæÆôöòûùÿÖÜ¢£¥₧ƒ"
  + "áíóúñÑªº¿⌐¬½¼¡«»"
  + "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐"
  + "└┴┬├─┼╞╟╚╔╩╦╠═╬╧"
  + "╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀"
  + "αßΓπΣσµτΦΘΩδ∞φε∩"
  + "≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
