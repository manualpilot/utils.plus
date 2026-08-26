import type { Character } from "./characters";

export interface Finding {
  kind: string;
  label: string;
  detail: string;
  codes: number[];
  serious: boolean;
}

export function findings(characters: Character[], text: string): Finding[] {
  const found: Finding[] = [];
  const of = (matches: (character: Character) => boolean) => codesOf(characters, matches);

  const bidi = of(({ code }) => BIDI.has(code));
  if (bidi.length > 0) {
    const open = openBidi(characters);
    found.push({
      kind: "bidi",
      label: open > 0 ? "Bidirectional controls left open" : "Bidirectional controls",
      detail: open > 0
        ? `${open} ${open === 1 ? "override or isolate is" : "overrides or isolates are"} never closed, so what `
          + "follows is drawn in an order the characters are not stored in — the whole of the Trojan Source trick."
        : "The order this text is drawn in is not the order it is stored in.",
      codes: bidi,
      serious: open > 0,
    });
  }

  const homoglyphs = of(({ code, looksLike }) => looksLike !== "" && code > 0x7F);
  if (homoglyphs.length > 0) {
    found.push({
      kind: "homoglyph",
      label: "Characters that can be taken for ASCII",
      detail: "Unicode's own table of confusables says each of these is read as an ASCII character it is not.",
      codes: homoglyphs,
      serious: true,
    });
  }

  const invisible = of(isInvisibleFormat);
  if (invisible.length > 0) {
    found.push({
      kind: "invisible",
      label: "Characters that draw nothing",
      detail: "These take no space on screen and are still there in the bytes, the clipboard and every comparison.",
      codes: invisible,
      serious: true,
    });
  }

  const controls = of(({ category, code }) => category === "Cc" && !LINE.has(code));
  if (controls.length > 0) {
    found.push({
      kind: "control",
      label: "Control characters",
      detail: "A C0 or C1 control, which is a byte a terminal, a log or a CSV file acts on rather than shows.",
      codes: controls,
      serious: true,
    });
  }

  const scripts = [...new Set(characters.map(({ script }) => script))].filter((script) => !SHARED.has(script));
  if (scripts.length > 1) {
    found.push({
      kind: "mixed",
      label: `Written in ${scripts.length} scripts`,
      detail: `${scripts.join(", ")}. A name, a domain or an identifier in more than one script is worth a look.`,
      codes: [],
      serious: false,
    });
  }

  const unusual = of(({ category }) => category === "Co" || category === "Cn" || category === "Cs");
  if (unusual.length > 0) {
    found.push({
      kind: "unusual",
      label: "Private use, unassigned or surrogate code points",
      detail: "Nothing outside whatever wrote this agrees on what these mean, and some of them cannot be encoded.",
      codes: unusual,
      serious: false,
    });
  }

  if (text !== "" && text !== text.normalize("NFC")) {
    found.push({
      kind: "normalisation",
      label: "Not in NFC",
      detail: "Two texts that read the same compare as different until both are normalised.",
      codes: [],
      serious: false,
    });
  }

  return found;
}

const BIDI = new Set([0x061C, 0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069]);

const OPENS = new Set([0x202A, 0x202B, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068]);
const CLOSES = new Set([0x202C, 0x2069]);

function openBidi(characters: Character[]): number {
  let open = 0;
  for (const { code } of characters) {
    if (OPENS.has(code)) open++;
    else if (CLOSES.has(code) && open > 0) open--;
  }
  return open;
}

function isInvisibleFormat({ category, code }: Character): boolean {
  if (BIDI.has(code)) return false;
  if (category === "Cf" || category === "Zl" || category === "Zp") return true;
  return category === "Zs" && code !== 0x20;
}

const LINE = new Set([0x09, 0x0A, 0x0D]);

const SHARED = new Set(["Common", "Inherited", "Unknown"]);

function codesOf(characters: Character[], matches: (character: Character) => boolean): number[] {
  return [...new Set(characters.filter(matches).map(({ code }) => code))];
}
