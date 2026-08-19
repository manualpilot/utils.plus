export const SITE_NAME = "utils+";

export const SITE_ORIGIN = "https://utils.plus";

export const HOME_PATH = "/";
export const ATTRIBUTIONS_PATH = "/attributions";

export const PAGE_META = {
  "/": {
    title: "Developer Tools That Run in Your Browser",
    description:
      "Encoders, hashes, key generators, JSON, JWT, diff, cron and more, running entirely in your browser. No server-side processing, no third-party requests, no tracking.",
    keywords: [
      "developer tools",
      "online developer utilities",
      "browser based tools",
      "offline dev tools",
      "privacy first tools",
      "no upload tools",
    ],
  },
  "/calculator": {
    title: "Programmer & Scientific Calculator",
    description:
      "Add, shift, rotate and mask 8- to 64-bit words in hex, octal or decimal, with every bit on screen — or switch to powers, roots, logs and trigonometry.",
    keywords: [
      "programmer calculator",
      "hex calculator",
      "binary calculator",
      "bitwise calculator",
      "two's complement",
      "bit shift calculator",
      "scientific calculator",
      "trigonometry calculator",
      "hex to decimal",
    ],
  },
  "/codec": {
    title: "Base64, Base32, Hex & Morse Codec",
    description:
      "Encode and decode text as Base64, Base32, hexadecimal, decimal, binary, NATO phonetic or Morse, with every RFC 4648 variant. Nothing leaves the browser.",
    keywords: [
      "base64 encoder",
      "base64 decoder",
      "url-safe base64",
      "base32 encoder",
      "crockford base32",
      "hex encoder",
      "text to binary",
      "morse code translator",
      "nato phonetic alphabet",
      "rfc 4648",
    ],
  },
  "/colour": {
    title: "Hex, RGB, HSL & OKLCH Colour Converter",
    description:
      "Pick a colour and read it back as hex, RGB, HSL, HSV, CMYK, LAB, LCH, OKLAB, OKLCH or a CSS name — or type any of those into any box to convert it.",
    keywords: [
      "colour converter",
      "color converter",
      "hex to rgb",
      "rgb to hex",
      "hsl converter",
      "oklch",
      "oklab",
      "cmyk converter",
      "css color names",
      "colour picker",
    ],
  },
  "/converter": {
    title: "Unit Converter for Length, Mass & Data",
    description:
      "Convert distance, area, volume, mass, temperature, speed, data, energy, power and pressure between metric, imperial and SI units, to twelve digits.",
    keywords: [
      "unit converter",
      "metric to imperial",
      "length converter",
      "temperature converter",
      "celsius to fahrenheit",
      "kg to lbs",
      "km to miles",
      "data storage converter",
      "pressure converter",
    ],
  },
  "/cron": {
    title: "Cron Expression Builder & Parser",
    description:
      "Write or read a cron expression field by field, in Unix or Quartz flavour, and see the next runs in your own time zone or UTC before you schedule it.",
    keywords: [
      "cron expression",
      "crontab generator",
      "cron parser",
      "quartz cron",
      "cron schedule",
      "next run time",
      "cron syntax",
      "crontab editor",
    ],
  },
  "/diff": {
    title: "Text & Code Diff Checker",
    description:
      "Compare two texts side by side, with the changed words marked rather than the whole line and syntax highlighting for eighteen languages. Nothing is uploaded.",
    keywords: [
      "diff checker",
      "text compare",
      "code diff",
      "compare two files",
      "word level diff",
      "side by side diff",
      "online diff tool",
      "myers diff",
    ],
  },
  "/hasher": {
    title: "Hash & Key Derivation Calculator",
    description:
      "Hash text with MD5, SHA-1, SHA-2, SHA-3, BLAKE2, BLAKE3, CRC32, xxHash or MurmurHash, or derive a key with Argon2, bcrypt, scrypt or PBKDF2, in the tab.",
    keywords: [
      "hash calculator",
      "md5 generator",
      "sha256 hash",
      "sha512 hash",
      "sha-3 keccak",
      "blake3",
      "crc32 checksum",
      "xxhash",
      "argon2",
      "bcrypt generator",
      "scrypt",
      "pbkdf2",
    ],
  },
  "/javascript": {
    title: "Run JavaScript & TypeScript in the Browser",
    description:
      "Run a JavaScript or TypeScript script, or work at a REPL, on a WebAssembly engine served from this page — output as it is written and a panel of what the run left bound.",
    keywords: [
      "online javascript",
      "run javascript in browser",
      "javascript repl",
      "typescript playground",
      "javascript playground",
      "js console online",
      "quickjs",
      "webassembly javascript",
      "typescript repl",
      "run typescript online",
    ],
  },
  "/json": {
    title: "JSON Formatter, Validator & Minifier",
    description:
      "Format, minify, sort the keys of, escape and unescape JSON in an editor that marks a syntax error where it is. The document stays in the browser.",
    keywords: [
      "json formatter",
      "json validator",
      "json beautifier",
      "json minifier",
      "json escape",
      "sort json keys",
      "pretty print json",
      "json editor",
    ],
  },
  "/jwt": {
    title: "JWT Decoder, Verifier & Builder",
    description:
      "Read a JSON Web Token's header and claims, check its signature against a secret, PEM, certificate or JWK, or build and sign a new one. The key never leaves the tab.",
    keywords: [
      "jwt decoder",
      "jwt debugger",
      "json web token",
      "verify jwt signature",
      "jwt generator",
      "hs256",
      "rs256",
      "es256",
      "eddsa",
      "jwt claims",
    ],
  },
  "/keygen": {
    title: "SSH, PGP, TLS & JWK Key Generator",
    description:
      "Generate SSH keys, PGP keys, self-signed TLS certificates, JSON Web Keys, WireGuard keypairs and random secrets. The private half is built here and never sent anywhere.",
    keywords: [
      "ssh key generator",
      "pgp key generator",
      "self-signed certificate",
      "tls certificate generator",
      "json web key",
      "jwk generator",
      "wireguard keys",
      "ed25519 key",
      "rsa key generator",
      "ecdsa key",
    ],
  },
  "/markdown": {
    title: "Markdown Editor with Live Preview",
    description:
      "Write Markdown with a formatting bar and read it back rendered as you type, side by side or one at a time, in GitHub, CommonMark or original flavour.",
    keywords: [
      "markdown editor",
      "markdown preview",
      "live markdown preview",
      "markdown to html",
      "github flavored markdown",
      "gfm",
      "commonmark",
      "readme editor",
      "markdown viewer",
    ],
  },
  "/passphrase": {
    title: "Memorable Passphrase Generator",
    description:
      "Build a passphrase out of real nouns, verbs and adjectives, with the word count, mix, casing and separator you choose: easier to remember, harder to guess.",
    keywords: [
      "passphrase generator",
      "diceware",
      "memorable password",
      "random word password",
      "xkcd password",
      "secure passphrase",
      "word based password",
    ],
  },
  "/password": {
    title: "Random Password Generator",
    description:
      "Generate a strong random password at the length and mix of lowercase, uppercase, digits and symbols you want, drawn from the browser's own secure randomness.",
    keywords: [
      "password generator",
      "random password",
      "strong password",
      "secure password generator",
      "password length",
      "special characters password",
    ],
  },
  "/python": {
    title: "Run Python in the Browser",
    description:
      "Run a Python script or work at a REPL with the whole standard library, output as it is written and a panel of what the run left bound. No server and no install.",
    keywords: [
      "online python",
      "run python in browser",
      "python repl",
      "python playground",
      "pyodide",
      "pyscript",
      "python interpreter online",
      "webassembly python",
    ],
  },
  "/regex": {
    title: "Regex Tester & Explainer",
    description:
      "Write a regular expression, watch every match and capture group light up in your own text, and read a line-by-line breakdown of what the pattern does.",
    keywords: [
      "regex tester",
      "regular expression tester",
      "regex explainer",
      "regex debugger",
      "javascript regex",
      "named capture groups",
      "regex highlighter",
      "test regex online",
    ],
  },
  "/schema": {
    title: "JSON Schema, Zod & Pydantic Validator",
    description:
      "Check a JSON payload against a JSON Schema, Zod or Pydantic model with every error marked in place, and convert a schema between all three.",
    keywords: [
      "json schema validator",
      "zod schema",
      "pydantic model",
      "json schema to zod",
      "zod to json schema",
      "pydantic to json schema",
      "json schema generator",
      "json to json schema",
      "schema converter",
    ],
  },
  "/time": {
    title: "Timestamp & Time Zone Converter",
    description:
      "Convert a Unix timestamp or a date across time zones and read it as ISO 8601, RFC 2822, RFC 1123, week date or ordinal date, with a live clock for each zone.",
    keywords: [
      "unix timestamp converter",
      "epoch converter",
      "time zone converter",
      "epoch to date",
      "iso 8601",
      "rfc 2822",
      "utc converter",
      "world clock",
    ],
  },
  "/unique-id": {
    title: "UUID, ULID & NanoID Generator",
    description:
      "Generate UUIDs v1 through v8 and NanoID, CUID2, ULID, KSUID, XID, TypeID, MongoDB ObjectId, Firebase PushID, Snowflake and Sonyflake IDs, singly or by the batch.",
    keywords: [
      "uuid generator",
      "uuid v4",
      "uuid v7",
      "nanoid",
      "ulid generator",
      "cuid2",
      "ksuid",
      "typeid",
      "mongodb objectid",
      "snowflake id",
      "unique id generator",
    ],
  },
  "/attributions": {
    title: "Open Source Attributions",
    description:
      "The licences and copyright notices of every open source package bundled into utils+, reproduced in full as their own terms ask for.",
    keywords: ["open source licences", "third party notices", "attributions", "licence texts"],
  },
} satisfies Record<string, PageMeta>;

export type PagePath = keyof typeof PAGE_META;

export interface PageMeta {
  title: string;
  description: string;
  keywords: string[];
  noindex?: true;
}

const NOT_FOUND_META: PageMeta = {
  title: "Page Not Found",
  description: "No utility lives at this address. The list of everything utils+ can do is one click away.",
  keywords: [],
  noindex: true,
};

export function pageMeta(path: string): PageMeta {
  return PAGE_META[path as PagePath] ?? NOT_FOUND_META;
}

export function documentTitle(meta: PageMeta): string {
  return `${meta.title} · ${SITE_NAME}`;
}

export function canonicalUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

export function headMeta(path: string): HeadMeta {
  const meta = pageMeta(path);
  const title = documentTitle(meta);
  const url = canonicalUrl(path);

  return {
    title,
    canonical: url,
    metas: [
      { attribute: "name", key: "description", content: meta.description },
      { attribute: "name", key: "keywords", content: meta.keywords.join(", ") },
      { attribute: "name", key: "robots", content: meta.noindex ? "noindex, follow" : "index, follow" },
      { attribute: "property", key: "og:type", content: "website" },
      { attribute: "property", key: "og:site_name", content: SITE_NAME },
      { attribute: "property", key: "og:title", content: title },
      { attribute: "property", key: "og:description", content: meta.description },
      { attribute: "property", key: "og:url", content: url },
      { attribute: "name", key: "twitter:card", content: "summary" },
      { attribute: "name", key: "twitter:title", content: title },
      { attribute: "name", key: "twitter:description", content: meta.description },
    ],
  };
}

export interface HeadMeta {
  title: string;
  canonical: string;
  metas: MetaTag[];
}

export interface MetaTag {
  attribute: "name" | "property";
  key: string;
  content: string;
}

export function headHtml(path: string): string {
  const { title, canonical, metas } = headMeta(path);

  return [
    `<title>${escapeHtml(title)}</title>`,
    ...metas.map(({ attribute, key, content }) => `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`),
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  ].join("\n  ");
}

export function withHead(html: string, path: string): string {
  return html.replace(HEAD_BLOCK, `${HEAD_OPEN}\n  ${headHtml(path)}\n  ${HEAD_CLOSE}`);
}

const HEAD_OPEN = "<!--page-head-->";
const HEAD_CLOSE = "<!--/page-head-->";

const HEAD_BLOCK = /<!--page-head-->(?:[\s\S]*?<!--\/page-head-->)?/;

export function pageDocuments(index: string): Record<string, string> {
  const paths = (Object.keys(PAGE_META) as PagePath[]).filter((path) => path !== HOME_PATH);
  const documents: Record<string, string> = {};

  for (const path of paths) documents[documentFileName(path)] = withHead(index, path);

  return documents;
}

export function documentFileName(path: PagePath): string {
  return path === HOME_PATH ? "index.html" : `${path.slice(1)}/index.html`;
}

export function indexablePaths(): PagePath[] {
  return (Object.keys(PAGE_META) as PagePath[]).filter((path) => !pageMeta(path).noindex);
}

export function sitemapXml(): string {
  const urls = indexablePaths().map((path) => `  <url>\n    <loc>${escapeHtml(canonicalUrl(path))}</loc>\n  </url>`);

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function robotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
