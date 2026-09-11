import { describe, expect, it } from "vitest";
import { addOption, addUrl, arrange, type Entry, removeAt, setValue } from "../src/utilities/curl/entries";
import { findLong } from "../src/utilities/curl/options";
import { MANY_COMMANDS, NOT_CURL, parseCurl } from "../src/utilities/curl/parse";
import { NO_URL, NOT_HTTP, ONE_METHOD, planRequest } from "../src/utilities/curl/request";
import { BLOCKED, explain, MIXED } from "../src/utilities/curl/send";
import { POWERSHELL, quoteCmd, quoteWord, splitWords, UNTERMINATED_QUOTE } from "../src/utilities/curl/shell";
import { writeCurl } from "../src/utilities/curl/write";

const words = (source: string) => splitWords(source).words.map((word) => word.text);

const rewrite = (source: string, wrapped = false) => {
  const { entries, shell } = parseCurl(source);
  return writeCurl(entries, wrapped, shell);
};

const handed = (source: string) =>
  parseCurl(source).entries.map((entry) => entry.kind === "unknown" ? entry.flag : entry.value);

const CHROME_CMD_GET = [
  String.raw`curl --url ^"https://example.com/api/items?page=2^&sort=name^" ^`,
  String.raw`  -H ^"accept: application/json, text/plain, */*^" ^`,
  String.raw`  -b ^"session=abc123; theme=dark^" ^`,
  String.raw`  -H ^"sec-ch-ua: ^\^"Chromium^\^";v=^\^"128^\^", ^\^"Not;A=Brand^\^";v=^\^"24^\^"^" ^`,
  String.raw`  -H ^"user-agent: Mozilla/5.0 ^(Windows NT 10.0; Win64; x64^) AppleWebKit/537.36 `
  + String.raw`^(KHTML, like Gecko^) Chrome/128.0.0.0 Safari/537.36^"`,
].join("\n");

const CHROME_CMD_POST = [
  String.raw`curl --url ^"https://example.com/api/items^" ^`,
  String.raw`  -H ^"content-type: application/json^" ^`,
  String.raw`  -H ^"x-empty;^" ^`,
  String.raw`  --data-raw ^"^{^\^"name^\^":^\^"widget^\^",^\^"note^\^":^\^"50^% off ^& ^<free^>^\^"^}^"`,
].join("\n");

const CHROME_CMD_LINES = [
  String.raw`curl --url ^"https://example.com/upload^" ^`,
  String.raw`  -X ^"PUT^" ^`,
  String.raw`  -H ^"content-type: text/plain^" ^`,
  String.raw`  --data-raw ^"line one^`,
  "",
  String.raw`line two ^%^PATH^%^"`,
].join("\n");

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

  it("notes the variables a shell would expand and not the ones quoted against it", () => {
    const split = splitWords("curl -H \"Bearer $TOKEN\" ${HOST}/a '$HOME' \"\\$5\" $'$x'");
    expect(split.words.map((word) => word.text)).toEqual([
      "curl",
      "-H",
      "Bearer $TOKEN",
      "${HOST}/a",
      "$HOME",
      "$5",
      "$x",
    ]);
    expect(split.words.map((word) => word.variables)).toEqual([[], [], ["$TOKEN"], ["${HOST}"], [], [], []]);
  });

  it("hands a command with cmd's carets in it to the cmd reader", () => {
    expect(splitWords(CHROME_CMD_GET).shell).toBe("cmd");
    expect(splitWords("curl -d '^\"' https://example.com").shell).toBe("bash");
  });

  it("refuses a line continued with PowerShell's backtick", () => {
    expect(splitWords("curl.exe -X POST https://example.com `\n  -H \"Accept: */*\"").error).toBe(POWERSHELL);
  });
});

describe("splitWords, reading cmd", () => {
  it("reads Chrome's cmd copy of a GET into the words curl.exe is handed", () => {
    expect(words(CHROME_CMD_GET)).toEqual([
      "curl",
      "--url",
      "https://example.com/api/items?page=2&sort=name",
      "-H",
      "accept: application/json, text/plain, */*",
      "-b",
      "session=abc123; theme=dark",
      "-H",
      "sec-ch-ua: \"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\"",
      "-H",
      "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      + "Chrome/128.0.0.0 Safari/537.36",
    ]);
  });

  it("reads Chrome's cmd copy of a POST, percent, ampersand and all", () => {
    expect(words(CHROME_CMD_POST).slice(-2)).toEqual([
      "--data-raw",
      "{\"name\":\"widget\",\"note\":\"50% off & <free>\"}",
    ]);
    expect(words(CHROME_CMD_POST)).toContain("x-empty;");
  });

  it("keeps the line break a caret and an empty line spell", () => {
    expect(words(CHROME_CMD_LINES).at(-1)).toBe("line one\nline two %PATH%");
  });

  it("reads the quotes and backslashes the way the C runtime hands them to curl.exe", () => {
    expect(words("curl ^\n  " + String.raw`-d "a \"b\" c" -d C:\temp\ -d "d:\\" -d a\\\\"b c" -d "e""f"`)).toEqual([
      "curl",
      "-d",
      "a \"b\" c",
      "-d",
      "C:\\temp\\",
      "-d",
      "d:\\",
      "-d",
      "a\\\\b c",
      "-d",
      "e\"f",
    ]);
  });

  it("joins a line ended with a caret and keeps a quoted caret as a caret", () => {
    expect(words("curl \"https://example.com/?a=1&b=2\" ^\n  -H \"X: ^up\"")).toEqual([
      "curl",
      "https://example.com/?a=1&b=2",
      "-H",
      "X: ^up",
    ]);
  });

  it("notes a %NAME% cmd would expand and not one broken up with a caret", () => {
    const split = splitWords("curl -H \"Authorization: Bearer %TOKEN%\" ^\n  -d %^PATH%");
    expect(split.words.map((word) => word.text)).toEqual([
      "curl",
      "-H",
      "Authorization: Bearer %TOKEN%",
      "-d",
      "%PATH%",
    ]);
    expect(split.words.map((word) => word.variables)).toEqual([[], [], ["%TOKEN%"], [], []]);
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

  it("writes a value holding a variable in double quotes, every other $ escaped", () => {
    expect(quoteWord("Authorization: Bearer $TOKEN", ["$TOKEN"])).toBe("\"Authorization: Bearer $TOKEN\"");
    expect(quoteWord("{\"a\":\"$A\",\"cost\":\"$5\",\"x\":\"`\\\"}", ["$A"])).toBe(
      "\"{\\\"a\\\":\\\"$A\\\",\\\"cost\\\":\\\"\\$5\\\",\\\"x\\\":\\\"\\`\\\\\\\"}\"",
    );
    expect(words(`curl -d ${quoteWord("cost $5 for $USER", ["$USER"])}`)).toEqual(["curl", "-d", "cost $5 for $USER"]);
  });

  it("leaves a variable expanding only where its name still ends", () => {
    expect(quoteWord("$TOKENS", ["$TOKEN"])).toBe("'$TOKENS'");
    expect(quoteWord("${TOKEN}S", ["${TOKEN}"])).toBe("\"${TOKEN}S\"");
  });

  it("keeps a ! in a double-quoted value out of the quotes", () => {
    expect(quoteWord("hi! $NAME", ["$NAME"])).toBe("\"hi\"\\!\" $NAME\"");
    expect(words(`curl -d ${quoteWord("hi! $NAME", ["$NAME"])}`)).toEqual(["curl", "-d", "hi! $NAME"]);
  });
});

describe("quoteCmd", () => {
  const read = (value: string) => words(`curl -d ${quoteCmd(value)}`).at(-1);

  it("writes a value the way Chrome copies one for cmd", () => {
    expect(quoteCmd("https://example.com/a/b")).toBe("^\"https://example.com/a/b^\"");
    expect(quoteCmd("accept: */*")).toBe("^\"accept: */*^\"");
    expect(quoteCmd("a&b|c<d>e")).toBe("^\"a^&b^|c^<d^>e^\"");
    expect(quoteCmd("{\"a\":1}")).toBe("^\"{^\\^\"a^\\^\":1}^\"");
    expect(quoteCmd("")).toBe("^\"^\"");
  });

  it("reads back every value it writes", () => {
    for (
      const value of ["", "a b", "say \"hi\"", "C:\\temp\\", "a\\\"b", "50% off %PATH%", "one\ntwo", "^&|<>()!", "é"]
    ) {
      expect(read(value), value).toBe(value);
    }
  });

  it("leaves a %NAME% cmd was expanding to expand", () => {
    expect(quoteCmd("Bearer %TOKEN%", ["%TOKEN%"])).toBe("^\"Bearer %TOKEN%^\"");
    expect(splitWords(`curl -H ${quoteCmd("Bearer %TOKEN% %HOME%", ["%TOKEN%"])}`).words.at(-1)?.variables).toEqual([
      "%TOKEN%",
    ]);
  });
});

describe("parseCurl", () => {
  it("takes a command apart into its arguments and its URL", () => {
    expect(parseCurl("curl -X POST https://example.com -H 'A: b'")).toEqual({
      error: null,
      shell: "bash",
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
    expect(parseCurl("")).toEqual({ entries: [], error: null, shell: "bash" });
  });

  it("reads Chrome's cmd copy into the arguments it names", () => {
    const command = parseCurl(CHROME_CMD_GET);
    expect(command.error).toBeNull();
    expect(command.shell).toBe("cmd");
    expect(command.entries.map((entry) => entry.kind === "option" ? entry.name : entry.kind)).toEqual([
      "url",
      "--header",
      "--cookie",
      "--header",
      "--header",
    ]);
    expect(command.entries[0]).toEqual({
      kind: "url",
      value: "https://example.com/api/items?page=2&sort=name",
      flag: "--url",
    });
  });

  it("reads Chrome's cmd copy of a POST into its method, headers and body", () => {
    expect(handed(CHROME_CMD_POST)).toEqual([
      "https://example.com/api/items",
      "content-type: application/json",
      "x-empty;",
      "{\"name\":\"widget\",\"note\":\"50% off & <free>\"}",
    ]);
    expect(handed(CHROME_CMD_LINES)).toEqual([
      "https://example.com/upload",
      "PUT",
      "content-type: text/plain",
      "line one\nline two %PATH%",
    ]);
  });

  it("refuses more than one command written for cmd", () => {
    expect(parseCurl(`${CHROME_CMD_GET} &\r\n${CHROME_CMD_POST}`).error).toBe(MANY_COMMANDS);
    expect(parseCurl("curl ^\"https://one.example^\"\ncurl ^\"https://two.example^\"").error).toBe(MANY_COMMANDS);
    expect(parseCurl("curl ^\"https://one.example^\" | more").error).toBe(MANY_COMMANDS);
  });

  it("reads an ampersand or a pipe cmd was told to leave alone as a character", () => {
    expect(handed("curl ^\"https://e.example/?a=1^&b=2^\" -d a^|b")).toEqual(["https://e.example/?a=1&b=2", "a|b"]);
  });

  it("refuses a PowerShell command rather than reading its quoting as bash's", () => {
    expect(parseCurl("curl.exe https://example.com `\n  -H 'Accept: */*'").error).toBe(POWERSHELL);
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

  it("writes a command read from cmd back for cmd", () => {
    expect(rewrite("curl ^\"https://example.com/^\" -H ^\"a: b^\" -sS")).toBe(
      "curl ^\"https://example.com/^\" -H ^\"a: b^\" -sS",
    );
    expect(rewrite("curl ^\"https://example.com/^\" -sS", true)).toBe("curl ^\n  ^\"https://example.com/^\" ^\n  -sS");
    for (const sample of [CHROME_CMD_GET, CHROME_CMD_POST, CHROME_CMD_LINES]) {
      for (const wrapped of [true, false]) {
        const again = parseCurl(rewrite(sample, wrapped));
        expect(again.shell).toBe("cmd");
        expect(again.entries).toEqual(parseCurl(sample).entries);
      }
    }
  });
});

describe("shell variables", () => {
  const source = "curl https://api.example.com -H \"Authorization: Bearer $TOKEN\" -d '{\"id\":\"$literal\"}'";
  const entries = parseCurl(source).entries;

  it("still expands a variable written in double quotes once another field is edited", () => {
    expect(writeCurl(setValue(entries, 0, "https://api.example.com/v2"), false)).toBe(
      "curl https://api.example.com/v2 -H \"Authorization: Bearer $TOKEN\" -d '{\"id\":\"$literal\"}'",
    );
  });

  it("keeps it expanding through an edit to its own field, and a single-quoted $ literal", () => {
    const written = writeCurl(setValue(entries, 1, "Authorization: Token $TOKEN"), false);
    expect(written).toBe("curl https://api.example.com -H \"Authorization: Token $TOKEN\" -d '{\"id\":\"$literal\"}'");
    expect(parseCurl(written).entries[1]).toEqual({
      kind: "option",
      name: "--header",
      flag: "-H",
      value: "Authorization: Token $TOKEN",
      variables: ["$TOKEN"],
    });
  });

  it("keeps an unquoted variable expanding, and the literal $ beside it literal", () => {
    expect(rewrite("curl $BASE/items -d \"price=\\$5&user=${USER}\" -L")).toBe(
      "curl \"$BASE/items\" -d \"price=\\$5&user=${USER}\" -L",
    );
  });

  it("keeps a %NAME% expanding in a command read from cmd", () => {
    const cmd = parseCurl("curl ^\"https://a.example^\" -H \"Authorization: Bearer %TOKEN%\"");
    expect(writeCurl(setValue(cmd.entries, 0, "https://b.example"), false, cmd.shell)).toBe(
      "curl ^\"https://b.example^\" -H ^\"Authorization: Bearer %TOKEN%^\"",
    );
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
  const plan = (source: string, protocol = "https:") => planRequest(parseCurl(source).entries, protocol);
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

  it("reads an address written with no scheme the way curl does", () => {
    expect(plan("curl example.com:8080/items").url).toBe("http://example.com:8080/items");
    expect(plan("curl ftpserver.example.com/f").url).toBe("http://ftpserver.example.com/f");
    expect(plan("curl ftp.example.com/f").error).toBe(NOT_HTTP);
    expect(plan("curl FTP.example.com/f").error).toBe(NOT_HTTP);
    expect(plan("curl u:p@imap.example.com").error).toBe(NOT_HTTP);
  });

  it("says an http address cannot be fetched from an https page", () => {
    const request = plan("curl example.com/api");
    expect(request.mixed).toBe(true);
    expect(request.notes).toEqual([{ subject: "example.com/api", reason: expect.stringContaining("mixed content") }]);
    expect(explain(new TypeError("Failed to fetch"), request, false)).toBe(MIXED);
  });

  it("says nothing of it where the browser allows it", () => {
    const allowed: [string, string][] = [
      ["curl http://example.com", "http:"],
      ["curl http://localhost:8080/", "https:"],
      ["curl http://api.localhost/", "https:"],
      ["curl http://127.0.0.1/", "https:"],
      ["curl http://[::1]:3000/", "https:"],
    ];
    for (const [source, protocol] of allowed) {
      const request = plan(source, protocol);
      expect(request.mixed, source).toBe(false);
      expect(request.notes, source).toEqual([]);
    }
    expect(explain(new TypeError("Failed to fetch"), plan("curl https://example.com"), false)).toBe(BLOCKED);
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

  it("makes a POST of data read from a file, and says the file is left out", () => {
    const request = plan("curl https://e.com/api -d @payload.json");
    expect(request.method).toBe("POST");
    expect(request.body).toEqual({ kind: "text", text: "" });
    expect(header("curl https://e.com/api -d @payload.json", "content-type")).toBe("application/x-www-form-urlencoded");
    expect(request.notes).toEqual([{ subject: "-d", reason: expect.stringContaining("sent without") }]);
    expect(plan("curl https://e.com -d a=b -d @more.txt").body).toEqual({ kind: "text", text: "a=b" });
    expect(plan("curl https://e.com --json @payload.json").method).toBe("POST");
    expect(header("curl https://e.com --json @payload.json", "content-type")).toBe("application/json");
    expect(plan("curl https://e.com -F file=@report.pdf")).toMatchObject({
      method: "POST",
      body: { kind: "form", fields: [] },
    });
    expect(plan("curl -G https://e.com/search -d @query.txt")).toMatchObject({ method: "GET", body: null });
  });

  it("makes a PUT of an upload, and says the file is left out", () => {
    const request = plan("curl -T report.pdf https://e.com/files/");
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("https://e.com/files/report.pdf");
    expect(request.body).toBeNull();
    expect(request.headers).toEqual([]);
    expect(request.error).toBeNull();
    expect(request.notes).toEqual([{ subject: "-T", reason: expect.stringContaining("sent without") }]);
    expect(plan("curl --upload-file - https://e.com/in").notes).toEqual([{
      subject: "--upload-file",
      reason: expect.stringContaining("standard input"),
    }]);
  });

  it("names the remote file after the local one where the address has no name of its own", () => {
    expect(plan("curl -T f.txt https://e.com/api").url).toBe("https://e.com/api");
    expect(plan("curl -T f.txt https://e.com").url).toBe("https://e.com/f.txt");
    expect(plan("curl -T ./sub/f.txt https://e.com/dir/#top").url).toBe("https://e.com/dir/f.txt#top");
    expect(plan("curl -T 'a\\b.txt' https://e.com/w/").url).toBe("https://e.com/w/b.txt");
    expect(plan("curl -T 'x y#?&.txt' https://e.com/w/").url).toBe("https://e.com/w/x%20y%23%3f%26.txt");
    expect(plan("curl -T é.txt https://e.com/w/").url).toBe("https://e.com/w/%c3%a9.txt");
    expect(plan("curl -T f.txt 'https://e.com/dir/?q=1'").url).toBe("https://e.com/dir/?q=1");
    expect(plan("curl -T f.txt 'https://e.com/dir/?'").url).toBe("https://e.com/dir/?");
    expect(plan("curl -T - https://e.com/dir/").url).toBe("https://e.com/dir/");
  });

  it("lets the method written out and -G alone leave the upload as curl leaves it", () => {
    expect(plan("curl -T f.txt -X GET https://e.com/dir/")).toMatchObject({
      method: "GET",
      url: "https://e.com/dir/f.txt",
    });
    expect(plan("curl -T f.txt -G https://e.com/dir/")).toMatchObject({
      method: "PUT",
      url: "https://e.com/dir/f.txt",
    });
  });

  it("refuses an upload beside a body, a form or -I, as curl does", () => {
    for (const extra of ["-d a=b", "-d @body.json", "-F a=b", "-G -d a=b", "-I"]) {
      expect(plan(`curl -T f.txt ${extra} https://e.com/`).error, extra).toBe(ONE_METHOD);
    }
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

  it("says a cookie is not sent, and neither are the browser's own", () => {
    const [note] = plan("curl https://e.com -b session=abc").notes;
    expect(note.subject).toBe("-b");
    expect(note.reason).not.toContain("sends its own cookies");
    expect(note.reason).toContain("no cookies");
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
