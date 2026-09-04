import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import type { Plugin, Rolldown } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vitest/config";
import { documentFileName, HOME_PATH, PAGE_META, pageDocuments, type PagePath, robotsTxt, sitemapXml, withBody, withHead } from "./src/page-meta.ts";

const METADATA_NAME = "utils-metadata";
const METADATA_SRC = `/${METADATA_NAME}.ts`;

const BUILT_AT = new Date();

const ASSET_DIR = `assets/${Math.floor(BUILT_AT.getTime() / 1000)}`;

export default defineConfig({
  root: "src",
  publicDir: false,
  css: { postcss: join(import.meta.dirname, "conf") },
  define: { __BUILD_TIME__: JSON.stringify(BUILT_AT.toISOString()), __ASSET_DIR__: JSON.stringify(`/${ASSET_DIR}`) },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsDir: ASSET_DIR,
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
        [METADATA_NAME]: join(import.meta.dirname, `src/${METADATA_NAME}.ts`),
      },
      output: { chunkFileNames, assetFileNames },
    },
  },
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
    setupFiles: "./conf/vitest.setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },

  resolve: {
    tsconfigPaths: true,
    alias: {
      "stream/promises": "stream-browserify",
    },
  },

  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "@electric-sql/pglite"],
  },
});

function chunkFileNames(chunk: Rolldown.PreRenderedChunk): string {
  const name = (DIRECTORY_NAMES.has(chunk.name) ? packageOf(chunk) : undefined) ?? chunk.name;
  return `${ASSET_DIR}/${scopedName(name, chunk)}-[hash].js`;
}

function scopedName(name: string, chunk: Rolldown.PreRenderedChunk): string {
  const editor = CODEMIRROR.exec(name);
  if (editor) return `codemirror/${editor[1] ?? "codemirror"}`;
  const icon = ICON.exec(name);
  if (icon) return `icons/${icon[1]}`;
  if (allFrom(chunk, "@mantine/")) return `mantine/${name}`;
  if (allFrom(chunk, "pdfmake/")) return `pdfmake/${name}`;
  return name;
}

const CODEMIRROR = /^codemirror(?:[-_](.+))?$/;

const ICON = /^Icon(.+)$/;

function allFrom(chunk: Rolldown.PreRenderedChunk, path: string): boolean {
  return chunk.moduleIds.length > 0 && chunk.moduleIds.every((id) => id.includes(`/node_modules/${path}`));
}

function assetFileNames(asset: Rolldown.PreRenderedAsset): string {
  return `${assetDirectory(asset)}/[name]-[hash][extname]`;
}

function assetDirectory(asset: Rolldown.PreRenderedAsset): string {
  if (FONT.test(asset.names[0] ?? "")) return `${ASSET_DIR}/fonts`;
  const original = asset.originalFileNames[0] ?? "";
  if (PHONE_GEO.test(original)) return `${ASSET_DIR}/phone-geo`;
  if (UNICODE_NAME.test(original)) return `${ASSET_DIR}/unicode-names`;
  if (IP_DELEGATION.test(original)) return `${ASSET_DIR}/ip-registry`;
  if (IP_ROA.test(original)) return `${ASSET_DIR}/ip-roas`;
  if (LICENCE.test(original)) return `${ASSET_DIR}/license`;
  return COUNTRY_VIEW.test(original) ? `${ASSET_DIR}/country-views` : ASSET_DIR;
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
  const files: Record<string, () => string> = { "/sitemap.xml": sitemapXml, "/robots.txt": robotsTxt };

  return {
    name: "page-meta-files",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => withBody(withHead(html, HOME_PATH), HOME_PATH),
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

        const metadata = Object.values(bundle).find((file) => file.type === "chunk" && file.name === METADATA_NAME);
        if (!metadata) throw new Error(`page-meta-files: ${METADATA_NAME} is not in the bundle`);

        const template = index.source.toString();
        if (!template.includes(METADATA_SRC)) {
          throw new Error(`page-meta-files: index.html does not load ${METADATA_SRC}`);
        }

        const welcome = template.replace(METADATA_SRC, `/${metadata.fileName}`);
        index.source = welcome;

        for (const [fileName, source] of Object.entries(pageDocuments(welcome))) {
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
  const dir = `${ASSET_DIR}/pyodide/${require("pyodide/package.json").version}`;
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
