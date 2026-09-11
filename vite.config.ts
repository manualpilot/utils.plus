import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin, Rolldown } from "vite";
import { defineConfig } from "vitest/config";
import { type PageContent, type PageContents, pageDocuments, withBody, withHead } from "./src/page-document.ts";
import { ATTRIBUTIONS_PATH, documentFileName, HOME_PATH, OG_IMAGE, PAGE_META, type PagePath, robotsTxt, sitemapXml } from "./src/page-meta.ts";

export default defineConfig({
  root: "src",
  publicDir: false,
  css: { postcss: join(import.meta.dirname, "conf") },
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    assetsInlineLimit: (file) =>
      PHONE_GEO.test(file) || COUNTRY_VIEW.test(file) || UNICODE_NAME.test(file) || LICENCE.test(file)
        || IP_DELEGATION.test(file) || IP_ROA.test(file)
        ? false
        : undefined,
    rolldownOptions: {
      input: {
        index: join(import.meta.dirname, "src/index.html"),
        "404": join(import.meta.dirname, "src/404.html"),
      },
      output: { chunkFileNames, assetFileNames },
    },
  },
  plugins: [react(), pyodideAssets(), pageMetaFiles()],
  test: {
    root: import.meta.dirname,
    globals: true,
    environment: "jsdom",
    setupFiles: "./conf/vitest.setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },

  resolve: { tsconfigPaths: true },

  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "@electric-sql/pglite", "@docx-editor.dev/core", "@docx-editor.dev/fonts"],
    entries: ["index.html", "utilities/**/*.ts"],
  },
});

function chunkFileNames(chunk: Rolldown.PreRenderedChunk): string {
  const name = (DIRECTORY_NAMES.has(chunk.name) ? packageOf(chunk) : undefined) ?? chunk.name;
  return `assets/${scopedName(name, chunk)}-[hash].js`;
}

const PAGE_CONTENT = /\/src\/page-content\/[^/]+\.ts$/;

function scopedName(name: string, chunk: Rolldown.PreRenderedChunk): string {
  if (PAGE_CONTENT.test(chunk.facadeModuleId ?? "")) return `page-content/${name}`;
  const editor = CODEMIRROR.exec(name);
  if (editor) return `codemirror/${editor[1] ?? "codemirror"}`;
  const icon = ICON.exec(name);
  if (icon) return `icons/${icon[1]}`;
  if (allFrom(chunk, "@mantine/")) return `mantine/${name}`;
  if (allFrom(chunk, "pdfmake/")) return `pdfmake/${name}`;
  if (allFrom(chunk, "@docx-editor.dev/")) return `docx-editor/${name}`;
  if (allFrom(chunk, "@embedpdf/")) return `embedpdf/${name.replace(EMBEDPDF, "")}`;
  return name;
}

const EMBEDPDF = /^embedpdf-/;

const CODEMIRROR = /^codemirror(?:[-_](.+))?$/;

const ICON = /^Icon(.+)$/;

function allFrom(chunk: Rolldown.PreRenderedChunk, path: string): boolean {
  return chunk.moduleIds.length > 0 && chunk.moduleIds.every((id) => id.includes(`/node_modules/${path}`));
}

function assetFileNames(asset: Rolldown.PreRenderedAsset): string {
  return `${assetDirectory(asset)}/[name]-[hash][extname]`;
}

function assetDirectory(asset: Rolldown.PreRenderedAsset): string {
  if (FONT.test(asset.names[0] ?? "")) return "assets/fonts";
  const original = asset.originalFileNames[0] ?? "";
  if (PHONE_GEO.test(original)) return "assets/phone-geo";
  if (UNICODE_NAME.test(original)) return "assets/unicode-names";
  if (IP_DELEGATION.test(original)) return "assets/ip-registry";
  if (IP_ROA.test(original)) return "assets/ip-roas";
  if (LICENCE.test(original)) return "assets/license";
  return COUNTRY_VIEW.test(original) ? "assets/country-views" : "assets";
}

const FONT = /\.(?:woff2?|ttf|otf|eot)$/;

const PHONE_GEO = /\/phone-number\/maps\/[^/]+\.json$/;

const COUNTRY_VIEW = /\/countries\/views\/[^/]+\.json$/;

const UNICODE_NAME = /\/unicode\/names\/[^/]+\.json$/;

const IP_DELEGATION = /\/ip-address\/delegations\/[^/]+\.json$/;

const IP_ROA = /\/ip-address\/roas\/[^/]+\.json$/;

const LICENCE = /\/attribution\/(?:license|canonical)\/[^/]+\.txt$/;

function packageOf(chunk: Rolldown.PreRenderedChunk): string | undefined {
  const id = chunk.facadeModuleId ?? chunk.moduleIds.at(-1) ?? "";
  const [scope, name] = id.split("/node_modules/").at(-1)?.split("/") ?? [];
  if (!id.includes("/node_modules/") || !scope) return undefined;
  return scope.startsWith("@") && name ? `${scope.slice(1)}-${name}` : scope;
}

const DIRECTORY_NAMES = new Set("browser build cjs core dist esm exports index lib main module src".split(" "));

function pageMetaFiles(): Plugin {
  const files: Record<string, () => string> = {
    "/sitemap.xml": () => sitemapXml(lastModified()),
    "/robots.txt": robotsTxt,
  };

  return {
    name: "page-meta-files",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => withBody(withHead(html, HOME_PATH), HOME_PATH),
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === OG_IMAGE.path) {
          readFile(OG_IMAGE_SOURCE).then((body) => {
            res.setHeader("Content-Type", "image/png");
            res.end(body);
          }, next);
          return;
        }
        const write = files[url];
        if (!write) return next();
        res.setHeader("Content-Type", url.startsWith("/sitemap") ? "application/xml" : "text/plain");
        res.end(write());
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        const end = url.search(/[?#]/);
        const document = DOCUMENT_URLS.get(end === -1 ? url : url.slice(0, end));
        if (document) req.url = end === -1 ? document : document + url.slice(end);
        next();
      });
    },
    generateBundle: {
      order: "post",
      async handler(_options, bundle) {
        for (const [url, write] of Object.entries(files)) {
          this.emitFile({ type: "asset", fileName: url.slice(1), source: write() });
        }
        this.emitFile({ type: "asset", fileName: OG_IMAGE.path.slice(1), source: await readFile(OG_IMAGE_SOURCE) });

        const index = bundle["index.html"];
        if (index?.type !== "asset") throw new Error("page-meta-files: index.html is not in the bundle");

        for (const [fileName, source] of Object.entries(pageDocuments(index.source.toString(), await pageContents()))) {
          this.emitFile({ type: "asset", fileName, source });
        }
      },
    },
  };
}

const OG_IMAGE_SOURCE = join(import.meta.dirname, "src/images/og-image.png");

const CONTENT_DIR = join(import.meta.dirname, "src/page-content");

async function pageContents(): Promise<PageContents> {
  const contents: PageContents = {};
  for (const file of readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".ts"))) {
    const path = `/${basename(file, ".ts")}` as keyof PageContents;
    const module: { default: PageContent } = await import(pathToFileURL(join(CONTENT_DIR, file)).href);
    contents[path] = module.default;
  }
  return contents;
}

function lastModified(): Partial<Record<PagePath, string>> {
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", import.meta.dirname, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim();

  try {
    if (git("rev-parse", "--is-shallow-repository") !== "false") return warnUndated("the checkout is shallow");
  } catch {
    return warnUndated("there is no git history to read");
  }

  const dates: Partial<Record<PagePath, string>> = {};
  for (const path of Object.keys(PAGE_META) as PagePath[]) {
    const date = git("log", "-1", "--format=%cI", "--", ...sourcesOf(path));
    if (date) dates[path] = date;
  }
  return dates;
}

function sourcesOf(path: PagePath): string[] {
  if (path === HOME_PATH) return ["src/page-meta.ts", "src/welcome.tsx"];
  if (path === ATTRIBUTIONS_PATH) return ["attribution", "src/attributions.tsx"];
  const name = path.slice(1);
  return [`src/utilities/${name}`, `src/page-content/${name}.ts`];
}

function warnUndated(reason: string): Partial<Record<PagePath, string>> {
  console.warn(`page-meta-files: the sitemap carries no lastmod, because ${reason}`);
  return {};
}

const DOCUMENT_URLS = new Map<string, string>(
  (Object.keys(PAGE_META) as PagePath[])
    .filter((path) => path !== HOME_PATH)
    .map((path) => [path, `/${documentFileName(path)}`]),
);

function pyodideAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const packageDir = dirname(require.resolve("pyodide/package.json"));
  const dir = `assets/pyodide/${require("pyodide/package.json").version}`;
  const read = (name: string) => readFile(join(packageDir, name));

  return {
    name: "pyodide-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = PYODIDE_FILES.find((file) => req.url?.split("?")[0] === `/${dir}/${file}`);
        if (!name) return next();
        read(name).then((body) => {
          res.setHeader("Content-Type", PYODIDE_TYPES[extname(name)]);
          res.end(body);
        }, next);
      });
    },
    async generateBundle() {
      for (const name of PYODIDE_FILES) {
        this.emitFile({ type: "asset", fileName: `${dir}/${name}`, source: await read(name) });
      }
    },
  };
}

const PYODIDE_FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

const PYODIDE_TYPES: Record<string, string> = {
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".zip": "application/zip",
  ".json": "application/json",
};
