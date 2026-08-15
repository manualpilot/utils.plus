import { splitWords } from "./text";

const NATO_WORD_BREAK = "Break";

export function encodeNato(text: string, variant: string): string {
  const words = NATO_WORDS[variant] ?? NATO_WORDS.standard;
  return splitWords(text)
    .map((word) => Array.from(word, (char) => words[char.toUpperCase()] ?? char).join(" "))
    .join(` ${NATO_WORD_BREAK} `);
}

export function decodeNato(text: string): string {
  const words = text
    .split(new RegExp(`\\s*\\b${NATO_WORD_BREAK}\\b\\s*|\\n+`, "i"))
    .map((group) =>
      splitWords(group)
        .map((token) => {
          const char = NATO_LOOKUP.get(token.toLowerCase());
          if (char !== undefined) return char;
          if (Array.from(token).length === 1) return token.toUpperCase();
          throw new Error(`"${token}" is not a NATO phonetic word`);
        })
        .join("")
    );
  return words.filter((word) => word !== "").join(" ");
}

const NATO_LETTER_WORDS =
  "Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec "
  + "Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu";
const NATO_DIGIT_WORDS = "Zero One Two Three Four Five Six Seven Eight Nine";

const NATO_WORDS: Record<string, Record<string, string>> = {
  standard: natoWords(),
  alternate: natoWords({ A: "Alpha", J: "Juliet", X: "X-ray" }),
  aviation: natoWords({ "3": "Tree", "4": "Fower", "5": "Fife", "9": "Niner" }),
};

function natoWords(overrides: Record<string, string> = {}): Record<string, string> {
  const table: Record<string, string> = {};
  NATO_LETTER_WORDS.split(" ").forEach((word, index) => {
    table[String.fromCharCode("A".charCodeAt(0) + index)] = word;
  });
  NATO_DIGIT_WORDS.split(" ").forEach((word, index) => {
    table[String(index)] = word;
  });
  return { ...table, ...overrides };
}

const NATO_LOOKUP = natoLookup();

function natoLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const table of Object.values(NATO_WORDS)) {
    for (const [char, word] of Object.entries(table)) {
      lookup.set(word.toLowerCase(), char);
    }
  }
  for (const [word, char] of Object.entries({ wun: "1", too: "2", ait: "8" })) {
    lookup.set(word, char);
  }
  return lookup;
}
