import qrcode from "qrcode-generator";

qrcode.stringToBytes = (text: string) => Array.from(new TextEncoder().encode(text));

export const QR_QUIET_ZONE = 4;

export function qrModules(text: string): boolean[][] | null {
  try {
    const code = qrcode(0, "M");
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
