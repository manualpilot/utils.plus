import type { PageContent } from "../page-document.ts";

export default {
  related: ["/codec", "/hasher", "/unicode", "/calculator"],
  howItWorks: [
    "Choose a file or drop one on the File card, up to 8 MB of any kind. It is read into the tab and never sent anywhere, and Download writes the same bytes back out with your edits and nothing re-encoded.",
    "Each row is an offset, 8, 16, 24 or 32 bytes in hex with a wider gap every eight, and one glyph per byte. The glyph column can be ASCII, Latin-1 or CP437, the DOS code page with its box-drawing characters; a byte with no glyph is a full stop. It is never UTF-8, because a character spread over several bytes has no single column to stand in.",
    "Looks like, on the File card, matches the first bytes against about fifty signatures, PNG, JPEG, Zip, PDF, ELF, SQLite and WebAssembly among them. After `RIFF` it also reads the four bytes at offset 8, which tell WebP from WAVE and AVI; after `ftyp` it reads the brand, which tells an iPhone's HEIC photo and an AVIF from an MP4 video; and `CA FE BA BE` is named as both formats that use it. A file with no signature whose first 4 KB is printable is called UTF-8 or single-byte text.",
    "The Inspector reads the bytes at the caret as binary, signed and unsigned integers from 8 to 64 bits, 32- and 64-bit floats, a Unix time and a GUID, little-endian unless switched. Below that, a selection, or the next 64 bytes, is decoded as UTF-8 and UTF-16 LE and spelled in hex and Base64.",
    "Typing overwrites the byte under the caret, in hex or, with Type text, as a character of the chosen encoding. The length only changes through Insert bytes and Delete on the Edit card. Find takes hex or text, counts matches up to 1,000 and wraps at either end.",
  ],
  examples: [
    {
      title: "The start of a PNG",
      blocks: [
        {
          code:
            "0000  89 50 4e 47 0d 0a 1a 0a  00 00 00 0d 49 48 44 52  .PNG........IHDR\n0010  00 00 00 01 00 00 00 01  08 06 00 00 00 1f 15 c4  ................",
        },
        "Looks like says “PNG image”. With the caret on offset `0010`, the first byte of the width, the Inspector's UInt32 reads 16777216 in little-endian and 1 in big-endian. PNG stores its numbers big-endian, so this picture is one pixel wide.",
      ],
    },
    {
      title: "An accented letter in three encodings",
      blocks: [
        "The text `café au lait` saved as UTF-8 is 13 bytes, because `é` takes two. The same row in each glyph column:",
        {
          code:
            "63 61 66 c3 a9 20 61 75  20 6c 61 69 74\n\nASCII    caf.. au lait\nLatin-1  cafÃ© au lait\nCP437    caf├⌐ au lait",
        },
        "Selecting the 13 bytes puts `café au lait` on the Inspector's UTF-8 line and `Y2Fmw6kgYXUgbGFpdA==` on its Base64 line.",
      ],
    },
  ],
  problems: [
    {
      title: "A number in the Inspector is absurdly large",
      blocks: [
        "It is being read the wrong way round. PNG, JPEG and network protocols store numbers big-endian, most significant byte first; Zip, BMP and WAV store them little-endian. The page starts in little-endian, so switch the Inspector to Big-endian when the format says so.",
      ],
    },
    {
      title: "Accented letters show as two dots",
      blocks: [
        "UTF-8 writes every character above `U+007F` as two to four bytes, and the glyph column draws one byte at a time, so ASCII gives full stops and Latin-1 gives pairs such as `Ã©`. Select the bytes and read the Inspector's UTF-8 line. Text search follows the glyph column too: `é` in Latin-1 finds the byte `e9`, not UTF-8's `c3 a9`, so search for the hex pair; [the Unicode inspector](/unicode) gives the UTF-8 bytes of any character.",
      ],
    },
    {
      title: "Go to offset lands in the wrong place",
      blocks: [
        "A number made only of digits is read as decimal, even though the offsets are shown in hex: `100` goes to byte 100, which is `0x64`. Write `0x100` for byte 256. Anything with a hex letter in it, such as `1a4`, is read as hex.",
      ],
    },
    {
      title: "An edit cannot be undone",
      blocks: [
        "There is no undo, only Put it back, which throws away every edit and returns the file as it arrived. Typing never changes the file's length, so a wrong keystroke can be fixed by typing the old value over it.",
      ],
    },
  ],
  faq: [
    {
      question: "Can I insert or delete bytes?",
      answer:
        "Yes, from the Edit card: Insert bytes at the caret or at the end, Fill the selection with a repeated pattern, or Delete the selected bytes. Typing in the dump only ever overwrites, so no offset moves unless you ask for it.",
    },
    {
      question: "What can I type into the search box?",
      answer:
        "In hex mode, pairs of digits spaced however you like, with or without `0x` or `\\x` in front and commas between, so `ff d8 ff` and `0xff, 0xd8, 0xff` find the same run. In text mode, characters that the chosen glyph encoding has a byte for.",
    },
    {
      question: "Does Looks like read the whole file?",
      answer:
        "No. It compares magic numbers at fixed offsets, almost all within the first sixteen bytes, and never parses the format. A `.docx` shows as a Zip archive because that is what its first bytes are, and a text file that happens to begin with `BM` is called a BMP image.",
    },
  ],
  references: [
    { title: "Gary Kessler, File Signatures table", url: "https://www.garykessler.net/library/file_sigs.html" },
    { title: "List of file signatures, Wikipedia", url: "https://en.wikipedia.org/wiki/List_of_file_signatures" },
    { title: "RFC 3629, UTF-8", url: "https://www.rfc-editor.org/rfc/rfc3629" },
    { title: "Code page 437, Wikipedia", url: "https://en.wikipedia.org/wiki/Code_page_437" },
    { title: "PNG Specification, Third Edition", url: "https://www.w3.org/TR/png-3/" },
    {
      title: "DataView and byte order, MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView",
    },
  ],
} satisfies PageContent;
