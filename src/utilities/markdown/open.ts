export const MAX_BYTES = 1024 * 1024;

export const ACCEPT = ".md,.markdown,.mdown,.mkd,.mdx,.txt,text/markdown,text/plain";

export async function readDocument(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error(`That file is larger than the ${MAX_BYTES / 1024 / 1024} MB this opens.`);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error("That file is not UTF-8 text, so there is no markdown in it to read.");
  }

  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
