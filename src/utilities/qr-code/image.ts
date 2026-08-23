import { QR_QUIET_ZONE, qrPath } from "../../common/qr";

export function qrSvg(modules: boolean[][]): string {
  const span = modules.length + QR_QUIET_ZONE * 2;
  const size = span * SVG_SCALE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${span} ${span}" `
    + `shape-rendering="crispEdges"><rect width="${span}" height="${span}" fill="#fff"/>`
    + `<path d="${qrPath(modules)}" fill="#000"/></svg>`;
}

export function qrPng(modules: boolean[][]): Promise<Blob | null> {
  const span = modules.length + QR_QUIET_ZONE * 2;
  const scale = Math.max(MIN_SCALE, Math.ceil(PNG_TARGET / span));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = span * scale;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  for (const [row, cells] of modules.entries()) {
    for (const [col, dark] of cells.entries()) {
      if (dark) context.fillRect((col + QR_QUIET_ZONE) * scale, (row + QR_QUIET_ZONE) * scale, scale, scale);
    }
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

const SVG_SCALE = 8;

const PNG_TARGET = 640;
const MIN_SCALE = 4;
