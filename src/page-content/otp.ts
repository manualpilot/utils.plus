import type { PageContent } from "../page-document.ts";

export default {
  related: ["/keygen", "/qr-code", "/codec", "/time"],
  howItWorks: [
    "TOTP, HOTP and OCRA are one computation: an HMAC over an eight-byte counter, cut down to a number of digits by RFC 4226's dynamic truncation. HOTP counts uses, TOTP counts periods of 30 seconds (by default) since 1970, and OCRA hashes a challenge, and whatever else its suite names, into a longer message. The code is recomputed as the fields change, in the tab; the secret is not sent anywhere.",
    "The secret is read as Base32 by default, which is what authenticators print and `otpauth://` URIs carry; spaces, lower case and missing padding are accepted. Hex is how the RFCs write their keys, and Text takes the characters as typed. The icon in the box generates 20 bytes for SHA-1, 32 for SHA-256 and 64 for SHA-512.",
    "Leave Time empty and TOTP follows the clock, with a bar for the seconds left; type epoch seconds, which the [time converter](/time) works out from a date, to pin a moment. Under the code the page prints the counter, or the time step in decimal and hex, to check against a server's log. For TOTP and HOTP the URI box holds the `otpauth://` line an authenticator enrols from, in step with the fields both ways, with a QR icon to scan it.",
  ],
  examples: [
    {
      title: "RFC 6238's SHA-1 vectors, and RFC 4226's",
      blocks: [
        {
          code:
            "Secret:  GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ   (Base32 of 12345678901234567890)\n\nTOTP, 8 digits, Time 59          → 94287082   Time step 1 · 0x1\nTOTP, 8 digits, Time 1111111109  → 07081804   Time step 37037036 · 0x23523EC\nHOTP, 6 digits, Counter 0, 1, 2  → 755224, 287082, 359152",
        },
        "SHA-1 and a 30-second period throughout. The same secret as Hex, `3132333435363738393031323334353637383930`, or as Text, `12345678901234567890`, gives the same codes.",
      ],
    },
    {
      title: "An OCRA challenge",
      blocks: [
        {
          code:
            "Suite:    OCRA-1:HOTP-SHA1-6:QN08\nSecret:   3132333435363738393031323334353637383930   (Hex)\n\nQuestion 00000000  → 237653\nQuestion 11111111  → 243178",
        },
        "Both are in RFC 6287's one-way challenge-response table. The suite is hashed as part of the message, so the same suite typed as `ocra-1:hotp-sha1-6:qn08` gives `827128` for the first question instead.",
      ],
    },
    {
      title: "The enrolment URI",
      blocks: [
        {
          code:
            "otpauth://totp/Example%20Co:ada@example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Example%20Co&algorithm=SHA1&digits=8&period=30",
        },
        "Issuer `Example Co`, Label `ada@example.com`, 8 digits. The issuer is written twice, as the prefix and as a parameter, as the format recommends, and `algorithm` is written even at its default. Pasting a URI into the box sets the fields from it.",
      ],
    },
  ],
  problems: [
    {
      title: "The code looks right but is rejected",
      blocks: [
        "TOTP depends on the clock of whatever shows the code. RFC 6238 recommends a server accept at most one step of delay, so a clock 30 seconds out is already at the edge; compare the time step under the code with the one the server logged. An HOTP server that has fallen behind or run ahead of the counter rejects codes until the two meet.",
      ],
    },
    {
      title: "`\"1\" is not a Base32 character`",
      blocks: [
        "Base32 is `A`–`Z` and `2`–`7`, so a 0, 1, 8 or 9 means the secret is hex or text, or an `O` or `I` was read as a digit. Set Secret Format to what the secret is. A wrong format that happens to decode gives a wrong code with no error at all.",
      ],
    },
    {
      title: "RFC 6238's SHA-256 and SHA-512 codes do not match",
      blocks: [
        "The appendix says every row uses the 20-byte seed `12345678901234567890`, but the reference code keys SHA-256 with a 32-byte seed and SHA-512 with a 64-byte one, and the table comes from the code. At 59 seconds SHA-256 gives `32247374` with the 20-byte key and the table's `46119246` with `12345678901234567890123456789012`.",
      ],
    },
    {
      title: "An authenticator shows the wrong code for a SHA-256 or 60-second account",
      blocks: [
        "Google's Key Uri Format page says Google Authenticator ignores the `algorithm` and `period` parameters, and `digits` on some platforms. An app that does enrols the account and then shows SHA-1, 30-second, 6-digit codes. Those are the format's defaults, and the safe choice when the app is not known.",
      ],
    },
  ],
  faq: [
    {
      question: "Why does the share link carry the secret?",
      answer:
        "Because the secret is the input the code is computed from; a link without it would open on the settings and no code. The part of an address after `#` is never sent to a server, but it does sit in browser history and in anything the link is pasted into, so do not share a link to a live account.",
    },
    {
      question: "What is OCRA for?",
      answer:
        "Challenge and response. A server sends a question and the token answers with an HMAC over the suite, the question and, if the suite names them, a counter, a hashed PIN, session information and a time step. The page takes the PIN as typed and hashes it as the suite asks.",
    },
    {
      question: "How long should the secret be?",
      answer:
        "RFC 4226 requires at least 128 bits and recommends 160, which is the 20 bytes the page generates for SHA-1, or 32 Base32 characters. For SHA-256 and SHA-512 it generates 32 and 64 bytes, the width of each hash. A Base32 secret of any size up to 512 bytes can also be drawn on [Keygen](/keygen).",
    },
  ],
  references: [
    { title: "RFC 4226, HOTP", url: "https://www.rfc-editor.org/rfc/rfc4226" },
    { title: "RFC 6238, TOTP", url: "https://www.rfc-editor.org/rfc/rfc6238" },
    { title: "RFC 6287, OCRA", url: "https://www.rfc-editor.org/rfc/rfc6287" },
    { title: "Key Uri Format", url: "https://github.com/google/google-authenticator/wiki/Key-Uri-Format" },
    { title: "RFC 4648, Base32", url: "https://www.rfc-editor.org/rfc/rfc4648" },
  ],
} satisfies PageContent;
