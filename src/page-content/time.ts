import type { PageContent } from "../page-document.ts";

export default {
  related: ["/cron", "/unique-id", "/jwt", "/countries"],
  howItWorks: [
    "Three modes share the page, switched beside the title. Instant writes a timestamp out in each time zone you pick, your own and UTC to begin with. Duration counts a length of time forwards and back from an instant, and Between counts the time from one instant to another. An empty instant box follows the clock.",
    "The instant box takes Unix time in seconds, milliseconds, microseconds or nanoseconds, ISO 8601, RFC 2822 and HTTP dates. A bare number's unit is decided by its digits, up to 11 for seconds and up to 14 for milliseconds, and the line above the results says what it was taken to be. Each zone card gives RFC 2822, ISO 8601 in extended and basic form, and the ISO week and ordinal dates, from the browser's own copy of the IANA time zone database. Zones can be found by country, city or abbreviation as well as by name, so `Wellington` finds Pacific/Auckland, and a country typed in full comes before a name that only begins with it: `India` lists Asia/Kolkata above the Indian Ocean zones.",
    "A duration can be ISO 8601 (`P1Y2M3DT4H5M6S`), units (`1h 30m`, `3 days and 4 hours`), a clock (`01:30:00`, or `90:00` as minutes and seconds) or a bare number of seconds; `m` is minutes and `mo` months. Years, months and days are kept apart from hours and below, because only the clock units have a fixed length. A month or a day becomes a number of hours once a zone and a starting point say which one, which is what the Zone picker under Duration and Between is for.",
  ],
  examples: [
    {
      title: "One epoch in several zones",
      blocks: [
        "`1800000000` is read as Unix seconds:",
        {
          code:
            "UTC               2027-01-15T08:00:00Z\nAsia/Tokyo        2027-01-15T17:00:00+09:00\nAmerica/New_York  2027-01-15T03:00:00-05:00\nRFC 2822, Tokyo   Fri, 15 Jan 2027 17:00:00 +0900\nHTTP date         Fri, 15 Jan 2027 08:00:00 GMT\nISO week date     2027-W02-5",
        },
        "`1800000000000` gives the same instant, read as milliseconds.",
      ],
    },
    {
      title: "A day that is 23 hours long",
      blocks: [
        "In Duration mode with the zone set to Europe/Berlin and the instant `2026-03-28T12:00:00+01:00`:",
        {
          code:
            "1d    After  2026-03-29T12:00:00+02:00   Clock  23:00:00\n24h   After  2026-03-29T13:00:00+02:00   Clock  24:00:00",
        },
        "Berlin's clocks go forward at 02:00 on 29 March 2026, so a calendar day from noon to noon is 23 hours. A [cron schedule](/cron) set for 02:30 has nothing to match that night.",
      ],
    },
    {
      title: "A month from 31 January",
      blocks: [
        "In UTC, `1mo` after `2026-01-31T12:00:00Z` is `2026-02-28T12:00:00Z`, 28 days later, because February has no 31st and the date goes to its last day. `30d` lands on 2 March instead.",
      ],
    },
  ],
  problems: [
    {
      title: "Seconds or milliseconds",
      blocks: [
        "`date +%s` and the `exp` claim of a [JSON Web Token](/jwt) count seconds, while JavaScript's `Date.now()` counts milliseconds. The page tells them apart by length, so a count of milliseconds before 3 March 1973, which has 11 digits or fewer, is read as seconds: `86400000`, one day after the epoch in milliseconds, comes out as 27 September 1972.",
      ],
    },
    {
      title: "A date with no offset",
      blocks: [
        "`2026-03-29` is read as midnight UTC, but `2026-03-29T00:00` as midnight in your own zone. That is how JavaScript parses ISO strings, and the line above the results says which happened; add `Z` or an offset to remove the doubt.",
      ],
    },
    {
      title: "Days and hours across a clock change",
      blocks: [
        "From midnight on 28 March to midnight on 30 March 2026 in Europe/Berlin, Between gives `P2D`, two calendar days, and 47 hours in total. Dividing by 86400 seconds to count days goes wrong wherever clocks change.",
      ],
    },
    {
      title: "P1M is not PT1M",
      blocks: [
        "In an ISO 8601 duration `M` before the `T` means months and after it minutes, so `P1M` is a month and `PT1M` a minute. A fraction of a month, such as `1.5mo`, is refused, and `36h` stays 36 hours rather than becoming a day and a half.",
      ],
    },
    {
      title: "Week numbers at the turn of the year",
      blocks: [
        "An ISO week belongs to the year that holds its Thursday, so 1 January 2027 is `2026-W53-5` and 30 December 2024 is `2025-W01-1`. Pairing the week number with the calendar year puts such dates a year out.",
      ],
    },
  ],
  faq: [
    {
      question: "What is the difference between ISO 8601 and RFC 3339?",
      answer:
        "RFC 3339 is a profile of ISO 8601 for internet protocols. It requires a full date and time with an offset or `Z`, such as `2027-01-15T08:00:00Z`, and leaves out week dates, ordinal dates and the basic format. The ISO 8601 extended line on each zone card is also valid RFC 3339.",
    },
    {
      question: "What is the Unix epoch?",
      answer:
        "Midnight UTC on 1 January 1970, from which Unix time counts seconds. Leap seconds are not counted, so every day is exactly 86400 seconds long. Negative numbers are the years before it: `-1` is `1969-12-31T23:59:59Z`.",
    },
    {
      question: "What happens in 2038?",
      answer:
        "A signed 32-bit count of seconds runs out at `2147483647`, which is `2038-01-19T03:14:07Z`, and systems that still store Unix time that way wrap round to 1901. The page reads well past it, to the end of the year 9999.",
    },
  ],
  references: [
    { title: "RFC 3339, Date and Time on the Internet: Timestamps", url: "https://www.rfc-editor.org/rfc/rfc3339" },
    { title: "Time zone database, IANA", url: "https://www.iana.org/time-zones" },
    { title: "Date and Time Formats, W3C note on ISO 8601", url: "https://www.w3.org/TR/NOTE-datetime" },
    {
      title: "RFC 5322, Internet Message Format (date and time, section 3.3)",
      url: "https://www.rfc-editor.org/rfc/rfc5322",
    },
    { title: "RFC 9110, HTTP Semantics (HTTP-date, section 5.6.7)", url: "https://www.rfc-editor.org/rfc/rfc9110" },
    {
      title: "Date Time String Format, ECMAScript specification",
      url: "https://tc39.es/ecma262/#sec-date-time-string-format",
    },
  ],
} satisfies PageContent;
