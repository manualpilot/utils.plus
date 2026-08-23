import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof window !== "undefined") {
  const { getComputedStyle } = window;
  window.getComputedStyle = (elt) => getComputedStyle(elt);
  window.HTMLElement.prototype.scrollIntoView = () => {};

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserver;

  if (typeof Blob.prototype.stream !== "function") {
    Blob.prototype.stream = function(this: Blob) {
      const whole = this.arrayBuffer().then((buffer) => new Uint8Array(buffer));
      let offset = 0;
      return new ReadableStream<Uint8Array<ArrayBuffer>>({
        async pull(controller) {
          const bytes = await whole;
          if (offset >= bytes.length) return controller.close();
          controller.enqueue(bytes.subarray(offset, offset + STREAM_CHUNK));
          offset += STREAM_CHUNK;
        },
      });
    };
  }
}

const STREAM_CHUNK = 1024;
