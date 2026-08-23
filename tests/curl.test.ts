import { describe, expect, it } from "vitest";
import { addOption, addUrl, arrange, type Entry, removeAt, setValue } from "../src/utilities/curl/entries";
import { findLong } from "../src/utilities/curl/options";
import { MANY_COMMANDS, NOT_CURL, parseCurl } from "../src/utilities/curl/parse";
import { NO_URL, NOT_HTTP, planRequest } from "../src/utilities/curl/request";
import { quoteWord, splitWords, UNTERMINATED_QUOTE } from "../src/utilities/curl/shell";
import { writeCurl } from "../src/utilities/curl/write";

const words = (source: string) => splitWords(source).words.map((word) => word.text);

const rewrite = (source: string, wrapped = false) => writeCurl(parseCurl(source).entries, wrapped);

const spec = (name: string) => findLong(name)!;

describe("splitWords", () => {
  it("splits a line the way a shell hands it to curl", () => {
    expect(words("curl -X POST https://example.com")).toEqual(["curl", "-X", "POST", "https://example.com"]);
  });

  it("joins the lines a continuation holds together", () => {
    expect(words("curl \\\n  -L \\\n  https://example.com")).toEqual(["curl", "-L", "https://example.com"]);
  });

  it("keeps a quoted word whole, delimiters and all", () => {
    expect(words("curl -H 'Accept: text/html, */*'")).toEqual(["curl", "-H", "Accept: text/html, */*"]);
  });

  it("reads the escapes double quotes have and leaves the rest alone", () => {
    expect(words("curl -d \"say \\\"hi\\\" \\$now \\d\"")).toEqual(["curl", "-d", "say \"hi\" $now \\d"]);
  });

  it("reads the escapes of an ANSI-C quoted word", () => {
    expect(words("curl -d $'a\\nb\\tc\\x41\\u00e9'")).toEqual(["curl", "-d", "a\nb\tc\u0041\u00e9"]);
  });

  it("opens a comment only where a word opens, so a fragment keeps its hash", () => {
    expect(words("curl https://example.com/#top # the rest is a note")).toEqual(["curl", "https://example.com/#top"]);
  });

  it("says so when a quote is never closed", () => {
    expect(splitWords("curl -H 'Accept: */*").error).toBe(UNTERMINATED_QUOTE);
  });

  it("marks the words that stood inside quotes, which is what tells a pipe from a character", () => {
    expect(splitWords("curl -d '|' | jq").words.map((word) => word.quoted)).toEqual([false, false, true, false, false]);
  });
});

describe("quoteWord", () => {
  it("leaves a word a shell would leave alone", () => {
    expect(quoteWord("https://example.com/a/b")).toBe("https://example.com/a/b");
  });

  it("quotes an address with a query on it, which every copied command is written with", () => {
    expect(quoteWord("https://example.com/a?c=1&d=2")).toBe("'https://example.com/a?c=1&d=2'");
  });

  it("quotes anything with a space, a brace or a glob in it", () => {
    expect(quoteWord("Accept: */*")).toBe("'Accept: */*'");
    expect(quoteWord("{\"a\":1}")).toBe("'{\"a\":1}'");
  });

  it("spells a quote by stopping quoting for it", () => {
    expect(quoteWord("it's")).toBe("'it'\\''s'");
    expect(words(`curl -d ${quoteWord("it's")}`)).toEqual(["curl", "-d", "it's"]);
  });

  it("writes an empty value as an empty word rather than as nothing", () => {
    expect(quoteWord("")).toBe("''");
  });
});

describe("parseCurl", () => {
  it("takes a command apart into its arguments and its URL", () => {
    expect(parseCurl("curl -X POST https://example.com -H 'A: b'")).toEqual({
      error: null,
      entries: [
        { kind: "option", name: "--request", flag: "-X", value: "POST" },
        { kind: "url", value: "https://example.com", flag: null },
        { kind: "option", name: "--header", flag: "-H", value: "A: b" },
      ],
    });
  });

  it("reads a bundle letter by letter", () => {
    expect(parseCurl("curl -sSL https://example.com").entries.map((entry) => entry.kind === "option" && entry.name))
      .toEqual(["--silent", "--show-error", "--location", false]);
  });

  it("lets the last of a bundle take the rest of it as its value", () => {
    expect(parseCurl("curl -so out.json https://example.com").entries).toContainEqual({
      kind: "option",
      name: "--output",
      flag: "-o",
      value: "out.json",
    });
  });

  it("reads a value written with an equals sign as one written with a space", () => {
    expect(parseCurl("curl --data=name=widget https://example.com").entries[0]).toEqual({
      kind: "option",
      name: "--data",
      flag: "--data",
      value: "name=widget",
    });
  });

  it("reads a URL written as an option into the same place as one written as an operand", () => {
    expect(parseCurl("curl --url https://example.com").entries).toEqual([
      { kind: "url", value: "https://example.com", flag: "--url" },
    ]);
  });

  it("keeps an option it has no field for rather than dropping it", () => {
    expect(parseCurl("curl --happy-eyeballs-timeout-ms https://example.com").entries).toEqual([
      { kind: "unknown", flag: "--happy-eyeballs-timeout-ms" },
      { kind: "url", value: "https://example.com", flag: null },
    ]);
  });

  it("drops the prompt a command was copied with", () => {
    expect(parseCurl("$ curl https://example.com").error).toBeNull();
  });

  it("reads curl by whatever path it was invoked under", () => {
    expect(parseCurl("/usr/bin/curl https://example.com").error).toBeNull();
    expect(parseCurl("wget https://example.com").error).toBe(NOT_CURL);
  });

  it("refuses more than one command", () => {
    expect(parseCurl("curl https://example.com | jq .").error).toBe(MANY_COMMANDS);
    expect(parseCurl("curl https://example.com --next https://other.example").error).toBe(MANY_COMMANDS);
  });

  it("reads a pipe inside a value as part of the value", () => {
    expect(parseCurl("curl -d 'a|b' https://example.com").error).toBeNull();
  });

  it("has nothing to say about an empty box", () => {
    expect(parseCurl("")).toEqual({ entries: [], error: null });
  });
});

describe("writeCurl", () => {
  it("writes the arguments back in the order they were read, in the spelling they were read in", () => {
    const source = "curl --header 'A: b' -X POST https://example.com --compressed";
    expect(rewrite(source)).toBe(source);
  });

  it("writes a flag with no value after it", () => {
    expect(rewrite("curl -L https://example.com")).toBe("curl -L https://example.com");
  });

  it("lays the arguments out one to a line when it is asked to", () => {
    expect(rewrite("curl -L https://example.com", true)).toBe("curl \\\n  -L \\\n  https://example.com");
  });

  it("carries an option it has no field for through untouched", () => {
    expect(rewrite("curl --tr-encoding https://example.com")).toBe("curl --tr-encoding https://example.com");
  });

  it("reads back the same command it wrote", () => {
    const source = "curl -sSL --data=name=widget -H 'Accept: */*' https://example.com";
    expect(parseCurl(rewrite(source)).entries).toEqual(parseCurl(source).entries);
  });

  it("writes single-letter flags standing together as the one bundle curl reads them as", () => {
    expect(rewrite("curl -sSL https://example.com")).toBe("curl -sSL https://example.com");
    expect(rewrite("curl -s -S -L https://example.com")).toBe("curl -sSL https://example.com");
  });

  it("leaves anything a letter cannot join standing on its own", () => {
    expect(rewrite("curl -s -o out.json -S https://example.com")).toBe("curl -s -o out.json -S https://example.com");
    expect(rewrite("curl -s --compressed -S https://example.com")).toBe("curl -s --compressed -S https://example.com");
  });

  it("does not bundle an option that was written out in full", () => {
    expect(rewrite("curl --silent --location https://example.com")).toBe(
      "curl --silent --location https://example.com",
    );
  });

  it("never appends a letter to something that is not a flag", () => {
    const typed = setValue(parseCurl("curl https://example.com -L").entries, 0, "-abc");
    expect(writeCurl(typed, false)).toBe("curl -abc -L");
  });

  it("bundles an option it has no field for along with the rest", () => {
    expect(rewrite("curl -s -Q -L https://example.com")).toBe("curl -sQL https://example.com");
  });
});

describe("the builder's edits", () => {
  const command = "curl https://example.com -H 'A: b' -H 'C: d' -L";
  const entries = parseCurl(command).entries;

  it("writes one field back without touching any other", () => {
    expect(writeCurl(setValue(entries, 1, "A: z"), false)).toBe("curl https://example.com -H 'A: z' -H 'C: d' -L");
  });

  it("takes one row off", () => {
    expect(writeCurl(removeAt(entries, 1), false)).toBe("curl https://example.com -H 'C: d' -L");
  });

  it("adds a repeat next to the ones already there", () => {
    expect(writeCurl(addOption(entries, spec("--header")), false))
      .toBe("curl https://example.com -H 'A: b' -H 'C: d' -H '' -L");
  });

  it("adds an option that is not there yet at the end", () => {
    expect(writeCurl(addOption(entries, spec("--user")), false)).toBe(`${command} -u ''`);
  });

  it("adds a single-letter flag to the ones already there", () => {
    expect(writeCurl(addOption(entries, spec("--silent")), false))
      .toBe("curl https://example.com -H 'A: b' -H 'C: d' -Ls");
  });

  it("adds a URL after the last one, and writes it as an operand", () => {
    expect(writeCurl(addUrl(entries), false)).toBe("curl https://example.com '' -H 'A: b' -H 'C: d' -L");
  });

  it("writes a new argument in the short spelling where the option has one", () => {
    expect(writeCurl(addOption([], spec("--data")), false)).toBe("curl -d ''");
    expect(writeCurl(addOption([], spec("--compressed")), false)).toBe("curl --compressed");
  });
});

describe("arrange", () => {
  const entries: Entry[] = parseCurl(
    "curl https://example.com -X POST -H 'A: b' -H 'C: d' -m 30 -L --compressed --tr-encoding",
  ).entries;
  const parts = arrange(entries);

  it("puts every URL in the one fieldset", () => {
    expect(parts.urls.map((slot) => slot.entry.value)).toEqual(["https://example.com"]);
  });

  it("draws an option curl reads once as a field", () => {
    expect(parts.singles.map((block) => block.spec.name)).toEqual(["--request", "--max-time"]);
  });

  it("draws an option curl reads every one of as a fieldset holding all of them", () => {
    expect(parts.groups.map((block) => block.spec.name)).toEqual(["--header"]);
    expect(parts.groups[0].slots).toHaveLength(2);
  });

  it("collects the flags, which have no value to draw a box for", () => {
    expect(parts.flags.map((block) => block.spec.name)).toEqual(["--location", "--compressed"]);
  });

  it("keeps what it does not recognise where it can still be taken off", () => {
    expect(parts.unknown.map((slot) => slot.entry.flag)).toEqual(["--tr-encoding"]);
  });

  it("draws an option written twice as two fields", () => {
    const twice = arrange(parseCurl("curl -X POST -X PUT https://example.com").entries);
    expect(twice.singles[0].slots.map((slot) => slot.entry.value)).toEqual(["POST", "PUT"]);
  });
});

describe("planRequest", () => {
  const plan = (source: string) => planRequest(parseCurl(source).entries);
  const header = (source: string, name: string) =>
    plan(source).headers.find(([held]) => held.toLowerCase() === name.toLowerCase())?.[1];
  const reasons = (source: string) => plan(source).notes.map((note) => note.subject);

  it("reads a bare command as the GET it is", () => {
    const request = plan("curl https://example.com/items");
    expect(request.method).toBe("GET");
    expect(request.url).toBe("https://example.com/items");
    expect(request.body).toBeNull();
    expect(request.error).toBeNull();
  });

  it("puts https on an address written without one", () => {
    expect(plan("curl example.com:8080/items").url).toBe("https://example.com:8080/items");
  });

  it("says what is missing rather than sending something else", () => {
    expect(plan("curl -X POST").error).toBe(NO_URL);
    expect(plan("curl ftp://example.com/f").error).toBe(NOT_HTTP);
  });

  it("carries the headers the command writes", () => {
    expect(header("curl https://e.com -H 'Accept: text/plain'", "accept")).toBe("text/plain");
  });

  it("makes a POST of a command with data, and says what the body is", () => {
    const request = plan("curl https://e.com -d name=widget -d quantity=3");
    expect(request.method).toBe("POST");
    expect(request.body).toEqual({ kind: "text", text: "name=widget&quantity=3" });
    expect(header("curl https://e.com -d a=b", "content-type")).toBe("application/x-www-form-urlencoded");
  });

  it("lets the method written out win over the one the body implies", () => {
    expect(plan("curl https://e.com -X PUT -d a=b").method).toBe("PUT");
    expect(plan("curl https://e.com -I").method).toBe("HEAD");
  });

  it("reads --json as the body and both of the headers it stands for", () => {
    const source = "curl https://e.com --json '{\"a\":1}'";
    expect(plan(source).body).toEqual({ kind: "text", text: "{\"a\":1}" });
    expect(header(source, "content-type")).toBe("application/json");
    expect(header(source, "accept")).toBe("application/json");
  });

  it("keeps one Content-Type where the command writes its own", () => {
    const request = plan("curl https://e.com -d a=b -H 'Content-Type: text/plain'");
    expect(request.headers.filter(([name]) => name.toLowerCase() === "content-type")).toEqual([[
      "Content-Type",
      "text/plain",
    ]]);
  });

  it("works out the credentials a browser can actually be given", () => {
    expect(header("curl https://e.com -u alice:hunter2", "authorization")).toBe("Basic YWxpY2U6aHVudGVyMg==");
    expect(header("curl https://e.com --oauth2-bearer s3cr3t", "authorization")).toBe("Bearer s3cr3t");
  });

  it("moves the data onto the query for -G and sends no body", () => {
    const request = plan("curl -G https://e.com/search -d q=widgets -d page=2");
    expect(request.url).toBe("https://e.com/search?q=widgets&page=2");
    expect(request.method).toBe("GET");
    expect(request.body).toBeNull();
  });

  it("encodes what --data-urlencode asks it to and leaves the name alone", () => {
    expect(plan("curl https://e.com --data-urlencode 'q=two words&more'").body).toEqual({
      kind: "text",
      text: "q=two%20words%26more",
    });
    expect(plan("curl https://e.com --data-urlencode '=a b'").body).toEqual({ kind: "text", text: "a%20b" });
  });

  it("reads a form into its fields and leaves the boundary to fetch", () => {
    const request = plan("curl https://e.com -F name=widget -F note=hello");
    expect(request.body).toEqual({ kind: "form", fields: [["name", "widget"], ["note", "hello"]] });
    expect(header("curl https://e.com -F a=b", "content-type")).toBeUndefined();
  });

  it("follows redirects only where the command says to", () => {
    expect(plan("curl https://e.com").redirect).toBe("manual");
    expect(plan("curl -L https://e.com").redirect).toBe("follow");
  });

  it("takes the whole timeout off --max-time and nothing off the rest", () => {
    expect(plan("curl https://e.com -m 2.5").timeout).toBe(2500);
    expect(plan("curl https://e.com").timeout).toBeNull();
  });

  it("says what a browser will not do rather than quietly not doing it", () => {
    expect(reasons("curl https://e.com -k --proxy http://127.0.0.1:8080")).toEqual(["-k", "--proxy"]);
    expect(reasons("curl https://e.com -d @body.json")).toEqual(["-d"]);
    expect(reasons("curl https://e.com --tr-encoding")).toEqual(["--tr-encoding"]);
  });

  it("collects the headers a browser sets for itself into the one line", () => {
    const notes = plan("curl https://e.com -H 'Cookie: a=b' -H 'Host: e.com' -H 'sec-ch-ua: x'").notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].reason).toContain("Cookie, Host, sec-ch-ua");
    expect(plan("curl https://e.com -H 'Cookie: a=b'").headers).toEqual([]);
  });

  it("says each thing once", () => {
    expect(reasons("curl https://e.com --resolve a:1:2 --resolve b:1:2")).toEqual(["--resolve"]);
  });

  it("takes a body off a GET, which is the one curl would have sent", () => {
    const request = plan("curl https://e.com -X GET -d a=b");
    expect(request.body).toBeNull();
    expect(request.notes.map((note) => note.reason)).toContain("A browser will not put a body on a GET");
  });

  it("sends the first URL and says the others are not sent", () => {
    const request = plan("curl https://one.example https://two.example");
    expect(request.url).toBe("https://one.example/");
    expect(request.notes.map((note) => note.subject)).toEqual(["https://two.example"]);
  });

  it("keeps quiet about the options a browser already does", () => {
    expect(plan("curl https://e.com -sSL --compressed -i -f").notes).toEqual([]);
  });
});
