import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { applyDocumentHead } from "../src/common/document-head";
import { articleHtml, bodyHtml, crumbs, headHtml, type PageContent, type PageContents, pageDocuments, structuredData, withBody, withHead } from "../src/page-document";
import { ATTRIBUTIONS_PATH, canonicalUrl, CATEGORIES, documentFileName, documentTitle, HOME_PATH, indexablePaths, OG_IMAGE, PAGE_META, pageMeta, type PagePath, robotsTxt, SITE_ORIGIN, sitemapXml, type UtilityPath, utilityPaths } from "../src/page-meta";
import { utilities } from "../src/utility-registry";

const DESCRIPTION_RANGE = { min: 80, max: 170 };
const TITLE_MAX = 60;

const PAGES = (Object.keys(PAGE_META) as PagePath[]).map((path) => ({ path, meta: PAGE_META[path] }));

const INDEX_HTML = readFileSync(join(import.meta.dirname, "../src/index.html"), "utf8");

const CONTENTS: PageContents = Object.fromEntries(
  Object.entries(import.meta.glob<PageContent>("../src/page-content/*.ts", { import: "default", eager: true }))
    .map(([file, content]) => [`/${file.split("/").at(-1)!.replace(/\.ts$/, "")}`, content]),
);

const CONTENT: PageContent = {
  related: ["/time", "/hasher", "/codec"],
  howItWorks: ["Reads `a < b` & [the codec](/codec).", { code: "$& $1 </script>" }],
  examples: [{ title: "One", blocks: ["An example."] }],
  problems: [{ title: "Two", blocks: [{ list: ["a", "b"] }, { table: [["h"], ["c"]] }] }],
  faq: [
    { question: "Does `x` & y work?", answer: "Yes, see [the hasher](/hasher) and `a < b`." },
    { question: "Why?", answer: "Because." },
  ],
  references: [{ title: "RFC 1", url: "https://www.rfc-editor.org/rfc/rfc1" }],
};

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

  it("gives every page its own title, description and label", () => {
    expect(new Set(PAGES.map((page) => page.meta.title)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((page) => page.meta.description)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((page) => page.meta.label)).size).toBe(PAGES.length);
  });

  it("has no metadata for a page the router does not have", () => {
    const routed = new Set<string>([HOME_PATH, ATTRIBUTIONS_PATH, ...utilities.map((utility) => utility.path)]);
    for (const { path } of PAGES) expect(routed).toContain(path);
  });

  it("carries the metadata through onto the registry entry", () => {
    for (const utility of utilities) {
      expect(utility.description).toBe(PAGE_META[utility.path].description);
      expect(utility.label).toBe(PAGE_META[utility.path].label);
    }
  });

  it("puts every utility in exactly one group", () => {
    const grouped = CATEGORIES.flatMap((category) => category.paths);
    expect([...grouped].sort()).toEqual([...utilityPaths()].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
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
    expect(content("meta[property=\"og:title\"]")).toBe(document.title);
    expect(content("meta[property=\"og:url\"]")).toBe(`${SITE_ORIGIN}/keygen`);
    expect(document.head.querySelector("link[rel=\"canonical\"]")?.getAttribute("href"))
      .toBe(`${SITE_ORIGIN}/keygen`);
  });

  it("writes no keywords", () => {
    applyDocumentHead("/keygen");
    expect(document.head.querySelector("meta[name=\"keywords\"]")).toBeNull();
  });

  it("names a picture large enough for a card", () => {
    applyDocumentHead("/keygen");

    expect(content("meta[property=\"og:image\"]")).toBe(`${SITE_ORIGIN}${OG_IMAGE.path}`);
    expect(content("meta[property=\"og:image:width\"]")).toBe("1200");
    expect(content("meta[property=\"og:image:height\"]")).toBe("630");
    expect(content("meta[name=\"twitter:card\"]")).toBe("summary_large_image");
    expect(content("meta[name=\"twitter:image\"]")).toBe(`${SITE_ORIGIN}${OG_IMAGE.path}`);
  });

  it("rewrites the tags in place on the next page", () => {
    applyDocumentHead("/keygen");
    applyDocumentHead("/time");

    expect(document.head.querySelectorAll("meta[name=\"description\"]")).toHaveLength(1);
    expect(document.head.querySelectorAll("link[rel=\"canonical\"]")).toHaveLength(1);
    expect(content("meta[name=\"description\"]")).toBe(PAGE_META["/time"].description);
  });

  it("replaces the graph as the router moves and takes it off a page with none", () => {
    applyDocumentHead(HOME_PATH);
    expect(graphs()).toEqual([structuredData(HOME_PATH)]);

    applyDocumentHead("/keygen", CONTENT);
    expect(graphs()).toEqual([structuredData("/keygen", CONTENT)]);

    applyDocumentHead("/nothing-here");
    expect(graphs()).toEqual([]);
  });

  it("says so when the address has no page", () => {
    applyDocumentHead("/nothing-here");

    expect(content("meta[name=\"robots\"]")).toBe("noindex, follow");
  });
});

describe("structuredData", () => {
  describe("on the welcome page", () => {
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

    it("says what the site is and who publishes it", () => {
      const site = graph.find((node) => node["@type"] === "WebSite")!;
      const organization = graph.find((node) => node["@type"] === "Organization")!;

      expect(site["@id"]).toBe(`${SITE_ORIGIN}/#website`);
      expect(site.publisher).toEqual({ "@id": organization["@id"] });
      for (const { item } of items) expect(item.isPartOf).toEqual({ "@id": site["@id"] });
    });
  });

  describe("on a utility's page", () => {
    const graph = structuredData("/jwt", CONTENT)!["@graph"];
    const node = (type: string) => graph.find((entry) => entry["@type"] === type)!;

    it("says what the utility is, off the words its head is written from", () => {
      const application = node("WebApplication");

      expect(application.name).toBe(PAGE_META["/jwt"].title);
      expect(application.url).toBe(canonicalUrl("/jwt"));
      expect(application.applicationCategory).toBe("DeveloperApplication");
      expect(application.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD" });
    });

    it("names the trail the page draws", () => {
      const trail = node("BreadcrumbList").itemListElement as { position: number; name: string; item: string }[];

      expect(trail.map(({ name }) => name)).toEqual(crumbs("/jwt").map(({ label }) => label));
      expect(trail.map(({ item }) => item)).toEqual([canonicalUrl(HOME_PATH), canonicalUrl("/jwt")]);
      expect(trail.map(({ position }) => position)).toEqual([1, 2]);
    });

    it("asks the questions the article answers, word for word as they are drawn", () => {
      const faq = node("FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[];
      const drawn = document.createElement("div");
      drawn.innerHTML = articleHtml("/jwt", CONTENT);
      const section = [...drawn.querySelectorAll("section")].find((s) =>
        s.querySelector("h2")?.textContent?.includes("questions")
      )!;
      const questions = [...section.querySelectorAll("h3")];

      expect(faq.map(({ name }) => name)).toEqual(questions.map((h3) => h3.textContent));
      expect(faq.map(({ acceptedAnswer }) => acceptedAnswer.text))
        .toEqual(questions.map((h3) => h3.nextElementSibling!.textContent));
    });

    it("asks nothing when there is no article to answer it", () => {
      expect(structuredData("/jwt")!["@graph"].map((entry) => entry["@type"])).toEqual([
        "WebApplication",
        "BreadcrumbList",
      ]);
    });
  });

  it("gives attributions its trail and an address with no page nothing", () => {
    expect(structuredData(ATTRIBUTIONS_PATH)!["@graph"].map((entry) => entry["@type"])).toEqual(["BreadcrumbList"]);
    expect(structuredData("/nothing-here")).toBeUndefined();
  });
});

describe("headHtml", () => {
  it("writes the same reading the browser applies", () => {
    const html = headHtml("/python");

    expect(html).toContain(`<title>${documentTitle(PAGE_META["/python"])}</title>`);
    expect(html).toContain(`content="${PAGE_META["/python"].description}"`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/python" />`);
    expect(html).not.toContain("name=\"keywords\"");
  });

  it("escapes what the browser would otherwise read as markup", () => {
    expect(headHtml("/codec")).toContain("<title>Base64, Base32, Hex, Gzip, Morse &amp; ROT13 Codec · utils+</title>");
    for (const path of indexablePaths()) {
      const html = headHtml(path, CONTENTS[path as UtilityPath]);
      expect(html).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
      expect(html.match(/<\/script>/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it("writes the page's own graph, which parses back to what it was written from", () => {
    const html = headHtml("/jwt", CONTENT);
    const json = /<script type="application\/ld\+json">(.*)<\/script>/.exec(html)![1];

    expect(json).not.toMatch(/[<>&]/);
    expect(JSON.parse(json)).toEqual(structuredData("/jwt", CONTENT));
  });

  it("is what index.html leaves room for", () => {
    expect(INDEX_HTML).toContain("<!--page-head-->");
    expect(INDEX_HTML).not.toContain("<title>");
  });

  it("writes a head that holds a dollar sign as written", () => {
    const content = { ...CONTENT, faq: [{ question: "What is `$&`?", answer: "The match, in `$&` and `$1`." }] };
    expect(withHead(INDEX_HTML, "/regex", content)).toContain("The match, in $\\u0026 and $1.");
  });

  it("carries the Dark Reader lock into every document written from it", () => {
    expect(INDEX_HTML).toContain("<meta name=\"darkreader-lock\" />");

    const documents = Object.values(pageDocuments(withHead(INDEX_HTML, HOME_PATH), CONTENTS));
    expect(documents.length).toBeGreaterThan(0);
    for (const document of documents) expect(document).toContain("<meta name=\"darkreader-lock\" />");
  });
});

describe("bodyHtml", () => {
  it("says what the page is called and what it does", () => {
    const html = bodyHtml("/python");

    expect(html).toContain(`<h1>${PAGE_META["/python"].title}</h1>`);
    expect(html).toContain(`<p class="page-lede">${PAGE_META["/python"].description}</p>`);
  });

  it("escapes what the browser would otherwise read as markup", () => {
    expect(bodyHtml("/codec")).toContain("<h1>Base64, Base32, Hex, Gzip, Morse &amp; ROT13 Codec</h1>");
    for (const path of indexablePaths()) {
      expect(bodyHtml(path, CONTENTS[path as UtilityPath])).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
    }
    expect(bodyHtml("/jwt", CONTENT)).toContain("<code>a &lt; b</code> &amp; <a href=\"/codec\">the codec</a>");
  });

  it("links every utility from every page, by name", () => {
    for (const path of indexablePaths()) {
      const html = bodyHtml(path, CONTENTS[path as UtilityPath]);
      for (const utility of utilityPaths()) expect(html, `${path} → ${utility}`).toContain(`<a href="${utility}">`);
      expect(html.split("\n").filter((line) => line.includes("<a ")).length).toBeGreaterThanOrEqual(
        utilityPaths().length,
      );
    }
    expect(bodyHtml("/json")).toContain(`<a href="/cron">${PAGE_META["/cron"].label}</a>`);
    expect(bodyHtml(HOME_PATH)).toContain(`<a href="/cron"><strong>${PAGE_META["/cron"].label}</strong>`);
  });

  it("draws the trail on every page but the welcome one", () => {
    expect(bodyHtml(HOME_PATH)).not.toContain("aria-label=\"Breadcrumb\"");
    const html = bodyHtml("/json");
    expect(html).toContain("<li><a href=\"/\">utils+</a></li>");
    expect(html).toContain("<li><span aria-current=\"page\">JSON</span></li>");
  });

  it("writes the article under the headline, related tools and all", () => {
    const html = bodyHtml("/jwt", CONTENT);

    expect(html).toContain(articleHtml("/jwt", CONTENT));
    expect(html).toContain(`<a href="/time">${escaped(PAGE_META["/time"].title)}</a>`);
    expect(html).toContain(
      "<a href=\"https://www.rfc-editor.org/rfc/rfc1\" rel=\"noopener noreferrer\" target=\"_blank\">",
    );
    expect(html.indexOf("<h1>")).toBeLessThan(html.indexOf("<article"));
  });

  it("is what index.html leaves room for", () => {
    expect(INDEX_HTML).toContain("<div id=\"root\"><!--page-body--></div>");
    expect(INDEX_HTML).not.toContain("<h1>");
  });

  it("rewrites the block the last write left rather than adding another", () => {
    const codec = withBody(withBody(INDEX_HTML, HOME_PATH), "/codec");

    expect(codec.match(/<h1>/g)).toHaveLength(1);
    expect(codec).toContain(`<h1>${escaped(PAGE_META["/codec"].title)}</h1>`);
  });
});

describe("pageDocuments", () => {
  const INDEX = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <!--page-head-->\n</head>\n"
    + "<body><div id=\"root\"><!--page-body--></div>"
    + "<script type=\"module\" src=\"/assets/index-abc123.js\"></script></body>\n</html>\n";

  const documents = pageDocuments(withBody(withHead(INDEX, HOME_PATH), HOME_PATH), CONTENTS);
  const others = (Object.keys(PAGE_META) as PagePath[]).filter((page) => page !== HOME_PATH);

  it("writes one beside index.html for every page but the welcome one", () => {
    expect(Object.keys(documents).sort()).toEqual(others.map(documentFileName).sort());
  });

  it("names each one the directory index of the address it is for", () => {
    expect(documentFileName(HOME_PATH)).toBe("index.html");
    expect(documentFileName("/codec")).toBe("codec/index.html");
    expect(documentFileName("/unique-id")).toBe("unique-id/index.html");
  });

  it("gives each the head of the page it is for, and the script the build named", () => {
    for (const path of others) {
      const html = documents[documentFileName(path)];

      expect(html).toContain(`<title>${escaped(documentTitle(PAGE_META[path]))}</title>`);
      expect(html).toContain(`<link rel="canonical" href="${canonicalUrl(path)}" />`);
      expect(html).toContain("/assets/index-abc123.js");
    }
  });

  it("gives each a heading of its own before any script has run", () => {
    for (const path of others) {
      const html = documents[documentFileName(path)];

      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`<h1>${escaped(PAGE_META[path].title)}</h1>`);
    }
  });

  it("leaves one head and one graph on the page rather than the two a copy would have", () => {
    for (const html of Object.values(documents)) {
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
      expect(html).not.toContain(PAGE_META[HOME_PATH].description);
      expect(html).not.toContain("\"@type\":\"ItemList\"");
    }
  });

  it("writes each utility's own article and questions into its document", () => {
    for (const [path, content] of Object.entries(CONTENTS) as [UtilityPath, PageContent][]) {
      const html = documents[documentFileName(path)];

      expect(html).toContain(articleHtml(path, content));
      expect(html).toContain("\"@type\":\"FAQPage\"");
    }
  });
});

function escaped(value: string): string {
  return value.replace(/&/g, "&amp;");
}

describe("sitemapXml", () => {
  it("lists every page worth crawling, absolutely", () => {
    const xml = sitemapXml();
    for (const path of indexablePaths()) expect(xml).toContain(`<loc>${canonicalUrl(path)}</loc>`);
    expect(xml.match(/<loc>/g)).toHaveLength(indexablePaths().length);
  });

  it("opens on the welcome page", () => {
    expect(sitemapXml()).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
  });

  it("dates the pages it was told the dates of and no others", () => {
    const xml = sitemapXml({ "/cron": "2026-09-01T10:00:00+00:00" });

    expect(xml).toContain(`<loc>${canonicalUrl("/cron")}</loc>\n    <lastmod>2026-09-01T10:00:00+00:00</lastmod>`);
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
    expect(sitemapXml()).not.toContain("<lastmod>");
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

function graphs() {
  return [...document.head.querySelectorAll("script[type=\"application/ld+json\"]")].map((tag) =>
    JSON.parse(tag.textContent!)
  );
}
