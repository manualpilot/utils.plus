import type { Session } from "../../common/repl-console";
import { isWorking, type Run } from "../../common/run-output";
import type { Scope } from "../../common/variables-panel";
import type { Language } from "./engine";

export function runMessage(run: Run, scope: Scope | null): string {
  if (isWorking(run)) return "Variables are read when the run ends.";
  if (scope) return "The script defined no variables.";
  if (run.state === "stopped") return "The run was stopped before its variables could be read.";
  return "Nothing has run yet.";
}

export function sessionMessage(run: Run, scope: Scope | null, session: Session): string {
  if (isWorking(run)) return "Variables are read when the line returns.";
  if (scope) return "The session has bound no names.";
  if (session.entries.length > 0) return "The engine was stopped, and the session's names went with it.";
  return "Nothing has been entered yet.";
}

export type Mode = "script" | "repl";

export const COULD_NOT_START = "The engine could not be started.";

export const FUNCTIONS = { label: "Functions", one: "name", many: "names" };

export const MARKS = { prompt: ">", continued: "..." };

export const STOPPED_NOTE = "Stopped, and the session's names went with the engine.";

export const LANGUAGE_NAMES: Record<Language, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
};
