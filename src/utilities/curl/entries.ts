import { defaultFlag, findLong, type OptionSpec } from "./options";

export type Entry = UrlEntry | OptionEntry | UnknownEntry;

export interface UrlEntry {
  kind: "url";
  value: string;
  flag: string | null;
}

export interface OptionEntry {
  kind: "option";
  name: string;
  flag: string;
  value: string;
}

export interface UnknownEntry {
  kind: "unknown";
  flag: string;
}

export interface Command {
  entries: Entry[];
  error: string | null;
}

export interface Slot<T extends Entry> {
  index: number;
  entry: T;
}

export interface Block {
  spec: OptionSpec;
  slots: Slot<OptionEntry>[];
}

export interface Arrangement {
  urls: Slot<UrlEntry>[];
  singles: Block[];
  groups: Block[];
  flags: Block[];
  unknown: Slot<UnknownEntry>[];
}

export function arrange(entries: Entry[]): Arrangement {
  const urls: Slot<UrlEntry>[] = [];
  const unknown: Slot<UnknownEntry>[] = [];
  const blocks = new Map<string, Block>();

  entries.forEach((entry, index) => {
    if (entry.kind === "url") {
      urls.push({ index, entry });
      return;
    }

    if (entry.kind === "unknown") {
      unknown.push({ index, entry });
      return;
    }

    const spec = findLong(entry.name);
    if (!spec) return;

    const block = blocks.get(entry.name) ?? { spec, slots: [] };
    block.slots.push({ index, entry });
    blocks.set(entry.name, block);
  });

  const present = [...blocks.values()];

  return {
    urls,
    singles: present.filter((block) => block.spec.value !== "none" && !block.spec.repeatable),
    groups: present.filter((block) => block.spec.value !== "none" && block.spec.repeatable),
    flags: present.filter((block) => block.spec.value === "none"),
    unknown,
  };
}

export function optionNames(entries: Entry[]): Set<string> {
  return new Set(entries.filter((entry) => entry.kind === "option").map((entry) => entry.name));
}

export function setValue(entries: Entry[], index: number, value: string): Entry[] {
  return entries.map((entry, at) => at === index && entry.kind !== "unknown" ? { ...entry, value } : entry);
}

export function removeAt(entries: Entry[], index: number): Entry[] {
  return entries.filter((_, at) => at !== index);
}

export function addUrl(entries: Entry[]): Entry[] {
  return insertAfter(entries, lastIndex(entries, (entry) => entry.kind === "url"), {
    kind: "url",
    value: "",
    flag: null,
  });
}

export function addOption(entries: Entry[], spec: OptionSpec): Entry[] {
  const entry: OptionEntry = { kind: "option", name: spec.name, flag: defaultFlag(spec), value: "" };

  const own = lastIndex(entries, (held) => held.kind === "option" && held.name === spec.name);
  if (own >= 0) return insertAfter(entries, own, entry);

  if (bundledLetter(entry) === null) return [...entries, entry];
  return insertAfter(entries, lastIndex(entries, (held) => bundledLetter(held) !== null), entry);
}

export function bundledLetter(entry: Entry): string | null {
  if (entry.kind === "url") return null;
  if (entry.kind === "option" && findLong(entry.name)?.value !== "none") return null;
  return LETTER.test(entry.flag) ? entry.flag.slice(1) : null;
}

const LETTER = /^-[^-]$/;

function insertAfter(entries: Entry[], at: number, entry: Entry): Entry[] {
  if (at < 0) return [...entries, entry];
  return [...entries.slice(0, at + 1), entry, ...entries.slice(at + 1)];
}

function lastIndex(entries: Entry[], matches: (entry: Entry) => boolean): number {
  for (let at = entries.length - 1; at >= 0; at -= 1) {
    if (matches(entries[at])) return at;
  }
  return -1;
}
