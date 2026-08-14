import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import type { Plugin, Rolldown } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vitest/config";
import { documentFileName, HOME_PATH, PAGE_META, pageDocuments, type PagePath, robotsTxt, sitemapXml, withHead } from "./src/page-meta.ts";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  css: { postcss: import.meta.dirname },
  build: { outDir: "../dist", emptyOutDir: true, rolldownOptions: { output: { chunkFileNames } } },
  plugins: [
    react(),
    nodePolyfills({ include: ["assert", "buffer", "crypto", "stream", "util"] }),
    pyodideAssets(),
    pageMetaFiles(),
  ],
  test: {
    root: import.meta.dirname,
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },

  resolve: {
    tsconfigPaths: true,
  },
});

function chunkFileNames(chunk: Rolldown.PreRenderedChunk): string {
  const name = (DIRECTORY_NAMES.has(chunk.name) ? packageOf(chunk) : undefined) ?? chunk.name;
  const editor = CODEMIRROR.exec(name);
  return editor ? `assets/codemirror/${editor[1] ?? "codemirror"}-[hash].js` : `assets/${name}-[hash].js`;
}

const CODEMIRROR = /^codemirror(?:[-_](.+))?$/;

function packageOf(chunk: Rolldown.PreRenderedChunk): string | undefined {
  const id = chunk.facadeModuleId ?? chunk.moduleIds.at(-1) ?? "";
  const [scope, name] = id.split("/node_modules/").at(-1)?.split("/") ?? [];
  if (!id.includes("/node_modules/") || !scope) return undefined;
  return scope.startsWith("@") && name ? `${scope.slice(1)}-${name}` : scope;
}

const DIRECTORY_NAMES = new Set("browser build cjs core dist esm exports index lib main module src".split(" "));

function pageMetaFiles(): Plugin {
  const files: Record<string, () => string> = { "/sitemap.xml": sitemapXml, "/robots.txt": robotsTxt };

  return {
    name: "page-meta-files",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => withHead(html, HOME_PATH),
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const write = files[req.url?.split("?")[0] ?? ""];
        if (!write) return next();
        res.setHeader("Content-Type", req.url?.startsWith("/sitemap") ? "application/xml" : "text/plain");
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
      handler(_options, bundle) {
        for (const [url, write] of Object.entries(files)) {
          this.emitFile({ type: "asset", fileName: url.slice(1), source: write() });
        }

        const index = bundle["index.html"];
        if (index?.type !== "asset") throw new Error("page-meta-files: index.html is not in the bundle");

        for (const [fileName, source] of Object.entries(pageDocuments(index.source.toString()))) {
          this.emitFile({ type: "asset", fileName, source });
        }
      },
    },
  };
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
