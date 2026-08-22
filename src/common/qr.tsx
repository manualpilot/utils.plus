import qrcode from "qrcode-generator";

export function QrCode({ modules, label }: QrCodeProps) {
  const span = modules.length + QR_QUIET_ZONE * 2;

  return (
    <div className="qr-code">
      <svg viewBox={`0 0 ${span} ${span}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <path d={qrPath(modules)} fill="#000" />
      </svg>
    </div>
  );
}

interface QrCodeProps {
  modules: boolean[][];
  label: string;
}

export type QrCorrection = "L" | "M" | "Q" | "H";

qrcode.stringToBytes = (text: string) => Array.from(new TextEncoder().encode(text));

export const QR_QUIET_ZONE = 4;

export function qrModules(text: string, correction: QrCorrection = "M"): boolean[][] | null {
  try {
    const code = qrcode(0, correction);
    code.addData(text);
    code.make();
    const size = code.getModuleCount();
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
  } catch {
    return null;
  }
}

export function qrPath(modules: boolean[][]): string {
  const parts: string[] = [];
  for (const [row, cells] of modules.entries()) {
    let start = -1;
    for (let col = 0; col <= cells.length; col++) {
      if (cells[col]) {
        if (start === -1) start = col;
        continue;
      }
      if (start === -1) continue;
      parts.push(`M${start + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h${col - start}v1h-${col - start}z`);
      start = -1;
    }
  }
  return parts.join("");
}
