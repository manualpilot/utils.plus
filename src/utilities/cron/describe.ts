import { type FieldSpec, normalise } from "./fields";
import type { ParsedField, Schedule, Term } from "./parse";

export function describeSchedule(schedule: Schedule): string {
  const parts = [describeTime(schedule)];

  const days = describeDays(schedule);
  if (days) parts.push(days);

  const months = saysNothing(schedule.month) ? "" : listPhrase(schedule.month);
  const years = schedule.year && !saysNothing(schedule.year) ? listPhrase(schedule.year) : "";
  if (months && years) parts.push(`in ${months} of ${years}`);
  else if (months) parts.push(`in ${months}`);
  else if (years) parts.push(`in ${years}`);

  return parts.join(" ");
}

function describeTime(schedule: Schedule): string {
  const { second, minute, hour } = schedule;

  if (pinned(hour) && pinned(minute) && (!second || pinned(second))) {
    const seconds = second ? second.values[0] : 0;
    const clock = `${pad(hour.values[0])}:${pad(minute.values[0])}`;
    return `At ${seconds ? `${clock}:${pad(seconds)}` : clock}`;
  }

  const clauses: { text: string; every: boolean }[] = [];
  if (second && !(pinned(second) && second.values[0] === 0)) clauses.push(unitClause(second));
  clauses.push(unitClause(minute), unitClause(hour));
  while (clauses.length > 1 && clauses[clauses.length - 1].every) clauses.pop();

  const text = clauses.map((clause) => clause.text).join(" past ");
  return text.startsWith("every") ? capitalise(text) : `At ${text}`;
}

function unitClause(field: ParsedField): { text: string; every: boolean } {
  const only = field.terms.length === 1 ? field.terms[0] : null;
  if (only?.kind === "all") return { text: `every ${field.spec.noun}`, every: true };
  if (only?.kind === "step") return { text: termPhrase(only, field.spec), every: false };
  const noun = field.values.length > 1 ? field.spec.plural : field.spec.noun;
  return { text: `${noun} ${listPhrase(field)}`, every: false };
}

function describeDays(schedule: Schedule): string {
  const dom = dayPhrase(schedule.dom);
  const dow = dayPhrase(schedule.dow);
  if (dom && dow) return `on ${dom} ${schedule.orDays ? "or" : "and"} ${dow}`;
  return dom || dow ? `on ${dom || dow}` : "";
}

function dayPhrase(field: ParsedField): string {
  if (saysNothing(field)) return "";
  const plain = field.terms.filter((term) => !field.specials.includes(term));
  const phrases: string[] = [];

  if (plain.length > 0) {
    const stepped = plain.length === 1 && plain[0].kind === "step";
    const list = joinWords(plain.map((term) => termPhrase(term, field.spec)));
    phrases.push(field.spec.key === "dom" && !stepped ? `${field.spec.noun} ${list}` : list);
  }
  for (const term of field.specials) phrases.push(termPhrase(term, field.spec));

  return joinWords(phrases);
}

export function saysNothing(field: ParsedField): boolean {
  return field.terms.length === 1 && field.terms[0].kind === "all";
}

function listPhrase(field: ParsedField): string {
  return joinWords(field.terms.map((term) => termPhrase(term, field.spec)));
}

function termPhrase(term: Term, spec: FieldSpec): string {
  switch (term.kind) {
    case "all":
      return `every ${spec.noun}`;
    case "value":
      return formatValue(spec, term.value);
    case "range":
      return `${formatValue(spec, term.from)} through ${formatValue(spec, term.to)}`;
    case "step": {
      const every = spec.calendar ? `every ${ordinal(term.step)} ${spec.noun}` : `every ${term.step} ${spec.plural}`;
      if (term.whole) return every;
      return `${every} from ${formatValue(spec, term.from)} through ${formatValue(spec, term.to)}`;
    }
    case "last-day":
      return term.offset === 0
        ? "the last day of the month"
        : `the ${ordinal(term.offset + 1)}-to-last day of the month`;
    case "last-weekday":
      return "the last weekday of the month";
    case "nearest-weekday":
      return `the weekday nearest the ${ordinal(term.day)}`;
    case "last-dow":
      return `the last ${formatValue(spec, term.day)} of the month`;
    case "nth-dow":
      return `the ${NTH_WORDS[term.nth]} ${formatValue(spec, term.day)} of the month`;
  }
}

function formatValue(spec: FieldSpec, value: number): string {
  if (!spec.fullNames) return String(value);
  return spec.fullNames[spec.weekday ? normalise(spec, value) : value - spec.min];
}

function pinned(field: ParsedField): boolean {
  return field.values.length === 1 && field.specials.length === 0;
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const NTH_WORDS = ["", "first", "second", "third", "fourth", "fifth"];
const ORDINAL_SUFFIXES: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };

function ordinal(value: number): string {
  const teens = value % 100;
  const suffix = teens >= 11 && teens <= 13 ? "th" : ORDINAL_SUFFIXES[value % 10] ?? "th";
  return `${value}${suffix}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
