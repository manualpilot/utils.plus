import type { PageContent } from "../page-document.ts";

export default {
  related: ["/codec", "/curl", "/har", "/qr-code"],
  howItWorks: [
    "The address is the one thing the page keeps. The components, the query box and the parameter rows are read back out of it on every keystroke, and each writes only its own piece back, so changing the port rewrites the port and nothing else. A pasted address is left byte for byte until something in it is edited.",
    "The components show the address exactly as it is spelled, escapes included. The parameter rows are the one place that decodes: `caf%C3%A9+latte` appears as `café latte`, and what you type there is escaped on the way back with `encodeURIComponent`. Only the parameter being edited is rewritten; the rest keep their original spelling.",
    "The parser is looser than the URL grammar on purpose. Whatever comes before the first colon is the scheme, so a mistyped scheme, a host with a space in it or a port above 65535 stays in its box with a message beside it instead of emptying the page. Any scheme works, `mailto:` included; credentials split at the last `@`, and a bracketed IPv6 host stays whole.",
  ],
  examples: [
    {
      title: "The address the page opens with",
      blocks: [
        { code: "https://example.com:8443/api/v2/search?q=caf%C3%A9+latte&limit=20&tags=hot,fast#results" },
        {
          code:
            "Scheme    https\nHost      example.com\nPort      8443\nPath      /api/v2/search\nQuery     q=caf%C3%A9+latte&limit=20&tags=hot,fast\nFragment  results\n\nq         café latte\nlimit     20\ntags      hot,fast",
        },
        "The query box holds the query as written; the three rows under it are the same parameters decoded.",
      ],
    },
    {
      title: "Editing one parameter",
      blocks: [
        "Typing `flat white & cake` into the value of `q` rewrites the address as:",
        { code: "https://example.com:8443/api/v2/search?q=flat%20white%20%26%20cake&limit=20&tags=hot,fast#results" },
        "The spaces become `%20` and the ampersand `%26`, so it cannot be read as the start of another parameter. `tags=hot,fast` keeps its bare comma because nobody touched it; editing that row would write `hot%2Cfast`.",
      ],
    },
    {
      title: "A URL inside a URL",
      blocks: [
        {
          code:
            "https://login.example.com/authorize?next=https%3A%2F%2Fapp.example.com%2Finbox%3Ftab%3D2%26sort%3Ddate",
        },
        "The `next` row reads `https://app.example.com/inbox?tab=2&sort=date`. Paste that into the address to take the inner URL apart in turn.",
      ],
    },
  ],
  problems: [
    {
      title: "`+` or `%20`",
      blocks: [
        "In a query, `+` means a space, because HTML forms encode queries that way and servers and `URLSearchParams` decode them so. Anywhere else in a URL, `+` is a plus. So in `https://example.com/c++/notes?lang=c++` the path keeps its pluses while the parameter reads as `c` and two spaces. A literal plus in a value must be `%2B`; typing `1+1` into a row writes `1%2B1`. Base64 suffers most, its alphabet using `+`; the [codec](/codec) decodes a Base64 value pasted with its `%2B` escapes still in it. The rows write a space as `%20`, which means a space in a query and everywhere else too.",
      ],
    },
    {
      title: "Values that were encoded twice",
      blocks: [
        "If a decoded value still has escapes in it, something encoded it twice. `?q=caf%25C3%25A9%2520latte` shows `caf%C3%A9%20latte` in its row: `%25` is an escaped `%`. The fix belongs in whatever built the URL, which should encode each value once, just before joining it in.",
      ],
    },
    {
      title: "`encodeURI` and `encodeURIComponent`",
      blocks: [
        "`encodeURI` is for a whole address, so it leaves the characters that structure one alone. Given `a&b=c d/e?f#g` it returns `a&b=c%20d/e?f#g`, and as a parameter value that adds a parameter and cuts the query short at the `#`. `encodeURIComponent` escapes them all, `a%26b%3Dc%20d%2Fe%3Ff%23g`, which is what a value needs and what the rows use.",
      ],
    },
    {
      title: "“A percent escape here opens nothing”",
      blocks: [
        "A `%` must be followed by two hex digits. `?discount=50%` has one that is not, so the row shows `50%` as written with that message beside it. Written correctly the value is `50%25`.",
      ],
    },
  ],
  faq: [
    {
      question: "Why is the path not decoded?",
      answer:
        "Because decoding a path loses information: `%2F` is a slash inside one segment and `/` separates segments, and after decoding the two are the same character. The components show the address as it is spelled; only the query rows decode, where each value is read on its own.",
    },
    {
      question: "Does the page normalise the URL as a browser would?",
      answer:
        "No. The WHATWG parser behind `new URL` lowercases the scheme and host, drops a default port and resolves `..`, turning `HTTPS://Example.COM:443/a/../b` into `https://example.com/b`. This page leaves the address as typed and rewrites only the piece being edited, so what you see is what was pasted.",
    },
    {
      question: "What is the difference between `?debug` and `?debug=`?",
      answer:
        "The first is a flag with no value, the second a parameter whose value is empty. `URLSearchParams` reads both as an empty string, but they are different addresses, and the page keeps them apart: editing another parameter leaves `debug` without an `=`, and typing a value into its row gives it one.",
    },
  ],
  references: [
    { title: "RFC 3986: URI Generic Syntax", url: "https://www.rfc-editor.org/rfc/rfc3986" },
    { title: "WHATWG URL Standard", url: "https://url.spec.whatwg.org/" },
    {
      title: "WHATWG URL Standard: application/x-www-form-urlencoded",
      url: "https://url.spec.whatwg.org/#application/x-www-form-urlencoded",
    },
    {
      title: "MDN: encodeURIComponent()",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent",
    },
  ],
} satisfies PageContent;
