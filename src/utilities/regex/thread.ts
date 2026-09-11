import type { MatchResult, MatchSpan } from "./match";
import type { Answer, Request } from "./search";

export type Outcome = { kind: "found"; result: MatchResult } | { kind: "stopped"; reason: string };

export const SEARCH_BUDGET = 1000;

export const BACKTRACKED =
  "The search was stopped because this pattern backtracks too much on this text: it had not finished after a second.";
export const TOO_DEEP =
  "The search was stopped because this pattern backtracks too deeply on this text for the browser to follow.";
export const COULD_NOT_SEARCH = "The search could not be started.";

export class SearchThread {
  private worker: Worker;
  private latest = 0;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private answer: (outcome: Outcome) => void) {
    this.worker = this.make();
  }

  search(request: Omit<Request, "id">) {
    if (this.pending) this.replace();
    this.pending = true;
    this.worker.postMessage({ ...request, id: ++this.latest } satisfies Request);
  }

  close() {
    clearTimeout(this.timer);
    this.worker.terminate();
  }

  private make(): Worker {
    const worker = new Worker(new URL("./search.ts", import.meta.url), { type: "module" });

    worker.onmessage = ({ data }: MessageEvent<Answer>) => {
      if (data.id !== this.latest) return;
      if (data.kind === "began") this.timer = setTimeout(() => this.stop(BACKTRACKED), SEARCH_BUDGET);
      else if (data.kind === "threw") this.settle({ kind: "stopped", reason: TOO_DEEP });
      else this.settle({ kind: "found", result: data.result });
    };

    worker.onerror = () => this.settle({ kind: "stopped", reason: COULD_NOT_SEARCH });

    return worker;
  }

  private stop(reason: string) {
    this.replace();
    this.settle({ kind: "stopped", reason });
  }

  private settle(outcome: Outcome) {
    clearTimeout(this.timer);
    this.pending = false;
    this.answer(outcome);
  }

  private replace() {
    clearTimeout(this.timer);
    this.worker.terminate();
    this.worker = this.make();
  }
}

export function matchesOf(outcome: Outcome | null): MatchSpan[] {
  return outcome?.kind === "found" ? outcome.result.matches : NOTHING;
}

const NOTHING: MatchSpan[] = [];
