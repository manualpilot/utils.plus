export interface LogEntry {
  at: number;
  level: LogLevel;
  text: string;
}

export type LogLevel = "engine" | "query" | "notice" | "error";

export const MAX_LOG_ENTRIES = 10_000;

export function appended(entries: readonly LogEntry[], added: readonly LogEntry[]): LogEntry[] {
  if (added.length === 0) return entries as LogEntry[];
  const next = [...entries, ...added];
  return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
}

export function writeLog(entries: readonly LogEntry[]): string {
  return entries.map(writeEntry).join("\n");
}

export function writeEntry(entry: LogEntry): string {
  return `${clockOf(entry.at)}  ${LEVEL_MARKS[entry.level]}  ${entry.text}`;
}

function clockOf(at: number): string {
  const time = new Date(at);
  const parts = [time.getHours(), time.getMinutes(), time.getSeconds()].map((part) => String(part).padStart(2, "0"));
  return `${parts.join(":")}.${String(time.getMilliseconds()).padStart(3, "0")}`;
}

const LEVEL_MARKS: Record<LogLevel, string> = {
  engine: "ENGINE",
  query: "QUERY ",
  notice: "NOTICE",
  error: "ERROR ",
};
