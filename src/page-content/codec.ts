import type { PageContent } from "../page-document.ts";

export default {
  related: ["/hasher", "/url", "/unicode", "/hex", "/jwt"],
  howItWorks: [
    "Pick a direction and a format and the output follows every keystroke. Text is encoded as UTF-8 first, so Base64, Base32, hexadecimal, decimal and binary spell those bytes, and the count beside the output is bytes, not characters. The swap button feeds the output back in the other direction.",
    "The variant shapes what encoding writes; decoding is lenient wherever the alphabets allow. Base64 is read in the standard and URL-safe alphabets alike, padded or not, with whitespace ignored and percent escapes such as `%2B` read as the character they stand for. Hex ignores case, spaces, colons and `0x`. Base32 alphabets give the same characters different values, so there the variant applies to decoding too.",
    "Deflate (Base64) compresses with the browser's own `CompressionStream` in the zlib, raw or gzip wrapper and writes Base64. Decoding tries the selected wrapper, then the other two.",
    "ROT13, ROT18 and ROT47 are each their own inverse. Caesar shifts by 3 unless told otherwise; Vigenère takes a keyword in standard, autokey or Beaufort form; XOR repeats a text or hex key under the bytes. NATO and Morse spell out the characters.",
  ],
  examples: [
    {
      title: "The same bytes in both Base64 alphabets",
      blocks: [
        { code: "<<???>>" },
        "Encoded as Standard (RFC 4648), then as URL-safe, no padding:",
        { code: "PDw/Pz8+Pg==\nPDw_Pz8-Pg" },
        "Both are 7 bytes. Either line decodes back to `<<???>>` whichever Base64 variant is selected.",
      ],
    },
    {
      title: "A SAMLRequest copied out of a query string",
      blocks: [
        "Deflate (Base64), Decode, variant left at zlib, with the value pasted escapes and all:",
        {
          code:
            "HY1LC4JAFEb%2FiszeZ2pyyUBwIxRBRos2MYw3HHAeea%2Fhz0%2FcnnM%2BvhNJM3loFh7tHb8LEgermSzBLmqxzBacJE1gpUECVtA31wtkUQJ%2BduyUm0TQtbV4V1gNqviUInjiTNrZWmzVJokW7CyxtLyhJM3D5Bim5SM7QJFBXrxE0G7H2kreVyOzhzjWg49wlcZPGCln4r6%2F9Tj%2FtMLIj17E5z8%3D",
        },
        {
          code:
            "<samlp:AuthnRequest xmlns:samlp=\"urn:oasis:names:tc:SAML:2.0:protocol\" ID=\"_8e8dc5f6\" Version=\"2.0\" IssueInstant=\"2014-07-16T23:52:45Z\" Destination=\"http://idp.example.com/SSOService.php\"/>",
        },
        "The body is raw deflate, as SAML's redirect binding requires, and is read once zlib and gzip have both failed. The count reads 189 bytes.",
      ],
    },
    {
      title: "Seven characters, eight bytes",
      blocks: [
        { code: "Pay £5?" },
        "Encoded as Hexadecimal, Lowercase, spaced:",
        { code: "50 61 79 20 c2 a3 35 3f" },
        "The pound sign is U+00A3, which UTF-8 writes as `c2 a3`, so the count says 8 bytes and Base64 gives `UGF5IMKjNT8=`. The [Unicode inspector](/unicode) shows the same bytes a character at a time.",
      ],
    },
  ],
  problems: [
    {
      title: "Base64 from a URL comes out truncated or short",
      blocks: [
        "Form decoding turns `+` into a space, and Base64 decoding here drops whitespace, so `PDw/Pz8+Pg==` that has been through that trip arrives as `PDw/Pz8 Pg==` and fails with “Input is truncated: it does not contain a whole number of bytes”. Where the length still works out, it decodes short with no error: `PDw/Pz8+`, which is `<<???>`, loses its `+` and gives `<<???`. Paste the value before anything unescaped it; `%2B` is read as `+`.",
      ],
    },
    {
      title: "“Decoded bytes are not valid UTF-8 text”",
      blocks: [
        "Every format decodes to text, so bytes that are not UTF-8 are refused rather than shown as replacement characters. Base64 of an image, a key or a hash ends here: `iVBORw0KGgo=` is the first eight bytes of a PNG. A value beginning `H4sI` is gzip, and decodes under Deflate (Base64) instead.",
      ],
    },
  ],
  faq: [
    {
      question: "Do I need to say whether a value is URL-safe Base64?",
      answer:
        "Not to decode it. The two alphabets share their first 62 characters and differ only in `+` and `/` against `-` and `_`, so all four are read. Padding is optional too, so a JWT segment decodes as it stands: `eyJzdWIiOiIxMjM0NTY3ODkwIn0` gives `{\"sub\":\"1234567890\"}`. The variant only changes what encoding writes.",
    },
    {
      question: "Why is Base64 longer than the input?",
      answer:
        "Each character carries six bits, so every three bytes become four characters, and padding rounds the last group up to four. Seven bytes take ten characters without padding and twelve with it. Base32 carries five bits a character, hex four, and binary one.",
    },
    {
      question: "Why is the compressed output bigger than my text?",
      answer:
        "The count is the compressed payload, and each wrapper costs something: `hello` is 5 bytes of text, 7 as raw deflate, 13 under zlib's header and checksum, and 25 under gzip's. Compression pays for itself once the text repeats; a 70-character sentence saying the same thing four times comes to 45 bytes under zlib.",
    },
    {
      question: "What is Crockford's Base32?",
      answer:
        "An alphabet of digits and capitals that leaves out I, L, O and U, so it survives being read aloud or written by hand. Decoding ignores case and hyphens and reads I and L as 1 and O as 0, as Crockford's specification asks, and nothing is padded. ULIDs are written in it.",
    },
  ],
  references: [
    { title: "RFC 4648: The Base16, Base32, and Base64 Data Encodings", url: "https://www.rfc-editor.org/rfc/rfc4648" },
    { title: "RFC 1950: ZLIB Compressed Data Format", url: "https://www.rfc-editor.org/rfc/rfc1950" },
    { title: "RFC 1951: DEFLATE Compressed Data Format", url: "https://www.rfc-editor.org/rfc/rfc1951" },
    { title: "RFC 1952: GZIP File Format", url: "https://www.rfc-editor.org/rfc/rfc1952" },
    { title: "Crockford's Base32", url: "https://www.crockford.com/base32.html" },
    {
      title: "SAML 2.0 Bindings, section 3.4: HTTP Redirect",
      url: "https://docs.oasis-open.org/security/saml/v2.0/saml-bindings-2.0-os.pdf",
    },
  ],
} satisfies PageContent;
