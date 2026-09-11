import { unzipSync } from "fflate";

export interface Loaded {
  name: string;
  bytes: Uint8Array;
}

export const MAX_BYTES = 128 * 1024 * 1024;

export const ACCEPT = ".pdf,application/pdf";

export const UNTITLED = "Untitled";

export async function load(file: File): Promise<Loaded> {
  if (file.size > MAX_BYTES) throw new Error(`That file is larger than the ${MAX_BYTES / 1024 / 1024} MB this opens.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = refusal(bytes);
  if (problem) throw new Error(problem);
  return { name: file.name || `${UNTITLED}.pdf`, bytes };
}

export function refusal(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "That file is empty.";
  if (indexOf(bytes.subarray(0, HEADER_WINDOW), PDF) !== -1) return null;
  if (startsWith(bytes, ZIP)) return insideZip(bytes);
  if (startsWith(bytes, POSTSCRIPT)) {
    return "That is a PostScript file, which is what a PDF is usually made from rather than a PDF itself.";
  }
  if (startsWith(bytes, PNG) || startsWith(bytes, JPEG)) {
    return "That is a picture, not a PDF. Open a PDF first and use Image to put the picture on one of its pages.";
  }
  if (HTML.test(new TextDecoder().decode(bytes.subarray(0, HEADER_WINDOW)).trimStart())) {
    return "That is a web page saved under a PDF's name, which is what a download that failed usually leaves behind. "
      + "Download the PDF again.";
  }
  return "That file is not a PDF: a PDF begins with %PDF-.";
}

function insideZip(bytes: Uint8Array): string {
  const names: string[] = [];
  try {
    unzipSync(bytes, {
      filter: ({ name }) => {
        names.push(name);
        return false;
      },
    });
  } catch {
    return "That file is a damaged zip archive, not a PDF.";
  }
  if (names.some((entry) => entry.startsWith("word/"))) {
    return "That is a Word document, not a PDF. DOCX opens those, and Word can save one as a PDF.";
  }
  return "That is a zip archive, not a PDF.";
}

export function unreadableMessage(code: number | undefined, detail: string | null): string {
  if (code === FORMAT) return "That file starts like a PDF but is too damaged for anything to be read out of it.";
  if (code === SECURITY) {
    return "That PDF is encrypted by a security handler other than the standard password one, which only the "
      + "software that encrypted it can open.";
  }
  return `That PDF could not be opened${detail ? ` (${detail})` : ""}.`;
}

export function saveName(name: string): string {
  const stem = name.trim().replace(/\.pdf$/i, "").replace(/[/\\:*?"<>|]+/g, "-").trim();
  return `${stem || UNTITLED}.pdf`;
}

export function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return String(error);
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function indexOf(bytes: Uint8Array, needle: readonly number[]): number {
  outer: for (let start = 0; start + needle.length <= bytes.length; start++) {
    for (let offset = 0; offset < needle.length; offset++) {
      if (bytes[start + offset] !== needle[offset]) continue outer;
    }
    return start;
  }
  return -1;
}

const FORMAT = 3;
const SECURITY = 5;

const HEADER_WINDOW = 1024;

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const POSTSCRIPT = [0x25, 0x21, 0x50, 0x53];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const HTML = /^(?:<!doctype html|<html|<head|<body)/i;
