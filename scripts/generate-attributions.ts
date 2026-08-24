import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "attribution/attributions.json");
const LICENSES = join(ROOT, "attribution/license");
const CANONICAL = join(ROOT, "attribution/canonical");
const MODULES = join(ROOT, "node_modules");

const LICENSE_FILE = /^(licen[sc]e|copying|notice)([._-].*)?$/i;

type Person = string | { name?: string };

interface Manifest {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  licenses?: (string | { type?: string })[];
  author?: Person;
  contributors?: Person[];
  repository?: string | { url?: string };
  homepage?: string;
}

interface Attribution {
  name: string;
  version: string;
  license: string;
  publisher: string;
  url: string;
  file: string;
  reconstructed?: true;
}

interface Installed {
  dependencies?: Record<string, Installed>;
}

function main(): void {
  const { json, files } = build();
  const previous = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const departed = existing().filter((name) => !files.has(name));

  if (process.argv.includes("--check")) {
    const stale = json !== previous || departed.length > 0
      || [...files].some(([name, text]) => stored(name) !== text);

    if (stale) {
      console.error("attributions: attribution/ is stale — run `npm run attributions`");
      process.exit(1);
    }
    return;
  }

  mkdirSync(LICENSES, { recursive: true });
  writeFileSync(OUT, json);
  for (const [name, text] of files) writeFileSync(join(LICENSES, `${name}.txt`), text);
  for (const name of departed) rmSync(join(LICENSES, `${name}.txt`));

  console.log(`attributions: ${files.size} packages, ${departed.length} licences no longer served`);
}

function build(): { json: string; files: Map<string, string> } {
  const locations = locate(MODULES, null, {});
  const files = new Map<string, string>();
  const packages: Attribution[] = [];

  for (const name of [...shipped()].sort()) {
    const dir = locations[name];
    if (!dir) continue;

    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
    const file = readdirSync(dir).find((entry) => LICENSE_FILE.test(entry));
    const license = spdx(manifest);
    const text = file ? readFileSync(join(dir, file), "utf8").trim() : fallback(license, manifest);
    const own = fileName(name);

    if (files.has(own)) throw new Error(`attributions: two packages want attribution/license/${own}.txt`);
    files.set(own, `${text}\n`);

    packages.push({
      name,
      version: manifest.version ?? "",
      license,
      publisher: publisher(manifest),
      url: repository(manifest),
      file: own,
      ...(file ? {} : { reconstructed: true as const }),
    });
  }

  return { json: JSON.stringify({ packages }, null, 2) + "\n", files };
}

function fileName(name: string): string {
  return name.replace(/^@/, "").replace(/\//g, "-");
}

function existing(): string[] {
  if (!existsSync(LICENSES)) return [];
  return readdirSync(LICENSES).filter((entry) => entry.endsWith(".txt")).map((entry) => entry.slice(0, -".txt".length));
}

function stored(name: string): string {
  const path = join(LICENSES, `${name}.txt`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function shipped(): Set<string> {
  const json = execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  const names = new Set<string>();
  (function walk(node: Installed): void {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      names.add(name);
      walk(child);
    }
  })(JSON.parse(json) as Installed);

  return names;
}

function locate(dir: string, scope: string | null, found: Record<string, string>): Record<string, string> {
  if (!existsSync(dir)) return found;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);

    if (entry.name.startsWith("@") && !scope) {
      locate(path, entry.name, found);
      continue;
    }

    const name = scope ? `${scope}/${entry.name}` : entry.name;
    if (!found[name] && existsSync(join(path, "package.json"))) found[name] = path;
    locate(join(path, "node_modules"), null, found);
  }

  return found;
}

function spdx(manifest: Manifest): string {
  if (typeof manifest.license === "string") return manifest.license;
  if (manifest.license?.type) return manifest.license.type;
  if (Array.isArray(manifest.licenses)) {
    return manifest.licenses.map((one) => (typeof one === "string" ? one : one.type ?? "")).join(" OR ");
  }
  return "UNKNOWN";
}

function publisher(manifest: Manifest): string {
  const author = manifest.author ?? manifest.contributors?.[0];
  if (typeof author === "string") return author.replace(/\s*<[^>]*>/g, "").replace(/\s*\([^)]*\)/g, "").trim();
  return author?.name ?? "";
}

function repository(manifest: Manifest): string {
  const repo = typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;
  if (!repo) return manifest.homepage ?? "";
  return repo.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/\.git$/, "");
}

function fallback(license: string, manifest: Manifest): string {
  const notice = `Copyright (c) ${publisher(manifest) || manifest.name}`;
  const path = join(CANONICAL, `${license}.txt`);

  if (/^[\w.+-]+$/.test(license) && existsSync(path)) {
    const text = readFileSync(path, "utf8").trim();
    return NOTICED.has(license) ? `${notice}\n\n${text}` : text;
  }

  return `${notice}\n\nReleased under the ${license} licence. This package ships no licence file of its own; `
    + `see ${repository(manifest) || "the package"} for the full terms.`;
}

const NOTICED = new Set(["MIT", "ISC"]);

main();
