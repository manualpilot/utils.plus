import type { PageContent } from "../page-document.ts";

export default {
  related: ["/curl", "/url", "/json", "/jwt"],
  howItWorks: [
    "Choose or drop a `.har` file of up to 32 MB. Recorders disagree about the optional half of the format, so every field is read where it is present and left out where it is not, and only a file that is not JSON, or has no `log.entries`, is refused. `-1` in a size or a timing means it was not measured and a status of 0 means no response came back, so neither is read as a number.",
    "Each request is a card showing its status, method, path, host, resource type, size and duration. Opened, it has four tabs: an overview, the request's query string, headers, cookies and body, the response's headers, cookies and body, and the timings as a bar. JSON bodies are indented, text sent as base64 is decoded, images are drawn, and a body is cut at 20,000 characters with a line saying so.",
    "The filter is a stack of conditions that must all hold, each a field, a comparator and a value, such as Status is at least 400 or Response header contains gzip. Text comparisons ignore case. A header condition is asked of every header the request carried, as `name: value`, so a negative one such as does not contain holds only when none of them matches. The list stops at 200 cards and says how many matched.",
    "The share link carries the filter and never the recording, so a colleague holding the same file can open the same question.",
  ],
  examples: [
    {
      title: "Failures from one API",
      blocks: [
        "A recording of five requests:",
        {
          code:
            "200  GET https://shop.example.com/\n500  GET https://api.example.com/v1/cart\n200  GET https://api.example.com/v1/items?page=2\n404  GET https://cdn.example.com/app.js\n  —  GET https://api.example.com/v1/track   (no response)",
        },
        "Two conditions, Status is at least 400 and Host contains api, leave `1 of 5 requests match`: the 500 from `/v1/cart`. The 404 from the CDN drops out at the second row. The request to `/v1/track` drops out at the first, because it has no status to compare rather than a status of 0.",
      ],
    },
    {
      title: "Where the time went",
      blocks: [
        "One entry's timings, as the file has them:",
        {
          code:
            "\"time\": 240.3,\n\"timings\": { \"blocked\": 2, \"dns\": 12, \"connect\": 40, \"ssl\": 25, \"send\": 0.3, \"wait\": 180, \"receive\": 6 }",
        },
        "The Timings tab draws:",
        {
          code:
            "Blocked  2 ms\nDNS      12 ms\nConnect  15 ms\nTLS      25 ms\nSend     0.30 ms\nWait     180 ms\nReceive  6 ms\n240 ms measured, 240 ms recorded in all",
        },
        "HAR 1.2 counts the TLS handshake inside `connect`, so the page draws 15 ms of connection and 25 of TLS rather than the handshake twice. A Connect condition still compares against the 40 in the file.",
      ],
    },
  ],
  problems: [
    {
      title: "The recording holds your session",
      blocks: [
        "A HAR saved with sensitive data carries `Cookie` and `Authorization` headers, `Set-Cookie` responses and any tokens in bodies or query strings. Chrome's Network panel exports a sanitised HAR without those three headers by default and the full one only when asked. Before sending a file on, Request header contains authorization and Request cookie contains the name of your session cookie show what it still carries, and a bearer token that is a JWT can be read on [the JWT page](/jwt).",
      ],
    },
    {
      title: "A body says None recorded",
      blocks: [
        "The card shows what the file holds and nothing more: a body the recorder did not keep is None recorded rather than an empty response. A response stored as base64 is decoded only when its type says it is text; other binary types are named rather than shown. The indented JSON is the page's doing, and the card says the file holds it as it was served.",
      ],
    },
    {
      title: "A filter on status skips failed requests",
      blocks: [
        "A request that got no answer, such as one refused or cancelled, is written with status 0 and shown as —. The page reads it as having no status, so Status is less than 300 does not count failures as successes, and Status is at least 400 does not find them either. The Error field holds the recorder's reason where it wrote one.",
      ],
    },
  ],
  faq: [
    {
      question: "Is the HAR file uploaded anywhere?",
      answer:
        "No. The file is read and parsed in this tab and nothing leaves it: the page makes no request to any other host, and the share link carries only the filter. The bin on the File card closes the recording and drops it from the page.",
    },
    {
      question: "How do I save a HAR file?",
      answer:
        "In Chrome, open the Network panel in DevTools, reload the page so its requests are recorded, and press Export HAR (sanitized) in the panel's toolbar. In Firefox, right-click the request list in the Network Monitor and choose Save All As HAR.",
    },
    {
      question: "Which recorders does it read?",
      answer:
        "Any that writes HAR, browsers and debugging proxies alike. What a recorder left out is simply not shown. Chrome names each request's resource type itself; for other recorders the page works it out from the MIME type, or from the file extension where there is no type.",
    },
  ],
  references: [
    {
      title: "HTTP Archive (HAR) format, W3C draft",
      url: "https://w3c.github.io/web-performance/specs/HAR/Overview.html",
    },
    {
      title: "Save all network requests to a HAR file, Chrome DevTools",
      url: "https://developer.chrome.com/docs/devtools/network/reference#save-as-har",
    },
    {
      title: "Network request list, Firefox DevTools",
      url: "https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/request_list/index.html",
    },
  ],
} satisfies PageContent;
