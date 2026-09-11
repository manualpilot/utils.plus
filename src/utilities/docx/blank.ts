import { blankDocumentBytes } from "@docx-editor.dev/core";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { DEFAULT_FAMILY } from "./substitutes";

export function blankDocument(): Uint8Array {
  const files = unzipSync(blankDocumentBytes());
  const styles = files[STYLES];
  if (!styles) return blankDocumentBytes();
  files[STYLES] = strToU8(withDefaultFace(strFromU8(styles), DEFAULT_FAMILY));
  return zipSync(files);
}

export function withDefaultFace(styles: string, family: string): string {
  return styles.replace(
    DEFAULTS,
    (block) =>
      block.replace(
        /<w:rFonts\b[^>]*\/>/,
        (fonts) => fonts.replace(/(w:(?:ascii|hAnsi|eastAsia|cs))="[^"]*"/g, `$1="${family}"`),
      ),
  );
}

const STYLES = "word/styles.xml";

const DEFAULTS = /<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/;
