export interface OutputFormat {
  value: string;
  label: string;
  mime: string;
  extension: string;
  lossy: boolean;
  alpha: boolean;
}

export const FORMATS: OutputFormat[] = [
  { value: "png", label: "PNG", mime: "image/png", extension: "png", lossy: false, alpha: true },
  { value: "jpeg", label: "JPEG", mime: "image/jpeg", extension: "jpg", lossy: true, alpha: false },
  { value: "webp", label: "WebP", mime: "image/webp", extension: "webp", lossy: true, alpha: true },
  { value: "avif", label: "AVIF", mime: "image/avif", extension: "avif", lossy: true, alpha: true },
];

export function formatFor(value: string): OutputFormat {
  return FORMATS.find((format) => format.value === value) ?? FORMATS[0];
}

export function formatForMime(mime: string): OutputFormat | null {
  return FORMATS.find((format) => format.mime === mime) ?? null;
}

export function encodable(): OutputFormat[] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return FORMATS.filter((format) => {
    if (format.value === "png") return true;
    try {
      return canvas.toDataURL(format.mime).startsWith(`data:${format.mime}`);
    } catch {
      return false;
    }
  });
}
