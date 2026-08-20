import { spawnSync } from "node:child_process";

const TITLES = { dependencies: "Outdated dependencies", devDependencies: "Outdated dev dependencies" };
const ORDER = Object.keys(TITLES);

const groups = new Map();

for (const [name, reported] of Object.entries(outdated())) {
  for (const entry of [reported].flat()) {
    const kind = entry.type ?? "dependencies";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(describe(name, entry));
  }
}

if (groups.size === 0) {
  console.log("every dependency is up to date");
  process.exit(0);
}

for (const kind of [...groups.keys()].sort((a, b) => rank(a) - rank(b))) {
  const lines = groups.get(kind).sort();
  warn(`${TITLES[kind] ?? `Outdated ${kind}`} (${lines.length})`, lines);
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
