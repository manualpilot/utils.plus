export type WifiSecurity = "WPA" | "WEP" | "nopass";

export const SECURITY_OPTIONS = [
  { value: "WPA", label: "WPA/WPA2/WPA3" },
  { value: "WEP", label: "WEP" },
  { value: "nopass", label: "None" },
];

export interface WifiFields {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

export function pickSecurity(value: unknown): WifiSecurity {
  return value === "WEP" || value === "nopass" ? value : "WPA";
}

export function writeWifi(fields: WifiFields): string {
  const ssid = fields.ssid.trim();
  if (!ssid) return "";
  const parts = [`T:${fields.security}`, `S:${wifiValue(ssid)}`];
  if (fields.security !== "nopass" && fields.password) parts.push(`P:${wifiValue(fields.password)}`);
  if (fields.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export function ssidProblem(ssid: string): string | null {
  const trimmed = ssid.trim();
  if (!trimmed) return null;
  return new TextEncoder().encode(trimmed).length > MAX_SSID_BYTES ? `A network name is ${MAX_SSID_BYTES} bytes` : null;
}

export function keyProblem(password: string, security: WifiSecurity): string | null {
  if (security === "nopass" || !password) return null;
  const hex = HEX.test(password);
  const length = password.length;
  if (security === "WEP") {
    const ok = length === 5 || length === 13 || hex && (length === 10 || length === 26);
    return ok ? null : "A WEP key is 5 or 13 characters, or 10 or 26 hex digits";
  }
  return length >= 8 && length <= 63 || hex && length === 64
    ? null
    : "A WPA key is 8 to 63 characters, or 64 hex digits";
}

const MAX_SSID_BYTES = 32;

const HEX = /^[0-9a-f]+$/i;

function wifiValue(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}
