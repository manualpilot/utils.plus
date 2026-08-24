import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

export function useNewRowFocus(): { ref: RefObject<HTMLInputElement | null>; focusNewRow: () => void } {
  const ref = useRef<HTMLInputElement>(null);
  const wanted = useRef(false);

  useLayoutEffect(() => {
    if (!wanted.current) return;
    wanted.current = false;
    ref.current?.focus();
  });

  const focusNewRow = useCallback(() => {
    wanted.current = true;
  }, []);

  return { ref, focusNewRow };
}
