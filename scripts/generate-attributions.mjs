import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "attribution/attributions.json");
const MODULES = join(ROOT, "node_modules");

const LICENSE_FILE = /^(licen[sc]e|copying|notice)([._-].*)?$/i;

function main() {
  const written = build();
  const previous = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";

  if (!process.argv.includes("--check")) {
    writeFileSync(OUT, written);
    const { packages, texts } = JSON.parse(written);
    console.log(`attributions: ${packages.length} packages, ${texts.length} distinct licence texts`);
  } else if (written !== previous) {
    console.error("attributions: attribution/attributions.json is stale — run `npm run attributions`");
    process.exit(1);
  }
}

function build() {
  const locations = locate(MODULES, null, {});
  const texts = [];
  const index = new Map();
  const packages = [];

  for (const name of [...shipped()].sort()) {
    const dir = locations[name];
    if (!dir) continue;

    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const file = readdirSync(dir).find((entry) => LICENSE_FILE.test(entry));
    const license = spdx(manifest);
    const text = file ? readFileSync(join(dir, file), "utf8").trim() : fallback(license, manifest);

    if (!index.has(text)) {
      index.set(text, texts.length);
      texts.push(text);
    }

    packages.push({
      name,
      version: manifest.version ?? "",
      license,
      publisher: publisher(manifest),
      url: repository(manifest),
      text: index.get(text),
      ...(file ? {} : { reconstructed: true }),
    });
  }

  return JSON.stringify({ packages, texts }, null, 2) + "\n";
}

function shipped() {
  const json = execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  const names = new Set();
  (function walk(node) {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      names.add(name);
      walk(child);
    }
  })(JSON.parse(json));

  return names;
}

function locate(dir, scope, found) {
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

function spdx(manifest) {
  if (typeof manifest.license === "string") return manifest.license;
  if (manifest.license?.type) return manifest.license.type;
  if (Array.isArray(manifest.licenses)) return manifest.licenses.map((l) => l.type ?? l).join(" OR ");
  return "UNKNOWN";
}

function publisher(manifest) {
  const author = manifest.author ?? manifest.contributors?.[0];
  if (typeof author === "string") return author.replace(/\s*<[^>]*>/g, "").replace(/\s*\([^)]*\)/g, "").trim();
  return author?.name ?? "";
}

function repository(manifest) {
  const repo = typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;
  if (!repo) return manifest.homepage ?? "";
  return repo.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/\.git$/, "");
}

function fallback(license, manifest) {
  const notice = `Copyright (c) ${publisher(manifest) || manifest.name}`;
  const vendored = join(ROOT, "attribution", `${license}.txt`);

  if (/^[\w.+-]+$/.test(license) && existsSync(vendored)) {
    const text = readFileSync(vendored, "utf8").trim();
    return NOTICED.has(license) ? `${notice}\n\n${text}` : text;
  }

  return `${notice}\n\nReleased under the ${license} licence. This package ships no licence file of its own; `
    + `see ${repository(manifest) || "the package"} for the full terms.`;
}

const NOTICED = new Set(["MIT", "ISC"]);

main();
