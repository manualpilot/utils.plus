export type Hosted =
  | "Roboto"
  | "Carlito"
  | "Caladea"
  | "Liberation Sans"
  | "Liberation Serif"
  | "Liberation Mono"
  | "TeX Gyre Adventor";

export const DEFAULT_FAMILY = "Roboto" satisfies Hosted;

export const DEFAULT_SIZE = 22;

export const PACKAGED = {
  "Calibri": "Carlito",
  "Cambria": "Caladea",
  "Times New Roman": "Liberation Serif",
  "Arial": "Liberation Sans",
  "Courier New": "Liberation Mono",
  "Century Gothic": "TeX Gyre Adventor",
} as const satisfies Record<string, Exclude<Hosted, "Roboto">>;

export type PackagedFamily = keyof typeof PACKAGED;

const SAME_WIDTHS: readonly PackagedFamily[] = ["Calibri", "Cambria", "Times New Roman", "Arial", "Courier New"];

const CLOSEST: Record<Hosted, readonly string[]> = {
  "Roboto": ["Roboto"],
  "Carlito": ["Calibri", "Carlito", "Candara", "Corbel"],
  "Caladea": [
    "Cambria",
    "Caladea",
    "Georgia",
    "Constantia",
    "Book Antiqua",
    "Palatino",
    "Palatino Linotype",
    "Bookman",
    "Bookman Old Style",
    "Century",
    "Century Schoolbook",
    "New Century Schoolbook",
    "Charter",
    "Bitstream Charter",
    "Sitka",
    "Aptos Serif",
  ],
  "Liberation Sans": [
    "Arial",
    "Arial MT",
    "Arial Nova",
    "Arimo",
    "Liberation Sans",
    "Helvetica",
    "Helvetica Neue",
    "Nimbus Sans",
    "Nimbus Sans L",
    "FreeSans",
    "Microsoft Sans Serif",
    "MS Sans Serif",
    "Univers",
  ],
  "Liberation Serif": [
    "Times New Roman",
    "Times",
    "Times Roman",
    "Tinos",
    "Liberation Serif",
    "Nimbus Roman",
    "Nimbus Roman No9 L",
    "FreeSerif",
    "TeX Gyre Termes",
    "Garamond",
    "EB Garamond",
    "Adobe Garamond Pro",
    "Minion Pro",
    "Baskerville",
    "Baskerville Old Face",
    "Sabon",
    "Perpetua",
    "Goudy Old Style",
    "Calisto MT",
  ],
  "Liberation Mono": [
    "Courier New",
    "Courier",
    "Cousine",
    "Liberation Mono",
    "Nimbus Mono",
    "Nimbus Mono L",
    "Consolas",
    "Lucida Console",
    "Lucida Sans Typewriter",
    "Menlo",
    "Monaco",
    "Andale Mono",
    "Cascadia Code",
    "Cascadia Mono",
    "SF Mono",
    "Aptos Mono",
    "OCR A Extended",
  ],
  "TeX Gyre Adventor": [
    "Century Gothic",
    "TeX Gyre Adventor",
    "Avant Garde",
    "ITC Avant Garde Gothic",
    "URW Gothic",
    "URW Gothic L",
    "Futura",
    "Futura PT",
    "Tw Cen MT",
    "Twentieth Century",
    "Avenir",
    "Avenir Next",
    "Gotham",
    "Montserrat",
    "Poppins",
  ],
};

const LEFT_ALONE = [
  "Symbol",
  "Wingdings",
  "Wingdings 2",
  "Wingdings 3",
  "Webdings",
  "Marlett",
  "MT Extra",
  "Bookshelf Symbol 7",
  "MS Reference Specialty",
  "Zapf Dingbats",
  "ITC Zapf Dingbats",
  "Arial Unicode MS",
  "MS Gothic",
  "MS PGothic",
  "MS UI Gothic",
  "MS Mincho",
  "MS PMincho",
  "Meiryo",
  "Meiryo UI",
  "Yu Gothic",
  "Yu Gothic UI",
  "Yu Mincho",
  "SimSun",
  "NSimSun",
  "SimHei",
  "SimKai",
  "KaiTi",
  "FangSong",
  "DengXian",
  "Microsoft YaHei",
  "Microsoft YaHei UI",
  "Microsoft JhengHei",
  "Microsoft JhengHei UI",
  "MingLiU",
  "PMingLiU",
  "MingLiU_HKSCS",
  "Malgun Gothic",
  "Batang",
  "BatangChe",
  "Gulim",
  "GulimChe",
  "Dotum",
  "DotumChe",
  "Gungsuh",
  "GungsuhChe",
  "Mangal",
  "Nirmala UI",
  "Kokila",
  "Aparajita",
  "Utsaah",
  "Latha",
  "Vijaya",
  "Vrinda",
  "Shruti",
  "Raavi",
  "Gautami",
  "Tunga",
  "Kartika",
  "Iskoola Pota",
  "Leelawadee",
  "Leelawadee UI",
  "Angsana New",
  "AngsanaUPC",
  "Cordia New",
  "CordiaUPC",
  "Browallia New",
  "DokChampa",
  "Khmer UI",
  "Lao UI",
  "Ebrima",
  "Gadugi",
  "Nyala",
  "Sylfaen",
  "Estrangelo Edessa",
  "Euphemia",
  "Plantagenet Cherokee",
  "Mongolian Baiti",
  "Microsoft Himalaya",
  "Microsoft Yi Baiti",
  "Microsoft New Tai Lue",
  "Microsoft Tai Le",
  "Microsoft PhagsPa",
  "Myanmar Text",
  "Javanese Text",
  "MV Boli",
  "Traditional Arabic",
  "Simplified Arabic",
  "Arabic Typesetting",
  "Sakkal Majalla",
  "Andalus",
  "Aldhabi",
  "Urdu Typesetting",
  "David",
  "Miriam",
  "Narkisim",
  "FrankRuehl",
  "Levenim MT",
  "Gisha",
];

const NOT_LETTERS = words([
  "symbols?",
  "dingbats?",
  "wingdings",
  "webdings",
  "emoji",
  "math",
  "icons?",
  "awesome",
  "cjk",
  "mincho",
]);
const OTHER_SCRIPTS = words(["arabic", "hebrew", "devanagari", "bengali", "tamil", "thai", "khmer", "ethiopic"]);
const MONOSPACED = words(["mono", "monospace", "monospaced", "code", "console", "courier", "typewriter"]);
const SERIF = words(["serif"]);
const SANS = words(["sans"]);

const STYLE_WORDS = new RegExp(`\\s+(${
  [
    "thin",
    "hairline",
    "extralight",
    "ultralight",
    "light",
    "semilight",
    "book",
    "regular",
    "normal",
    "medium",
    "semibold",
    "demibold",
    "demi",
    "bold",
    "extrabold",
    "ultrabold",
    "heavy",
    "black",
    "display",
    "text",
  ].join("|")
})$`);

const BY_NAME = new Map<string, Hosted>(
  (Object.entries(CLOSEST) as [Hosted, readonly string[]][]).flatMap(([hosted, names]) =>
    names.map((name) => [normalise(name), hosted] as const)
  ),
);

const UNTOUCHED = new Set(LEFT_ALONE.map(normalise));

const METRIC = new Set(SAME_WIDTHS.map(normalise));

const PACKAGED_NAMES = new Set(Object.keys(PACKAGED).map(normalise));

export function standIn(family: string): Hosted | null {
  if (!/^[ -~]+$/.test(family)) return null;
  let name = normalise(family);
  if (UNTOUCHED.has(name) || NOT_LETTERS.test(name) || OTHER_SCRIPTS.test(name)) return null;

  for (;;) {
    const hosted = BY_NAME.get(name);
    if (hosted) return hosted;
    const bare = name.replace(STYLE_WORDS, "");
    if (bare === name || bare === "") break;
    name = bare;
  }

  if (MONOSPACED.test(name)) return "Liberation Mono";
  if (SERIF.test(name) && !SANS.test(name)) return "Liberation Serif";
  return DEFAULT_FAMILY;
}

export interface Reading {
  family: string;
  face: Hosted | null;
  kind: "own" | "metric" | "closest" | "untouched";
}

export function reading(family: string): Reading {
  const face = standIn(family);
  if (face === null) return { family, face, kind: "untouched" };
  if (normalise(face) === normalise(family)) return { family, face, kind: "own" };
  return { family, face, kind: METRIC.has(normalise(family)) ? "metric" : "closest" };
}

export function noteOf({ face, kind }: Reading): string {
  if (kind === "own") return "Served here as it is";
  if (kind === "metric") return `${face}, with the same widths`;
  if (kind === "closest") return `${face}, the closest served here`;
  return "Left to your browser";
}

export function normalise(family: string): string {
  return family.trim().toLowerCase().replace(/\s+/g, " ");
}

export function packagedFamilyOf(hosted: Hosted): PackagedFamily | null {
  const entry = Object.entries(PACKAGED).find(([, face]) => face === hosted);
  return entry ? entry[0] as PackagedFamily : null;
}

export function isPackaged(family: string): boolean {
  return PACKAGED_NAMES.has(normalise(family));
}

function words(list: readonly string[]): RegExp {
  return new RegExp(`\\b(${list.join("|")})\\b`);
}
