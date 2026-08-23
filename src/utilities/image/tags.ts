import type { ExifEntry, ExifValue, IfdName, Rational } from "./exif";

export function tagName(ifd: IfdName, tag: number): string {
  const table = ifd === "gps" ? GPS_TAGS : ifd === "interop" ? INTEROP_TAGS : TIFF_TAGS;
  return table[tag] ?? `Tag ${hex(tag)}`;
}

export function tagText(ifd: IfdName, entry: ExifEntry): string {
  const special = SPECIAL[`${ifd}:${entry.tag}`];
  if (special) {
    const text = special(entry.value);
    if (text !== null) return text;
  }
  const named = NAMED_VALUES[`${ifd}:${entry.tag}`];
  if (named && Array.isArray(entry.value) && typeof entry.value[0] === "number") {
    return named[entry.value[0]] ?? String(entry.value[0]);
  }
  return plainText(entry.value);
}

export function plainText(value: ExifValue): string {
  if (typeof value === "string") return value.trim();
  if (value instanceof Uint8Array) return bytesText(value);
  return value.map(one).join(", ");
}

export function ratio(value: Rational): number {
  return value.d === 0 ? NaN : value.n / value.d;
}

export function readComment(value: ExifValue): string {
  if (typeof value === "string") return value;
  if (!(value instanceof Uint8Array) || value.length < 8) return "";
  const charset = LATIN1.decode(value.subarray(0, 8)).replace(/\0+$/, "");
  const body = value.subarray(8);
  if (charset === "UNICODE") return decodeUtf16(body);
  return LATIN1.decode(body).replace(/\0+$/, "").trim();
}

export function writeComment(text: string): Uint8Array {
  const out = new Uint8Array(8 + text.length);
  out.set([0x41, 0x53, 0x43, 0x49, 0x49, 0, 0, 0]);
  for (let index = 0; index < text.length; index++) out[8 + index] = text.charCodeAt(index) & 0xff;
  return out;
}

export function coordinate(parts: ExifValue, reference: string): number | null {
  if (!Array.isArray(parts) || parts.length < 3 || typeof parts[0] === "number") return null;
  const [degrees, minutes, seconds] = (parts as Rational[]).map(ratio);
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return reference === "S" || reference === "W" ? -decimal : decimal;
}

export function degreesMinutesSeconds(decimal: number, axis: "lat" | "lon"): string {
  const hemisphere = axis === "lat" ? (decimal < 0 ? "S" : "N") : decimal < 0 ? "W" : "E";
  const total = Math.abs(decimal);
  const degrees = Math.floor(total);
  const minutes = Math.floor((total - degrees) * 60);
  const seconds = ((total - degrees) * 60 - minutes) * 60;
  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${hemisphere}`;
}

export function toCoordinate(decimal: number): Rational[] {
  const total = Math.abs(decimal);
  const degrees = Math.floor(total);
  const minutes = Math.floor((total - degrees) * 60);
  const seconds = Math.round(((total - degrees) * 60 - minutes) * 60 * 10000);
  return [{ n: degrees, d: 1 }, { n: minutes, d: 1 }, { n: seconds, d: 10000 }];
}

function one(value: number | Rational): string {
  if (typeof value === "number") return trim(value);
  return value.d === 1 ? String(value.n) : trim(ratio(value));
}

function trim(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toFixed(6)).toString();
}

function bytesText(value: Uint8Array): string {
  const text = LATIN1.decode(value).replace(/\0+$/, "");
  if (text.length > 0 && !CONTROL.test(text)) return text.trim();
  return `${value.length} bytes`;
}

function decodeUtf16(body: Uint8Array): string {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let text = "";
  for (let at = 0; at + 1 < body.length; at += 2) text += String.fromCharCode(view.getUint16(at, true));
  return text.replace(/\0+$/, "");
}

function hex(tag: number): string {
  return `0x${tag.toString(16).padStart(4, "0")}`;
}

function first(value: ExifValue): Rational | number | null {
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

const LATIN1 = new TextDecoder("latin1");

const CONTROL = /[\x00-\x08\x0e-\x1f\x7f]/;

const NAMED_VALUES: Record<string, Record<number, string>> = {
  "image:274": {
    1: "Normal",
    2: "Mirrored horizontally",
    3: "Rotated 180°",
    4: "Mirrored vertically",
    5: "Mirrored horizontally, rotated 270°",
    6: "Rotated 90° clockwise",
    7: "Mirrored horizontally, rotated 90°",
    8: "Rotated 270° clockwise",
  },
  "image:296": { 1: "None", 2: "Inches", 3: "Centimetres" },
  "image:262": { 0: "White is zero", 1: "Black is zero", 2: "RGB", 6: "YCbCr" },
  "image:259": { 1: "Uncompressed", 6: "JPEG", 7: "JPEG", 8: "Deflate" },
  "image:531": { 1: "Centred", 2: "Co-sited" },
  "exif:34850": { 0: "Not defined", 1: "Manual", 2: "Program", 3: "Aperture priority", 4: "Shutter priority" },
  "exif:37383": {
    0: "Unknown",
    1: "Average",
    2: "Centre-weighted average",
    3: "Spot",
    4: "Multi-spot",
    5: "Pattern",
    6: "Partial",
    255: "Other",
  },
  "exif:37384": {
    0: "Unknown",
    1: "Daylight",
    2: "Fluorescent",
    3: "Tungsten",
    4: "Flash",
    9: "Fine weather",
    10: "Cloudy",
    11: "Shade",
    17: "Standard light A",
    18: "Standard light B",
    19: "Standard light C",
    21: "D65",
    255: "Other",
  },
  "exif:41986": { 0: "Auto", 1: "Manual", 2: "Auto bracket" },
  "exif:41987": { 0: "Auto", 1: "Manual" },
  "exif:41990": { 0: "Standard", 1: "Landscape", 2: "Portrait", 3: "Night scene" },
  "exif:41991": { 0: "None", 1: "Low gain up", 2: "High gain up", 3: "Low gain down", 4: "High gain down" },
  "exif:41992": { 0: "Normal", 1: "Soft", 2: "Hard" },
  "exif:41993": { 0: "Normal", 1: "Low", 2: "High" },
  "exif:41994": { 0: "Normal", 1: "Soft", 2: "Hard" },
  "exif:41996": { 0: "Unknown", 1: "Macro", 2: "Close", 3: "Distant" },
  "exif:40961": { 1: "sRGB", 2: "Adobe RGB", 65535: "Uncalibrated" },
  "exif:41495": { 1: "Not defined", 2: "One-chip colour area", 3: "Two-chip colour area", 7: "Three-chip colour area" },
  "exif:41985": { 0: "Normal", 1: "Custom" },
  "exif:34864": { 1: "Standard output sensitivity", 2: "Recommended exposure index", 3: "ISO speed" },
  "gps:23": { 84: "True north", 77: "Magnetic north" },
};

const SPECIAL: Record<string, (value: ExifValue) => string | null> = {
  "exif:33434": (value) => {
    const seconds = first(value);
    if (seconds === null || typeof seconds === "number") return null;
    const decimal = ratio(seconds);
    if (!Number.isFinite(decimal) || decimal <= 0) return null;
    return decimal >= 1 ? `${trim(decimal)} s` : `1/${Math.round(1 / decimal)} s`;
  },
  "exif:33437": (value) => {
    const stop = first(value);
    return stop === null || typeof stop === "number" ? null : `f/${trim(ratio(stop))}`;
  },
  "exif:37381": (value) => {
    const stop = first(value);
    if (stop === null || typeof stop === "number") return null;
    return `f/${trim(2 ** (ratio(stop) / 2))}`;
  },
  "exif:37386": (value) => {
    const length = first(value);
    return length === null || typeof length === "number" ? null : `${trim(ratio(length))} mm`;
  },
  "exif:41989": (value) => {
    const length = first(value);
    return typeof length === "number" ? `${length} mm` : null;
  },
  "exif:37380": (value) => {
    const bias = first(value);
    if (bias === null || typeof bias === "number") return null;
    const stops = ratio(bias);
    return Number.isFinite(stops) ? `${stops > 0 ? "+" : ""}${trim(stops)} EV` : null;
  },
  "exif:34855": (value) => (Array.isArray(value) ? `ISO ${value.map(one).join(", ")}` : null),
  "exif:37510": (value) => readComment(value) || null,
  "exif:36864": (value) => versionText(value),
  "exif:40960": (value) => versionText(value),
  "exif:37377": (value) => {
    const speed = first(value);
    if (speed === null || typeof speed === "number") return null;
    const apex = ratio(speed);
    return Number.isFinite(apex) ? `1/${Math.round(2 ** apex)} s` : null;
  },
  "exif:37385": (value) => {
    const flash = first(value);
    if (typeof flash !== "number") return null;
    if ((flash & 0x20) !== 0) return "No flash fitted";
    const parts = [(flash & 1) === 1 ? "Fired" : "Did not fire"];
    const mode = FLASH_MODES[(flash >> 3) & 0x03];
    if (mode) parts.push(mode);
    const returned = FLASH_RETURNS[(flash >> 1) & 0x03];
    if (returned) parts.push(returned);
    if ((flash & 0x40) !== 0) parts.push("red-eye reduction");
    return parts.join(", ");
  },
  "gps:0": (value) => (value instanceof Uint8Array ? Array.from(value).join(".") : null),
  "gps:5": (value) => {
    const reference = value instanceof Uint8Array ? value[0] : Array.isArray(value) ? value[0] : null;
    return reference === 1 ? "Below sea level" : reference === 0 ? "Above sea level" : null;
  },
  "gps:6": (value) => {
    const altitude = first(value);
    return altitude === null || typeof altitude === "number" ? null : `${trim(ratio(altitude))} m`;
  },
};

function versionText(value: ExifValue): string | null {
  if (!(value instanceof Uint8Array) || value.length !== 4) return null;
  const digits = LATIN1.decode(value);
  if (!/^\d{4}$/.test(digits)) return null;
  return `${Number(digits.slice(0, 2))}.${digits.slice(2)}`;
}

const FLASH_MODES = ["", "forced on", "forced off", "auto"];

const FLASH_RETURNS = ["", "", "no return detected", "return detected"];

const TIFF_TAGS: Record<number, string> = {
  254: "Subfile type",
  256: "Image width",
  257: "Image height",
  258: "Bits per sample",
  259: "Compression",
  262: "Photometric interpretation",
  270: "Image description",
  271: "Make",
  272: "Model",
  273: "Strip offsets",
  274: "Orientation",
  277: "Samples per pixel",
  278: "Rows per strip",
  279: "Strip byte counts",
  282: "X resolution",
  283: "Y resolution",
  284: "Planar configuration",
  296: "Resolution unit",
  301: "Transfer function",
  305: "Software",
  306: "Date and time",
  315: "Artist",
  318: "White point",
  319: "Primary chromaticities",
  513: "Thumbnail offset",
  514: "Thumbnail length",
  529: "YCbCr coefficients",
  530: "YCbCr sub-sampling",
  531: "YCbCr positioning",
  532: "Reference black and white",
  33421: "CFA repeat pattern",
  33432: "Copyright",
  33434: "Exposure time",
  33437: "F-number",
  34377: "Photoshop settings",
  34665: "Exif offset",
  34675: "ICC profile",
  34850: "Exposure program",
  34852: "Spectral sensitivity",
  34853: "GPS offset",
  34855: "ISO speed",
  34864: "Sensitivity type",
  34866: "Recommended exposure index",
  36864: "Exif version",
  36867: "Date taken",
  36868: "Date digitised",
  36880: "Offset time",
  36881: "Offset time original",
  36882: "Offset time digitised",
  37121: "Components configuration",
  37122: "Compressed bits per pixel",
  37377: "Shutter speed",
  37378: "Aperture",
  37379: "Brightness",
  37380: "Exposure compensation",
  37381: "Max aperture",
  37382: "Subject distance",
  37383: "Metering mode",
  37384: "Light source",
  37385: "Flash",
  37386: "Focal length",
  37396: "Subject area",
  37500: "Maker note",
  37510: "User comment",
  37520: "Sub-second time",
  37521: "Sub-second time original",
  37522: "Sub-second time digitised",
  40960: "Flashpix version",
  40961: "Colour space",
  40962: "Pixel X dimension",
  40963: "Pixel Y dimension",
  40964: "Related sound file",
  40965: "Interoperability offset",
  41483: "Flash energy",
  41486: "Focal plane X resolution",
  41487: "Focal plane Y resolution",
  41488: "Focal plane resolution unit",
  41492: "Subject location",
  41493: "Exposure index",
  41495: "Sensing method",
  41728: "File source",
  41729: "Scene type",
  41730: "CFA pattern",
  41985: "Custom rendered",
  41986: "Exposure mode",
  41987: "White balance",
  41988: "Digital zoom ratio",
  41989: "Focal length in 35 mm film",
  41990: "Scene capture type",
  41991: "Gain control",
  41992: "Contrast",
  41993: "Saturation",
  41994: "Sharpness",
  41995: "Device setting description",
  41996: "Subject distance range",
  42016: "Image unique ID",
  42032: "Camera owner",
  42033: "Body serial number",
  42034: "Lens specification",
  42035: "Lens make",
  42036: "Lens model",
  42037: "Lens serial number",
  42080: "Composite image",
  42240: "Gamma",
  50341: "Print image matching",
  59932: "Padding",
};

const GPS_TAGS: Record<number, string> = {
  0: "GPS version",
  1: "Latitude reference",
  2: "Latitude",
  3: "Longitude reference",
  4: "Longitude",
  5: "Altitude reference",
  6: "Altitude",
  7: "GPS time",
  8: "Satellites",
  9: "Receiver status",
  10: "Measure mode",
  11: "Dilution of precision",
  12: "Speed reference",
  13: "Speed",
  14: "Track reference",
  15: "Track",
  16: "Image direction reference",
  17: "Image direction",
  18: "Map datum",
  19: "Destination latitude reference",
  20: "Destination latitude",
  21: "Destination longitude reference",
  22: "Destination longitude",
  23: "Destination bearing reference",
  24: "Destination bearing",
  25: "Destination distance reference",
  26: "Destination distance",
  27: "Processing method",
  28: "Area information",
  29: "GPS date",
  30: "Differential",
  31: "Horizontal positioning error",
};

const INTEROP_TAGS: Record<number, string> = {
  1: "Interoperability index",
  2: "Interoperability version",
  4096: "Related image file format",
  4097: "Related image width",
  4098: "Related image height",
};

export const EDITABLE: Record<string, { ifd: IfdName; tag: number; label: string; placeholder: string }> = {
  description: { ifd: "image", tag: 270, label: "Description", placeholder: "What the picture is of" },
  artist: { ifd: "image", tag: 315, label: "Artist", placeholder: "Who took it" },
  copyright: { ifd: "image", tag: 33432, label: "Copyright", placeholder: "© 2026 Someone" },
  software: { ifd: "image", tag: 305, label: "Software", placeholder: "What wrote the file" },
  make: { ifd: "image", tag: 271, label: "Camera make", placeholder: "Manufacturer" },
  model: { ifd: "image", tag: 272, label: "Camera model", placeholder: "Body" },
  datetime: { ifd: "image", tag: 306, label: "File date", placeholder: "2026:08:23 14:05:00" },
  taken: { ifd: "exif", tag: 36867, label: "Date taken", placeholder: "2026:08:23 14:05:00" },
  comment: { ifd: "exif", tag: 37510, label: "User comment", placeholder: "A note kept with the picture" },
};

export type EditableField = keyof typeof EDITABLE;

export const EDITABLE_FIELDS = Object.keys(EDITABLE);

export const DATE_FIELDS = ["datetime", "taken"];

export const DATE_PATTERN = /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/;

export const ORIENTATION_TAG = 274;

export const ORIENTATIONS = [
  { value: "1", label: "Normal" },
  { value: "2", label: "Mirrored horizontally" },
  { value: "3", label: "Rotated 180°" },
  { value: "4", label: "Mirrored vertically" },
  { value: "5", label: "Mirrored horizontally, rotated 270°" },
  { value: "6", label: "Rotated 90° clockwise" },
  { value: "7", label: "Mirrored horizontally, rotated 90°" },
  { value: "8", label: "Rotated 270° clockwise" },
];
