import type { PageContent } from "../page-document.ts";

export default {
  related: ["/colour", "/qr-code", "/hex", "/codec"],
  howItWorks: [
    "The picture is read in this tab and never uploaded: the browser decodes it, a canvas encodes the copy you save, and the metadata is read and written by the page's own code. Choose a file, drop one, or paste an image or a `data:` URI. The type is taken from the file's first bytes, not its name, so a `.png` that is really a JPEG is read as a JPEG.",
    "The Transform tab crops, freely or to a shape such as 16:9, resizes, turns, mirrors and flips, and adjusts brightness, contrast, saturation, hue, sepia, greyscale and inversion, with presets as starting points. The preview follows at once; the Save as card re-encodes the picture at its output size a moment later and shows the real file size against the original.",
    "Output is PNG, JPEG, WebP or AVIF, and a format is offered only if this browser's canvas can actually encode it. It starts as the format the picture arrived in, or PNG where the browser cannot write that one. JPEG, WebP and AVIF take a Quality, 85 by default, and a transparent picture saved as JPEG gets a colour behind it, white unless you pick another.",
    "The Metadata tab lists every EXIF tag, grouped into Image, Camera, Location and the rest, with PNG text chunks and JPEG comments, and turns any GPS position into coordinates. The description, artist, copyright, camera, dates, user comment, orientation and location can be edited, and Save with these changes rewrites only the metadata of a JPEG, PNG or WebP; the compressed image data is copied unchanged.",
  ],
  examples: [
    {
      title: "Where a photograph was taken",
      blocks: [
        "A photo whose GPS tags read:",
        {
          code:
            "GPSLatitudeRef   N\nGPSLatitude      51/1, 30/1, 26244/10000\nGPSLongitudeRef  W\nGPSLongitude     0/1, 7/1, 286500/10000",
        },
        "gets a Where it was taken card:",
        {
          code:
            "Latitude      51.500729  (51° 30' 2.62\" N)\nLongitude     -0.124625  (0° 7' 28.65\" W)\nDecimal pair  51.500729, -0.124625",
        },
        "Pasted into a map, the decimal pair lands at the Elizabeth Tower in Westminster.",
      ],
    },
    {
      title: "Taking the location off and nothing else",
      blocks: [
        "For a JPEG, clearing both Latitude and Longitude and pressing Save with these changes writes a file with no GPS directory at all, the timestamp and bearing tags included. Camera make, model and the date taken stay as they were, and everything from the start of the image data to the end of the file is byte for byte the original.",
      ],
    },
  ],
  problems: [
    {
      title: "The resized copy still carries the location",
      blocks: [
        "Carry the metadata over is on by default, so a cropped or resized picture saved as JPEG, PNG or WebP keeps its EXIF, GPS included. Switch it off, clear the two coordinates on the Metadata tab, or turn on Take all of it off before saving.",
      ],
    },
    {
      title: "The picture comes out sideways, or its size looks swapped",
      blocks: [
        "Cameras store the sensor's reading plus an orientation tag, and viewers turn the picture by the tag. This page shows it turned and the File card says so: “Stored as 4032 × 3024, turned by the orientation tag”. A re-encoded copy has its pixels turned and the tag removed. Orientation on the Metadata tab changes only the tag.",
      ],
    },
    {
      title: "The saved file is several times larger",
      blocks: [
        "A picture in a format the browser cannot write, such as GIF, BMP or, in Chrome, AVIF, comes back as PNG, and a photograph stored losslessly is far bigger. The Against the original line shows it; choose JPEG or WebP for photos.",
      ],
    },
    {
      title: "Quality drops a little with every edit",
      blocks: [
        "Every save from the Transform tab as JPEG, WebP or AVIF is a fresh lossy encode, and the losses add up. Metadata edits do not re-encode, so change a caption or remove a location on the Metadata tab instead.",
      ],
    },
  ],
  faq: [
    {
      question: "What does Take all of it off remove?",
      answer:
        "The EXIF block, XMP, IPTC and other Photoshop resources, JPEG comments and PNG text chunks. The ICC colour profile is kept, because removing it changes how the colours are shown. The image data itself is not touched, and it works on JPEG, PNG and WebP.",
    },
    {
      question: "Which formats can have their metadata edited?",
      answer:
        "JPEG, PNG and WebP are rewritten in place; a simple WebP gains the extended header it needs to hold EXIF. EXIF is also read from TIFF. GIF, BMP, AVIF and the rest can only gain metadata by being saved from the Transform tab as one of those three.",
    },
    {
      question: "Why is a name or a date marked as wrong?",
      answer:
        "EXIF text fields hold only ASCII, so ü, Ł or an emoji is marked as soon as it is typed; only the User comment takes any character. Dates must be written the EXIF way, `2026:08:23 14:05:00`. Nothing is saved while a box is marked, and a value already in the file is kept as it was.",
    },
    {
      question: "How do I turn a picture into a data URI?",
      answer:
        "Press Make a data URI on the Save as card. It encodes the picture exactly as it would be saved, in the chosen format and size, and the result is about a third larger than the file, which is what Base64 costs.",
    },
  ],
  references: [
    { title: "CIPA standards, including DC-008 Exif", url: "https://www.cipa.jp/e/std/std-sec.html" },
    { title: "PNG Specification, Third Edition", url: "https://www.w3.org/TR/png-3/" },
    { title: "WebP Container Specification", url: "https://developers.google.com/speed/webp/docs/riff_container" },
    { title: "AV1 Image File Format (AVIF)", url: "https://aomediacodec.github.io/av1-avif/" },
    {
      title: "HTMLCanvasElement.toBlob(), MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob",
    },
    { title: "Filter Effects Module Level 1", url: "https://www.w3.org/TR/filter-effects-1/" },
  ],
} satisfies PageContent;
