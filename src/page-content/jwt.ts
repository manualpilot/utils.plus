import type { PageContent } from "../page-document.ts";

export default {
  related: ["/keygen", "/hasher", "/codec", "/time", "/certificate"],
  howItWorks: [
    "Decode lays a token's header and claims out as tables and glosses the registered names. The time claims `exp`, `nbf`, `iat` and `auth_time` also show their instant in your local time and a countdown, in red once `exp` has passed or while the others are in the future. A token of five parts is an encrypted JWE, whose claims wait for a key.",
    "A key in the box below is checked against the algorithm the header names. It takes an HMAC secret as text, a PKCS#8 or SPKI PEM, an X.509 certificate, a JWK, or a JWKS from which the key whose `kid` the header names is picked, and a private key is reduced to its public half first. Only the signature is judged, so an expired token with a good signature still reads Signature valid.",
    "Encode builds a token from rows, reading each value as JSON where it parses and as text where it does not: `42` is a number, `admin` a string, and `\"1234567890\"` in quotes stays a string. Picking an algorithm generates a key for it, unless the box holds one of your own, and for the asymmetric ones prints the public half as a PEM. It signs with `EdDSA` and the `ES`, `HS`, `RS` and `PS` families, and encrypts with `ECDH-ES`, `dir`, AES key wrap or `RSA-OAEP`.",
  ],
  examples: [
    {
      title: "Checking the jwt.io sample token",
      blocks: [
        {
          code:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        },
        "The claims are `sub` \"1234567890\", `name` \"John Doe\" and `iat` 1516239022, which is 18 January 2018 at 01:30:22 UTC. With `your-256-bit-secret` as the key the badge reads Signature valid; with one trailing space added, Signature invalid.",
      ],
    },
    {
      title: "Signing with the Ed25519 test key from RFC 8037",
      blocks: [
        {
          code:
            "Algorithm  EdDSA\nKey        {\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"d\":\"nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A\",\"x\":\"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo\"}\nHeader     typ  JWT\nClaims     sub  \"1234567890\"\n           iat  1789128000\n           exp  1789131600",
        },
        {
          code:
            "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNzg5MTI4MDAwLCJleHAiOjE3ODkxMzE2MDB9.SxAHgXn1LVn6f-OCoCI1Fxg8FPsE0VWL8mdw9c5ujFOtTNaa-FibxnRotsrxMkA02st7grJCBBoOBcjw8BekAQ\n\n-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=\n-----END PUBLIC KEY-----",
        },
        "It was issued at 12:00 UTC on 11 September 2026 and expires an hour later. Ed25519 signatures are deterministic, so these inputs give this token every time, and OpenSSL verifies it against the PEM. Unquoted, `sub` would be signed as a number.",
      ],
    },
    {
      title: "Opening the encrypted example from RFC 7516",
      blocks: [
        {
          code:
            "eyJhbGciOiJBMTI4S1ciLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0.6KB707dM9YTIgHtLvtgWQ8mKwboJW3of9locizkDTHzBC2IlrT1oOQ.AxY8DCtDaGlsbGljb3RoZQ.KDlTtXchhZTGufMYmOYGS4HffxPSUrfmqCHXaI9wOGY.U0m_YmjN04DJvceFICbCVQ",
        },
        "The header, `A128KW` over `A128CBC-HS256`, is readable at once. With the 16-byte AES key `GawgguFyGrWKav7AX4VKUg`, written as base64url, the badge reads Decrypted, and the plaintext, not being JSON, appears as a Payload card: `Live long and prosper.`",
      ],
    },
  ],
  problems: [
    {
      title: "Signature invalid with the right secret",
      blocks: [
        "The secret is the exact text in the box, so a trailing newline changes every signature. A secret your server base64-decodes before use has to be decoded here too: the page signs with the characters, not the bytes they spell.",
      ],
    },
    {
      title: "`exp` in milliseconds",
      blocks: [
        "JWT times are seconds since 1970, and `Date.now()` returns milliseconds. An `exp` of 1789131600000 reads here as a date in the year 58665, and a verifier that only compares it with the clock will accept the token for millennia. Check a value with the [time converter](/time).",
      ],
    },
    {
      title: "A token that decodes but will not verify",
      blocks: [
        "The signature covers the first two parts exactly as written. A payload re-encoded as padded base64 still decodes here, but `…fQ==` and `…fQ` are different bytes to sign. JWTs use base64url: `-` and `_` for `+` and `/`, and no `=`.",
      ],
    },
    {
      title: "The algorithm comes from the token",
      blocks: [
        "The classic attack changes `RS256` to `HS256` and signs with the server's RSA public key as the HMAC secret, which verifies wherever a library takes any key for any algorithm. This page refuses a PEM as an HMAC secret; your verifier should pin the algorithms it accepts and reject `none`.",
      ],
    },
  ],
  faq: [
    {
      question: "Does Signature valid mean the token can be trusted?",
      answer:
        "No, only that the key made the signature over these bytes. Expiry, audience (`aud`) and issuer (`iss`) are separate checks for your verifier. The page colours a time claim that is out of its window but leaves it out of the badge.",
    },
    {
      question: "Is it safe to paste a real token or key here?",
      answer:
        "Decoding, verifying, signing and encrypting run in the tab, through `jose` on the browser's Web Crypto, and nothing is sent to a server. But apart from the sample the page opens on, the token and key are written into the address's fragment so that a copied link reproduces the verdict, which puts them in browser history. Do not share or bookmark a link made with a live key.",
    },
    {
      question: "Which key checks an RS256 or ES256 signature?",
      answer:
        "The public half, as an SPKI PEM, a certificate or a JWK; a private key works too. A whole JWKS, as a `jwks_uri` serves it, works as well: the key whose `kid` the header names is used, and a set without it says which `kid` was asked for. `BEGIN RSA PRIVATE KEY` is PKCS#1, which Web Crypto cannot import; `openssl pkcs8 -topk8 -nocrypt` converts it.",
    },
  ],
  references: [
    { title: "RFC 7519: JSON Web Token (JWT)", url: "https://www.rfc-editor.org/rfc/rfc7519" },
    { title: "RFC 7515: JSON Web Signature (JWS)", url: "https://www.rfc-editor.org/rfc/rfc7515" },
    { title: "RFC 7516: JSON Web Encryption (JWE)", url: "https://www.rfc-editor.org/rfc/rfc7516" },
    { title: "RFC 7518: JSON Web Algorithms (JWA)", url: "https://www.rfc-editor.org/rfc/rfc7518" },
    { title: "RFC 8037: Ed25519 in JOSE", url: "https://www.rfc-editor.org/rfc/rfc8037" },
    { title: "RFC 8725: JSON Web Token Best Current Practices", url: "https://www.rfc-editor.org/rfc/rfc8725" },
  ],
} satisfies PageContent;
