export const SIGNATURE_NAMES: Record<string, string> = {
  "1.2.840.113549.1.1.2": "MD2 with RSA",
  "1.2.840.113549.1.1.4": "MD5 with RSA",
  "1.2.840.113549.1.1.5": "SHA-1 with RSA",
  "1.2.840.113549.1.1.10": "RSASSA-PSS",
  "1.2.840.113549.1.1.11": "SHA-256 with RSA",
  "1.2.840.113549.1.1.12": "SHA-384 with RSA",
  "1.2.840.113549.1.1.13": "SHA-512 with RSA",
  "1.2.840.113549.1.1.14": "SHA-224 with RSA",
  "1.2.840.10040.4.3": "SHA-1 with DSA",
  "2.16.840.1.101.3.4.3.1": "SHA-224 with DSA",
  "2.16.840.1.101.3.4.3.2": "SHA-256 with DSA",
  "1.2.840.10045.4.1": "SHA-1 with ECDSA",
  "1.2.840.10045.4.3.1": "SHA-224 with ECDSA",
  "1.2.840.10045.4.3.2": "SHA-256 with ECDSA",
  "1.2.840.10045.4.3.3": "SHA-384 with ECDSA",
  "1.2.840.10045.4.3.4": "SHA-512 with ECDSA",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
  "2.16.840.1.101.3.4.3.13": "SHA3-256 with RSA",
  "2.16.840.1.101.3.4.3.14": "SHA3-384 with RSA",
  "2.16.840.1.101.3.4.3.15": "SHA3-512 with RSA",
};

export const RSA_ENCRYPTION = "1.2.840.113549.1.1.1";
export const RSA_PSS = "1.2.840.113549.1.1.10";
export const EC_PUBLIC_KEY = "1.2.840.10045.2.1";
export const DSA_PUBLIC_KEY = "1.2.840.10040.4.1";
export const ED25519 = "1.3.101.112";
export const ED448 = "1.3.101.113";
export const X25519 = "1.3.101.110";
export const X448 = "1.3.101.111";

export const EDWARDS: Record<string, { label: string; bits: number }> = {
  [ED25519]: { label: "Ed25519", bits: 255 },
  [ED448]: { label: "Ed448", bits: 448 },
  [X25519]: { label: "X25519", bits: 255 },
  [X448]: { label: "X448", bits: 448 },
};

export const CURVES: Record<string, { label: string; bits: number }> = {
  "1.2.840.10045.3.1.1": { label: "P-192", bits: 192 },
  "1.3.132.0.33": { label: "P-224", bits: 224 },
  "1.2.840.10045.3.1.7": { label: "P-256", bits: 256 },
  "1.3.132.0.34": { label: "P-384", bits: 384 },
  "1.3.132.0.35": { label: "P-521", bits: 521 },
  "1.3.132.0.10": { label: "secp256k1", bits: 256 },
  "1.3.36.3.3.2.8.1.1.7": { label: "brainpoolP256r1", bits: 256 },
  "1.3.36.3.3.2.8.1.1.11": { label: "brainpoolP384r1", bits: 384 },
  "1.3.36.3.3.2.8.1.1.13": { label: "brainpoolP512r1", bits: 512 },
};

export const ATTRIBUTES: Record<string, { short: string; label: string }> = {
  "2.5.4.3": { short: "CN", label: "Common name" },
  "2.5.4.4": { short: "SN", label: "Surname" },
  "2.5.4.5": { short: "serialNumber", label: "Serial number" },
  "2.5.4.6": { short: "C", label: "Country" },
  "2.5.4.7": { short: "L", label: "Locality" },
  "2.5.4.8": { short: "ST", label: "State or province" },
  "2.5.4.9": { short: "STREET", label: "Street" },
  "2.5.4.10": { short: "O", label: "Organisation" },
  "2.5.4.11": { short: "OU", label: "Organisational unit" },
  "2.5.4.12": { short: "title", label: "Title" },
  "2.5.4.15": { short: "businessCategory", label: "Business category" },
  "2.5.4.17": { short: "postalCode", label: "Postal code" },
  "2.5.4.42": { short: "GN", label: "Given name" },
  "2.5.4.43": { short: "initials", label: "Initials" },
  "2.5.4.46": { short: "dnQualifier", label: "Name qualifier" },
  "2.5.4.65": { short: "pseudonym", label: "Pseudonym" },
  "2.5.4.97": { short: "organizationIdentifier", label: "Organisation identifier" },
  "0.9.2342.19200300.100.1.1": { short: "UID", label: "User ID" },
  "0.9.2342.19200300.100.1.25": { short: "DC", label: "Domain component" },
  "1.2.840.113549.1.9.1": { short: "emailAddress", label: "Email" },
  "1.3.6.1.4.1.311.60.2.1.1": { short: "jurisdictionL", label: "Jurisdiction locality" },
  "1.3.6.1.4.1.311.60.2.1.2": { short: "jurisdictionST", label: "Jurisdiction state" },
  "1.3.6.1.4.1.311.60.2.1.3": { short: "jurisdictionC", label: "Jurisdiction country" },
};

export const EXTENSIONS: Record<string, string> = {
  "2.5.29.9": "Subject directory attributes",
  "2.5.29.14": "Subject key identifier",
  "2.5.29.16": "Private key usage period",
  "2.5.29.15": "Key usage",
  "2.5.29.17": "Subject alternative name",
  "2.5.29.18": "Issuer alternative name",
  "2.5.29.19": "Basic constraints",
  "2.5.29.30": "Name constraints",
  "2.5.29.31": "CRL distribution points",
  "2.5.29.32": "Certificate policies",
  "2.5.29.33": "Policy mappings",
  "2.5.29.35": "Authority key identifier",
  "2.5.29.36": "Policy constraints",
  "2.5.29.37": "Extended key usage",
  "2.5.29.46": "Freshest CRL",
  "2.5.29.54": "Inhibit anyPolicy",
  "1.3.6.1.5.5.7.1.1": "Authority information access",
  "1.3.6.1.5.5.7.1.11": "Subject information access",
  "1.3.6.1.5.5.7.1.24": "TLS feature",
  "1.3.6.1.4.1.11129.2.4.2": "Signed certificate timestamps",
  "1.3.6.1.5.5.7.48.1.5": "OCSP no check",
  "2.16.840.1.113730.1.1": "Netscape certificate type",
  "2.16.840.1.113730.1.13": "Netscape comment",
};

export const KEY_USAGES = [
  "Digital signature",
  "Non-repudiation",
  "Key encipherment",
  "Data encipherment",
  "Key agreement",
  "Certificate signing",
  "CRL signing",
  "Encipher only",
  "Decipher only",
];

export const EXTENDED_KEY_USAGES: Record<string, string> = {
  "2.5.29.37.0": "Any purpose",
  "1.3.6.1.5.5.7.3.1": "TLS server",
  "1.3.6.1.5.5.7.3.2": "TLS client",
  "1.3.6.1.5.5.7.3.3": "Code signing",
  "1.3.6.1.5.5.7.3.4": "Email protection",
  "1.3.6.1.5.5.7.3.5": "IPsec end system",
  "1.3.6.1.5.5.7.3.6": "IPsec tunnel",
  "1.3.6.1.5.5.7.3.7": "IPsec user",
  "1.3.6.1.5.5.7.3.8": "Time stamping",
  "1.3.6.1.5.5.7.3.9": "OCSP signing",
  "1.3.6.1.5.5.7.3.17": "IPsec IKE",
  "1.3.6.1.4.1.311.10.3.3": "Server gated cryptography",
  "1.3.6.1.4.1.311.10.3.4": "Encrypting file system",
  "1.3.6.1.4.1.311.20.2.2": "Smartcard logon",
  "1.3.6.1.5.2.3.5": "Kerberos PKINIT",
};

export const ACCESS_METHODS: Record<string, string> = {
  "1.3.6.1.5.5.7.48.1": "OCSP",
  "1.3.6.1.5.5.7.48.2": "CA issuers",
  "1.3.6.1.5.5.7.48.3": "Time stamping",
  "1.3.6.1.5.5.7.48.5": "CA repository",
};

export const POLICIES: Record<string, string> = {
  "2.23.140.1.2.1": "Domain validated",
  "2.23.140.1.2.2": "Organisation validated",
  "2.23.140.1.2.3": "Individual validated",
  "2.23.140.1.1": "Extended validation",
  "2.5.29.32.0": "Any policy",
};

export const REQUEST_ATTRIBUTES: Record<string, string> = {
  "1.2.840.113549.1.9.7": "Challenge password",
  "1.2.840.113549.1.9.14": "Requested extensions",
  "1.2.840.113549.1.9.2": "Unstructured name",
  "1.3.6.1.4.1.311.13.2.3": "Operating system version",
};

export const ENCRYPTION_SCHEMES: Record<string, string> = {
  "1.2.840.113549.1.5.13": "PBES2",
  "1.2.840.113549.1.5.3": "PBE with MD5 and DES",
  "1.2.840.113549.1.5.12": "PBKDF2",
  "1.2.840.113549.1.12.1.3": "PBE with SHA-1 and 3-key triple DES",
  "1.2.840.113549.1.12.1.6": "PBE with SHA-1 and 40-bit RC2",
  "2.16.840.1.101.3.4.1.2": "AES-128-CBC",
  "2.16.840.1.101.3.4.1.42": "AES-256-CBC",
};

export function named(table: Record<string, string>, oid: string): string {
  return table[oid] ?? oid;
}
