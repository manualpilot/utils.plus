import type { PageContent } from "../page-document.ts";

export default {
  related: ["/countries", "/time", "/qr-code"],
  howItWorks: [
    "Pick a country and type a number, and the page parses it against Google's libphonenumber numbering plans, as the `libphonenumber-js` package carries them. A number starting with `+` names its own country and moves the picker to it; one without is read as a national number of the country showing, and is spaced as you type the way that country writes numbers. There are 245 dialling regions, a few of them, such as Ascension Island, with no ISO country code of their own.",
    "The page says whether the number is valid and, if not, whether its length is at least possible there. It names the line type, writes the number as E.164, international, national and RFC 3966, and shows how to dial it from your own country. It then takes it apart into calling code, national number, area code, national destination code and extension.",
    "A valid number is also looked up in three tables Google publishes beside the plans: where the range was issued, which operator it was issued to, and which time zones it can be in. They come from a fixed release of google/libphonenumber taken when the site was built.",
    "Short codes such as `000`, `112` and `911` are read against the country showing and answered as what they are: whether they reach an emergency service, what they cost, and whether they belong to one carrier.",
  ],
  examples: [
    {
      title: "A London landline",
      blocks: [
        "United Kingdom, `020 7946 0018`:",
        {
          code:
            "E.164          +442079460018\nInternational  +44 20 7946 0018\nNational       020 7946 0018\nRFC 3966       tel:+442079460018\nType           Fixed line\nArea code      20\nLocation       London",
        },
        "`+44 (0)20 7946 0018`, a common way of writing it that cannot be dialled as it stands, gives the same result.",
      ],
    },
    {
      title: "The zero Italy keeps",
      blocks: [
        "Italy, `02 1234 5678`:",
        {
          code:
            "E.164          +390212345678\nInternational  +39 02 1234 5678\nArea code      02\nLocation       Milan",
        },
        "In Germany `030 123456` becomes `+49 30 123456`, the 0 being a trunk prefix dialled only inside the country. In Italy the 0 is part of the number and stays.",
      ],
    },
    {
      title: "Short codes",
      blocks: [
        "`000` with Australia selected is Emergency and Toll free. `112` is an emergency number in Australia and Germany alike, while `611` in the United States is Carrier specific. None has an E.164 form, a short code being dialled only inside its own country.",
      ],
    },
  ],
  problems: [
    {
      title: "The trunk prefix and +44 (0)",
      blocks: [
        "Many countries put a trunk prefix in front of national numbers, 0 in the United Kingdom, Germany and Australia and 8 in Kazakhstan, and it is dropped after the country code. In `+44 (0)20` the 0 is for callers inside the country and is not part of the number. The page accepts that style and removes the 0.",
      ],
    },
    {
      title: "Valid is not the same as in service",
      blocks: [
        "Valid means the number falls in a range the plan allocates; nothing here dials it or asks a network. Possible means only that the length fits. `07700 900123` in the United Kingdom is Possible and Not a valid number: it has the length of a British mobile but sits in a range Ofcom sets aside for drama.",
      ],
    },
    {
      title: "The carrier may not carry the number",
      blocks: [
        "The Carrier row names the operator the range was issued to. Numbers can be ported between operators and keep their digits, so `0412 345 678` in Australia reads as Optus whoever the line is with today.",
      ],
    },
    {
      title: "Countries that share a calling code",
      blocks: [
        "+1 is shared by 25 regions, and only the digits after it tell them apart: `+1 416 555 0199` moves the picker to Canada and reads as Ontario, `+1 212 555 0199` to the United States and New York, NY. +7 is Russia and Kazakhstan, and +44 also covers Guernsey, the Isle of Man and Jersey. The [country lookup](/countries) lists each country's dialling prefixes.",
      ],
    },
  ],
  faq: [
    {
      question: "What is E.164?",
      answer:
        "The ITU-T recommendation for international numbering, and the form it defines: a plus, the country calling code and the national number, with no spaces and no trunk prefix, at most 15 digits in all. `+442079460018` is one. It is the form to store, since every other format can be written from it.",
    },
    {
      question: "What is the RFC 3966 format for?",
      answer:
        "It is the number as a `tel:` URI, such as `tel:+442079460018`, which is what a link needs so that tapping it offers to call. An extension goes on the end as `;ext=`.",
    },
    {
      question: "Does the location show where the phone is?",
      answer:
        "No. It is where the number's range was issued, according to Google's geocoding data, which for a landline is usually a town and for a mobile often nothing at all.",
    },
    {
      question: "How current is the data?",
      answer:
        "As current as the site's last build, whose date the mark beside the title gives. A range allocated or reassigned since then can read as invalid, or with an old location or carrier, until the site is built with newer data.",
    },
  ],
  references: [
    { title: "google/libphonenumber on GitHub", url: "https://github.com/google/libphonenumber" },
    {
      title: "Falsehoods programmers believe about phone numbers, libphonenumber",
      url: "https://github.com/google/libphonenumber/blob/master/FALSEHOODS.md",
    },
    { title: "libphonenumber-js on GitHub", url: "https://github.com/catamphetamine/libphonenumber-js" },
    { title: "ITU-T Recommendation E.164", url: "https://www.itu.int/rec/T-REC-E.164" },
    { title: "List of ITU-T E.164 assigned country codes", url: "https://www.itu.int/pub/T-SP-E.164D" },
    { title: "RFC 3966, The tel URI for Telephone Numbers", url: "https://www.rfc-editor.org/rfc/rfc3966" },
  ],
} satisfies PageContent;
