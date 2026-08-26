import type { Fact } from "../../common/fact-table";
import type { PrivateReading } from "./keys";
import type { SshKey } from "./ssh";
import type { PublicKey } from "./types";
import type { Certificate, Fingerprints, Request } from "./x509";

export function certificateFacts(certificate: Certificate): Fact[] {
  return [
    { label: "Subject", value: certificate.subject.text },
    { label: "Issuer", value: certificate.issuer.text },
    { label: "Serial number", value: certificate.serial },
    { label: "Not before", value: stamp(certificate.notBefore) },
    { label: "Not after", value: stamp(certificate.notAfter) },
    { label: "Public key", value: certificate.key.label },
    { label: "Signature", value: certificate.signature },
    { label: "Version", value: `v${certificate.version}` },
    ...fingerprintFacts(certificate.fingerprints),
  ];
}

export function requestFacts(request: Request): Fact[] {
  return [
    { label: "Subject", value: request.subject.text },
    { label: "Public key", value: request.key.label },
    { label: "Signature", value: request.signature },
    { label: "Version", value: `v${request.version}` },
    ...request.attributes.map((attribute) => ({ label: attribute.label, value: attribute.value })),
    { label: "Public key SHA-256", value: request.fingerprints.pin },
  ];
}

export function publicKeyFacts(key: PublicKey, pin: string): Fact[] {
  return [
    { label: "Public key", value: key.label },
    { label: "Public exponent", value: key.exponent },
    { label: "Public key SHA-256", value: pin },
  ];
}

export function sshFacts(ssh: SshKey): Fact[] {
  return [
    { label: "Algorithm", value: ssh.type },
    { label: "Public key", value: ssh.certificate ? "" : ssh.key.label },
    { label: "Comment", value: ssh.comment },
    { label: "Fingerprint", value: ssh.sha256 },
    { label: "Legacy fingerprint", value: ssh.md5 },
  ];
}

export function privateKeyFacts(reading: PrivateReading): Fact[] {
  return [
    { label: "Format", value: reading.format },
    { label: "Public key", value: reading.key?.label ?? "" },
    { label: "Public exponent", value: reading.key?.exponent ?? "" },
    { label: "Encryption", value: reading.scheme },
  ];
}

function fingerprintFacts(fingerprints: Fingerprints): Fact[] {
  return [
    { label: "SHA-256", value: fingerprints.sha256 },
    { label: "SHA-1", value: fingerprints.sha1 },
    { label: "Public key SHA-256", value: fingerprints.pin },
  ];
}

const STAMP = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function stamp(date: Date | null): string {
  return date === null ? "" : `${STAMP.format(date).replace(",", "")} UTC`;
}
