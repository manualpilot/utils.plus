import { Group, Loader, Text } from "@mantine/core";

export type Run =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "running" }
  | { state: "finished"; seconds: number }
  | { state: "stopped" }
  | { state: "failed"; message: string };

export const IDLE: Run = { state: "idle" };

export function isWorking(run: Run): boolean {
  return run.state === "starting" || run.state === "running";
}

export function RunStatus({ run, starting }: { run: Run; starting: string }) {
  switch (run.state) {
    case "idle":
      return null;
    case "starting":
    case "running":
      return (
        <Group gap="xs" wrap="nowrap">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">{run.state === "starting" ? starting : "Running…"}</Text>
        </Group>
      );
    case "finished":
      return <Text size="sm" c="dimmed">Finished in {run.seconds.toFixed(2)}s</Text>;
    case "stopped":
      return <Text size="sm" c="dimmed">Stopped</Text>;
    case "failed":
      return <Text size="sm" c="red">{run.message}</Text>;
  }
}

export interface Chunk {
  text: string;
  dropped: boolean;
}

export const NOTHING_HELD: Chunk = { text: "", dropped: false };

export const DRAW_DELAY = 100;

export const MAX_OUTPUT = 128 * 1024;

export const DROPPED_NOTE = "… earlier output dropped\n";

export function runStats(seconds: number, output: string | null, dropped: boolean): string {
  const written = output ?? "";
  const finished = `Finished in ${seconds.toFixed(2)}s`;
  if (!written) return `${finished} · no output`;

  const lines = written.split("\n").length - (written.endsWith("\n") ? 1 : 0);
  return `${finished} · ${lines} ${lines === 1 ? "line" : "lines"}${dropped ? " kept" : ""}`;
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
