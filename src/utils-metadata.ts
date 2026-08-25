import { type StructuredData, structuredData } from "./page-meta";

const JSON_LD = "application/ld+json";

setStructuredData(structuredData(location.pathname));

export function setStructuredData(data: StructuredData | undefined) {
  const existing = document.head.querySelector<HTMLScriptElement>(`script[type="${JSON_LD}"]`);
  if (!data) return existing?.remove();

  const tag = existing ?? document.head.appendChild(document.createElement("script"));
  tag.type = JSON_LD;
  tag.textContent = JSON.stringify(data);
}
