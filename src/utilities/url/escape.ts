export function decodePart(text: string): { text: string; error: string | null } {
  const spaced = text.replace(/\+/g, " ");
  try {
    return { text: decodeURIComponent(spaced), error: null };
  } catch {
    return { text: spaced, error: "A percent escape here opens nothing" };
  }
}

export function encodePart(text: string): string {
  try {
    return encodeURIComponent(text);
  } catch {
    return text.replace(/[%&=#?+ ]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  }
}
