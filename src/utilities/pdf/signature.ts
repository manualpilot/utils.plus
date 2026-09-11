import "@fontsource-variable/dancing-script";

export const INKS = [
  { value: "#111111", label: "Black" },
  { value: "#1c3f95", label: "Blue" },
] as const;

export type InkId = typeof INKS[number]["value"];

export const DEFAULT_INK: InkId = INKS[0].value;

export const SIGNATURE_FACE = "Dancing Script Variable";

export const SIGNATURE_FONT = `'${SIGNATURE_FACE}', cursive`;

export function signatureFaceReady(): Promise<unknown> {
  return document.fonts.load(`48px '${SIGNATURE_FACE}'`);
}

export const SIGNATURE_SIZE = { width: 150, height: 50 };

export const CREATION_TABS = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
  { value: "upload", label: "Upload" },
] as const;

export type CreationTab = typeof CREATION_TABS[number]["value"];

export const SIGNATURE_IMAGE_ACCEPT = "image/png,image/jpeg";
