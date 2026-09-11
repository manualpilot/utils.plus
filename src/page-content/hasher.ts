import type { PageContent } from "../page-document.ts";

export default {
  related: ["/codec", "/cryptography", "/password", "/hex"],
  howItWorks: [
    "For the fast hashes the digest follows every keystroke. Text is hashed as its UTF-8 bytes exactly as typed, with no newline added, and written in hex, uppercase hex or Base64, plus URL-safe Base64 for the cryptographic hashes and decimal for the checksums.",
    "Switch the input to File and the file is read from disk a chunk at a time. The cryptographic hashes and both CRCs keep only their running state, so a disc image costs no more memory than a sentence; xxHash and MurmurHash are single-pass here, and the page says when it has to hold the whole file for them. Nothing is uploaded: text, files and digests stay in the tab.",
    "The four password hashes are slow on purpose, so they run when you press Compute, and they take typed text only. Each opens with a fresh random salt and writes the encoded string a password database stores, with the salt and the hash in unpadded Base64:",
    {
      table: [
        ["Algorithm", "Opens with", "Writes"],
        ["Argon2id, Argon2i, Argon2d", "19,456 KiB, 2 iterations, 1 lane", "`$argon2id$v=19$m=19456,t=2,p=1$…$…`"],
        ["bcrypt", "cost 10", "`$2b$10$`, 22 characters of salt, 31 of hash"],
        ["scrypt", "cost 15 (N = 32,768), r = 8, p = 1", "`$scrypt$ln=15,r=8,p=1$…$…`"],
        ["PBKDF2-HMAC-SHA256, -SHA512, -SHA1", "600,000 iterations", "`$pbkdf2-sha256$i=600000$…$…`"],
      ],
    },
  ],
  examples: [
    {
      title: "A word, and the same word with a newline",
      blocks: [
        {
          code:
            "hello\n2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824\nLPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=   (the same, in Base64)\n\nhello, then a newline\n5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
        },
        "Both are SHA-256. The second is what `echo hello | sha256sum` prints, because `echo` adds a newline; press Enter after the word and the page gives it too.",
      ],
    },
    {
      title: "The CRC check value",
      blocks: [
        {
          code:
            "123456789\n\nCRC-32 (IEEE 802.3):  cbf43926   decimal 3421780262\nCRC-32C (Castagnoli): e3069283   decimal 3808858755",
        },
        "`123456789` is the input every CRC is checked against. The decimal is the integer Python's `zlib.crc32` returns.",
      ],
    },
    {
      title: "Argon2id with a fixed salt",
      blocks: [
        {
          code:
            "Password: correct horse\nSalt:     saltsalt\n\n$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$pEoTT/PQJUrQ+4Qp3XrtcTufBun4D9FCw+dj/PBsWHI",
        },
        "The defaults were left as they open. `c2FsdHNhbHQ` is `saltsalt` in Base64 and the last field is the 32-byte hash, so the string carries everything a verifier needs except the password. The [codec](/codec) turns either field into hex.",
      ],
    },
  ],
  problems: [
    {
      title: "The digest does not match `sha256sum`",
      blocks: [
        "Nearly always a line ending. `echo` appends a newline, a file saved on Windows ends its lines in CRLF, and text pasted into the box has its line breaks turned into plain LF by the browser. To hash the bytes on disk, use the File input; the [hex editor](/hex) shows whether a file's lines end in `0d 0a`.",
      ],
    },
    {
      title: "SHA3-256 does not match an Ethereum hash",
      blocks: [
        "Ethereum uses Keccak-256, the submission SHA-3 was standardised from, which pads its input differently. The empty string is `a7ffc6f8…80f8434a` under SHA3-256 and `c5d24601…5d85a470` under Keccak-256. Pick Keccak-256 (pre-standard) under SHA-3.",
      ],
    },
    {
      title: "Another tool derives a different hash from the same salt",
      blocks: [
        "The salt is used as UTF-8 text, exactly as typed. The random salt the page fills in is 16 random bytes written as 32 hex characters, and those 32 characters are the salt: a tool that decodes the hex first is hashing 16 different bytes. The Base64 field in the encoded string is the bytes actually used. Argon2's Memory is in kibibytes.",
      ],
    },
    {
      title: "bcrypt ignores the end of a long password",
      blocks: [
        "bcrypt reads the first 72 bytes and drops the rest, so 72 `a`s and 72 `a`s followed by `b` give the same hash under the same salt. A character outside ASCII takes two to four of those bytes. The page says so under the box once a password passes the limit.",
      ],
    },
  ],
  faq: [
    {
      question: "Are MD5 and SHA-1 still safe to use?",
      answer:
        "For spotting accidental corruption, yes. For anything an attacker can choose, no: practical collisions have been published for both, so two different files can share a digest. Use SHA-256, SHA-3, BLAKE2 or BLAKE3 where somebody might want to forge a match, and never store passwords under any fast hash.",
    },
    {
      question: "Which password hash should I use?",
      answer:
        "Argon2id where you can. The page opens it at OWASP's minimum of 19 MiB, 2 iterations and 1 lane, bcrypt at OWASP's cost of 10, and PBKDF2-HMAC-SHA256 at its 600,000 iterations. scrypt opens at N = 32,768 with r = 8 and p = 1, which is below OWASP's floor, so raise Cost to 17 or Parallelism to 3.",
    },
    {
      question: "How do I make a Subresource Integrity hash?",
      answer:
        "Switch the input to File and choose the script or stylesheet, pick SHA-512 with the SHA-384 variant, and set the output to Base64. Put `sha384-` in front of the result and use it as the `integrity` attribute. The hash covers the exact bytes the server sends, so a minified copy has a different one.",
    },
  ],
  references: [
    { title: "FIPS 180-4, Secure Hash Standard", url: "https://csrc.nist.gov/pubs/fips/180-4/upd1/final" },
    { title: "FIPS 202, SHA-3 Standard", url: "https://csrc.nist.gov/pubs/fips/202/final" },
    { title: "RFC 9106, Argon2", url: "https://www.rfc-editor.org/rfc/rfc9106" },
    { title: "RFC 7914, the scrypt key derivation function", url: "https://www.rfc-editor.org/rfc/rfc7914" },
    {
      title: "OWASP Password Storage Cheat Sheet",
      url: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html",
    },
    {
      title: "Subresource Integrity, MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity",
    },
  ],
} satisfies PageContent;
