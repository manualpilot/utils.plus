import type { PageContent } from "../page-document.ts";

export default {
  related: ["/keygen", "/jwt", "/hasher", "/codec"],
  howItWorks: [
    "Decode takes everything in one box: certificates, signing requests, public and private keys in PEM, SSH public key lines, OpenSSH private keys, PKCS#7 bundles, a DER file opened from disk, or base64 with no armour. Each piece gets a card of its own. A certificate's shows its names, its dates in UTC, its key, its extensions with the critical ones flagged, and SHA-256 and SHA-1 fingerprints beside the SHA-256 of its public key.",
    "Certificates pasted together are put back in chain order, leaf first, linked by issuer name and checked against the key identifiers, and a Chain card says when the paste was out of order or stops short of a self-signed root. A key pasted beside a certificate is compared by its public half, whatever format either is in. No signature is verified, which is why a certificate whose subject and issuer agree is badged Self-issued rather than Self-signed. The expiry badge counts in days within ninety of the date and turns yellow for the last thirty.",
    "Generate writes a self-signed certificate, a root CA, a certificate signed by a CA, or an intermediate signed by a root, with ECDSA P-256 (the default), P-384 or P-521, RSA of 2048 to 4096 bits, or Ed25519. The alternative names default to the common name and the validity to 825 days, or 3650 for an authority. A passphrase encrypts the private key as PBES2, with 100,000 rounds of PBKDF2 and AES-256-CBC. Use as issuer moves an authority you have just made into the boxes that sign the next certificate. For a bare key pair, use the [key generator](/keygen).",
  ],
  examples: [
    {
      title: "A chain pasted root first",
      blocks: [
        "Three certificates from this page's test suite, pasted as root, leaf, intermediate. The Chain card reads:",
        {
          code:
            "Leaf          C=AU, O=utils.plus, CN=example.test\nIntermediate  C=AU, O=utils.plus, CN=utils.plus Test Issuing CA\nRoot          C=AU, O=utils.plus, CN=utils.plus Test Root CA\n\nPasted out of order. A server has to send its chain leaf first, and this is that order.",
        },
        "Leave the intermediate out and the leaf's row says `Nothing here issued C=AU, O=utils.plus, CN=utils.plus Test Issuing CA`. OpenSSL, given the same two, fails with `unable to get local issuer certificate`.",
      ],
    },
    {
      title: "An Ed25519 certificate and its key",
      blocks: [
        {
          code:
            "-----BEGIN CERTIFICATE-----\nMIIBRDCB96ADAgECAhQ4sUYcOqr3BmAYRbuyMtWKLSX/gzAFBgMrZXAwFzEVMBMG\nA1UEAwwMZWQyNTUxOS50ZXN0MCAXDTI1MDEwMTAwMDAwMFoYDzIxMjUwMTAxMDAw\nMDAwWjAXMRUwEwYDVQQDDAxlZDI1NTE5LnRlc3QwKjAFBgMrZXADIQAn3XBAse5H\n1pKe7nhVGuB3x/taF3XDo+9ExJHPjvPgrqNTMFEwHQYDVR0OBBYEFLCYhgSrcFDP\nk/h07fO0gP7syei+MB8GA1UdIwQYMBaAFLCYhgSrcFDPk/h07fO0gP7syei+MA8G\nA1UdEwEB/wQFMAMBAf8wBQYDK2VwA0EAEaw6T3H33v4BJ0NAtKsgB4rQzq+yzpVK\nHwAwen/UQeCg8H4JlR4Wd85bmUQGi0BIqhRCGW9R08dirL6ckcOzCg==\n-----END CERTIFICATE-----\n-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIByQBZCVdcvqyYrhugwW+52RFxWuNWSzD1sSorI89bYC\n-----END PRIVATE KEY-----",
        },
        {
          code:
            "Certificate  ed25519.test · Certificate authority · Self-issued · Private key matches\nSubject             CN=ed25519.test\nNot after           2125-01-01 00:00:00 UTC\nPublic key          Ed25519\nSHA-256             27:91:77:4B:89:00:F3:1A:D3:0D:42:1C:48:9A:93:6E:95:F2:F5:98:77:B1:F2:1A:0E:A5:16:43:C7:01:22:C4\nPublic key SHA-256  dQ9ZzP9MIJZ7SET1rzaSamCV8Ps1Ii1QYrPLI/6Egyk=\n\nPrivate key  Ed25519 · Matches ed25519.test\nFormat              PKCS#8",
        },
        "The key holds only its 32-byte seed, so the page works the public half out before comparing. The fingerprint is the one `openssl x509 -fingerprint -sha256` prints.",
      ],
    },
    {
      title: "An SSH public key",
      blocks: [
        { code: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAHQwB3WqNJNHrQmKHQwa5B2ukwcbSKVr5jSOvGYXq8U ada@example.test" },
        {
          code:
            "Fingerprint         SHA256:BXxgus5qjl4w/pnvtrZbtpev9aqqHi4K0v419Cl584w\nLegacy fingerprint  MD5:21:64:a9:b8:7a:dd:5f:04:e5:67:6a:f9:7d:6e:31:c7",
        },
        "The same two `ssh-keygen -lf` prints, with and without `-E md5`.",
      ],
    },
  ],
  problems: [
    {
      title: "Clients fail with “unable to get local issuer certificate”",
      blocks: [
        "The server is sending its own certificate without the intermediate that issued it. A browser that has seen the intermediate before may cope; curl, OpenSSL and most API clients do not. Paste the file the server is configured with: a leaf row that says `Nothing here issued …` names what is missing.",
      ],
    },
    {
      title: "The key does not match the certificate",
      blocks: [
        "A renewal with a fresh key, or a signing request regenerated after the first one was sent, leaves a key that Matches nothing here. An encrypted key gets no verdict at all, since its public half cannot be read without the passphrase; `openssl pkey -in locked.pem -out key.pem` asks for it and writes the key unencrypted.",
      ],
    },
    {
      title: "A generated certificate is refused",
      blocks: [
        "Nothing trusts a certificate made here until it, or the root that signed it, is imported into the client's trust store. Clients match the host against the alternative names, not the common name, and Apple's platforms refuse a server certificate valid for over 825 days or lacking the TLS server purpose; the defaults meet all three. Validity starts the moment you press Generate, so a device whose clock runs slow calls it not yet valid.",
      ],
    },
  ],
  faq: [
    {
      question: "Does the page check the certificate's signature?",
      answer:
        "No. It links a chain by names and key identifiers, which is enough to put it in order and spot a missing link, but it never verifies that the issuer actually signed the certificate, and it checks no revocation. For the signatures, use `openssl verify -CAfile root.pem -untrusted intermediate.pem leaf.pem`.",
    },
    {
      question: "Is it safe to paste a private key?",
      answer:
        "Everything on this page runs in the tab, and nothing is uploaded. The address carries the page's state for sharing, but every private-key block is removed before it is written, so a link holds only certificates and public keys; the Generate view never puts a private key or passphrase in it.",
    },
    {
      question: "What is the difference between the SHA-256 and the public key SHA-256?",
      answer:
        "The first is a hash of the whole certificate and changes with every reissue. The second is the SHA-256 of the SubjectPublicKeyInfo, base64-encoded, and stays the same for as long as the key does, which is why pins are taken over it.",
    },
  ],
  references: [
    { title: "RFC 5280: X.509 certificate and CRL profile", url: "https://www.rfc-editor.org/rfc/rfc5280" },
    { title: "RFC 7468: Textual encodings of PKIX structures (PEM)", url: "https://www.rfc-editor.org/rfc/rfc7468" },
    { title: "RFC 2986: PKCS #10 certification requests", url: "https://www.rfc-editor.org/rfc/rfc2986" },
    { title: "RFC 8410: Ed25519 and X25519 in X.509", url: "https://www.rfc-editor.org/rfc/rfc8410" },
    { title: "Apple: Requirements for trusted certificates", url: "https://support.apple.com/en-us/103769" },
    { title: "openssl-verify, OpenSSL 3.0 manual", url: "https://docs.openssl.org/3.0/man1/openssl-verify/" },
  ],
} satisfies PageContent;
