import { saysNothing } from "./describe";
import { DAY_NAMES, type Flavour } from "./fields";
import { type ParsedField, readCron, type Schedule } from "./parse";

export interface Preset {
  label: string;
  minute: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
}

export const PRESETS: Preset[] = [
  { label: "Every minute", minute: "*", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every 5 minutes", minute: "*/5", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every 15 minutes", minute: "*/15", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every hour", minute: "0", hour: "*", dom: "*", month: "*", dow: "*" },
  { label: "Every 6 hours", minute: "0", hour: "*/6", dom: "*", month: "*", dow: "*" },
  { label: "Every day at midnight", minute: "0", hour: "0", dom: "*", month: "*", dow: "*" },
  { label: "Every day at 09:00", minute: "0", hour: "9", dom: "*", month: "*", dow: "*" },
  { label: "Weekdays at 09:00", minute: "0", hour: "9", dom: "*", month: "*", dow: "MON-FRI" },
  { label: "Mondays at 09:00", minute: "0", hour: "9", dom: "*", month: "*", dow: "MON" },
  { label: "The 1st at midnight", minute: "0", hour: "0", dom: "1", month: "*", dow: "*" },
  { label: "Quarterly", minute: "0", hour: "0", dom: "1", month: "JAN,APR,JUL,OCT", dow: "*" },
];

export function presetExpression(preset: Preset, flavour: Flavour): string {
  let dom = preset.dom;
  let dow = preset.dow;
  if (flavour === "quartz") {
    if (dow === "*") dow = "?";
    else if (dom === "*") dom = "?";
  }
  const core = [preset.minute, preset.hour, dom, preset.month, dow];
  return flavour === "unix" ? core.join(" ") : ["0", ...core].join(" ");
}

export function refit(text: string, from: Flavour, to: Flavour): string {
  if (from === to) return text;
  const preset = PRESETS.find((item) => presetExpression(item, from) === text.trim());
  if (preset) return presetExpression(preset, to);
  const schedule = readCron(text, from).schedule;
  return (schedule && rewrite(schedule, to)) ?? text;
}

export function rewrite(schedule: Schedule, to: Flavour): string | null {
  if (to !== "quartz" && (schedule.dom.specials.length > 0 || schedule.dow.specials.length > 0)) return null;

  let dom = schedule.dom.text;
  let dow = weekdayText(schedule.dow);
  if (to === "quartz") {
    if (saysNothing(schedule.dow)) dow = "?";
    else if (saysNothing(schedule.dom)) dom = "?";
  } else {
    if (dom === "?") dom = "*";
    if (dow === "?") dow = "*";
  }

  const tokens = to === "unix" ? [] : [schedule.second ? schedule.second.text : "0"];
  tokens.push(schedule.minute.text, schedule.hour.text, dom, schedule.month.text, dow);
  if (to === "quartz" && schedule.year && !schedule.year.open) tokens.push(schedule.year.text);
  return tokens.join(" ");
}

function weekdayText(field: ParsedField): string {
  if (field.open || field.specials.length > 0) return field.text;
  return runsOf(field.values)
    .map((run) =>
      run.length > 2
        ? `${DAY_NAMES[run[0]]}-${DAY_NAMES[run[run.length - 1]]}`
        : run.map((day) => DAY_NAMES[day]).join(",")
    )
    .join(",");
}

function runsOf(values: number[]): number[][] {
  const runs: number[][] = [];
  for (const value of values) {
    const last = runs[runs.length - 1];
    if (last && value === last[last.length - 1] + 1) last.push(value);
    else runs.push([value]);
  }
  return runs;
}
