import type { Fact } from "../../common/fact-table";
import { aspectRatio, formatBytes } from "./container";
import type { Exif, IfdName } from "./exif";
import { findEntry } from "./exif";
import type { Loaded } from "./source";
import { coordinate, degreesMinutesSeconds, plainText, tagName, tagText } from "./tags";

export interface Group {
  title: string;
  rows: Fact[];
}

export function fileFacts(loaded: Loaded): Fact[] {
  const { info, element } = loaded;
  const shown = { width: element.naturalWidth, height: element.naturalHeight };
  const stored = info.width > 0 ? info : shown;

  return [
    { label: "Name", value: loaded.name },
    { label: "Type", value: `${info.label} (${loaded.type})` },
    { label: "Size", value: formatBytes(loaded.size) },
    { label: "Modified", value: loaded.modified ? new Date(loaded.modified).toLocaleString() : "" },
    { label: "Dimensions", value: `${shown.width} × ${shown.height}` },
    {
      label: "Stored as",
      value: stored.width === shown.width && stored.height === shown.height
        ? ""
        : `${stored.width} × ${stored.height}, turned by the orientation tag`,
    },
    { label: "Aspect ratio", value: aspectRatio(shown.width, shown.height) },
    { label: "Megapixels", value: megapixels(shown.width, shown.height) },
    { label: "Transparency", value: info.hasAlpha ? "Yes" : "" },
    { label: "Animated", value: info.animated ? "Yes" : "" },
    ...info.facts,
  ];
}

export function exifGroups(exif: Exif | null): Group[] {
  if (!exif) return [];
  const groups: Group[] = [];
  for (const [name, title] of Object.entries(IFD_TITLES) as [IfdName, string][]) {
    const entries = exif.ifds[name];
    if (entries.length === 0) continue;
    groups.push({
      title,
      rows: entries.map((entry) => ({ label: tagName(name, entry.tag), value: tagText(name, entry) })),
    });
  }
  return groups;
}

export function locationFacts(exif: Exif | null): Fact[] {
  if (!exif || exif.ifds.gps.length === 0) return [];
  const latitude = coordinate(findEntry(exif.ifds.gps, 2)?.value ?? [], text(exif, 1));
  const longitude = coordinate(findEntry(exif.ifds.gps, 4)?.value ?? [], text(exif, 3));
  if (latitude === null || longitude === null) return [];
  return [
    { label: "Latitude", value: `${latitude.toFixed(6)}  (${degreesMinutesSeconds(latitude, "lat")})` },
    { label: "Longitude", value: `${longitude.toFixed(6)}  (${degreesMinutesSeconds(longitude, "lon")})` },
    { label: "Decimal pair", value: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` },
  ];
}

export function otherFacts(loaded: Loaded): Fact[] {
  const rows: Fact[] = loaded.info.text.map((entry) => ({ label: entry.key, value: entry.value }));
  for (const [at, comment] of loaded.info.comments.entries()) {
    rows.push({ label: loaded.info.comments.length > 1 ? `Comment ${at + 1}` : "Comment", value: comment.trim() });
  }
  if (loaded.info.xmp) rows.push({ label: "XMP", value: `${loaded.info.xmp.length} characters` });
  return rows;
}

function megapixels(width: number, height: number): string {
  const total = (width * height) / 1e6;
  if (total <= 0) return "";
  return `${total < 1 ? total.toFixed(2) : total.toFixed(1)} MP`;
}

function text(exif: Exif, tag: number): string {
  return plainText(findEntry(exif.ifds.gps, tag)?.value ?? "");
}

const IFD_TITLES: Record<string, string> = {
  image: "Image",
  exif: "Camera",
  gps: "Location",
  interop: "Interoperability",
  thumbnail: "Thumbnail",
};
