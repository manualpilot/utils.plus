import { useAnnotation } from "@embedpdf/plugin-annotation/react";
import { useEffect } from "react";

export function useLinks(documentId: string) {
  const { provides: annotation } = useAnnotation(documentId);

  useEffect(() => {
    if (!annotation) return;
    return annotation.onNavigate(({ result }) => {
      const address = result.outcome === "uri" ? followable(result.uri) : null;
      if (address) window.open(address, "_blank", "noopener,noreferrer");
    });
  }, [annotation]);
}

export function followable(uri: string): string | null {
  try {
    const url = new URL(uri.trim());
    return FOLLOWABLE.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const FOLLOWABLE = new Set(["http:", "https:", "mailto:"]);
