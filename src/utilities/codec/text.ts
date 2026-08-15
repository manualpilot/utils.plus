export function bytesToText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("This format spells out text, and the input is not valid UTF-8");
  }
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== "");
}
