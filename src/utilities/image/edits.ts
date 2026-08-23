import { carriesExif, type Container, sniff, stripMetadata, writeExifBlock } from "./embed";
import { countEntries, emptyExif, type Exif, type ExifEntry, findEntry, IFD_NAMES, setEntry, writeExif } from "./exif";
import { coordinate, DATE_FIELDS, DATE_PATTERN, EDITABLE, ORIENTATION_TAG, plainText, readComment, toCoordinate, writeComment } from "./tags";

export interface Edits {
  fields: Record<string, string>;
  orientation: string;
  latitude: string;
  longitude: string;
}

export const NO_EDITS: Edits = { fields: {}, orientation: "", latitude: "", longitude: "" };

export function editsFrom(exif: Exif | null): Edits {
  const fields: Record<string, string> = {};
  for (const [key, field] of Object.entries(EDITABLE)) {
    const entry = exif && findEntry(exif.ifds[field.ifd], field.tag);
    fields[key] = !entry ? "" : key === "comment" ? readComment(entry.value) : plainText(entry.value);
  }

  const orientation = exif && findEntry(exif.ifds.image, ORIENTATION_TAG);
  const [latitude, longitude] = readLocation(exif);
  return {
    fields,
    orientation: Array.isArray(orientation?.value) && typeof orientation.value[0] === "number"
      ? String(orientation.value[0])
      : "",
    latitude,
    longitude,
  };
}

export function readLocation(exif: Exif | null): [string, string] {
  if (!exif) return ["", ""];
  const latitude = coordinate(
    findEntry(exif.ifds.gps, 2)?.value ?? [],
    plainText(findEntry(exif.ifds.gps, 1)?.value ?? ""),
  );
  const longitude = coordinate(
    findEntry(exif.ifds.gps, 4)?.value ?? [],
    plainText(findEntry(exif.ifds.gps, 3)?.value ?? ""),
  );
  return [latitude === null ? "" : latitude.toFixed(6), longitude === null ? "" : longitude.toFixed(6)];
}

export function sameEdits(left: Edits, right: Edits): boolean {
  if (left.orientation !== right.orientation) return false;
  if (left.latitude !== right.latitude || left.longitude !== right.longitude) return false;
  return Object.keys(EDITABLE).every((key) => (left.fields[key] ?? "") === (right.fields[key] ?? ""));
}

export function applyEdits(exif: Exif | null, edits: Edits): Exif {
  const out = exif ? clone(exif) : emptyExif();

  for (const [key, field] of Object.entries(EDITABLE)) {
    const text = (edits.fields[key] ?? "").trim();
    out.ifds[field.ifd] = setEntry(out.ifds[field.ifd], field.tag, text === "" ? null : entryFor(key, field.tag, text));
  }

  out.ifds.image = setEntry(
    out.ifds.image,
    ORIENTATION_TAG,
    edits.orientation === "" ? null : { tag: ORIENTATION_TAG, type: 3, value: [Number(edits.orientation)] },
  );

  const latitude = Number(edits.latitude);
  const longitude = Number(edits.longitude);
  if (edits.latitude.trim() === "" && edits.longitude.trim() === "") {
    out.ifds.gps = [];
  } else if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    out.ifds.gps = setEntry(out.ifds.gps, 1, { tag: 1, type: 2, value: latitude < 0 ? "S" : "N" });
    out.ifds.gps = setEntry(out.ifds.gps, 2, { tag: 2, type: 5, value: toCoordinate(latitude) });
    out.ifds.gps = setEntry(out.ifds.gps, 3, { tag: 3, type: 2, value: longitude < 0 ? "W" : "E" });
    out.ifds.gps = setEntry(out.ifds.gps, 4, { tag: 4, type: 5, value: toCoordinate(longitude) });
    if (!findEntry(out.ifds.gps, 0)) {
      out.ifds.gps = setEntry(out.ifds.gps, 0, { tag: 0, type: 1, value: Uint8Array.from([2, 3, 0, 0]) });
    }
  }
  return out;
}

export function rewrite(bytes: Uint8Array, container: Container, exif: Exif | null, strip: boolean): Uint8Array | null {
  if (strip) return stripMetadata(bytes, container);
  const block = exif && countEntries(exif) > 0 ? writeExif(exif) : null;
  return writeExifBlock(bytes, container, block);
}

export function problem(key: string, value: string): string | null {
  const text = value.trim();
  if (text === "") return null;
  if (DATE_FIELDS.includes(key) && !DATE_PATTERN.test(text)) return "YYYY:MM:DD HH:MM:SS";
  if (key !== "comment" && /[^\x00-\xff]/.test(text)) return "Only Latin-1 characters are kept";
  return null;
}

export function locationProblem(latitude: string, longitude: string): [string | null, string | null] {
  const pair: [string | null, string | null] = [null, null];
  const blank = latitude.trim() === "" && longitude.trim() === "";
  if (blank) return pair;
  pair[0] = degreeProblem(latitude, 90, "A latitude runs from -90 to 90");
  pair[1] = degreeProblem(longitude, 180, "A longitude runs from -180 to 180");
  return pair;
}

function degreeProblem(value: string, limit: number, message: string): string | null {
  const text = value.trim();
  if (text === "") return "Both halves of a coordinate, or neither";
  const degrees = Number(text);
  return Number.isFinite(degrees) && Math.abs(degrees) <= limit ? null : message;
}

function entryFor(key: string, tag: number, text: string): ExifEntry {
  return key === "comment" ? { tag, type: 7, value: writeComment(text) } : { tag, type: 2, value: text };
}

function clone(exif: Exif): Exif {
  const out = emptyExif(exif.little);
  for (const name of IFD_NAMES) out.ifds[name] = [...exif.ifds[name]];
  return out;
}

export function forOutput(exif: Exif, width: number, height: number): Exif {
  const out = clone(exif);
  out.ifds.image = setEntry(out.ifds.image, ORIENTATION_TAG, null);
  out.ifds.exif = setEntry(out.ifds.exif, 40962, { tag: 40962, type: 4, value: [width] });
  out.ifds.exif = setEntry(out.ifds.exif, 40963, { tag: 40963, type: 4, value: [height] });
  out.ifds.image = setEntry(out.ifds.image, 256, null);
  out.ifds.image = setEntry(out.ifds.image, 257, null);
  return out;
}

export async function withMetadata(blob: Blob, exif: Exif | null, width: number, height: number): Promise<Blob> {
  if (!exif || countEntries(exif) === 0) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const container = sniff(bytes);
  if (!carriesExif(container)) return blob;
  const written = writeExifBlock(bytes, container, writeExif(forOutput(exif, width, height)));
  return written ? new Blob([written as BlobPart], { type: blob.type }) : blob;
}
