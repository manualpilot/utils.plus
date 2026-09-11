import type { PageContent } from "../page-document.ts";

export default {
  related: ["/cryptography", "/certificate", "/jwt", "/password", "/otp"],
  howItWorks: [
    "Pick a key kind and press Generate; every key is made in the tab by the browser's Web Crypto or a bundled library, and nothing is sent anywhere. The share link records the kind and its settings, never a passphrase, a pasted key or anything generated.",
    "SSH keys are Ed25519 (the default), ECDSA on NIST P-256, P-384 or P-521, or RSA at 2048, 3072 or 4096 bits. The page writes OpenSSH's own formats by hand: the one-line public key for `authorized_keys`, and an `openssh-key-v1` private key file. A passphrase encrypts that file the way `ssh-keygen` does by default, with `aes256-ctr` under `bcrypt_pbkdf` at 16 rounds, and the fingerprint is the `SHA256:` form `ssh-keygen -l` prints.",
    {
      table: [
        ["Kind", "What it writes"],
        ["PGP key", "An armoured key pair for a name and optional email, on Curve25519, NIST ECDSA or RSA"],
        [
          "JSON Web Key",
          "One key or a set of up to 8, for 27 JWA algorithms from EdDSA to AES key wrap, with `kid`, `use` and `alg` filled in",
        ],
        ["WireGuard keys", "A server and a client configuration, each naming the other's public key"],
        [
          "age identity",
          "The three-line file `age-keygen` writes, a post-quantum ML-KEM-768 hybrid unless unticked, or the recipients file `age-keygen -y` derives from one",
        ],
        ["NaCl box keys", "An X25519 secret and public key in the encoding you pick"],
        ["Random secret", "1 to 512 random bytes in hex, Base64, Base32 or decimal, drawn as you change the size"],
      ],
    },
    "A JWK's `use` follows from its algorithm: the RSA-OAEP, ECDH-ES and key-wrap families are `enc` and the rest `sig`. HMAC and AES key-wrap keys are one `oct` key with no public half. The `kid` defaults to the RFC 7638 SHA-256 thumbprint.",
  ],
  examples: [
    {
      title: "An Ed25519 key for `authorized_keys`",
      blocks: [
        {
          code:
            "Comment: ada@example.com\n\nssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMwsaL+l3aEpBNd9fjvyPv7GHaW85hI7deNXZtA+vqOr ada@example.com\nSHA256:bvQFWto1kLK9Ag0OPlDRncp5nD7PjFfVS9jtFcDQU+g",
        },
        "One real run. `ssh-keygen -l` prints the same fingerprint for the public line and for the private file, and `ssh-keygen -y` recovers the same line from the file. Every Ed25519 line starts `AAAAC3NzaC1lZDI1NTE5`, the key type encoded inside the Base64.",
      ],
    },
    {
      title: "An ES256 public key named by its thumbprint",
      blocks: [
        {
          code:
            "{\n  \"kty\": \"EC\",\n  \"kid\": \"9Wls7JA_1M9tBnNdblfJpCS5YZ-4HQCgf7vaTSRE89o\",\n  \"use\": \"sig\",\n  \"alg\": \"ES256\",\n  \"crv\": \"P-256\",\n  \"x\": \"s5YGsZL_kphkmbW-_V09gEIB7VF0GYE60pwxNJOfm7I\",\n  \"y\": \"u3-V9ZLght6z8WxTzA7dVc0RumO6V-tg0tFccXTv5lA\"\n}",
        },
        "One real run with the defaults. The `kid` is the SHA-256 of `crv`, `kty`, `x` and `y` alone, in that order and with no spaces, so the private half, which adds `d`, carries the same one. Python's `hashlib` gives the same value from those four members.",
      ],
    },
    {
      title: "A recipients file from an age identity",
      blocks: [
        {
          code:
            "AGE-SECRET-KEY-1ZXWES3W2KQ50AFDNN37KEG45263ARY5L350MLDKW955UQ59X3T4QS7KT4D\n\nage1qmlv9j7xytqefw7shj7a95nuywn69faujkc9j9qr4tqqtqysjdns0rpe6x",
        },
        "A throwaway identity pasted in with Output set to Recipients file. The result is what `age-keygen -y` prints for the same file. Comment lines are skipped, so a whole identity file can go in as it is.",
      ],
    },
  ],
  problems: [
    {
      title: "`bad permissions` when using the key",
      blocks: [
        "OpenSSH ignores a private key other users can read, with `Permissions 0644 for 'id_ed25519' are too open`. Save it, then run `chmod 600 ~/.ssh/id_ed25519`.",
      ],
    },
    {
      title: "`error in libcrypto` when loading the key",
      blocks: [
        "The file has lost its final newline or gained Windows line endings. The page writes a newline after `-----END OPENSSH PRIVATE KEY-----` and the copy button includes it, but some editors strip it or save CRLF, and `ssh-keygen` refuses either with that message.",
      ],
    },
    {
      title: "A post-quantum age recipient is nearly 2,000 characters",
      blocks: [
        "The age identity opens as an ML-KEM-768 hybrid, whose `age1pq1…` recipient runs to about 1,960 characters against 62 for X25519, and only age implementations that know the hybrid type can encrypt to it. Untick Post-quantum for the classic kind.",
      ],
    },
  ],
  faq: [
    {
      question: "Which SSH key type should I choose?",
      answer:
        "Ed25519, unless a server or device only accepts RSA or ECDSA. Its public key is one 80-character line before the comment, and it is the kind the page opens on. For RSA the page opens at 3072 bits; 4096 takes noticeably longer to generate.",
    },
    {
      question: "Why is ES512 on P-521?",
      answer:
        "Because JWA pairs SHA-512 with the NIST curve of 521 bits, not 512. The page writes `\"crv\": \"P-521\"` for ES512 keys; ES256 and ES384 use P-256 and P-384, where the numbers do match.",
    },
    {
      question: "How do I get the public key back from a private one?",
      answer:
        "For SSH, run `ssh-keygen -y -f` on the private file. For age, set Output to Recipients file and paste the identity. For WireGuard, paste the private key as Server private key and its public key appears under `[Peer]` in the client configuration. A PGP private key block already contains its public key.",
    },
    {
      question: "Can I use these keys on the cryptography page?",
      answer:
        "Yes. NaCl box keys, PGP keys and age identities paste straight into the matching fields of the [cryptography](/cryptography) page, and its public-key fields link back here with the right kind already selected. A random secret of the key size a cipher asks for works as its key.",
    },
  ],
  references: [
    { title: "PROTOCOL.key, OpenSSH", url: "https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.key" },
    { title: "ssh-keygen(1), OpenBSD manual page", url: "https://man.openbsd.org/ssh-keygen.1" },
    { title: "RFC 7517, JSON Web Key", url: "https://www.rfc-editor.org/rfc/rfc7517" },
    { title: "RFC 7638, JWK Thumbprint", url: "https://www.rfc-editor.org/rfc/rfc7638" },
    { title: "The age file format, v1", url: "https://age-encryption.org/v1" },
    { title: "WireGuard quick start", url: "https://www.wireguard.com/quickstart/" },
  ],
} satisfies PageContent;
