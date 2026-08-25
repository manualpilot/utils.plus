import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { applyDocumentHead } from "../src/common/document-head";
import { canonicalUrl, documentFileName, documentTitle, headHtml, HOME_PATH, indexablePaths, PAGE_META, pageDocuments, pageMeta, type PagePath, robotsTxt, SITE_ORIGIN, sitemapXml, structuredData, utilityPaths, withHead } from "../src/page-meta";
import { utilities } from "../src/utility-registry";

const DESCRIPTION_RANGE = { min: 80, max: 170 };
const TITLE_MAX = 60;

const PAGES = (Object.keys(PAGE_META) as PagePath[]).map((path) => ({ path, meta: PAGE_META[path] }));

const INDEX_HTML = readFileSync(join(import.meta.dirname, "../src/index.html"), "utf8");

describe("page metadata", () => {
  it.each(PAGES)("$path says what the page is for", ({ meta }) => {
    expect(meta.description.length).toBeGreaterThanOrEqual(DESCRIPTION_RANGE.min);
    expect(meta.description.length).toBeLessThanOrEqual(DESCRIPTION_RANGE.max);
  });

  it.each(PAGES)("$path has a title that fits a result", ({ meta }) => {
    expect(documentTitle(meta).length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it.each(utilities)("$path carries keywords", ({ keywords }) => {
    expect(keywords.length).toBeGreaterThanOrEqual(5);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("gives every page its own title and description", () => {
    expect(new Set(PAGES.map((page) => page.meta.title)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((page) => page.meta.description)).size).toBe(PAGES.length);
  });

  it("has no metadata for a page the router does not have", () => {
    const routed = new Set<string>([HOME_PATH, "/attributions", ...utilities.map((utility) => utility.path)]);
    for (const { path } of PAGES) expect(routed).toContain(path);
  });

  it("carries the metadata through onto the registry entry", () => {
    for (const utility of utilities) expect(utility.description).toBe(PAGE_META[utility.path].description);
  });
});

describe("pageMeta", () => {
  it("answers for every page the router has", () => {
    for (const { path, meta } of PAGES) expect(pageMeta(path)).toBe(meta);
  });

  it("keeps an address with no page out of the index", () => {
    expect(pageMeta("/nothing-here").noindex).toBe(true);
    expect(pageMeta("/codec").noindex).toBeUndefined();
  });
});

describe("applyDocumentHead", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("writes the page's own head", () => {
    applyDocumentHead("/keygen");
    const keygen = PAGE_META["/keygen"];

    expect(document.title).toBe(documentTitle(keygen));
    expect(content("meta[name=\"description\"]")).toBe(keygen.description);
    expect(content("meta[name=\"keywords\"]")).toBe(keygen.keywords.join(", "));
    expect(content("meta[property=\"og:title\"]")).toBe(document.title);
    expect(content("meta[property=\"og:url\"]")).toBe(`${SITE_ORIGIN}/keygen`);
    expect(document.head.querySelector("link[rel=\"canonical\"]")?.getAttribute("href"))
      .toBe(`${SITE_ORIGIN}/keygen`);
  });

  it("rewrites the tags in place on the next page", () => {
    applyDocumentHead("/keygen");
    applyDocumentHead("/time");

    expect(document.head.querySelectorAll("meta[name=\"description\"]")).toHaveLength(1);
    expect(document.head.querySelectorAll("link[rel=\"canonical\"]")).toHaveLength(1);
    expect(content("meta[name=\"description\"]")).toBe(PAGE_META["/time"].description);
  });

  it("writes the graph on the welcome page and takes it off the next one", () => {
    applyDocumentHead(HOME_PATH);
    const script = document.head.querySelector("script[type=\"application/ld+json\"]");

    expect(JSON.parse(script!.textContent!)).toEqual(structuredData(HOME_PATH));

    applyDocumentHead("/keygen");
    expect(document.head.querySelector("script[type=\"application/ld+json\"]")).toBeNull();
  });

  it("says so when the address has no page", () => {
    applyDocumentHead("/nothing-here");

    expect(content("meta[name=\"robots\"]")).toBe("noindex, follow");
  });
});

describe("structuredData", () => {
  const graph = structuredData(HOME_PATH)!["@graph"];
  const list = graph.find((node) => node["@type"] === "ItemList")!;
  const items = list.itemListElement as { position: number; item: Record<string, string> }[];

  it("names every utility and nothing that is not one", () => {
    expect(items).toHaveLength(utilityPaths().length);
    expect(items.map((entry) => entry.item.url)).toEqual(utilities.map((utility) => canonicalUrl(utility.path)));
    expect(list.numberOfItems).toBe(utilities.length);
  });

  it("gives each entry the words of the page it points at", () => {
    for (const { position, item } of items) {
      const meta = PAGE_META[utilityPaths()[position - 1]];

      expect(item.name).toBe(meta.title);
      expect(item.description).toBe(meta.description);
    }
  });

  it("ties every entry to the site the welcome page describes", () => {
    const site = graph.find((node) => node["@type"] === "WebSite")!;

    expect(site["@id"]).toBe(`${SITE_ORIGIN}/#website`);
    for (const { item } of items) expect(item.isPartOf).toEqual({ "@id": site["@id"] });
  });

  it("is the welcome page's alone", () => {
    for (const path of indexablePaths()) {
      if (path !== HOME_PATH) expect(structuredData(path)).toBeUndefined();
    }
  });
});

describe("headHtml", () => {
  it("writes the same reading the browser applies", () => {
    const html = headHtml("/python");

    expect(html).toContain(`<title>${documentTitle(PAGE_META["/python"])}</title>`);
    expect(html).toContain(`content="${PAGE_META["/python"].description}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/python" />`);
  });

  it("escapes what the browser would otherwise read as markup", () => {
    expect(headHtml("/codec")).toContain("<title>Base64, Base32, Hex, Gzip, Morse &amp; ROT13 Codec · utils+</title>");
    for (const path of indexablePaths()) {
      expect(headHtml(path)).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
    }
  });

  it("leaves the graph to the script the document loads", () => {
    for (const path of indexablePaths()) expect(headHtml(path)).not.toContain("application/ld+json");
  });

  it("is what index.html leaves room for", () => {
    expect(INDEX_HTML).toContain("<!--page-head-->");
    expect(INDEX_HTML).not.toContain("<title>");
  });

  it("is loaded beside the script that writes the graph", () => {
    expect(INDEX_HTML).toContain("<script type=\"module\" vite-ignore src=\"/utils-metadata.ts\"></script>");
    expect(withHead(INDEX_HTML, "/keygen")).toContain("src=\"/utils-metadata.ts\"");
  });
});

describe("pageDocuments", () => {
  const INDEX = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <!--page-head-->\n</head>\n"
    + "<body><div id=\"root\"></div><script type=\"module\" src=\"/assets/index-abc123.js\"></script></body>\n</html>\n";

  const documents = pageDocuments(withHead(INDEX, HOME_PATH));

  it("writes one beside index.html for every page but the welcome one", () => {
    const expected = (Object.keys(PAGE_META) as PagePath[]).filter((path) => path !== HOME_PATH);

    expect(Object.keys(documents).sort()).toEqual(expected.map(documentFileName).sort());
  });

  it("names each one the directory index of the address it is for", () => {
    expect(documentFileName(HOME_PATH)).toBe("index.html");
    expect(documentFileName("/codec")).toBe("codec/index.html");
    expect(documentFileName("/unique-id")).toBe("unique-id/index.html");
  });

  it("gives each the head of the page it is for, and the script the build named", () => {
    for (const path of (Object.keys(PAGE_META) as PagePath[]).filter((page) => page !== HOME_PATH)) {
      const html = documents[documentFileName(path)];

      expect(html).toContain(`<title>${escaped(documentTitle(PAGE_META[path]))}</title>`);
      expect(html).toContain(`<link rel="canonical" href="${canonicalUrl(path)}" />`);
      expect(html).toContain("/assets/index-abc123.js");
    }
  });

  it("leaves one head on the page rather than the two a copy would have", () => {
    for (const html of Object.values(documents)) {
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html).not.toContain(PAGE_META[HOME_PATH].description);
    }
  });

  it("leaves the list of utilities to the script the document loads", () => {
    expect(withHead(INDEX, HOME_PATH)).not.toContain("application/ld+json");
    for (const html of Object.values(documents)) expect(html).not.toContain("application/ld+json");
  });
});

function escaped(value: string): string {
  return value.replace(/&/g, "&amp;");
}

describe("sitemapXml", () => {
  const xml = sitemapXml();

  it("lists every page worth crawling, absolutely", () => {
    for (const path of indexablePaths()) expect(xml).toContain(`<loc>${canonicalUrl(path)}</loc>`);
    expect(xml.match(/<loc>/g)).toHaveLength(indexablePaths().length);
  });

  it("opens on the welcome page", () => {
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
  });
});

describe("robotsTxt", () => {
  it("names the sitemap and holds nothing back", () => {
    expect(robotsTxt()).toContain("User-agent: *");
    expect(robotsTxt()).toContain("Allow: /");
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
    expect(robotsTxt()).not.toContain("Disallow");
  });
});

function content(selector: string) {
  return document.head.querySelector(selector)?.getAttribute("content");
}
