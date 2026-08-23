import { describe, expect, it } from "vitest";
import { readContainer } from "../src/utilities/image/container";
import { clampRect, dragRect, fitAspect, fitPreview, handleAt, localPoint, moveRect, resizeRect, turnTransform } from "../src/utilities/image/crop";
import { applyEdits, editsFrom, locationProblem, problem, rewrite } from "../src/utilities/image/edits";
import { carriesExif, readExifBlock, sniff, stripMetadata, webpCanvas, writeExifBlock } from "../src/utilities/image/embed";
import { countEntries, emptyExif, type Exif, findEntry, readExif, writeExif } from "../src/utilities/image/exif";
import { applyMatrix, cssFilter, isNeutral, matchPreset, matrixFor, NEUTRAL } from "../src/utilities/image/filters";
import { PANEL_ORDER, PANELS, panelTitle, reorderPanels, togglePanel } from "../src/utilities/image/panels";
import { readDataUri, stem } from "../src/utilities/image/source";
import { coordinate, degreesMinutesSeconds, readComment, tagName, tagText, toCoordinate, writeComment } from "../src/utilities/image/tags";

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytes(...parts: (number[] | Uint8Array)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) flat.push(...Array.from(part));
  return Uint8Array.from(flat);
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function jpeg(): Uint8Array {
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x10],
    ascii("JFIF"),
    [0x00, 0x01, 0x02, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00],
    [0xff, 0xfe, 0x00, 0x07],
    ascii("hello"),
    [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00],
    [0x12, 0x34, 0xff, 0xd9],
  );
}

function webp(width: number, height: number): Uint8Array {
  const packed = (width - 1) | ((height - 1) << 14);
  const stream = [0x2f, packed & 0xff, (packed >> 8) & 0xff, (packed >> 16) & 0xff, (packed >> 24) & 0xff];
  const body = bytes(ascii("WEBP"), ascii("VP8L"), [stream.length, 0, 0, 0], stream, [0]);
  return bytes(ascii("RIFF"), [body.length & 0xff, 0, 0, 0], body);
}

function sample(): Exif {
  const exif = emptyExif();
  exif.ifds.image = [
    { tag: 271, type: 2, value: "Nikon" },
    { tag: 274, type: 3, value: [6] },
    { tag: 282, type: 5, value: [{ n: 300, d: 1 }] },
  ];
  exif.ifds.exif = [
    { tag: 33434, type: 5, value: [{ n: 1, d: 250 }] },
    { tag: 33437, type: 5, value: [{ n: 28, d: 10 }] },
    { tag: 37510, type: 7, value: writeComment("A note") },
  ];
  exif.ifds.gps = [
    { tag: 1, type: 2, value: "S" },
    { tag: 2, type: 5, value: toCoordinate(-33.865143) },
    { tag: 3, type: 2, value: "E" },
    { tag: 4, type: 5, value: toCoordinate(151.2099) },
  ];
  return exif;
}

describe("the EXIF block", () => {
  it("writes a directory that reads back as the one that was written", () => {
    const read = readExif(writeExif(sample()));
    expect(read).not.toBeNull();
    expect(findEntry(read!.ifds.image, 271)?.value).toBe("Nikon");
    expect(findEntry(read!.ifds.image, 274)?.value).toEqual([6]);
    expect(findEntry(read!.ifds.image, 282)?.value).toEqual([{ n: 300, d: 1 }]);
    expect(findEntry(read!.ifds.exif, 33434)?.value).toEqual([{ n: 1, d: 250 }]);
    expect(readComment(findEntry(read!.ifds.exif, 37510)!.value)).toBe("A note");
  });

  it("keeps the two sub-directories reachable through the pointers it writes for them", () => {
    const read = readExif(writeExif(sample()))!;
    expect(findEntry(read.ifds.image, 0x8769)).toBeDefined();
    expect(findEntry(read.ifds.image, 0x8825)).toBeDefined();
    expect(read.ifds.exif).toHaveLength(3);
    expect(read.ifds.gps).toHaveLength(4);
  });

  it("takes the pointer off again once its directory is empty", () => {
    const exif = sample();
    exif.ifds.gps = [];
    const read = readExif(writeExif(exif))!;
    expect(findEntry(read.ifds.image, 0x8825)).toBeUndefined();
    expect(read.ifds.gps).toHaveLength(0);
  });

  it("writes tags in the ascending order the format asks for, whatever order they were set in", () => {
    const exif = emptyExif();
    exif.ifds.image = [
      { tag: 315, type: 2, value: "Artist" },
      { tag: 270, type: 2, value: "Description" },
      { tag: 271, type: 2, value: "Make" },
    ];
    const read = readExif(writeExif(exif))!;
    expect(read.ifds.image.map((entry) => entry.tag)).toEqual([270, 271, 315]);
  });

  it("holds a value of four bytes or fewer in the entry and anything longer after it", () => {
    const exif = emptyExif();
    exif.ifds.image = [{ tag: 270, type: 2, value: "abc" }, { tag: 271, type: 2, value: "a much longer value" }];
    const read = readExif(writeExif(exif))!;
    expect(findEntry(read.ifds.image, 270)?.value).toBe("abc");
    expect(findEntry(read.ifds.image, 271)?.value).toBe("a much longer value");
  });

  it("reads a big-endian block as readily as a little-endian one", () => {
    const little = writeExif(sample());
    const big = bytes(
      [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
      [
        0x00,
        0x01,
        0x01,
        0x0f,
        0x00,
        0x02,
        0x00,
        0x00,
        0x00,
        0x06,
        0x00,
        0x00,
        0x00,
        0x1a,
        0x00,
        0x00,
        0x00,
        0x00,
      ],
      ascii("Nikon"),
      [0x00],
    );
    expect(readExif(little)!.little).toBe(true);
    const read = readExif(big);
    expect(read!.little).toBe(false);
    expect(findEntry(read!.ifds.image, 271)?.value).toBe("Nikon");
  });

  it("answers with nothing rather than half a reading for something that is not a block", () => {
    expect(readExif(new Uint8Array(0))).toBeNull();
    expect(readExif(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
    expect(readExif(bytes([0x49, 0x49, 0x00, 0x00, 0, 0, 0, 8]))).toBeNull();
  });

  it("does not follow a directory that points back at itself", () => {
    const loop = bytes(
      [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00],
      [0x01, 0x00],
      [0x69, 0x87, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00],
      [0x00, 0x00, 0x00, 0x00],
    );
    const read = readExif(loop);
    expect(read).not.toBeNull();
    expect(read!.ifds.exif).toHaveLength(0);
  });
});

describe("what a tag says", () => {
  it("names a tag by the directory it was found in", () => {
    expect(tagName("image", 271)).toBe("Make");
    expect(tagName("gps", 2)).toBe("Latitude");
    expect(tagName("image", 0xbeef)).toBe("Tag 0xbeef");
  });

  it("writes a measurement the way the measurement is written", () => {
    expect(tagText("exif", { tag: 33434, type: 5, value: [{ n: 1, d: 250 }] })).toBe("1/250 s");
    expect(tagText("exif", { tag: 33434, type: 5, value: [{ n: 4, d: 1 }] })).toBe("4 s");
    expect(tagText("exif", { tag: 33437, type: 5, value: [{ n: 28, d: 10 }] })).toBe("f/2.8");
    expect(tagText("exif", { tag: 37386, type: 5, value: [{ n: 50, d: 1 }] })).toBe("50 mm");
    expect(tagText("exif", { tag: 34855, type: 3, value: [400] })).toBe("ISO 400");
    expect(tagText("exif", { tag: 37380, type: 10, value: [{ n: 1, d: 3 }] })).toBe("+0.333333 EV");
  });

  it("reads a coded number back as the sentence it stands for", () => {
    expect(tagText("image", { tag: 274, type: 3, value: [6] })).toBe("Rotated 90° clockwise");
    expect(tagText("exif", { tag: 40961, type: 3, value: [1] })).toBe("sRGB");
    expect(tagText("exif", { tag: 37385, type: 3, value: [0x19] })).toBe("Fired, auto");
    expect(tagText("exif", { tag: 37385, type: 3, value: [0x09] })).toBe("Fired, forced on");
    expect(tagText("exif", { tag: 37385, type: 3, value: [0x0f] })).toBe("Fired, forced on, return detected");
    expect(tagText("exif", { tag: 37385, type: 3, value: [0x20] })).toBe("No flash fitted");
    expect(tagText("exif", { tag: 37385, type: 3, value: [0] })).toBe("Did not fire");
  });

  it("takes the character set off a user comment and puts one back", () => {
    expect(readComment(writeComment("hello"))).toBe("hello");
    expect(readComment(Uint8Array.from([]))).toBe("");
    expect(Array.from(writeComment("hi").subarray(0, 8))).toEqual([0x41, 0x53, 0x43, 0x49, 0x49, 0, 0, 0]);
  });

  it("turns three rationals and a hemisphere into a place and back again", () => {
    const south = toCoordinate(-33.865143);
    expect(coordinate(south, "S")).toBeCloseTo(-33.865143, 5);
    expect(coordinate(south, "N")).toBeCloseTo(33.865143, 5);
    expect(degreesMinutesSeconds(-33.865143, "lat")).toBe(`33° 51' 54.51" S`);
    expect(degreesMinutesSeconds(151.2099, "lon")).toBe(`151° 12' 35.64" E`);
    expect(coordinate([1, 2, 3], "N")).toBeNull();
  });
});

describe("where a container keeps a block", () => {
  it("knows a format from its own first bytes and not from what it was called", () => {
    expect(sniff(decode(PNG_1X1))).toBe("png");
    expect(sniff(jpeg())).toBe("jpeg");
    expect(sniff(webp(1, 1))).toBe("webp");
    expect(sniff(bytes(ascii("GIF89a")))).toBe("gif");
    expect(sniff(bytes(ascii("BM"), [0, 0]))).toBe("bmp");
    expect(sniff(bytes([0, 0, 0, 0x18], ascii("ftypavif")))).toBe("avif");
    expect(sniff(bytes(ascii("<svg xmlns=\"x\">")))).toBe("svg");
    expect(sniff(bytes([1, 2, 3, 4, 5, 6, 7, 8]))).toBe("unknown");
  });

  it("puts a block into a JPEG, reads it back, and leaves the picture where it was", () => {
    const original = jpeg();
    const block = writeExif(sample());
    const written = writeExifBlock(original, "jpeg", block)!;
    expect(written).not.toBeNull();
    expect(readExifBlock(written, "jpeg")).toEqual(block);
    expect(Array.from(written.subarray(-4))).toEqual([0x12, 0x34, 0xff, 0xd9]);
  });

  it("replaces an existing block rather than leaving a second one behind", () => {
    const once = writeExifBlock(jpeg(), "jpeg", writeExif(sample()))!;
    const twice = writeExifBlock(once, "jpeg", writeExif(emptyExif()))!;
    const read = readExif(readExifBlock(twice, "jpeg")!)!;
    expect(countEntries(read)).toBe(0);
    expect(twice.length).toBeLessThan(once.length);
  });

  it("writes the block past the JFIF header, which is where a reader looks for it", () => {
    const written = writeExifBlock(jpeg(), "jpeg", writeExif(sample()))!;
    expect(Array.from(written.subarray(0, 2))).toEqual([0xff, 0xd8]);
    expect(Array.from(written.subarray(2, 4))).toEqual([0xff, 0xe0]);
    expect(Array.from(written.subarray(20, 22))).toEqual([0xff, 0xe1]);
  });

  it("refuses a block a JPEG segment has no room for rather than writing a broken one", () => {
    const enormous = emptyExif();
    enormous.ifds.image = [{ tag: 270, type: 2, value: "x".repeat(70000) }];
    expect(writeExifBlock(jpeg(), "jpeg", writeExif(enormous))).toBeNull();
  });

  it("puts an eXIf chunk into a PNG ahead of the pixels, with a check the file survives", () => {
    const png = decode(PNG_1X1);
    const block = writeExif(sample());
    const written = writeExifBlock(png, "png", block)!;
    expect(readExifBlock(written, "png")).toEqual(block);
    const types = chunkTypes(written);
    expect(types).toEqual(["IHDR", "eXIf", "IDAT", "IEND"]);
    expect(checksOk(written)).toBe(true);
  });

  it("grows a simple WebP the extended header a block needs, and says so in the flags", () => {
    const block = writeExif(sample());
    const written = writeExifBlock(webp(64, 32), "webp", block)!;
    expect(readExifBlock(written, "webp")).toEqual(block);
    expect(webpCanvas(written)).toEqual({ width: 64, height: 32 });
  });

  it("carries a block only where there is somewhere to put one", () => {
    expect(carriesExif("jpeg")).toBe(true);
    expect(carriesExif("png")).toBe(true);
    expect(carriesExif("webp")).toBe(true);
    expect(carriesExif("gif")).toBe(false);
    expect(writeExifBlock(bytes(ascii("GIF89a")), "gif", writeExif(sample()))).toBeNull();
  });

  it("takes every note off and leaves the colour profile alone", () => {
    const withExif = writeExifBlock(jpeg(), "jpeg", writeExif(sample()))!;
    const stripped = stripMetadata(withExif, "jpeg")!;
    expect(readExifBlock(stripped, "jpeg")).toBeNull();
    expect(Array.from(stripped.subarray(2, 4))).toEqual([0xff, 0xe0]);
    expect(stripped.length).toBeLessThan(jpeg().length);
  });
});

describe("reading a file", () => {
  it("reads a PNG's own header rather than asking a decoder", async () => {
    const info = await readContainer(decode(PNG_1X1));
    expect(info.container).toBe("png");
    expect(info.width).toBe(1);
    expect(info.height).toBe(1);
    const labels = Object.fromEntries(info.facts.map((fact) => [fact.label, fact.value]));
    expect(labels["Colour type"]).toBe("Truecolour with alpha");
    expect(labels["Bit depth"]).toBe("8 per channel");
    expect(labels["Interlacing"]).toBe("None");
    expect(info.hasAlpha).toBe(true);
  });

  it("reads a JPEG's frame header and the comment beside it", async () => {
    const info = await readContainer(jpeg());
    expect(info.container).toBe("jpeg");
    expect(info.comments).toEqual(["hello"]);
    const labels = Object.fromEntries(info.facts.map((fact) => [fact.label, fact.value]));
    expect(labels["JFIF version"]).toBe("1.02");
  });
});

describe("editing what a file says", () => {
  it("reads the fields out of a block and writes them back into one", () => {
    const edits = editsFrom(sample());
    expect(edits.fields.make).toBe("Nikon");
    expect(edits.fields.comment).toBe("A note");
    expect(edits.orientation).toBe("6");
    expect(edits.latitude).toBe("-33.865143");

    const changed = applyEdits(sample(), { ...edits, fields: { ...edits.fields, artist: "Someone" } });
    expect(findEntry(changed.ifds.image, 315)?.value).toBe("Someone");
    expect(findEntry(changed.ifds.image, 271)?.value).toBe("Nikon");
  });

  it("takes a tag off when its box is cleared rather than writing an empty one", () => {
    const edits = editsFrom(sample());
    const changed = applyEdits(sample(), { ...edits, fields: { ...edits.fields, make: "" } });
    expect(findEntry(changed.ifds.image, 271)).toBeUndefined();
  });

  it("takes every GPS tag off when both halves of the coordinate are cleared", () => {
    const edits = editsFrom(sample());
    const changed = applyEdits(sample(), { ...edits, latitude: "", longitude: "" });
    expect(changed.ifds.gps).toHaveLength(0);
  });

  it("writes a hemisphere from the sign of what was typed", () => {
    const changed = applyEdits(null, { fields: {}, orientation: "", latitude: "48.8584", longitude: "-2.2945" });
    expect(findEntry(changed.ifds.gps, 1)?.value).toBe("N");
    expect(findEntry(changed.ifds.gps, 3)?.value).toBe("W");
    expect(coordinate(findEntry(changed.ifds.gps, 4)!.value, "W")).toBeCloseTo(-2.2945, 4);
  });

  it("judges a date and a coordinate as they are typed", () => {
    expect(problem("taken", "")).toBeNull();
    expect(problem("taken", "2026:08:23 14:05:00")).toBeNull();
    expect(problem("taken", "2026-08-23")).toBe("YYYY:MM:DD HH:MM:SS");
    expect(problem("artist", "Someone")).toBeNull();
    expect(problem("artist", "Someone 😀")).toBe("Only Latin-1 characters are kept");
    expect(problem("comment", "Anything 😀")).toBeNull();

    expect(locationProblem("", "")).toEqual([null, null]);
    expect(locationProblem("10", "")[1]).toBe("Both halves of a coordinate, or neither");
    expect(locationProblem("100", "10")[0]).toBe("A latitude runs from -90 to 90");
    expect(locationProblem("10", "10")).toEqual([null, null]);
  });

  it("rewrites the bytes and leaves the pixels where they were", () => {
    const png = decode(PNG_1X1);
    const written = rewrite(png, "png", sample(), false)!;
    expect(readExif(readExifBlock(written, "png")!)).not.toBeNull();
    const cleared = rewrite(written, "png", null, true)!;
    expect(readExifBlock(cleared, "png")).toBeNull();
    expect(chunkTypes(cleared)).toEqual(["IHDR", "IDAT", "IEND"]);
  });
});

describe("the colour matrix", () => {
  it("leaves a picture alone when every slider is where it started", () => {
    expect(isNeutral(NEUTRAL)).toBe(true);
    expect(matrixFor(NEUTRAL)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(cssFilter(NEUTRAL)).toBe("none");
  });

  it("composes every slider into the one pass over the pixels", () => {
    const pixels = new Uint8ClampedArray([200, 100, 50, 255]);
    applyMatrix(pixels, matrixFor({ ...NEUTRAL, greyscale: 100 }));
    const grey = Math.round(0.213 * 200 + 0.715 * 100 + 0.072 * 50);
    expect([pixels[0], pixels[1], pixels[2]]).toEqual([grey, grey, grey]);
    expect(pixels[3]).toBe(255);
  });

  it("inverts, brightens and holds contrast about the midpoint", () => {
    const inverted = new Uint8ClampedArray([10, 20, 30, 255]);
    applyMatrix(inverted, matrixFor({ ...NEUTRAL, invert: 100 }));
    expect(Array.from(inverted)).toEqual([245, 235, 225, 255]);

    const bright = new Uint8ClampedArray([100, 100, 100, 255]);
    applyMatrix(bright, matrixFor({ ...NEUTRAL, brightness: 150 }));
    expect(bright[0]).toBe(150);

    const contrasted = new Uint8ClampedArray([128, 160, 96, 255]);
    applyMatrix(contrasted, matrixFor({ ...NEUTRAL, contrast: 200 }));
    expect(contrasted[0]).toBe(128);
    expect(contrasted[1]).toBe(192);
    expect(contrasted[2]).toBe(64);
  });

  it("clamps rather than wrapping when a slider takes a channel past what a byte holds", () => {
    const pixels = new Uint8ClampedArray([250, 5, 128, 255]);
    applyMatrix(pixels, matrixFor({ ...NEUTRAL, brightness: 200, contrast: 180 }));
    expect(pixels[0]).toBe(255);
    expect(pixels[1]).toBe(0);
  });

  it("names the preset the sliders are sitting on, and stops naming one as soon as they move", () => {
    expect(matchPreset(NEUTRAL)).toBe("none");
    expect(matchPreset({ ...NEUTRAL, invert: 100 })).toBe("negative");
    expect(matchPreset({ ...NEUTRAL, invert: 99 })).toBe("");
  });

  it("writes the same chain as a CSS filter for the preview to wear", () => {
    expect(cssFilter({ ...NEUTRAL, brightness: 120, hue: -30 })).toBe("brightness(120%) hue-rotate(-30deg)");
  });
});

describe("the crop rectangle", () => {
  const bounds = { width: 400, height: 300 };

  it("holds a rectangle inside the picture and on whole pixels", () => {
    expect(clampRect({ x: -20, y: -20, width: 500, height: 500 }, bounds)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    });
    expect(clampRect({ x: 380.6, y: 10.2, width: 100, height: 50.7 }, bounds)).toEqual({
      x: 300,
      y: 10,
      width: 100,
      height: 51,
    });
  });

  it("draws from the corner the pointer went down on, whichever way it then moved", () => {
    expect(dragRect({ x: 100, y: 100 }, { x: 200, y: 180 }, bounds, 0)).toEqual({
      x: 100,
      y: 100,
      width: 100,
      height: 80,
    });
    expect(dragRect({ x: 200, y: 180 }, { x: 100, y: 100 }, bounds, 0)).toEqual({
      x: 100,
      y: 100,
      width: 100,
      height: 80,
    });
  });

  it("keeps a locked shape by taking the larger side as the one being dragged", () => {
    const square = dragRect({ x: 0, y: 0 }, { x: 120, y: 40 }, bounds, 1);
    expect(square.width).toBe(square.height);
    expect(square.width).toBe(120);
  });

  it("moves a rectangle without letting it leave the picture", () => {
    const rect = { x: 350, y: 10, width: 40, height: 40 };
    expect(moveRect(rect, 100, -100, bounds)).toEqual({ x: 360, y: 0, width: 40, height: 40 });
  });

  it("resizes from the handle and pins the side opposite it", () => {
    const rect = { x: 100, y: 100, width: 100, height: 100 };
    expect(resizeRect(rect, "se", { x: 260, y: 240 }, bounds, 0)).toEqual({
      x: 100,
      y: 100,
      width: 160,
      height: 140,
    });
    const north = resizeRect(rect, "nw", { x: 40, y: 60 }, bounds, 0);
    expect(north.x + north.width).toBe(200);
    expect(north.y + north.height).toBe(200);
  });

  it("says which part of the rectangle a point is on", () => {
    const rect = { x: 100, y: 100, width: 100, height: 100 };
    expect(handleAt({ x: 101, y: 101 }, rect, 6)).toBe("nw");
    expect(handleAt({ x: 199, y: 199 }, rect, 6)).toBe("se");
    expect(handleAt({ x: 150, y: 102 }, rect, 6)).toBe("n");
    expect(handleAt({ x: 150, y: 150 }, rect, 6)).toBe("move");
    expect(handleAt({ x: 10, y: 10 }, rect, 6)).toBeNull();
  });

  it("fits a chosen shape inside the picture around the middle of what was there", () => {
    const wide = fitAspect({ x: 0, y: 0, width: 400, height: 300 }, bounds, 16 / 9);
    expect(wide.width).toBe(400);
    expect(wide.height).toBe(225);
    expect(wide.y).toBe(38);
  });
});

describe("the preview's own turn", () => {
  it("leaves the room a quarter turn will actually need", () => {
    const wide = { width: 800, height: 400 };
    const room = { width: 600, height: 600 };
    const flat = fitPreview(wide, room, false);
    expect(flat).toEqual({ width: 600, height: 300, frame: { width: 600, height: 300 } });

    const turned = fitPreview(wide, room, true);
    expect(turned).toEqual({ width: 600, height: 300, frame: { width: 300, height: 600 } });
    expect(turned.frame.width).toBeLessThanOrEqual(room.width);
    expect(turned.frame.height).toBeLessThanOrEqual(room.height);
  });

  it("shows a picture smaller than the card at its own size rather than blowing it up", () => {
    expect(fitPreview({ width: 64, height: 64 }, { width: 900, height: 600 }, false)).toEqual({
      width: 64,
      height: 64,
      frame: { width: 64, height: 64 },
    });
  });

  it("writes the same turn the canvas applies, in the same order", () => {
    expect(turnTransform(0, false, false)).toBe("rotate(0deg) scale(1, 1)");
    expect(turnTransform(90, true, false)).toBe("rotate(90deg) scale(-1, 1)");
  });

  it("takes a pointer back through the turn into the picture's own coordinates", () => {
    const size = { width: 200, height: 100 };
    const centre = { x: 500, y: 400 };

    expect(localPoint(centre, centre, size, 0, false, false)).toEqual({ x: 100, y: 50 });
    expect(localPoint({ x: 540, y: 400 }, centre, size, 0, false, false)).toEqual({ x: 140, y: 50 });

    const down = localPoint({ x: 500, y: 430 }, centre, size, 90, false, false);
    expect(down.x).toBeCloseTo(130, 6);
    expect(down.y).toBeCloseTo(50, 6);

    const mirrored = localPoint({ x: 540, y: 400 }, centre, size, 0, true, false);
    expect(mirrored.x).toBeCloseTo(60, 6);

    for (const rotate of [0, 90, 180, 270]) {
      for (const flip of [false, true]) {
        const there = localPoint({ x: 520, y: 380 }, centre, size, rotate, flip, false);
        expect(there.x).toBeGreaterThanOrEqual(-100);
        expect(there.y).toBeGreaterThanOrEqual(-100);
      }
    }
  });
});

describe("the cards the reader arranges", () => {
  it("opens in the order the canvas works in", () => {
    expect(PANEL_ORDER).toEqual(["shape", "colour"]);
    expect(PANELS.map((panel) => panel.title)).toEqual(["Size and shape", "Colour"]);
    expect(panelTitle("colour")).toBe("Colour");
    expect(panelTitle("nothing")).toBe("nothing");
  });

  it("takes the dragged card out and puts it back where it was dropped", () => {
    expect(reorderPanels(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderPanels(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(reorderPanels(["shape", "colour"], "colour", "shape")).toEqual(["colour", "shape"]);
  });

  it("hands back the order it was given when the drag moved nothing", () => {
    const order = ["shape", "colour"];
    expect(reorderPanels(order, "shape", "shape")).toBe(order);
    expect(reorderPanels(order, "shape", "elsewhere")).toBe(order);
  });

  it("closes a card that is open and opens one that is closed", () => {
    expect(togglePanel([], "colour")).toEqual(["colour"]);
    expect(togglePanel(["colour"], "colour")).toEqual([]);
    expect(togglePanel(["colour"], "shape")).toEqual(["colour", "shape"]);
  });
});

describe("a picture pasted as a string", () => {
  it("reads both spellings of a data URI", () => {
    const png = readDataUri(`data:image/png;base64,${PNG_1X1}`);
    expect(png?.type).toBe("image/png");
    expect(png?.name).toBe("pasted.png");
    expect(sniff(png!.bytes)).toBe("png");

    const svg = readDataUri("data:image/svg+xml,%3Csvg%20xmlns%3D%22x%22%3E%3C%2Fsvg%3E");
    expect(new TextDecoder().decode(svg!.bytes)).toBe("<svg xmlns=\"x\"></svg>");
    expect(svg?.name).toBe("pasted.svg");
  });

  it("takes the newlines a pasted URI arrives wrapped in", () => {
    const wrapped = `data:image/png;base64,\n${PNG_1X1.slice(0, 20)}\n${PNG_1X1.slice(20)}`;
    expect(sniff(readDataUri(wrapped)!.bytes)).toBe("png");
  });

  it("answers with nothing for anything that is not one", () => {
    expect(readDataUri("")).toBeNull();
    expect(readDataUri("https://example.com/cat.png")).toBeNull();
    expect(readDataUri("data:image/png;base64,")).toBeNull();
    expect(readDataUri("data:image/png;base64,not base64 at all!!")).toBeNull();
  });

  it("takes the old extension off a name before a new one is put on", () => {
    expect(stem("photo.jpg")).toBe("photo");
    expect(stem("holiday.2026.jpeg")).toBe("holiday.2026");
    expect(stem("noextension")).toBe("noextension");
    expect(stem("")).toBe("image");
  });
});

function chunkTypes(png: Uint8Array): string[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const types: string[] = [];
  let at = 8;
  while (at + 12 <= png.length) {
    const length = view.getUint32(at);
    types.push(new TextDecoder("latin1").decode(png.subarray(at + 4, at + 8)));
    at += 12 + length;
  }
  return types;
}

function checksOk(png: Uint8Array): boolean {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  while (at + 12 <= png.length) {
    const length = view.getUint32(at);
    if (view.getUint32(at + 8 + length) !== crc(png.subarray(at + 4, at + 8 + length))) return false;
    at += 12 + length;
  }
  return true;
}

function crc(input: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of input) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
