export type ValueKind = "none" | "text" | "body";

export type GroupName = typeof GROUPS[number];

export interface OptionSpec {
  name: string;
  short?: string;
  label: string;
  group: GroupName;
  value: ValueKind;
  repeatable?: boolean;
  placeholder?: string;
  hint?: string;
  choices?: readonly string[];
}

export const GROUPS = [
  "Request",
  "Data",
  "Authentication",
  "TLS",
  "Connection",
  "Proxy",
  "Output",
  "Behaviour",
] as const;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

export const OPTIONS: readonly OptionSpec[] = [
  {
    name: "--request",
    short: "-X",
    label: "Method",
    group: "Request",
    value: "text",
    placeholder: "GET",
    hint: "The method to use, whatever the body says",
    choices: METHODS,
  },
  {
    name: "--header",
    short: "-H",
    label: "Header",
    group: "Request",
    value: "text",
    repeatable: true,
    placeholder: "Content-Type: application/json",
    hint: "One header per row, written as it goes on the wire",
  },
  {
    name: "--user-agent",
    short: "-A",
    label: "User agent",
    group: "Request",
    value: "text",
    placeholder: "curl/8.0.0",
  },
  {
    name: "--referer",
    short: "-e",
    label: "Referer",
    group: "Request",
    value: "text",
    placeholder: "https://example.com",
  },
  {
    name: "--cookie",
    short: "-b",
    label: "Cookie",
    group: "Request",
    value: "text",
    repeatable: true,
    placeholder: "name=value",
    hint: "A pair to send, or the file to read a jar from",
  },
  {
    name: "--cookie-jar",
    short: "-c",
    label: "Cookie jar",
    group: "Request",
    value: "text",
    placeholder: "cookies.txt",
  },
  { name: "--get", short: "-G", label: "Send the data as a query", group: "Request", value: "none" },
  { name: "--head", short: "-I", label: "Headers only", group: "Request", value: "none" },
  { name: "--range", short: "-r", label: "Range", group: "Request", value: "text", placeholder: "0-1023" },
  {
    name: "--time-cond",
    short: "-z",
    label: "Only if modified",
    group: "Request",
    value: "text",
    placeholder: "2026-01-01",
  },

  {
    name: "--data",
    short: "-d",
    label: "Data",
    group: "Data",
    value: "body",
    repeatable: true,
    placeholder: "name=widget",
    hint: "Sent as a POST body, with newlines stripped",
  },
  {
    name: "--data-raw",
    label: "Data, raw",
    group: "Data",
    value: "body",
    repeatable: true,
    hint: "As --data, but a leading @ is a character rather than a file",
  },
  {
    name: "--data-binary",
    label: "Data, binary",
    group: "Data",
    value: "body",
    repeatable: true,
    hint: "Sent byte for byte, newlines and all",
  },
  {
    name: "--data-urlencode",
    label: "Data, encoded",
    group: "Data",
    value: "body",
    repeatable: true,
    placeholder: "q=two words",
    hint: "Encoded for you before it is sent",
  },
  { name: "--data-ascii", label: "Data, ASCII", group: "Data", value: "body", repeatable: true },
  {
    name: "--json",
    label: "JSON",
    group: "Data",
    value: "body",
    repeatable: true,
    placeholder: "{\"name\":\"widget\"}",
    hint: "The body, both content types and a POST, in one argument",
  },
  {
    name: "--form",
    short: "-F",
    label: "Form field",
    group: "Data",
    value: "text",
    repeatable: true,
    placeholder: "file=@report.pdf",
    hint: "A multipart part; @ reads a file and < reads its contents",
  },
  {
    name: "--form-string",
    label: "Form field, literal",
    group: "Data",
    value: "text",
    repeatable: true,
    placeholder: "note=@home",
  },
  {
    name: "--upload-file",
    short: "-T",
    label: "Upload file",
    group: "Data",
    value: "text",
    repeatable: true,
    placeholder: "report.pdf",
  },

  {
    name: "--user",
    short: "-u",
    label: "Credentials",
    group: "Authentication",
    value: "text",
    placeholder: "user:password",
  },
  { name: "--oauth2-bearer", label: "Bearer token", group: "Authentication", value: "text" },
  {
    name: "--aws-sigv4",
    label: "AWS signature",
    group: "Authentication",
    value: "text",
    placeholder: "aws:amz:eu-west-1:s3",
  },
  { name: "--netrc", short: "-n", label: "Read .netrc", group: "Authentication", value: "none" },
  { name: "--netrc-file", label: "Read a .netrc", group: "Authentication", value: "text", placeholder: ".netrc" },
  { name: "--basic", label: "Basic auth", group: "Authentication", value: "none" },
  { name: "--digest", label: "Digest auth", group: "Authentication", value: "none" },
  { name: "--ntlm", label: "NTLM auth", group: "Authentication", value: "none" },
  { name: "--negotiate", label: "Negotiate auth", group: "Authentication", value: "none" },
  { name: "--anyauth", label: "Any auth the server offers", group: "Authentication", value: "none" },

  { name: "--insecure", short: "-k", label: "Skip certificate checks", group: "TLS", value: "none" },
  { name: "--cacert", label: "CA bundle", group: "TLS", value: "text", placeholder: "ca-bundle.crt" },
  { name: "--capath", label: "CA directory", group: "TLS", value: "text" },
  { name: "--cert", short: "-E", label: "Client certificate", group: "TLS", value: "text", placeholder: "client.pem" },
  {
    name: "--cert-type",
    label: "Certificate type",
    group: "TLS",
    value: "text",
    choices: ["PEM", "DER", "ENG", "P12"],
  },
  { name: "--key", label: "Private key", group: "TLS", value: "text", placeholder: "client.key" },
  { name: "--key-type", label: "Key type", group: "TLS", value: "text", choices: ["PEM", "DER", "ENG"] },
  { name: "--ciphers", label: "Ciphers", group: "TLS", value: "text" },
  { name: "--pinnedpubkey", label: "Pinned public key", group: "TLS", value: "text", placeholder: "sha256//…" },
  { name: "--tlsv1.2", label: "TLS 1.2 at least", group: "TLS", value: "none" },
  { name: "--tlsv1.3", label: "TLS 1.3 at least", group: "TLS", value: "none" },

  {
    name: "--connect-timeout",
    label: "Connect timeout",
    group: "Connection",
    value: "text",
    placeholder: "10",
    hint: "Seconds",
  },
  {
    name: "--max-time",
    short: "-m",
    label: "Total timeout",
    group: "Connection",
    value: "text",
    placeholder: "30",
    hint: "Seconds",
  },
  { name: "--retry", label: "Retries", group: "Connection", value: "text", placeholder: "3" },
  {
    name: "--retry-delay",
    label: "Retry delay",
    group: "Connection",
    value: "text",
    placeholder: "2",
    hint: "Seconds",
  },
  {
    name: "--retry-max-time",
    label: "Retry window",
    group: "Connection",
    value: "text",
    placeholder: "60",
    hint: "Seconds",
  },
  { name: "--limit-rate", label: "Rate limit", group: "Connection", value: "text", placeholder: "200K" },
  { name: "--interface", label: "Interface", group: "Connection", value: "text", placeholder: "eth0" },
  {
    name: "--unix-socket",
    label: "Unix socket",
    group: "Connection",
    value: "text",
    placeholder: "/var/run/docker.sock",
  },
  {
    name: "--resolve",
    label: "Resolve to",
    group: "Connection",
    value: "text",
    repeatable: true,
    placeholder: "example.com:443:127.0.0.1",
  },
  {
    name: "--connect-to",
    label: "Connect to",
    group: "Connection",
    value: "text",
    repeatable: true,
    placeholder: "::example.com:8443",
  },
  { name: "--compressed", label: "Ask for compression", group: "Connection", value: "none" },
  { name: "--tcp-nodelay", label: "No Nagle delay", group: "Connection", value: "none" },
  { name: "--ipv4", short: "-4", label: "IPv4 only", group: "Connection", value: "none" },
  { name: "--ipv6", short: "-6", label: "IPv6 only", group: "Connection", value: "none" },
  { name: "--http1.0", short: "-0", label: "HTTP/1.0", group: "Connection", value: "none" },
  { name: "--http1.1", label: "HTTP/1.1", group: "Connection", value: "none" },
  { name: "--http2", label: "HTTP/2", group: "Connection", value: "none" },
  { name: "--http3", label: "HTTP/3", group: "Connection", value: "none" },

  { name: "--proxy", short: "-x", label: "Proxy", group: "Proxy", value: "text", placeholder: "http://127.0.0.1:8080" },
  {
    name: "--proxy-user",
    short: "-U",
    label: "Proxy credentials",
    group: "Proxy",
    value: "text",
    placeholder: "user:password",
  },
  { name: "--proxy-header", label: "Proxy header", group: "Proxy", value: "text", repeatable: true },
  { name: "--noproxy", label: "No proxy for", group: "Proxy", value: "text", placeholder: "localhost,127.0.0.1" },
  { name: "--socks5", label: "SOCKS5 proxy", group: "Proxy", value: "text", placeholder: "127.0.0.1:1080" },
  { name: "--socks5-hostname", label: "SOCKS5 proxy, remote DNS", group: "Proxy", value: "text" },
  { name: "--proxy-insecure", label: "Skip proxy certificate checks", group: "Proxy", value: "none" },

  {
    name: "--output",
    short: "-o",
    label: "Write to",
    group: "Output",
    value: "text",
    repeatable: true,
    placeholder: "response.json",
    hint: "One per URL, in the order the URLs are given",
  },
  { name: "--remote-name", short: "-O", label: "Write to the remote name", group: "Output", value: "none" },
  {
    name: "--remote-header-name",
    short: "-J",
    label: "Take the name from the headers",
    group: "Output",
    value: "none",
  },
  { name: "--output-dir", label: "Write into", group: "Output", value: "text", placeholder: "downloads" },
  { name: "--create-dirs", label: "Create the directories", group: "Output", value: "none" },
  {
    name: "--dump-header",
    short: "-D",
    label: "Dump headers to",
    group: "Output",
    value: "text",
    placeholder: "headers.txt",
  },
  { name: "--write-out", short: "-w", label: "Write out", group: "Output", value: "text", placeholder: "%{http_code}" },
  { name: "--include", short: "-i", label: "Include the headers", group: "Output", value: "none" },
  { name: "--silent", short: "-s", label: "Silent", group: "Output", value: "none" },
  { name: "--show-error", short: "-S", label: "Show errors anyway", group: "Output", value: "none" },
  { name: "--verbose", short: "-v", label: "Verbose", group: "Output", value: "none" },
  { name: "--progress-bar", short: "-#", label: "Progress bar", group: "Output", value: "none" },
  { name: "--no-progress-meter", label: "No progress meter", group: "Output", value: "none" },
  { name: "--trace", label: "Trace to", group: "Output", value: "text", placeholder: "trace.txt" },
  { name: "--trace-ascii", label: "Trace, readable, to", group: "Output", value: "text", placeholder: "trace.txt" },

  { name: "--location", short: "-L", label: "Follow redirects", group: "Behaviour", value: "none" },
  { name: "--location-trusted", label: "Follow redirects, keep credentials", group: "Behaviour", value: "none" },
  { name: "--max-redirs", label: "Redirect limit", group: "Behaviour", value: "text", placeholder: "10" },
  { name: "--fail", short: "-f", label: "Fail on an error status", group: "Behaviour", value: "none" },
  { name: "--fail-with-body", label: "Fail, but keep the body", group: "Behaviour", value: "none" },
  { name: "--continue-at", short: "-C", label: "Resume at", group: "Behaviour", value: "text", placeholder: "-" },
  { name: "--globoff", short: "-g", label: "No globbing", group: "Behaviour", value: "none" },
  { name: "--path-as-is", label: "Leave the path alone", group: "Behaviour", value: "none" },
  { name: "--parallel", short: "-Z", label: "Transfer in parallel", group: "Behaviour", value: "none" },
  { name: "--no-buffer", short: "-N", label: "No output buffering", group: "Behaviour", value: "none" },
  { name: "--remote-time", short: "-R", label: "Keep the remote timestamp", group: "Behaviour", value: "none" },
  { name: "--junk-session-cookies", short: "-j", label: "Drop session cookies", group: "Behaviour", value: "none" },
];

export const URL_FLAG = "--url";

const BY_NAME = new Map(OPTIONS.map((option) => [option.name, option]));
const BY_SHORT = new Map(OPTIONS.filter((option) => option.short).map((option) => [option.short!.slice(1), option]));

export function findLong(name: string): OptionSpec | undefined {
  return BY_NAME.get(name);
}

export function findShort(letter: string): OptionSpec | undefined {
  return BY_SHORT.get(letter);
}

export function flagsOf(spec: OptionSpec): string {
  return spec.short ? `${spec.short}, ${spec.name}` : spec.name;
}

export function defaultFlag(spec: OptionSpec): string {
  return spec.short ?? spec.name;
}

export function addableOptions(present: ReadonlySet<string>): SelectGroup[] {
  return GROUPS.map((group) => ({
    group,
    items: OPTIONS
      .filter((option) => option.group === group && (option.repeatable || !present.has(option.name)))
      .map((option) => ({ value: option.name, label: `${option.label} (${flagsOf(option)})` })),
  })).filter((entry) => entry.items.length > 0);
}

export interface SelectGroup {
  group: string;
  items: { value: string; label: string }[];
}
