import { describe, expect, it } from "vitest";
import { readShown } from "../src/utilities/har/body";
import { fieldOf } from "../src/utilities/har/fields";
import { blankCondition, comparatorOf, type Condition, conditionProblem, filterExchanges, readConditions, writeConditions } from "../src/utilities/har/filter";
import { type Exchange, readArchive } from "../src/utilities/har/parse";
import { statusColour, writeMs, writeSpan, writeTarget } from "../src/utilities/har/write";

const RECORDING = JSON.stringify({
  log: {
    version: "1.2",
    creator: { name: "WebInspector", version: "537.36" },
    pages: [{ id: "page_1", title: "https://shop.example.com/", startedDateTime: "2024-03-02T10:00:00.000Z" }],
    entries: [
      {
        pageref: "page_1",
        startedDateTime: "2024-03-02T10:00:00.000Z",
        time: 120.5,
        request: {
          method: "GET",
          url: "https://shop.example.com/",
          httpVersion: "http/2.0",
          headers: [{ name: "Accept", value: "text/html" }, { name: "Accept-Encoding", value: "gzip, deflate" }],
          queryString: [],
          cookies: [{ name: "session", value: "abc123" }],
          headersSize: 300,
          bodySize: 0,
        },
        response: {
          status: 200,
          statusText: "OK",
          httpVersion: "http/2.0",
          headers: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
          cookies: [],
          content: { size: 4096, mimeType: "text/html; charset=utf-8", text: "<!doctype html><title>Shop</title>" },
          redirectURL: "",
          headersSize: 200,
          bodySize: 1400,
        },
        cache: {},
        timings: { blocked: 1, dns: 8, connect: 30, ssl: 20, send: 0.5, wait: 70, receive: 11 },
        serverIPAddress: "93.184.216.34",
        connection: "443",
      },
      {
        pageref: "page_1",
        startedDateTime: "2024-03-02T10:00:01.000Z",
        time: 480,
        request: {
          method: "POST",
          url: "https://api.example.com/v2/cart?currency=EUR",
          httpVersion: "http/1.1",
          headers: [{ name: "Content-Type", value: "application/json" }, { name: "Authorization", value: "Bearer x" }],
          queryString: [{ name: "currency", value: "EUR" }],
          cookies: [],
          postData: { mimeType: "application/json", text: "{\"sku\":\"A-1\",\"quantity\":2}" },
          headersSize: 420,
          bodySize: 26,
        },
        response: {
          status: 201,
          statusText: "Created",
          httpVersion: "http/1.1",
          headers: [{ name: "Content-Type", value: "application/json" }, { name: "Content-Encoding", value: "gzip" }],
          cookies: [{ name: "cart", value: "9f2" }],
          content: { size: 90, mimeType: "application/json", text: "{\"id\":42,\"lines\":[{\"sku\":\"A-1\"}]}" },
          redirectURL: "",
          headersSize: 180,
          bodySize: 70,
        },
        cache: {},
        timings: { blocked: 2, dns: -1, connect: -1, ssl: -1, send: 1, wait: 460, receive: 17 },
        serverIPAddress: "203.0.113.7",
      },
      {
        startedDateTime: "2024-03-02T10:00:02.000Z",
        time: 40,
        request: { method: "GET", url: "https://cdn.example.com/logo.png", headers: [], queryString: [], cookies: [] },
        response: {
          status: 200,
          statusText: "OK",
          headers: [{ name: "Content-Type", value: "image/png" }],
          cookies: [],
          content: { size: 95, mimeType: "image/png", encoding: "base64", text: PNG_BASE64() },
          redirectURL: "",
          headersSize: 120,
          bodySize: 95,
        },
        cache: {},
        timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 30, receive: 10 },
      },
      {
        startedDateTime: "2024-03-02T10:00:03.000Z",
        time: 20,
        request: {
          method: "GET",
          url: "https://shop.example.com/missing.css",
          headers: [],
          queryString: [],
          cookies: [],
        },
        response: {
          status: 404,
          statusText: "Not Found",
          headers: [{ name: "Content-Type", value: "text/plain" }],
          cookies: [],
          content: { size: 9, mimeType: "text/plain", text: "not found" },
          redirectURL: "",
          headersSize: 90,
          bodySize: 9,
        },
        cache: {},
        timings: { wait: 20 },
      },
      {
        startedDateTime: "2024-03-02T10:00:04.000Z",
        time: -1,
        request: { method: "GET", url: "https://down.example.com/ping", headers: [], queryString: [], cookies: [] },
        response: {
          status: 0,
          statusText: "",
          headers: [],
          cookies: [],
          content: { size: 0, mimeType: "" },
          redirectURL: "",
          headersSize: -1,
          bodySize: -1,
        },
        cache: {},
        timings: { blocked: -1, dns: -1, connect: -1, send: -1, wait: -1, receive: -1 },
        _error: "net::ERR_CONNECTION_REFUSED",
      },
    ],
  },
});

function PNG_BASE64(): string {
  return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

const archive = readArchive(RECORDING);
const [home, cart, logo, missing, refused] = archive.exchanges;

function ask(field: string, comparator: string, value: string): Exchange[] {
  return filterExchanges(archive.exchanges, [{ key: 1, field, comparator, value }]);
}

function urls(exchanges: Exchange[]): string[] {
  return exchanges.map((exchange) => exchange.url);
}

describe("readArchive", () => {
  it("reads the log, the creator and the span the recording covers", () => {
    expect(archive.version).toBe("1.2");
    expect(archive.creator).toBe("WebInspector 537.36");
    expect(archive.pages).toBe(1);
    expect(archive.exchanges).toHaveLength(5);
    expect(archive.startedAt).toBe(Date.parse("2024-03-02T10:00:00.000Z"));
    expect(archive.endedAt).toBe(Date.parse("2024-03-02T10:00:04.000Z"));
  });

  it("splits a URL into the parts a filter is written against", () => {
    expect(cart.host).toBe("api.example.com");
    expect(cart.path).toBe("/v2/cart");
    expect(cart.query).toBe("currency=EUR");
    expect(cart.queryParams).toEqual([{ name: "currency", value: "EUR" }]);
  });

  it("takes the parameters off a content type, which say nothing about what the body is", () => {
    expect(home.mimeType).toBe("text/html");
  });

  it("reads what a recorder said the thing was fetched as, and works it out where it did not", () => {
    expect(home.resourceType).toBe("document");
    expect(cart.resourceType).toBe("json");
    expect(logo.resourceType).toBe("image");
    expect(missing.resourceType).toBe("text");
  });

  it("carries the page title over from the ref the entry names", () => {
    expect(home.page).toBe("https://shop.example.com/");
    expect(logo.page).toBe("");
  });

  it("reads -1 as a phase that was not measured rather than as a duration", () => {
    expect(cart.timings.dns).toBeNull();
    expect(cart.timings.ssl).toBeNull();
    expect(refused.time).toBeNull();
    expect(refused.status).toBeNull();
    expect(refused.transferSize).toBeNull();
  });

  it("takes the handshake out of the connect it was measured inside, so the bar counts it once", () => {
    expect(home.timings.connect).toBe(30);
    expect(home.phases).toEqual([
      { name: "Blocked", ms: 1 },
      { name: "DNS", ms: 8 },
      { name: "Connect", ms: 10 },
      { name: "TLS", ms: 20 },
      { name: "Send", ms: 0.5 },
      { name: "Wait", ms: 70 },
      { name: "Receive", ms: 11 },
    ]);
  });

  it("adds up the parts for a recorder that wrote no total of its own", () => {
    const read = readArchive(JSON.stringify({
      log: { entries: [{ request: { url: "https://x.test/" }, response: {}, timings: { wait: 5, receive: 3 } }] },
    }));
    expect(read.exchanges[0].time).toBe(8);
  });

  it("counts what came down the wire, and Chrome's own count where it wrote one", () => {
    expect(home.transferSize).toBe(1600);
    expect(cart.requestSize).toBe(446);
  });

  it("keeps a URL this browser will not parse rather than dropping it for the parse", () => {
    const read = readArchive(
      JSON.stringify({ log: { entries: [{ request: { url: "not a url?a=1" }, response: {} }] } }),
    );
    expect(read.exchanges[0].url).toBe("not a url?a=1");
    expect(read.exchanges[0].host).toBe("");
    expect(read.exchanges[0].query).toBe("a=1");
  });

  it("says what is wrong with a file that is not one", () => {
    expect(() => readArchive("{ nope")).toThrow(/not JSON/);
    expect(() => readArchive("{\"log\":{\"version\":\"1.2\"}}")).toThrow(/log\.entries/);
  });

  it("reads a recording with no entries in it at all", () => {
    const read = readArchive(JSON.stringify({ log: { entries: [] } }));
    expect(read.exchanges).toEqual([]);
    expect(read.startedAt).toBeNull();
  });
});

describe("comparators", () => {
  it("finds a substring whichever case either side was typed in", () => {
    expect(urls(ask("url", "contains", "API.example"))).toEqual([cart.url]);
    expect(urls(ask("host", "is", "CDN.example.com"))).toEqual([logo.url]);
  });

  it("holds a whole value to being that value and not to holding it", () => {
    expect(urls(ask("method", "is", "get"))).toEqual([home.url, logo.url, missing.url, refused.url]);
    expect(urls(ask("method", "is", "GE"))).toEqual([]);
  });

  it("reads a number as a number, so a status is ordered rather than spelled", () => {
    expect(urls(ask("status", "gte", "400"))).toEqual([missing.url]);
    expect(urls(ask("status", "lt", "300"))).toEqual([home.url, cart.url, logo.url]);
    expect(urls(ask("status", "is", "404"))).toEqual([missing.url]);
    expect(urls(ask("time", "gt", "100"))).toEqual([home.url, cart.url]);
  });

  it("matches a pattern, and matches it case-insensitively like every other text comparison", () => {
    expect(urls(ask("path", "matches", "^/v\\d+/"))).toEqual([cart.url]);
    expect(urls(ask("url", "matches", "\\.(png|css)$"))).toEqual([logo.url, missing.url]);
    expect(urls(ask("mime-type", "matches", "TEXT/"))).toEqual([home.url, missing.url]);
  });

  it("takes nothing out of the list for a row nobody has typed into yet", () => {
    expect(filterExchanges(archive.exchanges, [blankCondition()])).toHaveLength(5);
    expect(filterExchanges(archive.exchanges, [{ key: 1, field: "url", comparator: "contains", value: "   " }]))
      .toHaveLength(5);
  });

  it("matches nothing for a condition nobody could evaluate, rather than quietly widening the list", () => {
    expect(ask("url", "matches", "(unclosed")).toEqual([]);
    expect(ask("status", "gt", "four hundred")).toEqual([]);
  });
});

describe("a field with more than one value", () => {
  it("answers if any of them does", () => {
    expect(urls(ask("response-header", "contains", "gzip"))).toEqual([cart.url]);
    expect(urls(ask("request-header", "starts", "accept-encoding:"))).toEqual([home.url]);
    expect(urls(ask("request-cookie", "contains", "session"))).toEqual([home.url]);
    expect(urls(ask("response-cookie", "contains", "cart"))).toEqual([cart.url]);
  });

  it("answers a negative comparator only when none of them does", () => {
    expect(urls(ask("response-header", "not-contains", "gzip")))
      .toEqual([home.url, logo.url, missing.url, refused.url]);
    expect(urls(ask("request-header", "not-contains", "accept"))).toEqual([
      cart.url,
      logo.url,
      missing.url,
      refused.url,
    ]);
  });
});

describe("a value the recording does not carry", () => {
  it("answers nothing, in either direction, where the number was never measured", () => {
    expect(urls(ask("dns", "gt", "0"))).toEqual([home.url]);
    expect(urls(ask("dns", "is-not", "8"))).toEqual([logo.url]);
    expect(urls(ask("time", "lt", "1000"))).toEqual([home.url, cart.url, logo.url, missing.url]);
  });

  it("reads an empty text field as the empty string, so a negative comparator holds over it", () => {
    expect(urls(ask("error", "contains", "refused"))).toEqual([refused.url]);
    expect(urls(ask("error", "not-contains", "refused"))).toEqual([home.url, cart.url, logo.url, missing.url]);
  });
});

describe("more than one condition", () => {
  it("holds every one of them, because a row added is a list narrowed", () => {
    const conditions: Condition[] = [
      { key: 1, field: "host", comparator: "contains", value: "example.com" },
      { key: 2, field: "status", comparator: "gte", value: "200" },
      { key: 3, field: "status", comparator: "lt", value: "300" },
    ];
    expect(urls(filterExchanges(archive.exchanges, conditions))).toEqual([home.url, cart.url, logo.url]);
  });

  it("lets one unfinished row sit among the ones that are asking something", () => {
    const conditions: Condition[] = [
      { key: 1, field: "method", comparator: "is", value: "POST" },
      { key: 2, field: "response-body", comparator: "contains", value: "" },
    ];
    expect(urls(filterExchanges(archive.exchanges, conditions))).toEqual([cart.url]);
  });
});

describe("what is said under the box", () => {
  it("says nothing about a row nobody has finished", () => {
    expect(conditionProblem(blankCondition())).toBe("");
  });

  it("names the pattern that will not compile and the number that is not one", () => {
    expect(conditionProblem({ key: 1, field: "url", comparator: "matches", value: "([a-z" })).not.toBe("");
    expect(conditionProblem({ key: 1, field: "status", comparator: "gt", value: "40x" })).toBe("Not a number");
    expect(conditionProblem({ key: 1, field: "status", comparator: "gt", value: "400" })).toBe("");
  });
});

describe("a comparator the field cannot be asked with", () => {
  it("becomes the one that kind of field opens on", () => {
    expect(comparatorOf("contains", "number").id).toBe("is");
    expect(comparatorOf("gt", "text").id).toBe("contains");
    expect(comparatorOf(undefined, "text").id).toBe("contains");
    expect(comparatorOf("is", "number").id).toBe("is");
  });

  it("answers for a field an older link names and this version no longer has", () => {
    expect(fieldOf("no-such-field").id).toBe("url");
  });
});

describe("the link", () => {
  it("carries the rows somebody filled in and leaves the blank one out", () => {
    const conditions: Condition[] = [
      { key: 1, field: "status", comparator: "gte", value: "400" },
      { key: 2, field: "url", comparator: "contains", value: "" },
    ];
    expect(writeConditions(conditions)).toEqual([["status", "gte", "400"]]);
    expect(writeConditions([blankCondition()])).toBeUndefined();
  });

  it("reads back what it wrote, and opens on one row where it names none", () => {
    const read = readConditions([["status", "gte", "400"], ["response-header", "contains", "gzip"]]);
    expect(read.map((condition) => [condition.field, condition.comparator, condition.value])).toEqual([
      ["status", "gte", "400"],
      ["response-header", "contains", "gzip"],
    ]);
    expect(readConditions(undefined)).toHaveLength(1);
    expect(readConditions([])).toHaveLength(1);
  });

  it("falls back for a row naming a comparator its field cannot be asked with", () => {
    const [condition] = readConditions([["status", "contains", "40"]]);
    expect(condition.comparator).toBe("is");
  });

  it("gives every row a key of its own, two rows on one field being two rows", () => {
    const read = readConditions([["url", "contains", "a"], ["url", "contains", "b"]]);
    expect(read[0].key).not.toBe(read[1].key);
  });
});

describe("a recorded body", () => {
  it("indents JSON, which is served minified and read by nobody in that shape", () => {
    const shown = readShown(cart.responseBody)!;
    expect(shown.pretty).toBe(true);
    expect(shown.text).toBe("{\n  \"id\": 42,\n  \"lines\": [\n    {\n      \"sku\": \"A-1\"\n    }\n  ]\n}");
  });

  it("leaves anything else exactly as it was recorded", () => {
    const shown = readShown(home.responseBody)!;
    expect(shown.pretty).toBe(false);
    expect(shown.text).toBe("<!doctype html><title>Shop</title>");
  });

  it("shows a picture rather than spelling out the base64 of one", () => {
    const shown = readShown(logo.responseBody)!;
    expect(shown.image).toMatch(/^data:image\/png;base64,iVBOR/);
    expect(shown.text).toBe("");
  });

  it("turns base64 back into text where the type says it was text", () => {
    const shown = readShown({
      mimeType: "text/plain",
      encoding: "base64",
      text: btoa("hello, recorder"),
      size: 15,
      params: [],
    })!;
    expect(shown.text).toBe("hello, recorder");
  });

  it("says what it is instead of decoding a body that was never text", () => {
    const shown = readShown({
      mimeType: "application/octet-stream",
      encoding: "base64",
      text: btoa(" "),
      size: 3,
      params: [],
    })!;
    expect(shown.text).toBe("");
    expect(shown.note).toContain("not text");
  });

  it("is nothing at all where the exchange carried none", () => {
    expect(readShown(home.requestBody)).toBeNull();
  });
});

describe("what a card says about an exchange", () => {
  it("is the part that differs between two requests to the same host", () => {
    expect(writeTarget(cart)).toBe("/v2/cart?currency=EUR");
    expect(writeTarget(home)).toBe("/");
  });

  it("reads a duration in the unit somebody would say it in", () => {
    expect(writeMs(0.5)).toBe("0.50 ms");
    expect(writeMs(120.5)).toBe("121 ms");
    expect(writeMs(1480)).toBe("1.48 s");
    expect(writeMs(null)).toBe("");
  });

  it("says a recording's own length in minutes, a session not being a duration in seconds", () => {
    expect(writeSpan(0, 3020)).toBe("3.02 s");
    expect(writeSpan(0, 2_999_340)).toBe("49 min 59 s");
    expect(writeSpan(0, 7_400_000)).toBe("2 h 3 min");
    expect(writeSpan(null, 10)).toBe("");
  });

  it("colours a status the way every other tool does, and a request that failed as no status at all", () => {
    expect(statusColour(200)).toBe("teal");
    expect(statusColour(301)).toBe("blue");
    expect(statusColour(404)).toBe("yellow");
    expect(statusColour(503)).toBe("red");
    expect(statusColour(null)).toBe("gray");
  });
});
