import { describe, expect, it } from "vitest";
import { readPairs, readParts, readUrl } from "../src/utilities/url/parse";
import type { PartKey } from "../src/utilities/url/parts";
import { editPair, newPair, withPairs, withPart, writeUrl } from "../src/utilities/url/write";

function edit(text: string, key: PartKey, value: string): string {
  return writeUrl(withPart(readParts(text), key, value));
}

function editParam(text: string, index: number, patch: { name?: string; value?: string }): string {
  const { parts, pairs } = readUrl(text);
  return writeUrl(withPairs(parts, pairs.map((pair, at) => at === index ? editPair(pair, patch) : pair)));
}

describe("readParts", () => {
  it("takes an address apart", () => {
    expect(readParts("https://example.com:8443/a/b?q=1#top")).toEqual({
      scheme: "https",
      slashes: true,
      username: "",
      password: "",
      host: "example.com",
      port: "8443",
      path: "/a/b",
      query: "q=1",
      fragment: "top",
    });
  });

  it("reads credentials, and splits on the last @ so a password may hold one", () => {
    const parts = readParts("ftp://user:p@ss@files.example.com/pub");
    expect(parts).toMatchObject({ username: "user", password: "p@ss", host: "files.example.com", path: "/pub" });
  });

  it("keeps an IPv6 literal whole, the brackets being what the port is told from the address", () => {
    expect(readParts("http://[2001:db8::1]:8080/x")).toMatchObject({ host: "[2001:db8::1]", port: "8080" });
  });

  it("reads a scheme with no authority behind it", () => {
    expect(readParts("mailto:someone@example.com")).toMatchObject({
      scheme: "mailto",
      slashes: false,
      host: "",
      path: "someone@example.com",
    });
  });

  it("reads a protocol-relative address and a rooted path", () => {
    expect(readParts("//cdn.example.com/lib.js")).toMatchObject({ scheme: "", slashes: true, host: "cdn.example.com" });
    expect(readParts("/just/a/path?a=1")).toMatchObject({ scheme: "", slashes: false, path: "/just/a/path" });
  });

  it("does not take a colon inside a path for a scheme", () => {
    expect(readParts("a/b:c")).toMatchObject({ scheme: "", path: "a/b:c" });
  });

  it("keeps a misspelled scheme and a bad port where they were written", () => {
    expect(readUrl("ht tp://example.com/").partErrors.scheme).toBeTruthy();
    expect(readParts("http://example.com:80a/").port).toBe("80a");
    expect(readUrl("http://example.com:80a/").partErrors.port).toBeTruthy();
    expect(readUrl("http://exam ple.com/").partErrors.host).toBeTruthy();
    expect(readUrl("https://example.com:65535/").partErrors.port).toBeNull();
  });

  it("tells a missing query from an empty one", () => {
    expect(readParts("https://x/").query).toBeNull();
    expect(readParts("https://x/?").query).toBe("");
    expect(readParts("https://x/#").fragment).toBe("");
    expect(readParts("https://x/").fragment).toBeNull();
  });
});

describe("writeUrl", () => {
  it.each([
    "https://example.com:8443/a/b?q=1#top",
    "ftp://user:p@ss@files.example.com/pub",
    "http://[2001:db8::1]:8080/x",
    "mailto:someone@example.com",
    "//cdn.example.com/lib.js",
    "/just/a/path?a=1",
    "https://x/?",
    "https://x/#",
    "?a=1&b",
    "",
  ])("writes %s back as it was read", (text) => {
    expect(writeUrl(readParts(text))).toBe(text);
  });

  it("opens an authority for a host typed into an address that had none", () => {
    expect(edit("/just/a/path", "host", "example.com")).toBe("//example.com/just/a/path");
  });

  it("roots a path written under an authority", () => {
    expect(edit("mailto:a@b.com", "host", "mail.example.com")).toBe("mailto://mail.example.com/a@b.com");
  });

  it("takes the delimiter away with the text of a query or a fragment", () => {
    expect(edit("https://x/?a=1#top", "query", "")).toBe("https://x/#top");
    expect(edit("https://x/?a=1#top", "fragment", "")).toBe("https://x/?a=1");
  });

  it("drops a port and a password emptied to nothing", () => {
    expect(edit("https://example.com:8443/a", "port", "")).toBe("https://example.com/a");
    expect(edit("ftp://user:secret@x/", "password", "")).toBe("ftp://user@x/");
  });
});

describe("the query builder", () => {
  it("shows what the address escaped", () => {
    const pairs = readPairs("q=caf%C3%A9+latte&tags=hot%2Ccold&debug");
    expect(pairs.map((pair) => [pair.name, pair.value])).toEqual([
      ["q", "café latte"],
      ["tags", "hot,cold"],
      ["debug", ""],
    ]);
  });

  it("escapes what the builder was given", () => {
    expect(editParam("https://x/?q=a", 0, { value: "café latte" })).toBe("https://x/?q=caf%C3%A9%20latte");
    expect(editParam("https://x/?q=a", 0, { value: "a&b=c#d" })).toBe("https://x/?q=a%26b%3Dc%23d");
  });

  it.each(["a b", "a&b", "100%", "=", "+", "café", "a/b?c#d"])("round-trips %s through the address", (typed) => {
    const url = editParam("https://x/?q=", 0, { value: typed });
    expect(readUrl(url).pairs[0].value).toBe(typed);
    expect(readUrl(editParam(url, 0, { name: typed })).pairs[0].name).toBe(typed);
  });

  it("leaves every parameter but the one being edited exactly as the address spelled it", () => {
    expect(editParam("https://x/?a=one+two&b=x,y&c=3", 2, { value: "4" })).toBe("https://x/?a=one+two&b=x,y&c=4");
  });

  it("keeps a flag a flag until something is put in it", () => {
    expect(editParam("https://x/?debug&a=1", 0, { name: "verbose" })).toBe("https://x/?verbose&a=1");
    expect(editParam("https://x/?debug&a=1", 0, { value: "2" })).toBe("https://x/?debug=2&a=1");
    expect(editParam("https://x/?debug=2&a=1", 0, { value: "" })).toBe("https://x/?debug=&a=1");
  });

  it("holds an emptied row open with its own separator", () => {
    expect(editParam("https://x/?a=1", 0, { name: "" })).toBe("https://x/?=1");

    const emptied = editParam("https://x/?a=1", 0, { name: "", value: "" });
    expect(emptied).toBe("https://x/?=");
    expect(readUrl(emptied).pairs).toHaveLength(1);

    expect(readUrl(editParam("https://x/?debug", 0, { name: "" })).pairs).toHaveLength(1);
  });

  it("adds a parameter that survives the trip, and removes the query with the last of them", () => {
    const { parts, pairs } = readUrl("https://x/path");
    const added = writeUrl(withPairs(parts, [...pairs, newPair()]));
    expect(added).toBe("https://x/path?=");
    expect(readUrl(added).pairs).toHaveLength(1);
    expect(writeUrl(withPairs(readParts(added), []))).toBe("https://x/path");
  });

  it("says so where a percent escape opens nothing, and keeps the text it could not read", () => {
    const [pair] = readPairs("q=100%zz");
    expect(pair.value).toBe("100%zz");
    expect(pair.valueError).toBeTruthy();
  });

  it("tells a query with nothing in it from a query with an empty parameter", () => {
    expect(readPairs("")).toEqual([]);
    expect(readPairs(null)).toEqual([]);
    expect(readPairs("=")).toHaveLength(1);
  });

  it("keeps repeated names as the separate parameters they are", () => {
    const pairs = readPairs("a=1&a=2");
    expect(pairs.map((pair) => pair.value)).toEqual(["1", "2"]);
    expect(editParam("https://x/?a=1&a=2", 1, { value: "3" })).toBe("https://x/?a=1&a=3");
  });
});
