import { describe, expect, it } from "vitest";
import { articleHtml, type Block, type PageContent, plainText } from "../src/page-document";
import { isUtilityPath, type UtilityPath, utilityPaths } from "../src/page-meta";

const MODULES = import.meta.glob<PageContent>("../src/page-content/*.ts", { import: "default", eager: true });

const CONTENTS = Object.entries(MODULES).map(([file, content]) => ({
  path: `/${file.split("/").at(-1)!.replace(/\.ts$/, "")}` as UtilityPath,
  content,
}));

function proseWords(path: UtilityPath, content: PageContent): number {
  const html = articleHtml(path, { ...content, related: [], references: [] })
    .replace(/<pre>[\s\S]*?<\/pre>/g, " ")
    .replace(/<[^>]+>/g, " ");
  return html.split(/\s+/).filter((word) => /\w/.test(word)).length;
}

function blockTexts(blocks: Block[]): string[] {
  return blocks.flatMap((block) => {
    if (typeof block === "string") return [block];
    if ("list" in block) return block.list;
    if ("table" in block) return block.table.flat();
    return [];
  });
}

function allTexts(content: PageContent): string[] {
  return [
    ...blockTexts(content.howItWorks),
    ...[...content.examples, ...content.problems].flatMap(({ title, blocks }) => [title, ...blockTexts(blocks)]),
    ...content.faq.flatMap(({ question, answer }) => [question, answer]),
  ];
}

describe("page content", () => {
  it("has an article for every utility and none for a page that is not one", () => {
    expect(CONTENTS.map(({ path }) => path).sort()).toEqual([...utilityPaths()].sort());
  });

  it.each(CONTENTS)("$path is long enough to say something and short enough to be read", ({ path, content }) => {
    const words = proseWords(path, content);
    expect(words).toBeGreaterThanOrEqual(300);
    expect(words).toBeLessThanOrEqual(850);
  });

  it.each(CONTENTS)("$path has every section the page is written in", ({ content }) => {
    expect(content.howItWorks.length).toBeGreaterThan(0);
    expect(content.examples.length).toBeGreaterThanOrEqual(2);
    expect(content.examples.length).toBeLessThanOrEqual(3);
    expect(content.problems.length).toBeGreaterThanOrEqual(2);
    expect(content.faq.length).toBeGreaterThanOrEqual(3);
    expect(content.faq.length).toBeLessThanOrEqual(6);
    expect(content.references.length).toBeGreaterThan(0);
  });

  it.each(CONTENTS)("$path links three to five other utilities", ({ path, content }) => {
    expect(content.related.length).toBeGreaterThanOrEqual(3);
    expect(content.related.length).toBeLessThanOrEqual(5);
    expect(new Set(content.related).size).toBe(content.related.length);
    expect(content.related).not.toContain(path);
    for (const related of content.related) expect(isUtilityPath(related)).toBe(true);
  });

  it.each(CONTENTS)(
    "$path links only to pages that exist and to addresses a reader can follow",
    ({ path, content }) => {
      for (const text of allTexts(content)) {
        for (const [, , href] of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
          if (href.startsWith("/")) {
            expect(isUtilityPath(href), href).toBe(true);
            expect(href).not.toBe(path);
          } else {
            expect(href, href).toMatch(/^https:\/\//);
          }
        }
      }
      for (const { url } of content.references) expect(url).toMatch(/^https:\/\//);
      expect(new Set(content.references.map(({ url }) => url)).size).toBe(content.references.length);
    },
  );

  it.each(CONTENTS)("$path writes no markup of its own", ({ content }) => {
    for (const text of allTexts(content)) {
      expect(text, text).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(text.split("`").length % 2, text).toBe(1);
    }
  });

  it.each(CONTENTS)("$path answers each question in a short paragraph", ({ content }) => {
    for (const { question, answer } of content.faq) {
      expect(question.trim().endsWith("?"), question).toBe(true);
      expect(answer).not.toContain("\n");
      expect(plainText(answer).split(/\s+/).length, question).toBeLessThanOrEqual(90);
    }
  });

  it.each(CONTENTS)("$path asks no question twice", ({ content }) => {
    expect(new Set(content.faq.map(({ question }) => question)).size).toBe(content.faq.length);
    expect(new Set(content.problems.map(({ title }) => title)).size).toBe(content.problems.length);
  });
});
