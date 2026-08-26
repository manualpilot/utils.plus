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
  "/certificate": {
    title: "X.509 Certificate Decoder & Generator",
    description:
      "Decode a certificate, a signing request or an SSH key — names, expiry, fingerprints, chain order — or generate a self-signed one, a root CA, or one signed by it.",
    keywords: [
      "certificate decoder",
      "x509 decoder",
      "ssl certificate viewer",
      "csr decoder",
      "pem decoder",
      "certificate fingerprint",
      "certificate expiry checker",
      "certificate chain order",
      "ssh public key fingerprint",
      "does key match certificate",
      "self-signed certificate generator",
      "create root ca",
    ],
  },
  "/codec": {
    title: "Base64, Base32, Hex, Gzip, Morse & ROT13 Codec",
    description:
      "Encode and decode Base64, Base32, hex, decimal, binary, NATO, Morse and gzip, or run text through ROT13, Caesar, Vigenère and XOR. Nothing leaves the browser.",
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
      "deflate base64",
      "gzip base64",
      "inflate zlib",
      "decode samlrequest",
      "rot13 decoder",
      "rot47",
      "caesar cipher solver",
      "vigenere cipher",
      "xor cipher",
      "single byte xor",
    ],
  },
  "/colour": {
    title: "Colour Converter, Contrast & Palette",
    description:
      "Convert between hex, RGB, HSL, CMYK, LAB and OKLCH, check WCAG contrast, build a palette in OKLCH, and see any of it through colour blindness.",
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
      "wcag contrast checker",
      "contrast ratio",
      "colour palette generator",
      "complementary colours",
      "colour blindness simulator",
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
  "/countries": {
    title: "ISO 3166 Country Code & Data Lookup",
    description:
      "Pick any of 250 countries and read back its ISO 3166 codes, calling code, capital, currencies, languages, land borders, area and name in two dozen languages.",
    keywords: [
      "country codes",
      "iso 3166",
      "alpha-2 country code",
      "alpha-3 country code",
      "country calling codes",
      "country currency codes",
      "country capital lookup",
      "country tld",
      "demonyms",
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
  "/cryptography": {
    title: "AES, ChaCha, NaCl & PGP Encryption",
    description:
      "Encrypt and decrypt text or a file with AES-GCM, AES-CBC, AES-CTR, ChaCha20-Poly1305, NaCl secretbox and box, or OpenPGP. Keys are made and used in the tab.",
    keywords: [
      "encrypt text online",
      "decrypt text online",
      "aes encryption",
      "aes-gcm",
      "aes-cbc",
      "chacha20-poly1305",
      "xchacha20",
      "nacl secretbox",
      "tweetnacl box",
      "x25519",
      "pgp encrypt message",
      "encrypt a file in the browser",
    ],
  },
  "/csv": {
    title: "CSV Viewer, Parser & Data Table",
    description:
      "Paste or drop a CSV, TSV or any delimited file and read it as a sortable table beside its own text, with the delimiter worked out for you. Nothing is uploaded.",
    keywords: [
      "csv viewer",
      "csv to table",
      "tsv viewer",
      "delimited file viewer",
      "csv parser",
      "open csv in browser",
      "sort csv columns",
      "csv editor",
    ],
  },
  "/curl": {
    title: "curl Command Builder, Parser & Runner",
    description:
      "Build a curl command argument by argument, or paste one in and have it taken apart into fields you can edit — then Send it as a fetch and read what came back.",
    keywords: [
      "curl command builder",
      "curl command generator",
      "curl parser",
      "curl post json",
      "curl header",
      "curl options",
      "build curl request",
      "edit curl command",
      "run curl in browser",
      "curl to fetch",
      "online http client",
      "send http request",
      "rest client",
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
  "/har": {
    title: "HAR Viewer & HTTP Archive Analyser",
    description:
      "Open a HAR recording from Chrome, Firefox or Safari and read every request — headers, cookies, bodies and timings — filtered by any field. Nothing is uploaded.",
    keywords: [
      "har viewer",
      "har file analyzer",
      "http archive viewer",
      "har analyser",
      "network log viewer",
      "devtools har",
      "read har file",
      "har request filter",
      "http request timings",
      "waterfall timings",
    ],
  },
  "/hasher": {
    title: "Hash & Key Derivation Calculator",
    description:
      "Hash text or a file with MD5, SHA-1, SHA-2, SHA-3, BLAKE2, BLAKE3, CRC32, xxHash or MurmurHash, or derive a key with Argon2, bcrypt, scrypt or PBKDF2, in the tab.",
    keywords: [
      "hash calculator",
      "md5 generator",
      "sha256 hash",
      "sha512 hash",
      "sha-3 keccak",
      "blake3",
      "crc32 checksum",
      "xxhash",
      "file checksum",
      "sha256 file hash",
      "argon2",
      "bcrypt generator",
      "scrypt",
      "pbkdf2",
    ],
  },
  "/hex": {
    title: "Hex Editor & Binary File Viewer",
    description:
      "Open any file and read every byte of it, in hex and as text, patch the bytes in place, search for a signature, then save the file back out. Nothing is uploaded.",
    keywords: [
      "hex editor",
      "hex viewer",
      "online hex editor",
      "binary file editor",
      "hex dump",
      "edit binary file",
      "file signature viewer",
      "magic number lookup",
      "byte editor",
      "data inspector",
      "hex to text",
      "patch a binary",
    ],
  },
  "/image": {
    title: "Image Converter, Resizer & EXIF Editor",
    description:
      "Open a picture, read and edit its EXIF and metadata, crop, resize, turn and colour it, then save it as PNG, JPEG, WebP or AVIF, or as a data URI. Nothing is uploaded.",
    keywords: [
      "image converter",
      "exif viewer",
      "exif editor",
      "remove exif data",
      "strip image metadata",
      "image resizer",
      "crop image online",
      "png to jpg",
      "jpg to webp",
      "image to data uri",
      "base64 image encoder",
      "photo metadata viewer",
      "gps location from photo",
      "compress image",
    ],
  },
  "/ip-address": {
    title: "IPv4, IPv6 & CIDR Subnet Calculator",
    description:
      "Work out subnet ranges, masks and host counts from any CIDR block, split it into smaller ones, convert an address to an integer, and expand or compress IPv6.",
    keywords: [
      "subnet calculator",
      "cidr calculator",
      "ip address calculator",
      "ipv4 subnet mask",
      "ipv6 expander",
      "ipv6 compression",
      "cidr to ip range",
      "ip to integer",
      "wildcard mask",
      "private ip ranges",
      "cidr split",
      "reverse dns arpa",
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
    title: "SSH, PGP & JSON Web Key Generator",
    description:
      "Generate SSH keys, PGP keys, JSON Web Keys, WireGuard keypairs and random secrets, in your browser. The private half is built here and never sent anywhere.",
    keywords: [
      "ssh key generator",
      "pgp key generator",
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
  "/otp": {
    title: "TOTP, HOTP & OCRA One-Time Password Calculator",
    description:
      "Work out a TOTP, HOTP or OCRA one-time password from a shared secret, with the algorithm, digits, counter and challenge the token uses. The secret never leaves the tab.",
    keywords: [
      "totp generator",
      "hotp calculator",
      "ocra calculator",
      "one-time password",
      "2fa code generator",
      "authenticator code",
      "rfc 6238",
      "rfc 4226",
      "rfc 6287",
      "base32 secret",
      "otpauth uri",
    ],
  },
  "/password": {
    title: "Password & Passphrase Generator",
    description:
      "Generate a strong random password at the length and mix of lowercase, uppercase, digits and symbols you want, or a memorable passphrase made of real English words.",
    keywords: [
      "password generator",
      "random password",
      "strong password",
      "secure password generator",
      "password length",
      "special characters password",
      "passphrase generator",
      "diceware",
      "memorable password",
      "random word password",
      "xkcd password",
      "secure passphrase",
      "word based password",
    ],
  },
  "/phone-number": {
    title: "Phone Number Validator & Lookup",
    description:
      "Parse a phone number against any of 245 dialling regions, see whether it is valid, where its range was issued, who carries it and what time it is there.",
    keywords: [
      "phone number validator",
      "libphonenumber",
      "e164 format",
      "phone number location lookup",
      "phone carrier lookup",
      "phone number time zone",
      "short code lookup",
      "international phone number format",
      "phone number parser",
      "rfc 3966 tel uri",
      "mobile or landline lookup",
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
      "python interpreter online",
      "webassembly python",
    ],
  },
  "/qr-code": {
    title: "WiFi, vCard & URL QR Code Generator",
    description:
      "Make a QR code for a link, a WiFi network, a contact card, an email, a phone number or an SMS, drawn as you type and saved as an SVG or a PNG. Nothing is fetched.",
    keywords: [
      "qr code generator",
      "wifi qr code",
      "vcard qr code",
      "url to qr code",
      "mailto qr code",
      "sms qr code",
      "contact card qr",
      "offline qr generator",
      "qr code svg",
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
  "/sql": {
    title: "SQLite & Postgres Playground",
    description:
      "Run SQL against a real SQLite or PostgreSQL database running entirely in your browser, with a schema tree, a results grid and a log of everything it did.",
    keywords: [
      "sql playground",
      "online sql editor",
      "sqlite in the browser",
      "postgres in the browser",
      "run sql online",
      "sql sandbox",
      "sqlite wasm",
      "pglite",
      "sql query tool",
    ],
  },
  "/string": {
    title: "Case Converter, Line Sorter & Text Escaper",
    description:
      "Convert camel, snake, kebab, Pascal, title and sentence case, sort, dedupe, wrap and shuffle lines, slugify, count words, and escape for HTML, JS, C, shell and SQL.",
    keywords: [
      "case converter",
      "camel case converter",
      "snake case converter",
      "kebab case",
      "title case converter",
      "sort lines",
      "remove duplicate lines",
      "word count",
      "character count",
      "slugify text",
      "html entity encoder",
      "escape string",
      "text word wrap",
      "shuffle lines",
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
  "/url": {
    title: "URL Parser & Query String Builder",
    description:
      "Take a URL apart into scheme, host, port, path, query and fragment, and edit its query parameters unescaped in a builder that stays in step with the address.",
    keywords: [
      "url parser",
      "query string builder",
      "url decoder",
      "url encoder",
      "percent encoding",
      "query parameter editor",
      "url components",
      "parse url online",
      "url escape",
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

export function utilityPaths(): PagePath[] {
  return (Object.keys(PAGE_META) as PagePath[]).filter((path) => path !== HOME_PATH && path !== ATTRIBUTIONS_PATH);
}

export function structuredData(path: string): StructuredData | undefined {
  if (path !== HOME_PATH) return undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE_NAME,
        url: canonicalUrl(HOME_PATH),
        description: pageMeta(HOME_PATH).description,
      },
      {
        "@type": "ItemList",
        name: `${SITE_NAME} utilities`,
        numberOfItems: utilityPaths().length,
        itemListElement: utilityPaths().map((utility, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: utilityData(utility),
        })),
      },
    ],
  };
}

function utilityData(path: PagePath): Record<string, unknown> {
  const meta = pageMeta(path);

  return {
    "@type": "WebApplication",
    name: meta.title,
    description: meta.description,
    url: canonicalUrl(path),
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isPartOf: { "@id": WEBSITE_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export interface StructuredData {
  "@context": string;
  "@graph": Record<string, unknown>[];
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
