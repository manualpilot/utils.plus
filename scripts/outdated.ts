import { spawnSync } from "node:child_process";
import { RELEASE as SHAPES_RELEASE } from "./generate-country-shapes.ts";
import { RELEASE as PHONE_RELEASE } from "./generate-phone-geo.ts";

const TITLES: Record<string, string | undefined> = {
  dependencies: "Outdated dependencies",
  devDependencies: "Outdated dev dependencies",
};
const ORDER = Object.keys(TITLES);

interface Pinned {
  title: string;
  repository: string;
  pinned: string;
  generator: string;
}

const PINNED: Pinned[] = [
  {
    title: "phone number maps",
    repository: "google/libphonenumber",
    pinned: PHONE_RELEASE,
    generator: "scripts/generate-phone-geo.ts",
  },
  {
    title: "country boundaries",
    repository: "nvkelso/natural-earth-vector",
    pinned: SHAPES_RELEASE,
    generator: "scripts/generate-country-shapes.ts",
  },
];

interface Entry {
  current?: string;
  wanted?: string;
  latest?: string;
  type?: string;
}

interface Report {
  [name: string]: Entry | Entry[];
}

interface Failed {
  error?: { summary?: string };
}

const groups = new Map<string, string[]>();

for (const [name, reported] of Object.entries(outdated())) {
  for (const entry of [reported].flat()) {
    const kind = entry.type ?? "dependencies";
    groups.set(kind, [...groups.get(kind) ?? [], describe(name, entry)]);
  }
}

const behind = (await Promise.all(PINNED.map(pinnedRelease))).filter((line) => line !== undefined);

if (groups.size === 0 && behind.length === 0) {
  console.log("every dependency is up to date");
  process.exit(0);
}

for (const [kind, found] of [...groups].sort(([a], [b]) => rank(a) - rank(b))) {
  const lines = [...found].sort();
  warn(`${TITLES[kind] ?? `Outdated ${kind}`} (${lines.length})`, lines);
}

if (behind.length > 0) warn(`Outdated pinned releases (${behind.length})`, behind);

async function pinnedRelease({ title, repository, pinned, generator }: Pinned): Promise<string | undefined> {
  const url = `https://api.github.com/repos/${repository}/releases/latest`;
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const failed = `${title[0].toUpperCase()}${title.slice(1)} check failed`;
  let latest: string | undefined;
  try {
    const headers = { Accept: "application/vnd.github+json", ...token ? { Authorization: `Bearer ${token}` } : {} };
    const response = await fetch(url, { headers });
    if (!response.ok) fail(failed, `${url} answered ${response.status}`);
    latest = (await response.json() as { tag_name?: string }).tag_name;
  } catch (cause) {
    fail(failed, `${url}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!latest) fail(failed, `${url} named no release`);
  return latest === pinned ? undefined : `${repository} ${pinned} → ${latest} (RELEASE in ${generator})`;
}

function outdated(): Report {
  const npm = spawnSync("npm", ["outdated", "--json", "--long"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const report: (Report & Failed) | null = npm.error ? null : parse(npm.stdout);
  if (report && !report.error?.summary) return report;
  fail("Dependency check failed", report?.error?.summary ?? lastLine(npm.error?.message ?? npm.stderr));
}

function parse(stdout: string): (Report & Failed) | null {
  try {
    return JSON.parse(stdout || "{}") as Report & Failed;
  } catch {
    return null;
  }
}

function describe(name: string, entry: Entry): string {
  const current = entry.current ?? "missing";
  const inRange = entry.wanted && entry.wanted !== current && entry.wanted !== entry.latest;
  return `${name} ${current} → ${entry.latest}${inRange ? ` (${entry.wanted} inside the declared range)` : ""}`;
}

function rank(kind: string): number {
  const at = ORDER.indexOf(kind);
  return at === -1 ? ORDER.length : at;
}

function warn(title: string, lines: string[]): void {
  annotate("warning", title, lines);
}

function fail(title: string, line: string): never {
  annotate("error", title, [line]);
  process.exit(1);
}

function annotate(kind: "warning" | "error", title: string, lines: string[]): void {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::${kind} title=${escapeProperty(title)}::${escapeData(lines.join("\n"))}`);
    return;
  }
  const write = kind === "error" ? console.error : console.log;
  write(`\n${title}:`);
  for (const line of lines) write(`  ${line}`);
}

function escapeData(text: string): string {
  return text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function escapeProperty(text: string): string {
  return escapeData(text).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

function lastLine(text: string | undefined): string {
  return (text ?? "").trim().split("\n").at(-1) || "no output";
}
