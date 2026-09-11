import type { PageContent } from "../page-document.ts";

export default {
  related: ["/time", "/mock", "/password", "/hasher"],
  howItWorks: [
    "Pick a type and a count up to 1,000 and the batch is written one per line; any change of setting draws it again, and the refresh button draws a fresh one. The random parts come from the browser's cryptographic generator.",
    "The types differ in what they carry besides randomness. Those with the time first sort by age as text, and the two decimal ones as numbers.",
    {
      table: [
        ["Type", "Length", "Time inside", "Time first"],
        ["UUID v4, v8", "36", "None", "No"],
        ["UUID v3, v5", "36", "None, a hash of the name", "No"],
        ["UUID v1, v2", "36", "100 ns ticks since 1582", "No"],
        ["UUID v6", "36", "The same ticks, reordered", "Yes"],
        ["UUID v7, TypeID", "36; 26 after the prefix", "Milliseconds since 1970", "Yes"],
        ["ULID", "26", "Milliseconds since 1970", "Yes"],
        ["ObjectId, XID", "24, 20", "Seconds since 1970", "Yes"],
        ["KSUID", "27", "Seconds since 13 May 2014", "Yes"],
        ["Firebase PushID", "20", "Milliseconds since 1970", "Yes"],
        ["CUID", "25", "Milliseconds since 1970, in base 36", "Yes"],
        ["Snowflake, Sonyflake", "Up to 19 digits", "Milliseconds since 2010, 10 ms ticks since 2014", "Yes"],
        ["NanoID, CUID2", "21, 24", "None readable", "No"],
      ],
    },
    "UUID v3 and v5 take a namespace, with DNS, URL, OID and X500 offered, and a name, and make exactly one, since the pair always hashes to the same UUID. Version 2 writes a POSIX UID, GID or organisation number over the low time bits, and TypeID takes an optional lower-case prefix. Versions 1, 2 and 6 use a random node with the multicast bit set rather than a network card's address, and Snowflake always writes machine 1.",
  ],
  examples: [
    {
      title: "The same name always gives the same UUID",
      blocks: [
        {
          code:
            "Namespace  6ba7b810-9dad-11d1-80b4-00c04fd430c8  (DNS)\nName       example.com\n\nv5         cfbff0d1-9375-5685-968c-48ce8b15ae17\nv3         9073926b-929f-31c2-abc9-fad77ae3e8eb",
        },
        "These are the values Python's `uuid.uuid5` and `uuid.uuid3` give for the same pair, and they will be the same next year. A trailing dot or a capital letter in the name gives a different UUID.",
      ],
    },
    {
      title: "One instant in six formats",
      blocks: [
        "Generated with the clock at 12:00:00 UTC on 11 September 2026, TypeID with the prefix `user`:",
        {
          code:
            "UUID v7    01a09056-c200-748e-8926-362e9ced0e80\nULID       01M285DGG0F6M3KXH68MAG3CGX\nTypeID     user_01m285dgg0ferak2xnyxer2d8n\nObjectId   6aa3ed4020abfa2ecd2c3a48\nKSUID      3JBIOCfZbBK4JAF2YEGa1x3AfbN\nSnowflake  2098381037368250368",
        },
        "The UUID's first twelve hex digits, `01a09056c200`, are 1789128000000, the milliseconds since 1970, which the [time converter](/time) reads back as that instant. The first ten characters of the ULID and of the TypeID after its prefix are the same number in base32, and the ObjectId opens on the seconds, `6aa3ed40`. The Snowflake is the milliseconds since Twitter's 2010 epoch shifted left 22 bits over machine 1 and sequence 0; the next two in that millisecond end in 369 and 370.",
      ],
    },
  ],
  problems: [
    {
      title: "UUID v7s from two places are not in the order they were made",
      blocks: [
        "A batch from this page is in order, because inside one millisecond it counts rather than redraws. A v7 or TypeID spends the 12 bits after its version and the next 30 on a counter that starts at random each millisecond, the first of the methods RFC 9562 gives; a ULID adds one to its 80 random bits, the ULID spec's monotonic mode; and a v6 counts through the 100 ns ticks a millisecond holds while its clock sequence stays put. That counter belongs to one tab, though. IDs from two tabs or two servers count from starts of their own and interleave at random within a millisecond they share, and a clock set back hands out IDs that sort before ones it already gave.",
      ],
    },
    {
      title: "Snowflake IDs change in JavaScript",
      blocks: [
        "A Snowflake is a 64-bit integer, and a JavaScript number is exact only up to 9007199254740991. `JSON.parse` turns 2098381037368250368 into 2098381037368250400 without complaint, which is why APIs that issue them usually send them as strings too.",
      ],
    },
  ],
  faq: [
    {
      question: "Which UUID version should I use?",
      answer:
        "Version 4 when all you need is uniqueness. Version 7 for database keys, since each lands at the end of a B-tree index where a v4 lands anywhere in it, and for anything you will sort by creation. Version 5 when the same input must always produce the same ID. Versions 1, 2 and 6 are for systems that already expect them.",
    },
    {
      question: "Can two random UUIDs collide?",
      answer:
        "In principle. A v4 has 122 random bits, so you would need about 2.7 quintillion of them before the odds of any two matching reach one half. Duplicates met in practice come from broken random number generators and copied values, not from chance.",
    },
    {
      question: "What is the difference between UUID v3 and v5?",
      answer:
        "The hash: v3 uses MD5 and v5 uses SHA-1 truncated to 128 bits, and both then have their version and variant bits set. RFC 9562 says to use v5 where possible. Neither is a way to hide the name, since anyone who can guess it can compute the same UUID.",
    },
    {
      question: "Does a time-ordered ID reveal when it was made?",
      answer:
        "Yes. Anyone holding a UUID v1, v6 or v7, a ULID, TypeID, KSUID, ObjectId, XID, PushID, CUID, Snowflake or Sonyflake can read when it was made, to the second or better. Use v4 or NanoID where that would leak something, such as the age of an account.",
    },
  ],
  references: [
    { title: "RFC 9562: Universally Unique IDentifiers (UUIDs)", url: "https://www.rfc-editor.org/rfc/rfc9562" },
    { title: "ULID specification", url: "https://github.com/ulid/spec" },
    { title: "TypeID specification", url: "https://github.com/jetify-com/typeid" },
    { title: "KSUID", url: "https://github.com/segmentio/ksuid" },
    { title: "MongoDB ObjectId", url: "https://www.mongodb.com/docs/manual/reference/method/ObjectId/" },
    { title: "Nano ID", url: "https://github.com/ai/nanoid" },
  ],
} satisfies PageContent;
