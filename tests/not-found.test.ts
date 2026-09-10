import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { documentTitle, pageMeta } from "../src/page-meta";

const SOURCE = join(import.meta.dirname, "../src/404.html");
const DOCUMENT = new DOMParser().parseFromString(readFileSync(SOURCE, "utf8"), "text/html");

const NOT_FOUND = pageMeta("/no-such-page");

describe("404.html", () => {
  it("runs no script", () => {
    expect(DOCUMENT.querySelectorAll("script")).toHaveLength(0);
    const handlers = [...DOCUMENT.querySelectorAll("*")].flatMap((element) => element.getAttributeNames());
    expect(handlers.filter((name) => name.startsWith("on"))).toEqual([]);
  });

  it("loads the picture and the icon and nothing else", () => {
    const loads = [...DOCUMENT.querySelectorAll("[src], link[href]")].map((element) =>
      element.getAttribute("src") ?? element.getAttribute("href") ?? ""
    );

    expect(loads.sort()).toEqual(["./images/favicon.svg", "./images/not-found.png"]);
    for (const url of loads) expect(existsSync(join(dirname(SOURCE), url))).toBe(true);
  });

  it("says what the router says of a missing page", () => {
    expect(DOCUMENT.title).toBe(documentTitle(NOT_FOUND));
    expect(DOCUMENT.querySelector("main p")?.textContent).toBe(NOT_FOUND.description);
  });

  it("is one heading and a way home", () => {
    const headings = DOCUMENT.querySelectorAll("h1");
    expect(headings).toHaveLength(1);
    expect(headings[0]?.querySelector("img")?.getAttribute("alt")).toContain(NOT_FOUND.title);
    expect(DOCUMENT.querySelector("a[href='/']")).not.toBeNull();
  });

  it("is kept out of the index", () => {
    expect(DOCUMENT.querySelector("meta[name='robots']")?.getAttribute("content")).toBe("noindex");
    expect(DOCUMENT.querySelector("link[rel='canonical']")).toBeNull();
  });

  it("carries the Dark Reader lock", () => {
    expect(DOCUMENT.querySelector("meta[name='darkreader-lock']")).not.toBeNull();
  });
});
