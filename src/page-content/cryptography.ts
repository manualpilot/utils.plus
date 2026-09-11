import type { PageContent } from "../page-document.ts";

export default {
  related: ["/keygen", "/hasher", "/password", "/codec"],
  howItWorks: [
    "There is no Encrypt button: the output is recomputed as you type once the fields it needs are filled in. Every key field opens empty and nothing is drawn until you press the refresh icon beside one, so the same key, nonce and message always give the same ciphertext. Keys are raw bytes written in hex or Base64, never passwords. Everything runs in the tab and nothing is sent anywhere.",
    "For the ciphers below, the output is the nonce followed by the ciphertext, in Base64 by default or hex, so one string is all that has to be kept. Decrypt reads the nonce back off the front, which is why the nonce field only appears when encrypting. AES-GCM's 16-byte tag follows the ciphertext, as Web Crypto writes it; NaCl secretbox puts its tag first, as TweetNaCl does.",
    {
      table: [
        ["Algorithm", "Key", "Nonce", "Notices edits"],
        ["AES-GCM", "128, 192 or 256 bits", "12-byte IV", "Yes"],
        ["AES-CBC", "128, 192 or 256 bits", "16-byte IV", "No"],
        ["AES-CTR", "128, 192 or 256 bits", "16-byte counter block", "No"],
        ["ChaCha20-Poly1305", "256 bits", "12 bytes", "Yes"],
        ["XChaCha20-Poly1305", "256 bits", "24 bytes", "Yes"],
        ["NaCl secretbox", "256 bits", "24 bytes", "Yes"],
        ["NaCl box", "your secret key and their public key", "24 bytes", "Yes"],
      ],
    },
    "OpenPGP and age carry their own session keys, so there is nothing to size: a message goes to a public key or recipient, or to a password or passphrase. age takes `age1…` X25519 recipients and `age1pq1…` post-quantum ones alike. Pairs for NaCl box, OpenPGP and age are minted on [Keygen](/keygen), which an icon in the public-key fields opens with the right kind selected.",
  ],
  examples: [
    {
      title: "AES-128-GCM, and the same bytes from OpenSSL",
      blocks: [
        {
          code:
            "Key:     000102030405060708090a0b0c0d0e0f   (Key size 128 bits)\nIV:      a0a1a2a3a4a5a6a7a8a9aaab\nMessage: Meet me at noon\n\noKGio6Slpqeoqaqr5+Ndz17kVirrDJVuKX3eKVBePasyKkChjfninCKbrg==",
        },
        "Decoded: the 12 IV bytes, 15 bytes of ciphertext and the 16-byte tag. Node's `createCipheriv(\"aes-128-gcm\", …)`, which is OpenSSL underneath, gives the same ciphertext and tag.",
      ],
    },
    {
      title: "AES-CBC against `openssl enc`",
      blocks: [
        {
          code:
            "$ printf 'hello' | openssl enc -aes-128-cbc \\\n    -K 000102030405060708090a0b0c0d0e0f -iv 000102030405060708090a0b0c0d0e0f | xxd -p\n1dfe836df70e89310a970a31fa3351fd\n\nThe page, Ciphertext encoding Hex:\n000102030405060708090a0b0c0d0e0f1dfe836df70e89310a970a31fa3351fd",
        },
        "The same block with the IV in front. PKCS#7 padding takes the five bytes of `hello` to one 16-byte block.",
      ],
    },
    {
      title: "Why CTR is marked as not noticing edits",
      blocks: [
        {
          code:
            "Message:   Pay Bob 100\nSealed:    000102030405060708090a0b0c0d0e0f5af5729503019265c0f3a4\nEdited:    000102030405060708090a0b0c0d0e0f5af5729503019265c8f3a4\nDecrypted: Pay Bob 900",
        },
        "Same key, AES-CTR, hex. One changed digit turned the `1` into a `9` without the key and without an error. The same edit to an AES-GCM message is refused.",
      ],
    },
  ],
  problems: [
    {
      title: "`Needs 16 bytes, and this is 32`",
      blocks: [
        "The key is 64 hex digits, which is 32 bytes and an AES-256 key, while Key size says 128 bits. A key is judged against the selected size, and the page never trims or pads one to fit.",
      ],
    },
    {
      title: "`Hex takes 0-9 and a-f only` after typing a password",
      blocks: [
        "The key field wants key bytes. Derive them with Argon2, scrypt or PBKDF2 on the [hasher](/hasher) and paste the last field of its output with Key encoding set to Base64, or use OpenPGP's password mode or age's passphrase, which store their own salt.",
      ],
    },
    {
      title: "A ciphertext from another tool will not open",
      blocks: [
        "An authenticated cipher answers a wrong key, a wrong nonce and an edited ciphertext alike, with `That did not decrypt — the key, the nonce or the ciphertext is not the one it was sealed with`. A tool that keeps the IV apart needs it put in front of the ciphertext, and the Ciphertext encoding has to match. `openssl enc` with a password writes a `Salted__` format this page does not read, and refuses GCM with `enc: AEAD ciphers not supported`.",
      ],
    },
    {
      title: "Reusing a nonce",
      blocks: [
        "Nothing redraws the nonce, so a second message under the same key reuses it until you press refresh. Under CTR, GCM and ChaCha20 that exposes the XOR of the two plaintexts, and under GCM and Poly1305 it lets tags be forged. XChaCha20's 24-byte nonce is long enough to draw at random for every message.",
      ],
    },
  ],
  faq: [
    {
      question: "Does the link in the address bar contain the key?",
      answer:
        "Yes. It carries every field on screen, keys, passwords and the message included, which is how it reproduces the same ciphertext. The part after `#` never reaches a server, but it does reach browser history and whoever the link is sent to. The reset button in the header clears the page and the link together.",
    },
    {
      question: "Which cipher should I pick?",
      answer:
        "AES-GCM or XChaCha20-Poly1305 when both sides share a key; XChaCha20's long nonce makes random nonces safe. NaCl box when each side has its own key pair, and age or OpenPGP when the recipient already has a key for one of them. CBC and CTR only when something else authenticates the message.",
    },
    {
      question: "Is this compatible with TweetNaCl?",
      answer:
        "The sealed part is exactly what TweetNaCl's secretbox and box return, tag first, and the page is tested against NaCl's own box vector. The page puts the 24-byte nonce in front, so give TweetNaCl the first 24 bytes as the nonce and the rest as the box.",
    },
  ],
  references: [
    {
      title: "NIST SP 800-38D, Galois/Counter Mode",
      url: "https://csrc.nist.gov/pubs/sp/800/38/d/final",
    },
    { title: "RFC 8439, ChaCha20 and Poly1305", url: "https://www.rfc-editor.org/rfc/rfc8439" },
    { title: "NaCl: crypto_box", url: "https://nacl.cr.yp.to/box.html" },
    { title: "RFC 9580, OpenPGP", url: "https://www.rfc-editor.org/rfc/rfc9580" },
    { title: "The age file format, v1", url: "https://age-encryption.org/v1" },
    {
      title: "SubtleCrypto.encrypt(), MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt",
    },
  ],
} satisfies PageContent;
