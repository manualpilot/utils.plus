import type { PageContent } from "../page-document.ts";

export default {
  related: ["/har", "/url", "/json", "/jwt"],
  howItWorks: [
    "The fields are read out of the command's text: the URL, single options such as the method, repeatable ones such as headers and `-d` pieces, a switch per flag, and a row for anything unrecognised. Change a field and the command is rewritten; edit the command and the fields follow. `-H` stays `-H` and `--header` stays `--header`, single-letter flags standing together are written as one bundle such as `-sSL`, and a pasted command is left byte for byte until something is changed.",
    "The command is read the way bash reads it: single and double quotes, backslash line continuations, `$'…'` strings, which Chrome uses for a body with a control character in it, and `#` comments. A copy for Windows `cmd` is read and written back in cmd's own quoting. A pipe, a redirect or `--next` makes it more than one command, and the builder waits until that is taken off. Wrapped and One line are the same command with a line continuation, or a space, between arguments.",
    "Send makes the request with the browser's `fetch`, from this tab straight to the host in the command; it is the one thing on this site that leaves your browser. Before you press it, the page lists what a fetch cannot be told: skip certificate checks, use a proxy, read a file, retry, or set the headers a browser sets itself, such as `Cookie`, `Origin`, `Referer` and anything starting `Sec-`. Nor can this https page fetch `http://`, curl's default for an address with no scheme. Without `-L` a redirect is not followed, as in curl; `--max-time` bounds the whole request, and Stop cancels it.",
    "The response shows the status, the time, the size and the body as it arrived, unformatted and cut at 256 KB. Only the headers the server exposes to scripts reach the page, so the list is usually shorter than what `curl -i` prints.",
  ],
  examples: [
    {
      title: "Two data pieces and a user",
      blocks: [
        { code: "curl -sS -u ada:hunter2 -d name=widget -d quantity=3 https://httpbin.org/post" },
        "Send makes this request:",
        {
          code:
            "POST https://httpbin.org/post\nContent-Type: application/x-www-form-urlencoded\nAuthorization: Basic YWRhOmh1bnRlcjI=\n\nname=widget&quantity=3",
        },
        "`-d` makes it a POST, the pieces are joined with `&`, and `-u` becomes a Basic header, which is what curl itself sends. `-sS` changes nothing a browser does, so it earns no note.",
      ],
    },
    {
      title: "`-G` moves the data into the address",
      blocks: [
        { code: "curl -G -d q=curl -d page=2 https://httpbin.org/get" },
        "The same pieces go on the query string instead, and nothing goes in the body: `GET https://httpbin.org/get?q=curl&page=2`.",
      ],
    },
    {
      title: "Options a browser will not take",
      blocks: [
        {
          code:
            "curl -k -L --retry 3 --max-time 5 \\\n  -H 'accept: application/json' \\\n  -H 'origin: https://app.example.com' \\\n  -H 'sec-fetch-mode: cors' \\\n  'https://httpbin.org/get?page=2'",
        },
        "Under the command the page says:",
        {
          code:
            "The browser cannot do all of this:\n-k — A browser will not skip its certificate checks for a page that asks\n--retry — The request is made once and nothing here retries it\n-H — A browser sets these itself and will not take them: origin, sec-fetch-mode",
        },
        "What is sent is a GET with the `accept` header that follows redirects and gives up after five seconds. For a whole session rather than one request, [the HAR viewer](/har) reads the file a network panel exports.",
      ],
    },
  ],
  problems: [
    {
      title: "It works in a terminal and fails here",
      blocks: [
        "A refused fetch tells the page only that it failed, so the page names the usual cause: CORS. A page may read a response from another site only if that site answers with `Access-Control-Allow-Origin`, and a request carrying `Authorization` or a JSON `Content-Type` is first sent as an `OPTIONS` preflight, which the server has to answer as well. curl in a terminal is under no such rule. A host that is down looks the same from here.",
      ],
    },
    {
      title: "`-d` turns the request into a form POST",
      blocks: [
        "`-d` makes curl send a POST with `Content-Type: application/x-www-form-urlencoded`, even when the body is JSON. Add `-H 'Content-Type: application/json'`, or use `--json`, which sets that and `Accept` for you. curl will send a body with `-X GET`; a browser will not, so the page takes the body off and says so.",
      ],
    },
    {
      title: "Quoting and shell variables",
      blocks: [
        "Inside single quotes bash takes everything literally except another single quote, which is why the page writes `it's` as `'it'\\''s'`. With no shell here, Send sends `\"Bearer $TOKEN\"` as the literal text `$TOKEN`, but an edit keeps it double-quoted for a terminal to expand. PowerShell is refused: what it passes to `curl.exe` depends on its version.",
      ],
    },
  ],
  faq: [
    {
      question: "Does Send go through this site's server?",
      answer:
        "No. The browser's `fetch` goes from this tab straight to the address in the command, and this site sees neither the request nor the response. The target sees a request from a browser, with the headers a browser adds, `Origin` naming this site among them.",
    },
    {
      question: "Does the share link include the token in my command?",
      answer:
        "Yes. The whole command is kept in the part of the address after `#`, so anyone given the link can read an `Authorization` header or a password in it. Browsers do not send that part to a server, but it is in the link all the same, so take secrets out before sharing.",
    },
    {
      question: "Why does a redirect come back with no status?",
      answer:
        "Without `-L` the page asks `fetch` not to follow redirects, as curl does not, and a browser then hands back a filtered response with no status, headers or body, only the fact that it was a redirect. Add `-L`, Follow redirects in the builder, to see where it leads.",
    },
  ],
  references: [
    { title: "curl man page", url: "https://curl.se/docs/manpage.html" },
    { title: "Everything curl", url: "https://everything.curl.dev/" },
    {
      title: "Cross-Origin Resource Sharing (CORS), MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS",
    },
    {
      title: "Forbidden request header, MDN",
      url: "https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header",
    },
    { title: "Fetch Standard, WHATWG", url: "https://fetch.spec.whatwg.org/" },
  ],
} satisfies PageContent;
