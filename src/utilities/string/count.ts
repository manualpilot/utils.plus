import type { Fact } from "../../common/fact-table";
import { graphemes, splitLines } from "./lines";

export function counts(text: string): Fact[] {
  const characters = [...text].length;
  const clusters = graphemes(text).length;
  const trimmed = text.trim();
  return [
    { label: "Characters", value: String(characters) },
    { label: "Graphemes", value: clusters === characters ? "" : String(clusters) },
    { label: "Without spaces", value: String([...text.replace(/\s/gu, "")].length) },
    { label: "Words", value: String(trimmed === "" ? 0 : trimmed.split(/\s+/u).length) },
    { label: "Lines", value: String(text === "" ? 0 : splitLines(text).length) },
    { label: "Bytes (UTF-8)", value: String(new TextEncoder().encode(text).length) },
  ];
}
