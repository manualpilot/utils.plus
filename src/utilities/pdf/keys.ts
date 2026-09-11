import { useAnnotation } from "@embedpdf/plugin-annotation/react";
import { useHistoryCapability } from "@embedpdf/plugin-history/react";
import { useEffect } from "react";

export function useMarkKeys(documentId: string) {
  const { provides: annotation } = useAnnotation(documentId);
  const { provides: history } = useHistoryCapability();

  useEffect(() => {
    if (!annotation || !history) return;
    const scoped = history.forDocument(documentId);

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || elsewhere(event.target)) return;
      const modified = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (key === "escape") {
        annotation.setActiveTool(null);
        annotation.deselectAnnotation();
      } else if ((key === "delete" || key === "backspace") && !modified) {
        const selected = annotation.getSelectedAnnotations();
        if (selected.length === 0) return;
        event.preventDefault();
        annotation.deleteAnnotations(selected.map(({ object }) => ({ pageIndex: object.pageIndex, id: object.id })));
      } else if (modified && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        scoped.redo();
      } else if (modified && key === "z") {
        event.preventDefault();
        scoped.undo();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotation, history, documentId]);
}

function elsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
    || target.closest("[role=\"menu\"], [role=\"dialog\"], [role=\"listbox\"]") !== null;
}
