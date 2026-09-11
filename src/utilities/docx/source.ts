import { unzipSync } from "fflate";

export interface Loaded {
  name: string;
  bytes: Uint8Array;
}

export const MAX_BYTES = 64 * 1024 * 1024;

export const EXTENSIONS = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.ms-word.document.macroEnabled.12",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  dotm: "application/vnd.ms-word.template.macroEnabled.12",
} as const;

export type Extension = keyof typeof EXTENSIONS;

export const ACCEPT = Object.entries(EXTENSIONS).flatMap(([extension, type]) => [`.${extension}`, type]).join(",");

export const UNTITLED = "Untitled";

export async function load(file: File): Promise<Loaded> {
  if (file.size > MAX_BYTES) throw new Error(`That file is larger than the ${MAX_BYTES / 1024 / 1024} MB this opens.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name || `${UNTITLED}.docx`;
  const problem = refusal(bytes, name);
  if (problem) throw new Error(problem);
  return { name, bytes };
}

export function refusal(bytes: Uint8Array, name: string): string | null {
  if (startsWith(bytes, ZIP)) return insideZip(bytes);
  if (startsWith(bytes, COMPOUND)) {
    return EXTENSION.test(name)
      ? "That document is encrypted with a password, which wraps the whole file in another format. Open it in Word, "
        + "clear the password under File › Info › Protect Document › Encrypt with Password, and save it again."
      : "That is a Word 97–2003 .doc, which is a different format from .docx. Open it in Word or LibreOffice and "
        + "save it as .docx first.";
  }
  if (startsWith(bytes, RTF)) return "That is a Rich Text Format file, not a .docx. Save it from Word as .docx first.";
  return bytes.length === 0 ? "That file is empty." : "That file is not a Word document: a .docx is a zip archive.";
}

function insideZip(bytes: Uint8Array): string | null {
  const names: string[] = [];
  try {
    unzipSync(bytes, {
      filter: ({ name }) => {
        names.push(name);
        return false;
      },
    });
  } catch {
    return "That file is a damaged zip archive, so there is no document in it to read.";
  }
  if (names.some((entry) => entry.startsWith("word/"))) return null;
  if (names.includes("mimetype")) {
    return "That is an OpenDocument file, which LibreOffice writes. Save it from there as Word 2007–365 (.docx) first.";
  }
  if (names.some((entry) => entry.startsWith("xl/"))) return "That is an Excel workbook, not a Word document.";
  if (names.some((entry) => entry.startsWith("ppt/"))) return "That is a PowerPoint presentation, not a Word document.";
  return "That is a zip archive with no Word document inside it.";
}

export function saveName(title: string, extension: Extension): string {
  const stem = titleOf(title.trim()).replace(/[/\\:*?"<>|]+/g, "-");
  return `${stem.trim() || UNTITLED}.${extension}`;
}

export function titleOf(name: string): string {
  return name.replace(EXTENSION, "") || UNTITLED;
}

export function extensionOf(name: string): Extension {
  return (EXTENSION.exec(name)?.[1]?.toLowerCase() ?? "docx") as Extension;
}

export function unreadableMessage(code: string): string {
  return `That file is a zip, but no Word document could be read out of it (${code}).`;
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

const EXTENSION = /\.(docx|docm|dotx|dotm)$/i;

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const RTF = [0x7b, 0x5c, 0x72, 0x74, 0x66];
