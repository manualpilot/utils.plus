import { spawnSync } from "node:child_process";
import { RELEASE as SHAPES_RELEASE } from "./generate-country-shapes.mjs";
import { RELEASE as PHONE_RELEASE } from "./generate-phone-geo.mjs";

const TITLES = { dependencies: "Outdated dependencies", devDependencies: "Outdated dev dependencies" };
const ORDER = Object.keys(TITLES);

const PINNED = [
  {
    title: "phone number maps",
    repository: "google/libphonenumber",
    pinned: PHONE_RELEASE,
    generator: "scripts/generate-phone-geo.mjs",
  },
  {
    title: "country boundaries",
    repository: "nvkelso/natural-earth-vector",
    pinned: SHAPES_RELEASE,
    generator: "scripts/generate-country-shapes.mjs",
  },
];

const groups = new Map();

for (const [name, reported] of Object.entries(outdated())) {
  for (const entry of [reported].flat()) {
    const kind = entry.type ?? "dependencies";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(describe(name, entry));
  }
}

const behind = (await Promise.all(PINNED.map(pinnedRelease))).filter(Boolean);

if (groups.size === 0 && behind.length === 0) {
  console.log("every dependency is up to date");
  process.exit(0);
}

for (const kind of [...groups.keys()].sort((a, b) => rank(a) - rank(b))) {
  const lines = groups.get(kind).sort();
  warn(`${TITLES[kind] ?? `Outdated ${kind}`} (${lines.length})`, lines);
}

if (behind.length > 0) warn(`Outdated pinned releases (${behind.length})`, behind);

async function pinnedRelease({ title, repository, pinned, generator }) {
  const url = `https://api.github.com/repos/${repository}/releases/latest`;
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const failed = `${title[0].toUpperCase()}${title.slice(1)} check failed`;
  let latest;
  try {
    const headers = { Accept: "application/vnd.github+json", ...token ? { Authorization: `Bearer ${token}` } : {} };
    const response = await fetch(url, { headers });
    if (!response.ok) fail(failed, `${url} answered ${response.status}`);
    latest = (await response.json()).tag_name;
  } catch (cause) {
    fail(failed, `${url}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!latest) fail(failed, `${url} named no release`);
  return latest === pinned ? undefined : `${repository} ${pinned} → ${latest} (RELEASE in ${generator})`;
}

function outdated() {
  const npm = spawnSync("npm", ["outdated", "--json", "--long"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const report = npm.error ? null : parse(npm.stdout);
  if (report && !report.error?.summary) return report;
  fail("Dependency check failed", report?.error?.summary ?? lastLine(npm.error?.message ?? npm.stderr));
}

function parse(stdout) {
  try {
    return JSON.parse(stdout || "{}");
  } catch {
    return null;
  }
}

function describe(name, entry) {
  const current = entry.current ?? "missing";
  const inRange = entry.wanted && entry.wanted !== current && entry.wanted !== entry.latest;
  return `${name} ${current} → ${entry.latest}${inRange ? ` (${entry.wanted} inside the declared range)` : ""}`;
}

function rank(kind) {
  const at = ORDER.indexOf(kind);
  return at === -1 ? ORDER.length : at;
}

function warn(title, lines) {
  annotate("warning", title, lines);
}

function fail(title, line) {
  annotate("error", title, [line]);
  process.exit(1);
}

function annotate(kind, title, lines) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::${kind} title=${escapeProperty(title)}::${escapeData(lines.join("\n"))}`);
    return;
  }
  const write = kind === "error" ? console.error : console.log;
  write(`\n${title}:`);
  for (const line of lines) write(`  ${line}`);
}

function escapeData(text) {
  return text.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function escapeProperty(text) {
  return escapeData(text).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

function lastLine(text) {
  return (text ?? "").trim().split("\n").at(-1) || "no output";
}
