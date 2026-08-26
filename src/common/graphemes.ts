const SEGMENTER = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : undefined;

export function graphemes(text: string): string[] {
  if (!SEGMENTER) return [...text];
  return Array.from(SEGMENTER.segment(text), (segment) => segment.segment);
}
