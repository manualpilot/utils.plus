import type { PageContent } from "../page-document.ts";

export default {
  related: ["/phone-number", "/time", "/ip-address", "/unicode"],
  howItWorks: [
    "Pick a country and the page reads back its ISO 3166-1 alpha-2, alpha-3 and numeric codes, Olympic code, internet domain and calling code, then its capital, region, area and coordinates, currencies, languages, native names and demonyms. There are 250 entries, territories and Antarctica among them, with badges for UN membership and independence. A field the data does not record is left out rather than shown empty.",
    "The picker searches every name an entry has, not only the English label: the codes, the capital, the domain, native names and translations into 23 languages, with accents ignored. `Allemagne`, `Deutschland`, `DEU` and `276` all find Germany. A code typed in full ranks first and a name typed in full next, so `Holland` puts the Netherlands above the Caribbean Netherlands, whose Turkish name merely contains it.",
    "The map draws the country with its land neighbours shaded, and clicking any country on it, or any of the border buttons, goes there. Its boundaries come from Natural Earth's 1:10m countries and everything else from the `world-countries` data set, both taken when the site was last built; the mark beside the title gives that date.",
    "Natural Earth's default boundaries show who controls the ground. It also publishes the world as individual countries' law and conventions draw it, and the Point of view picker offers the 31 of those the site carries. The map opens on your own country's view if there is one, judged from your time zone and browser language, and the line under it says which view is drawn.",
  ],
  examples: [
    {
      title: "Germany, found by its French name",
      blocks: [
        "Typing `Allemagne` into the picker finds Germany:",
        {
          code:
            "ISO 3166-1 alpha-2   DE\nISO 3166-1 alpha-3   DEU\nISO 3166-1 numeric   276\nOlympic (IOC)        GER\nInternet domain      .de\nCalling code         +49\nCapital              Berlin\nArea                 357,114 km² (137,882.49 sq mi)",
        },
        "Nine land borders follow as buttons, from Austria to Switzerland.",
      ],
    },
    {
      title: "Taiwan from two points of view",
      blocks: [
        "In the default view Taiwan has its own boundary. With China as the point of view the map draws none, and the line under it reads:",
        { code: "No boundary of its own in that view: this land is inside the shape filed under China." },
        "Taiwan's own view does the reverse and files mainland China inside Taiwan. The codes and facts are the same whichever view is drawn.",
      ],
    },
    {
      title: "Kosovo",
      blocks: [
        "Kosovo's codes read `XK` and `UNK`, labelled “Alpha-2, not ISO-assigned” and “Alpha-3, not ISO-assigned”, with the badge “Code is user assigned”, no numeric code, and “Not a UN member”. ISO 3166-1 assigns Kosovo no code: `XK` is in the range it leaves for users to assign, so it is used by agreement rather than issued by ISO, and `UNK` is the alpha-3 the `world-countries` data carries, where others write `XKX`.",
      ],
    },
  ],
  problems: [
    {
      title: "Two people see different borders",
      blocks: [
        "Because the map opens on the reader's own point of view, one country can be drawn differently for two people. Western Sahara is inside Morocco in Morocco's view and several others, the Falklands are inside Argentina in Argentina's, and Kosovo has no boundary of its own in more than a dozen views. Default shows the boundaries as held on the ground, and the page's link carries the view you chose.",
      ],
    },
    {
      title: "The United Kingdom is GB",
      blocks: [
        "Its codes are `GB` and `GBR`, though its domain is `.uk`; `UK` is reserved in ISO 3166-1 rather than assigned. Typing `UK` into the picker still finds it first, since `UK` is one of its names typed in full and Ukraine's name only begins with those letters, but the code to write down is `GB`.",
      ],
    },
    {
      title: "A calling code is not one country",
      blocks: [
        "The United States shows +1 and 380 dialling prefixes, the area codes of a plan it shares with Canada and much of the Caribbean. Russia and Kazakhstan share +7, and Jersey dials +44 like the United Kingdom. To find which country a number belongs to, parse it on the [phone number page](/phone-number).",
      ],
    },
    {
      title: "A name changed, the code did not",
      blocks: [
        "Eswatini is still `SZ`, Türkiye `TR` and North Macedonia `MK`, and the old names still find them. Codes do sometimes change, as Burma's `BU` became `MM` and Zaire's `ZR` became `CD`, and this page carries only the current ones.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the difference between alpha-2, alpha-3 and numeric codes?",
      answer:
        "Alpha-2 is the two-letter code most software and country domains use, such as `DE`. Alpha-3 is a three-letter code that is easier to recognise, such as `DEU`. The numeric code, such as `276`, matches the UN's M49 area codes and reads the same in any script.",
    },
    {
      question: "How current is the data?",
      answer:
        "As current as the site's last build, whose date the mark beside the title gives. The boundaries come from a fixed Natural Earth release and the facts from the version of `world-countries` the site was built with, so a change made since then waits for a build that takes it in.",
    },
    {
      question: "Why are Hong Kong and Macau among China's neighbours?",
      answer:
        "The data treats both as entries of their own, `HK` and `MO`, so China is listed with 16 land borders rather than the 14 usually counted between sovereign states.",
    },
  ],
  references: [
    {
      title: "Standard country or area codes for statistical use (M49), UN Statistics Division",
      url: "https://unstats.un.org/unsd/methodology/m49/",
    },
    {
      title: "Admin 0 – Countries, Natural Earth",
      url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/",
    },
    {
      title: "Disputed boundaries policy, Natural Earth",
      url: "https://www.naturalearthdata.com/about/disputed-boundaries-policy/",
    },
    {
      title: "Admin 0 – Countries point-of-views, Natural Earth",
      url: "https://www.naturalearthdata.com/blog/admin-0-countries-point-of-views/",
    },
    { title: "mledoze/countries, the data behind world-countries", url: "https://github.com/mledoze/countries" },
    { title: "Root Zone Database, IANA", url: "https://www.iana.org/domains/root/db" },
  ],
} satisfies PageContent;
