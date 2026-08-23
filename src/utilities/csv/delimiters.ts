export const AUTO = "auto";

export const DELIMITERS = [
  { value: AUTO, label: "Auto" },
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
  { value: ":", label: "Colon" },
] as const satisfies readonly Delimiter[];

export const CANDIDATES = [",", ";", "\t", "|"];

export type DelimiterId = typeof DELIMITERS[number]["value"];

interface Delimiter {
  value: string;
  label: string;
}

export function isDelimiter(value: string | null | undefined): value is DelimiterId {
  return DELIMITERS.some((entry) => entry.value === value);
}

export function delimiterLabel(delimiter: string): string {
  return DELIMITERS.find((entry) => entry.value === delimiter)?.label ?? delimiter;
}
