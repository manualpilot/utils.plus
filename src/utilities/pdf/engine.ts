import type { PdfEngine } from "@embedpdf/models";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { useCallback, useEffect, useRef, useState } from "react";

export interface EngineState {
  engine: PdfEngine | null;
  loading: boolean;
  error: string | null;
  start(): void;
}

export function usePdfEngine(): EngineState {
  const [attempt, setAttempt] = useState(0);
  const [engine, setEngine] = useState<PdfEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settled = useRef<"idle" | "loading" | "ready" | "failed">("idle");

  const start = useCallback(() => {
    if (settled.current === "loading" || settled.current === "ready") return;
    settled.current = "loading";
    setError(null);
    setAttempt((was) => was + 1);
  }, []);

  useEffect(() => {
    if (attempt === 0) return;
    let cancelled = false;
    let made: PdfEngine | null = null;
    let blob: string | null = null;

    (async () => {
      try {
        blob = await fetchWasm();
        const { createPdfiumEngine } = await import("@embedpdf/engines/pdfium-worker-engine");
        if (cancelled) return;
        made = createPdfiumEngine(blob, { fontFallback: null });
        settled.current = "ready";
        setEngine(made);
      } catch (reason) {
        if (cancelled) return;
        settled.current = "failed";
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();

    return () => {
      cancelled = true;
      made?.destroy?.();
      if (blob) URL.revokeObjectURL(blob);
      settled.current = "idle";
      setEngine(null);
    };
  }, [attempt]);

  return { engine, loading: attempt > 0 && !engine && !error, error, start };
}

async function fetchWasm(): Promise<string> {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`the engine's WebAssembly answered ${response.status}`);
  return URL.createObjectURL(await response.blob());
}
