import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const OUTPUT = join(import.meta.dirname, "../src/images/og-image.png");
const WIDTH = 1200;
const HEIGHT = 630;

const require = createRequire(import.meta.url);
const fonts = join(dirname(require.resolve("@fontsource-variable/roboto/package.json")), "files");
const roboto = readFileSync(join(fonts, "roboto-latin-wght-normal.woff2")).toString("base64");

const MARK = [
  "M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-2",
  "M12 20h-6a3 3 0 0 1 -3 -3v-2a3 3 0 0 1 3 -3h10.5",
  "M16 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  "M18 14.5v1.5",
  "M18 20v1.5",
  "M21.032 16.25l-1.299 .75",
  "M16.27 19l-1.3 .75",
  "M14.97 16.25l1.3 .75",
  "M19.733 19l1.3 .75",
  "M7 8v.01",
  "M7 16v.01",
];

const TOOLS = ["JSON", "JWT", "Cron", "Regex", "Diff", "Hasher", "Keygen", "Base64", "UUID", "SQL", "X.509", "curl"];

const html = `<!DOCTYPE html>
<html><head><style>
@font-face { font-family: Roboto; src: url(data:font/woff2;base64,${roboto}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { width: ${WIDTH}px; height: ${HEIGHT}px; background: #121212; color: #E0E0E0; font-family: Roboto, sans-serif;
  display: flex; flex-direction: column; justify-content: center; padding: 0 96px; gap: 36px; }
.brand { display: flex; align-items: center; gap: 28px; }
.brand svg { width: 112px; height: 112px; }
.name { font-size: 104px; font-weight: 700; letter-spacing: -2px; color: #FAFAFA; }
.tagline { font-size: 48px; font-weight: 500; line-height: 1.2; }
.promise { font-size: 28px; color: #9E9E9E; }
.tools { display: flex; flex-wrap: wrap; gap: 12px; }
.tools span { font-size: 24px; padding: 8px 18px; border: 2px solid #2C2C2C; border-radius: 999px; color: #BDBDBD; }
.site { position: absolute; right: 96px; bottom: 56px; font-size: 28px; font-weight: 600; color: #FF7043; }
</style></head><body>
<div class="brand">
  <svg viewBox="0 0 24 24" fill="none" stroke="#FF7043" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    ${MARK.map((d) => `<path d="${d}"/>`).join("")}
  </svg>
  <div class="name">utils+</div>
</div>
<div class="tagline">Developer tools that run in your browser</div>
<div class="promise">No server-side processing · no third-party requests · no tracking</div>
<div class="tools">${TOOLS.map((tool) => `<span>${tool}</span>`).join("")}</div>
<div class="site">utils.plus</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUTPUT, type: "png" });
  console.log(`wrote ${OUTPUT}`);
} finally {
  await browser.close();
}
