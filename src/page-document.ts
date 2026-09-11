import { ATTRIBUTIONS_PATH, canonicalUrl, CATEGORIES, documentFileName, escapeHtml, headMeta, HOME_PATH, isUtilityPath, PAGE_META, pageMeta, type PagePath, SITE_NAME, SITE_ORIGIN, type UtilityPath, utilityPaths } from "./page-meta.ts";

export interface PageContent {
  related: UtilityPath[];
  howItWorks: Block[];
  examples: Titled[];
  problems: Titled[];
  faq: Question[];
  references: Reference[];
}

export type Block = string | { code: string } | { list: string[] } | { table: string[][] };

export interface Titled {
  title: string;
  blocks: Block[];
}

export interface Question {
  question: string;
  answer: string;
}

export interface Reference {
  title: string;
  url: string;
}

export type PageContents = Partial<Record<UtilityPath, PageContent>>;

export const SECTION_TITLES = {
  howItWorks: "How it works",
  examples: "Examples",
  problems: "Common problems",
  faq: "Frequently asked questions",
  related: "Related tools",
  references: "References",
} as const;

export function articleHtml(path: UtilityPath, content: PageContent): string {
  return [
    `<p class="page-lede">${escapeHtml(pageMeta(path).description)}</p>`,
    section(SECTION_TITLES.howItWorks, content.howItWorks.map(blockHtml)),
    section(SECTION_TITLES.examples, content.examples.map(titledHtml)),
    section(SECTION_TITLES.problems, content.problems.map(titledHtml)),
    section(SECTION_TITLES.faq, content.faq.map(questionHtml)),
    section(SECTION_TITLES.related, [listHtml(content.related.map(relatedHtml))]),
    section(SECTION_TITLES.references, [listHtml(content.references.map(referenceHtml))]),
  ].join("\n");
}

function section(title: string, parts: string[]): string {
  return ["<section>", `<h2>${escapeHtml(title)}</h2>`, ...parts, "</section>"].join("\n");
}

function titledHtml({ title, blocks }: Titled): string {
  return [`<h3>${inlineHtml(title)}</h3>`, ...blocks.map(blockHtml)].join("\n");
}

function questionHtml({ question, answer }: Question): string {
  return `<h3>${inlineHtml(question)}</h3>\n<p>${inlineHtml(answer)}</p>`;
}

function relatedHtml(path: UtilityPath): string {
  return `<a href="${path}">${escapeHtml(pageMeta(path).title)}</a>`;
}

function referenceHtml({ title, url }: Reference): string {
  return linkHtml(url, escapeHtml(title));
}

function blockHtml(block: Block): string {
  if (typeof block === "string") return `<p>${inlineHtml(block)}</p>`;
  if ("code" in block) return `<pre><code>${escapeHtml(block.code)}</code></pre>`;
  if ("list" in block) return listHtml(block.list.map(inlineHtml));

  const [head, ...rows] = block.table;
  const cells = (row: string[], tag: string) => row.map((cell) => `<${tag}>${inlineHtml(cell)}</${tag}>`).join("");
  return [
    "<div class=\"page-table\"><table>",
    `<thead><tr>${cells(head, "th")}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody>`,
    "</table></div>",
  ].join("\n");
}

function listHtml(items: string[]): string {
  return ["<ul>", ...items.map((item) => `<li>${item}</li>`), "</ul>"].join("\n");
}

const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function inlineHtml(text: string): string {
  let html = "";
  let from = 0;
  for (const match of text.matchAll(INLINE)) {
    html += escapeHtml(text.slice(from, match.index));
    html += match[1] !== undefined ? `<code>${escapeHtml(match[1])}</code>` : linkHtml(match[3], escapeHtml(match[2]));
    from = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(from));
}

export function plainText(text: string): string {
  return text.replace(INLINE, (_, code: string | undefined, label: string) => code ?? label);
}

function linkHtml(href: string, html: string): string {
  return href.startsWith("/")
    ? `<a href="${escapeHtml(href)}">${html}</a>`
    : `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${html}</a>`;
}

export interface Crumb {
  label: string;
  path: PagePath;
}

export function crumbs(path: PagePath): Crumb[] {
  return path === HOME_PATH ? [] : [{ label: SITE_NAME, path: HOME_PATH }, { label: pageMeta(path).label, path }];
}

export function structuredData(path: string, content?: PageContent): StructuredData | undefined {
  if (path === HOME_PATH) return graph([websiteData(), ORGANIZATION, itemListData()]);
  if (isUtilityPath(path)) {
    const nodes = [utilityData(path), breadcrumbData(path)];
    if (content && content.faq.length > 0) nodes.push(faqData(path, content.faq));
    return graph(nodes);
  }
  if (path === ATTRIBUTIONS_PATH) return graph([breadcrumbData(path)]);
  return undefined;
}

function graph(nodes: Record<string, unknown>[]): StructuredData {
  return { "@context": "https://schema.org", "@graph": nodes };
}

const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;

const ORGANIZATION = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "Manualpilot",
  url: "https://manualpilot.com",
  sameAs: ["https://github.com/manualpilot"],
};

function websiteData(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: canonicalUrl(HOME_PATH),
    description: pageMeta(HOME_PATH).description,
    inLanguage: "en",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

function itemListData(): Record<string, unknown> {
  return {
    "@type": "ItemList",
    name: `${SITE_NAME} utilities`,
    numberOfItems: utilityPaths().length,
    itemListElement: utilityPaths().map((utility, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: utilityData(utility),
    })),
  };
}

function utilityData(path: UtilityPath): Record<string, unknown> {
  const meta = pageMeta(path);

  return {
    "@type": "WebApplication",
    name: meta.title,
    description: meta.description,
    url: canonicalUrl(path),
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isPartOf: { "@id": WEBSITE_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

function breadcrumbData(path: PagePath): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs(path).map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: canonicalUrl(crumb.path),
    })),
  };
}

function faqData(path: UtilityPath, faq: Question[]): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    url: canonicalUrl(path),
    mainEntity: faq.map(({ question, answer }) => ({
      "@type": "Question",
      name: plainText(question),
      acceptedAnswer: { "@type": "Answer", text: plainText(answer) },
    })),
  };
}

export interface StructuredData {
  "@context": string;
  "@graph": Record<string, unknown>[];
}

function jsonLdHtml(data: StructuredData): string {
  const json = JSON.stringify(data).replace(
    /[<>&]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return `<script type="application/ld+json">${json}</script>`;
}

export function headHtml(path: string, content?: PageContent): string {
  const { title, canonical, metas } = headMeta(path);
  const data = structuredData(path, content);

  return [
    `<title>${escapeHtml(title)}</title>`,
    ...metas.map(({ attribute, key, content }) => `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`),
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    ...(data ? [jsonLdHtml(data)] : []),
  ].join("\n  ");
}

export function withHead(html: string, path: string, content?: PageContent): string {
  return html.replace(HEAD_BLOCK, () => `${HEAD_OPEN}\n  ${headHtml(path, content)}\n  ${HEAD_CLOSE}`);
}

const HEAD_OPEN = "<!--page-head-->";
const HEAD_CLOSE = "<!--/page-head-->";

const HEAD_BLOCK = /<!--page-head-->(?:[\s\S]*?<!--\/page-head-->)?/;

export function bodyHtml(path: string, content?: PageContent): string {
  const meta = pageMeta(path);
  const known = path in PAGE_META;
  const home = path === HOME_PATH;
  const article = isUtilityPath(path) && content;

  return [
    "<div class=\"page-fallback\">",
    ...(known && !home ? [crumbsHtml(path as PagePath)] : []),
    "<main>",
    `<h1>${escapeHtml(meta.title)}</h1>`,
    ...(article
      ? [NOSCRIPT, "<article class=\"page-article\">", articleHtml(path, content), "</article>"]
      : [`<p class="page-lede">${escapeHtml(meta.description)}</p>`]),
    ...(home ? [directoryHtml()] : []),
    "</main>",
    footerHtml(!home),
    "</div>",
  ].join("\n");
}

const NOSCRIPT =
  "<noscript><p>The tool on this page runs in your browser and needs JavaScript to do it; the explanation "
  + "below does not.</p></noscript>";

function crumbsHtml(path: PagePath): string {
  const trail = crumbs(path).map((crumb, index, all) =>
    index === all.length - 1
      ? `<li><span aria-current="page">${escapeHtml(crumb.label)}</span></li>`
      : `<li><a href="${crumb.path}">${escapeHtml(crumb.label)}</a></li>`
  );
  return ["<nav class=\"page-crumbs\" aria-label=\"Breadcrumb\">", "<ol>", ...trail, "</ol>", "</nav>"].join("\n");
}

function directoryHtml(): string {
  return categoriesHtml("page-directory", (path) => {
    const meta = pageMeta(path);
    return `<a href="${path}"><strong>${escapeHtml(meta.label)}</strong> <span>${
      escapeHtml(meta.description)
    }</span></a>`;
  });
}

function footerHtml(directory: boolean): string {
  return [
    "<footer class=\"page-footer\">",
    ...(directory
      ? [categoriesHtml("page-footer-directory", (path) => `<a href="${path}">${escapeHtml(pageMeta(path).label)}</a>`)]
      : []),
    "<p>",
    "© <a href=\"https://manualpilot.com\" rel=\"noopener noreferrer\">Manualpilot</a> ·",
    `<a href="${ATTRIBUTIONS_PATH}">Attributions</a> ·`,
    "<a href=\"https://github.com/manualpilot/utils.plus\" rel=\"noopener noreferrer\">manualpilot/utils.plus</a>",
    "</p>",
    "</footer>",
  ].join("\n");
}

function categoriesHtml(className: string, item: (path: UtilityPath) => string): string {
  const groups = CATEGORIES.map(({ name, paths }) =>
    ["<section>", `<h2>${escapeHtml(name)}</h2>`, listHtml(paths.map(item)), "</section>"].join("\n")
  );
  return [`<nav class="${className}" aria-label="Utilities">`, ...groups, "</nav>"].join("\n");
}

export function withBody(html: string, path: string, content?: PageContent): string {
  return html.replace(BODY_BLOCK, () => `${BODY_OPEN}${bodyHtml(path, content)}${BODY_CLOSE}`);
}

const BODY_OPEN = "<!--page-body-->";
const BODY_CLOSE = "<!--/page-body-->";

const BODY_BLOCK = /<!--page-body-->(?:[\s\S]*?<!--\/page-body-->)?/;

export function pageDocuments(index: string, contents: PageContents): Record<string, string> {
  const paths = (Object.keys(PAGE_META) as PagePath[]).filter((path) => path !== HOME_PATH);
  const documents: Record<string, string> = {};

  for (const path of paths) {
    const content = isUtilityPath(path) ? contents[path] : undefined;
    documents[documentFileName(path)] = withBody(withHead(index, path, content), path, content);
  }

  return documents;
}
