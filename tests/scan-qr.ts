import jsQR from "jsqr";
import { QR_QUIET_ZONE } from "../src/common/qr";

export function scanQr(modules: boolean[][], scale = 6): string | null {
  const span = (modules.length + QR_QUIET_ZONE * 2) * scale;
  const pixels = new Uint8ClampedArray(span * span * 4).fill(255);
  for (const [row, cells] of modules.entries()) {
    for (const [col, dark] of cells.entries()) {
      if (!dark) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const at = (((row + QR_QUIET_ZONE) * scale + y) * span + (col + QR_QUIET_ZONE) * scale + x) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, span, span)?.data ?? null;
}
