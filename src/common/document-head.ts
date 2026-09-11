import { useEffect } from "react";
import { loadPageContent } from "../page-article";
import { type PageContent, type StructuredData, structuredData } from "../page-document";
import { headMeta } from "../page-meta";

export function useDocumentHead(path: string) {
  useEffect(() => {
    let current = true;
    loadPageContent(path).then((content) => current && applyDocumentHead(path, content));
    return () => {
      current = false;
    };
  }, [path]);
}

export function applyDocumentHead(path: string, content?: PageContent) {
  const { title, canonical, metas } = headMeta(path);

  document.title = title;
  for (const { attribute, key, content } of metas) setMeta(attribute, key, content);
  setLink("canonical", canonical);
  setStructuredData(structuredData(path, content));
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

function setLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

const JSON_LD = "application/ld+json";

function setStructuredData(data: StructuredData | undefined) {
  const existing = document.head.querySelector<HTMLScriptElement>(`script[type="${JSON_LD}"]`);
  if (!data) return existing?.remove();

  const tag = existing ?? document.head.appendChild(document.createElement("script"));
  tag.type = JSON_LD;
  tag.textContent = JSON.stringify(data);
}
