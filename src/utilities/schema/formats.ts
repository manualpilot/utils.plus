export interface Format {
  name: string;
  label: string;
  test: (value: string) => boolean;
}

export const FORMATS: Format[] = [
  {
    name: "date-time",
    label: "date and time",
    test: (value) => DATE_TIME.test(value) && isRealDate(value.slice(0, 10)),
  },
  { name: "date", label: "date", test: (value) => DATE.test(value) && isRealDate(value) },
  { name: "time", label: "time", test: (value) => TIME.test(value) },
  { name: "duration", label: "duration", test: (value) => DURATION.test(value) },
  { name: "email", label: "email address", test: (value) => EMAIL.test(value) },
  { name: "hostname", label: "hostname", test: (value) => HOSTNAME.test(value) },
  { name: "ipv4", label: "IPv4 address", test: (value) => IPV4.test(value) },
  { name: "ipv6", label: "IPv6 address", test: isIpv6 },
  { name: "uri", label: "URI", test: (value) => URI.test(value) },
  { name: "uri-reference", label: "URI reference", test: (value) => value !== "" && !/\s/.test(value) },
  { name: "uuid", label: "UUID", test: (value) => UUID.test(value) },
  { name: "json-pointer", label: "JSON pointer", test: (value) => JSON_POINTER.test(value) },
  { name: "regex", label: "regular expression", test: isRegex },
];

const BY_NAME = new Map(FORMATS.map((format) => [format.name, format]));

export function formatNamed(name: string): Format | undefined {
  return BY_NAME.get(name);
}

export function checkFormat(name: string, value: string): boolean {
  const format = BY_NAME.get(name);
  return format ? format.test(value) : true;
}

export function detectFormat(value: string): string | undefined {
  for (const name of ["uuid", "date-time", "date", "time", "email", "ipv4", "ipv6", "uri"]) {
    if (BY_NAME.get(name)?.test(value)) return name;
  }
  return undefined;
}

function isRealDate(text: string): boolean {
  const [year, month, day] = text.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= days;
}

function isIpv6(value: string): boolean {
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;

  const groupsOf = (part: string): string[] | null => {
    if (part === "") return [];
    const groups = part.split(":");
    const last = groups[groups.length - 1];
    if (last.includes(".")) {
      if (!IPV4.test(last)) return null;
      groups.splice(groups.length - 1, 1, "0", "0");
    }
    return groups.every((group) => /^[0-9a-fA-F]{1,4}$/.test(group)) ? groups : null;
  };

  const left = groupsOf(halves[0]);
  const right = halves.length === 2 ? groupsOf(halves[1]) : [];
  if (!left || !right) return false;
  const total = left.length + right.length;
  return halves.length === 2 ? total <= 7 : total === 8;
}

function isRegex(value: string): boolean {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d:(?:[0-5]\d|60)(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const DURATION = /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?!$)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;
const EMAIL =
  /^[^\s@"(),:;<>[\\\]]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const HOSTNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const URI = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const JSON_POINTER = /^(?:\/(?:[^~/]|~[01])*)*$/;
