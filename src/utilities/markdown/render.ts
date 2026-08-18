import DOMPurify from "dompurify";
import { marked } from "marked";
import { type FlavourId, flavourOptions } from "./flavours";

export function renderMarkdown(text: string, flavour: FlavourId): string {
  return DOMPurify.sanitize(marked.parse(text, { ...flavourOptions(flavour), async: false }));
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName !== "A" || !node.hasAttribute("href")) return;
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
});
