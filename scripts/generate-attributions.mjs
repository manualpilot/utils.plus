import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "inline/attributions.json");
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
    console.error("attributions: inline/attributions.json is stale — run `npm run attributions`");
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
  const holder = publisher(manifest) || manifest.name;
  const notice = `Copyright (c) ${holder}`;

  if (license === "MIT") return `${notice}\n\n${MIT}`;
  if (license === "ISC") return `${notice}\n\n${ISC}`;
  if (license === "Unlicense") return UNLICENSE;

  const vendored = join(ROOT, "inline", `${license}.txt`);
  if (/^[\w.+-]+$/.test(license) && existsSync(vendored)) return readFileSync(vendored, "utf8").trim();

  return `${notice}\n\nReleased under the ${license} licence. This package ships no licence file of its own; `
    + `see ${repository(manifest) || "the package"} for the full terms.`;
}

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ISC = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const UNLICENSE = `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this
software, either in source code form or as a compiled binary, for any purpose,
commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this
software dedicate any and all copyright interest in the software to the public
domain. We make this dedication for the benefit of the public at large and to
the detriment of our heirs and successors. We intend this dedication to be an
overt act of relinquishment in perpetuity of all present and future rights to
this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org/>`;

main();
