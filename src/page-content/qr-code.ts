import type { PageContent } from "../page-document.ts";

export default {
  related: ["/url", "/otp", "/image", "/phone-number"],
  howItWorks: [
    "Pick a content type and fill in its fields; the code is redrawn on every keystroke. Under it is the exact text it holds, the only way to check a QR code by eye, and a line such as `Version 4 · 33×33 modules · 44 bytes` that shows the code growing with the text.",
    {
      table: [
        ["Content type", "What the code holds"],
        ["Plain Text", "the text as typed"],
        ["URL", "the address as a browser reads it, with `https://` added when there is no scheme"],
        ["WiFi", "`WIFI:T:WPA;S:name;P:key;;`, plus `H:true` for a hidden network"],
        ["vCard", "a vCard 3.0 contact card"],
        ["Email", "a `mailto:` address, with the subject and message percent-encoded"],
        ["Phone Call", "a `tel:` number with the spaces, brackets and dashes taken out"],
        ["SMS", "`SMSTO:number:message`"],
      ],
    },
    "Fields are checked as you type, and a wrong one takes the code away until it is put right: a network name over 32 bytes, a WPA key outside 8 to 63 characters, an email address with no `@`, a number with letters in it.",
    "Error correction is Low (7%), Medium (15%, the default), Quartile (25%) or High (30%): how much of the code can be damaged and still read, paid for in size. The code is always black on white with the four-module quiet zone the format requires. Download it as an SVG or as a PNG at least 640 pixels across. Everything is encoded in the tab; no image is fetched from a QR service. For an authenticator's `otpauth://` code, [the one-time password page](/otp) draws one from its own settings.",
  ],
  examples: [
    {
      title: "A network whose name and key have punctuation in them",
      blocks: [
        "Network name `Café; Guest`, security WPA/WPA2/WPA3, password `p@ss:word,1`:",
        { code: "WIFI:T:WPA;S:Café\\; Guest;P:p@ss\\:word\\,1;;" },
        "Version 4, 33×33 modules, 44 bytes. The semicolon, colon and comma are escaped with a backslash, because the format gives each of them a meaning.",
      ],
    },
    {
      title: "A contact card at each correction level",
      blocks: [
        "First name Ada, last name Lovelace, organisation `Analytical Engines, Ltd`, phone `+44 (20) 7946 0958`, email `ada@example.com`, website `example.com`:",
        {
          code:
            "BEGIN:VCARD\nVERSION:3.0\nN:Lovelace;Ada;;;\nFN:Ada Lovelace\nORG:Analytical Engines\\, Ltd\nTEL;TYPE=CELL:+442079460958\nEMAIL;TYPE=INTERNET:ada@example.com\nURL:https://example.com/\nEND:VCARD",
        },
        "193 bytes with its CRLF line endings. That is version 9 at Low, 10 at Medium, 12 at Quartile and 14 at High, where the code is 73 modules across instead of 53.",
      ],
    },
    {
      title: "A URL as the phone will read it",
      blocks: [
        { code: "Example.COM/a page?q=1 2" },
        { code: "https://example.com/a%20page?q=1%202" },
        "The scheme is added, the host lower-cased and the spaces percent-encoded before anything is encoded, so the text under the code is what a scanner will open. [The URL parser](/url) takes the same address apart.",
      ],
    },
  ],
  problems: [
    {
      title: "The phone will not join the network",
      blocks: [
        "A WPA key must be 8 to 63 characters or exactly 64 hex digits, and a WEP key 5 or 13 characters or 10 or 26 hex digits; the page marks any other length. A payload written by hand elsewhere can fail on a `;`, `:`, `,`, `\\` or `\"` in the name or key that was not escaped.",
      ],
    },
    {
      title: "Too much text for a QR code",
      blocks: [
        "The largest code, version 40, holds 2,953 bytes at Low, 2,331 at Medium, 1,663 at Quartile and 1,273 at High. Every character is encoded as bytes, so a letter such as `é` costs two and an emoji four, and digits are not packed more tightly. When the chosen level cannot hold the text but Low can, the page says so.",
      ],
    },
    {
      title: "A printed code that will not scan",
      blocks: [
        "Scanners find a code by its contrast and its empty margin, so recolouring it light on dark, printing it pale or cropping into the white border can stop it being read. For a code that will be scuffed or partly covered, choose Quartile or High.",
      ],
    },
  ],
  faq: [
    {
      question: "Do these QR codes expire?",
      answer:
        "No. The code holds the text itself, not a link to a redirecting service, so it works as long as the address, network or number in it does. Nothing is tracked and nothing needs renewing.",
    },
    {
      question: "Which error correction level should I use?",
      answer:
        "Medium suits a code shown on a screen or printed cleanly. High survives the most damage, for packaging or anything handled, at the cost of a denser pattern. Low fits the most text into the smallest code.",
    },
    {
      question: "Should I download the SVG or the PNG?",
      answer:
        "The SVG for print and design work, since it scales to any size without blurring and carries its own white background. The PNG where only a bitmap will do, such as a slide or a chat message; each module is a whole number of pixels, so its edges stay sharp.",
    },
    {
      question: "Why does the phone still ask for the WiFi password?",
      answer:
        "When the password box is empty the code carries no key, so the phone knows the network but has to ask for one. Fill in the password and pick the security type the router uses; None is only for a network with no password at all.",
    },
  ],
  references: [
    {
      title: "ZXing, Barcode Contents (WIFI, MECARD, SMSTO)",
      url: "https://github.com/zxing/zxing/wiki/Barcode-Contents",
    },
    { title: "RFC 2426, vCard MIME Directory Profile (vCard 3.0)", url: "https://www.rfc-editor.org/rfc/rfc2426" },
    { title: "RFC 3966, The tel URI for Telephone Numbers", url: "https://www.rfc-editor.org/rfc/rfc3966" },
    { title: "RFC 6068, The mailto URI Scheme", url: "https://www.rfc-editor.org/rfc/rfc6068" },
    { title: "Denso Wave, QR Code versions and capacity", url: "https://www.qrcode.com/en/about/version.html" },
  ],
} satisfies PageContent;
