import { findMatches, type MatchResult } from "./match";

self.addEventListener("message", ({ data }: MessageEvent<Request>) => {
  send({ kind: "began", id: data.id });
  try {
    send({ kind: "done", id: data.id, result: findMatches(data.pattern, data.flags, data.text) });
  } catch {
    send({ kind: "threw", id: data.id });
  }
});

function send(answer: Answer) {
  self.postMessage(answer);
}

export interface Request {
  id: number;
  pattern: string;
  flags: string;
  text: string;
}

export type Answer =
  | { kind: "began"; id: number }
  | { kind: "done"; id: number; result: MatchResult }
  | { kind: "threw"; id: number };
