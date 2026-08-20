import { ENGINE_NAMES, type ModeId, type Outcome } from "./engine";

export const NOTHING_TO_RUN = "There is nothing to run — the editor holds no statement.";

export const RUNNING = "Running…";

export const NOT_RUN_YET = "Nothing has run yet. Execute puts everything in the editor through the database.";

export const NO_SCHEMA_YET = "The catalogue is read once the database is up.";

export const EMPTY_SCHEMA = "This database is empty. Load an example dataset, or run a CREATE of your own.";

export const NO_LOG_YET = "The database has said nothing yet.";

export const RESETTING = "Resetting the database to an empty one.";

export function loadingMessage(label: string): string {
  return `Loading the ${label} dataset: its script is in the editor, and runs as the database comes up.`;
}

export function loadWarning(label: string, populated: boolean): string {
  const database = populated ? ", so the tables in this one go with it" : "";
  return `Loading the ${label} dataset writes its script into the editor and runs it against a fresh database${database}.`;
}

export const LOAD_UNDONE = "The editor's own undo still has what was there. Nothing here brings a database back.";

export function startingMessage(mode: ModeId, dataset: string | null): string {
  const engine = ENGINE_NAMES[mode];
  return dataset ? `Starting ${engine} and loading the ${dataset} dataset…` : `Starting ${engine}…`;
}

export function readyMessage(version: string): string {
  return `${version} is up, with an empty database.`;
}

export function startFailure(mode: ModeId, reason: string): string {
  return `${ENGINE_NAMES[mode]} did not start: ${reason}`;
}

export function summarise(outcome: Outcome, ms: number): string {
  const parts = [outcome.command ?? ""];
  if (outcome.columns.length > 0) parts.push(count(outcome.rows.length, "row"));
  if (outcome.affected !== null) parts.push(`${count(outcome.affected, "row")} affected`);
  return `${parts.filter(Boolean).join(", ")} in ${writeMillis(ms)}`;
}

export function ranMessage(done: number, ms: number): string {
  return `${count(done, "statement")} ran in ${writeMillis(ms)}. None of them returned rows.`;
}

export function truncatedMessage(shown: number, total: number): string {
  return `Showing the first ${shown.toLocaleString()} of ${total.toLocaleString()} rows.`;
}

export function schemaFailure(reason: string): string {
  return `The catalogue could not be read: ${reason}`;
}

export function writeMillis(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return ms >= 10 ? `${Math.round(ms)} ms` : `${ms.toFixed(2)} ms`;
}

export function count(total: number, noun: string): string {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}
