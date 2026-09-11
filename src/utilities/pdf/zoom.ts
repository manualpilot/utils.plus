import { ZoomMode } from "@embedpdf/plugin-zoom/react";

export const ZOOM_FITS = [
  { value: ZoomMode.FitWidth, label: "Fit width" },
  { value: ZoomMode.FitPage, label: "Fit page" },
] as const;

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export function percent(level: number): string {
  return `${Math.round(level * 100)}%`;
}
