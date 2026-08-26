export const MODES = {
  instant: {
    label: "Instant",
    title: "Time",
    field: "Timestamp or epoch",
    hint: "Epoch seconds to nanoseconds, ISO 8601 or RFC 2822",
  },
  duration: {
    label: "Duration",
    title: "Duration",
    field: "Instant",
    hint: "What the duration is counted from",
  },
  between: {
    label: "Between",
    title: "Time Between",
    field: "From",
    hint: "Where the count starts",
  },
};

export type Mode = keyof typeof MODES;

export const MODE_OPTIONS = Object.entries(MODES).map(([value, { label }]) => ({ value, label }));

export function pickMode(value: unknown): Mode {
  return value === "duration" || value === "between" ? value : "instant";
}

export const SAMPLE_DURATION = "1h 30m";

export function pickDuration(value: unknown): string {
  return typeof value === "string" ? value : SAMPLE_DURATION;
}
