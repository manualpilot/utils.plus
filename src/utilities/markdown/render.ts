import DOMPurify from "dompurify";
import { marked } from "marked";
import { type FlavourId, flavourOptions } from "./flavours";

export function renderMarkdown(text: string, flavour: FlavourId): string {
  return DOMPurify.sanitize(marked.parse(text, { ...flavourOptions(flavour), async: false }), CONTAINED);
}

const CONTAINED = {
  FORBID_TAGS: ["style", "form", "button", "select", "option", "optgroup", "datalist", "textarea", "label", "output"],
  FORBID_ATTR: ["style"],
};

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName !== "A" || !node.hasAttribute("href")) return;
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
});

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName !== "input") return;
  const box = node as HTMLInputElement;
  if (box.type !== "checkbox" || !box.disabled) box.remove();
});
