import { useEffect } from "react";
import { headMeta, type StructuredData } from "../page-meta";

export function useDocumentHead(path: string) {
  useEffect(() => applyDocumentHead(path), [path]);
}

export function applyDocumentHead(path: string) {
  const { title, canonical, metas, data } = headMeta(path);

  document.title = title;
  for (const { attribute, key, content } of metas) setMeta(attribute, key, content);
  setLink("canonical", canonical);
  setStructuredData(data);
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setStructuredData(data: StructuredData | undefined) {
  const existing = document.head.querySelector<HTMLScriptElement>(`script[type="${JSON_LD}"]`);
  if (!data) return existing?.remove();

  const tag = existing ?? document.head.appendChild(document.createElement("script"));
  tag.type = JSON_LD;
  tag.textContent = JSON.stringify(data);
}

const JSON_LD = "application/ld+json";

function setLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}
