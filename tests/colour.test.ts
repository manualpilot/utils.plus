import { describe, expect, it } from "vitest";
import { composite, CONTRAST_LEVELS, contrastRatio, grade, luminance, writeRatio } from "../src/utilities/colour/contrast";
import { judgePainting, type Painting } from "../src/utilities/colour/interference";
import { HARMONIES, harmony, inGamut, TONE_STEPS, tones } from "../src/utilities/colour/palette";
import { parseColour } from "../src/utilities/colour/parse";
import type { Rgba } from "../src/utilities/colour/rgba";
import { toOklab, toPolar } from "../src/utilities/colour/spaces";
import { simulate, VISIONS } from "../src/utilities/colour/vision";
import { nearestName, writeCmyk, writeHex, writeHsl, writeHsv, writeLab, writeLch, writeName, writeOklab, writeOklch, writeRgb } from "../src/utilities/colour/write";

const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });

describe("parsing", () => {
  it("reads hex in three, four, six and eight digits, with or without the hash", () => {
    expect(parseColour("#ff7043")).toEqual(rgb(255, 112, 67));
    expect(parseColour("ff7043")).toEqual(rgb(255, 112, 67));
    expect(parseColour("#F80")).toEqual(rgb(255, 136, 0));
    expect(parseColour("#f80c")).toEqual(rgb(255, 136, 0, 0.8));
    expect(parseColour("#ff704380")).toEqual(rgb(255, 112, 67, 0.5));
  });

  it("rejects anything that is not a colour", () => {
    expect(parseColour("")).toBeNull();
    expect(parseColour("#12345")).toBeNull();
    expect(parseColour("rgb(1, 2)")).toBeNull();
    expect(parseColour("rgb(1, 2, 3, 4, 5)")).toBeNull();
    expect(parseColour("hsl(none, 1%, 2%)")).toBeNull();
    expect(parseColour("not a colour")).toBeNull();
    expect(parseColour("rgb(1, 2, 3")).toBeNull();
  });

  it("takes the legacy comma syntax and the modern slash syntax alike", () => {
    expect(parseColour("rgb(255, 112, 67)")).toEqual(rgb(255, 112, 67));
    expect(parseColour("rgb(255 112 67)")).toEqual(rgb(255, 112, 67));
    expect(parseColour("rgba(255, 112, 67, 0.5)")).toEqual(rgb(255, 112, 67, 0.5));
    expect(parseColour("rgb(255 112 67 / 50%)")).toEqual(rgb(255, 112, 67, 0.5));
    expect(parseColour("rgb(100%, 0%, 0%)")).toEqual(rgb(255, 0, 0));
  });

  it("reads hue in every angle unit CSS allows", () => {
    expect(parseColour("hsl(180, 100%, 50%)")).toEqual(rgb(0, 255, 255));
    expect(parseColour("hsl(0.5turn, 100%, 50%)")).toEqual(rgb(0, 255, 255));
    expect(parseColour("hsl(200grad, 100%, 50%)")).toEqual(rgb(0, 255, 255));
    expect(parseColour("hsl(3.14159rad, 100%, 50%)")).toEqual(rgb(0, 255, 255));
    expect(parseColour("hsl(-180deg, 100%, 50%)")).toEqual(rgb(0, 255, 255));
  });

  it("knows the CSS names, and transparent", () => {
    expect(parseColour("rebeccapurple")).toEqual(rgb(102, 51, 153));
    expect(parseColour("  ToMaTo ")).toEqual(rgb(255, 99, 71));
    expect(parseColour("transparent")).toEqual(rgb(0, 0, 0, 0));
    expect(parseColour("burntsienna")).toBeNull();
  });

  it("clamps what a notation can say to what eight bits a channel can hold", () => {
    expect(parseColour("rgb(300, -20, 67)")).toEqual(rgb(255, 0, 67));
    expect(parseColour("rgba(255, 112, 67, 4)")).toEqual(rgb(255, 112, 67, 1));
  });

  it("brings a colour outside the sRGB gamut back to a real one", () => {
    for (const outside of ["lab(50% 120 -120)", "lch(90% 130 140)", "oklch(70% 0.4 20)"]) {
      const parsed = parseColour(outside);
      expect(parsed, outside).not.toBeNull();
      for (const channel of [parsed!.r, parsed!.g, parsed!.b]) {
        expect(Number.isInteger(channel), outside).toBe(true);
        expect(channel, outside).toBeGreaterThanOrEqual(0);
        expect(channel, outside).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("writing", () => {
  const orange = rgb(255, 112, 67);

  it("writes each format the way that format is written", () => {
    expect(writeHex(orange)).toBe("#ff7043");
    expect(writeRgb(orange)).toBe("rgb(255, 112, 67)");
    expect(writeHsl(orange)).toBe("hsl(14, 100%, 63%)");
    expect(writeHsv(orange)).toBe("hsv(14, 74%, 100%)");
    expect(writeCmyk(orange)).toBe("cmyk(0%, 56%, 74%, 0%)");
    expect(writeName(orange)).toBe("");
    expect(writeName(rgb(255, 99, 71))).toBe("tomato");
  });

  it("names the opacity only where there is one to name", () => {
    const half = rgb(255, 112, 67, 0.5);
    expect(writeHex(half)).toBe("#ff704380");
    expect(writeRgb(half)).toBe("rgba(255, 112, 67, 0.5)");
    expect(writeHsl(half)).toBe("hsla(14, 100%, 63%, 0.5)");
    expect(writeLab(half)).toMatch(/ \/ 0\.5\)$/);
    expect(writeOklch(half)).toMatch(/ \/ 0\.5\)$/);
    expect(writeCmyk(half)).toBe(writeCmyk(orange));
    expect(writeName(rgb(255, 99, 71, 0.5))).toBe("");
  });

  it("puts a colour where CSS Color 4 puts it", () => {
    const red = rgb(255, 0, 0);
    expect(writeLab(red)).toBe("lab(54.29% 80.8 69.89)");
    expect(writeLch(red)).toBe("lch(54.29% 106.84 40.86)");
    expect(writeOklab(red)).toBe("oklab(62.8% 0.2249 0.1258)");
    expect(writeOklch(red)).toBe("oklch(62.8% 0.2577 29.23)");

    const blue = rgb(34, 139, 230);
    expect(writeLab(blue)).toBe("lab(55.75% -3.9 -55.18)");
    expect(writeOklch(blue)).toBe("oklch(62.59% 0.1641 250.29)");
  });

  it("leaves grey without a hue rather than one made of rounding", () => {
    const grey = rgb(128, 128, 128);
    expect(writeHsl(grey)).toBe("hsl(0, 0%, 50%)");
    expect(writeHsv(grey)).toBe("hsv(0, 0%, 50%)");
    expect(writeLch(grey)).toBe("lch(53.59% 0 0)");
    expect(writeOklch(grey)).toBe("oklch(59.99% 0 0)");
    expect(writeCmyk(rgb(0, 0, 0))).toBe("cmyk(0%, 0%, 0%, 100%)");
  });
});

describe("round trips", () => {
  const samples = [
    rgb(255, 112, 67),
    rgb(0, 0, 0),
    rgb(255, 255, 255),
    rgb(128, 128, 128),
    rgb(34, 139, 230),
    rgb(1, 2, 3),
    rgb(102, 51, 153, 0.42),
  ];

  const check = (write: (colour: Rgba) => string, tolerance: number, keepsAlpha = true) => {
    for (const colour of samples) {
      const text = write(colour);
      const parsed = parseColour(text);
      expect(parsed, text).not.toBeNull();
      expect(Math.abs(parsed!.r - colour.r), text).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(parsed!.g - colour.g), text).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(parsed!.b - colour.b), text).toBeLessThanOrEqual(tolerance);
      expect(parsed!.a, text).toBe(keepsAlpha ? colour.a : 1);
    }
  };

  it("reads back what it wrote", () => {
    for (const write of [writeHex, writeRgb, writeLab, writeLch, writeOklab, writeOklch]) check(write, 1);
  });

  it("reads the rounded formats back to within their rounding", () => {
    for (const write of [writeHsl, writeHsv]) check(write, 3);
    check(writeCmyk, 3, false);
  });

  it("keeps the share link's hex exact, opacity and all", () => {
    for (let a = 0; a <= 100; a++) {
      const colour = rgb(255, 112, 67, a / 100);
      expect(parseColour(writeHex(colour))).toEqual(colour);
    }
  });
});

describe("nearest name", () => {
  it("gives the name itself when the colour has one", () => {
    expect(nearestName(rgb(255, 99, 71))).toBe("tomato");
    expect(nearestName(rgb(0, 0, 0))).toBe("black");
  });

  it("gives the closest name when it has not", () => {
    expect(nearestName(rgb(254, 100, 70))).toBe("tomato");
    expect(nearestName(rgb(200, 200, 200))).toBe("silver");
  });
});

describe("contrast", () => {
  const white = rgb(255, 255, 255);
  const black = rgb(0, 0, 0);

  it("puts the two ends of the scale where WCAG defines them", () => {
    expect(luminance(white)).toBeCloseTo(1, 12);
    expect(luminance(black)).toBeCloseTo(0, 12);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 10);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 12);
  });

  it("reads the figures a contrast checker reads", () => {
    expect(writeRatio(contrastRatio(rgb(0x76, 0x76, 0x76), white))).toBe("4.54:1");
    expect(writeRatio(contrastRatio(rgb(0x77, 0x77, 0x77), white))).toBe("4.47:1");
    expect(writeRatio(contrastRatio(rgb(0x59, 0x59, 0x59), white))).toBe("7.00:1");
    expect(writeRatio(contrastRatio(rgb(0, 0, 255), white))).toBe("8.59:1");
  });

  it("gives the same ratio whichever of the two is in front", () => {
    const orange = rgb(255, 112, 67);
    expect(contrastRatio(orange, white)).toBeCloseTo(contrastRatio(white, orange), 12);
  });

  it("spends the opacity against the background rather than dropping it", () => {
    expect(composite(rgb(0, 0, 0, 0.5), white)).toEqual(rgb(128, 128, 128));
    expect(contrastRatio(rgb(0, 0, 0, 0.5), white)).toBeCloseTo(contrastRatio(rgb(128, 128, 128), white), 12);
    expect(contrastRatio(white, rgb(0, 0, 0, 0.2))).toBeCloseTo(21, 10);
  });

  it("truncates the figure, so no badge disagrees with the number beside it", () => {
    expect(writeRatio(4.499)).toBe("4.49:1");
    expect(writeRatio(4.5)).toBe("4.50:1");
    expect(writeRatio(3)).toBe("3.00:1");
  });

  it("grades a pair by the strongest level it actually meets", () => {
    expect(grade(21)).toBe(grade(7));
    expect(grade(6.99)).not.toBe(grade(7));
    expect(grade(2.99)).toBe("Fails every level");
  });

  it("names every level WCAG puts a threshold on", () => {
    expect(CONTRAST_LEVELS.map((level) => level.ratio)).toEqual([4.5, 3, 7, 4.5, 3]);
    expect(new Set(CONTRAST_LEVELS.map((level) => level.id)).size).toBe(CONTRAST_LEVELS.length);
  });
});

describe("palette", () => {
  const orange = rgb(255, 112, 67);
  const oklch = (colour: Rgba) => toPolar(toOklab(colour), 0);

  it("turns the hue and leaves the lightness and the chroma where they were", () => {
    const [l, c, h] = oklch(orange);
    const [partner] = harmony(orange, [90]);
    const [turnedL, turnedC, turnedH] = oklch(partner.colour);
    expect(turnedL).toBeCloseTo(l, 2);
    expect(turnedC).toBeCloseTo(c, 2);
    expect(turnedH).toBeCloseTo((h + 90) % 360, 0);
  });

  it("gives up chroma rather than hue for a partner sRGB cannot show", () => {
    const [l, c, h] = oklch(orange);
    const wanted = (h + 220) % 360;
    const [reachedL, reachedC, reachedH] = oklch(inGamut(l, c, wanted, 1));
    expect(reachedH).toBeCloseTo(wanted, 0);
    expect(reachedL).toBeCloseTo(l, 2);
    expect(reachedC).toBeLessThan(c);
  });

  it("marks the colour itself in every arrangement it belongs to", () => {
    for (const arrangement of HARMONIES) {
      const swatches = harmony(orange, arrangement.angles);
      expect(swatches.filter((swatch) => swatch.base)).toHaveLength(1);
      expect(writeHex(swatches.find((swatch) => swatch.base)!.colour), arrangement.id).toBe(writeHex(orange));
    }
  });

  it("steps a ramp evenly in OKLab lightness, and marks the step the colour sits nearest", () => {
    const ramp = tones(orange);
    expect(ramp).toHaveLength(TONE_STEPS.length);
    ramp.forEach((swatch, index) => expect(oklch(swatch.colour)[0]).toBeCloseTo(TONE_STEPS[index], 2));
    expect(ramp.filter((swatch) => swatch.base)).toHaveLength(1);
    expect(writeHex(ramp[2].colour)).toBe("#ff8762");
    expect(ramp[2].base).toBe(true);
  });

  it("leaves a grey grey at every step and every angle", () => {
    const grey = rgb(128, 128, 128);
    for (const swatch of tones(grey)) expect(swatch.colour.r).toBe(swatch.colour.b);
    for (const swatch of harmony(grey, [0, 120, 240])) expect(writeHex(swatch.colour)).toBe(writeHex(grey));
  });

  it("carries the opacity through to every swatch", () => {
    const half = rgb(255, 112, 67, 0.4);
    for (const swatch of [...tones(half), ...harmony(half, [0, 180])]) expect(swatch.colour.a).toBe(0.4);
  });
});

describe("colour vision", () => {
  const byId = (id: string) => VISIONS.find((vision) => vision.id === id)!.matrix;

  it("leaves typical vision the colour it was handed", () => {
    const orange = rgb(255, 112, 67, 0.4);
    expect(simulate(orange, byId("typical"))).toEqual(orange);
  });

  it("moves nothing on the grey axis", () => {
    for (const vision of VISIONS) {
      for (const grey of [rgb(0, 0, 0), rgb(128, 128, 128), rgb(255, 255, 255)]) {
        expect(writeHex(simulate(grey, vision.matrix)), vision.id).toBe(writeHex(grey));
      }
    }
  });

  it("takes red to the dark yellow the missing cone leaves behind", () => {
    expect(writeHex(simulate(rgb(255, 0, 0), byId("protanopia")))).toBe("#6d5f00");
    expect(writeHex(simulate(rgb(255, 0, 0), byId("deuteranopia")))).toBe("#a39000");
    expect(writeHex(simulate(rgb(255, 0, 0), byId("tritanopia")))).toBe("#ff000f");
  });

  it("takes the hue out entirely for achromatopsia, at the lightness contrast is measured by", () => {
    for (const colour of [rgb(255, 0, 0), rgb(0, 255, 0), rgb(34, 139, 230), rgb(255, 112, 67)]) {
      const seen = simulate(colour, byId("achromatopsia"));
      expect(seen.r).toBe(seen.g);
      expect(seen.g).toBe(seen.b);
      expect(luminance(seen)).toBeCloseTo(luminance(colour), 2);
    }
  });

  it("keeps the opacity, which no cone has anything to do with", () => {
    for (const vision of VISIONS) expect(simulate(rgb(255, 0, 0, 0.4), vision.matrix).a).toBe(0.4);
  });
});

describe("interference", () => {
  const expected = { colour: rgb(255, 112, 67), background: rgb(255, 255, 255) };
  const painting = (over: Partial<Painting> = {}): Painting => ({
    background: "rgb(255, 255, 255)",
    colour: "rgb(255, 112, 67)",
    filter: null,
    forcedColours: false,
    ...over,
  });

  it("says nothing about a box painted what it was asked to be", () => {
    expect(judgePainting(painting(), expected)).toBeNull();
  });

  it("lets a computed value round without calling it a repainting", () => {
    expect(judgePainting(painting({ colour: "rgb(254, 113, 66)" }), expected)).toBeNull();
  });

  it("catches either colour rewritten under it", () => {
    expect(judgePainting(painting({ background: "rgb(24, 26, 27)" }), expected)?.id).toBe("repaint");
    expect(judgePainting(painting({ colour: "rgb(232, 106, 63)" }), expected)?.id).toBe("repaint");
    expect(judgePainting(painting({ colour: "rgba(255, 112, 67, 0.5)" }), expected)?.id).toBe("repaint");
  });

  it("catches a filter drawn over the page, which no colour on it would have shown", () => {
    expect(judgePainting(painting({ filter: "invert(1) hue-rotate(180deg)" }), expected)?.id).toBe("filter");
  });

  it("names the system rather than an extension where the system is what forced the palette", () => {
    expect(judgePainting(painting({ forcedColours: true }), expected)?.id).toBe("forced-colours");
  });

  it("reads the background as opaque, that being how the box was painted", () => {
    expect(judgePainting(painting(), { ...expected, background: rgb(255, 255, 255, 0.5) })).toBeNull();
  });

  it("holds its tongue about a value it cannot read, silence costing less than an accusation", () => {
    expect(judgePainting(painting({ background: "color(srgb 1 0.44 0.26)" }), expected)).toBeNull();
    expect(judgePainting(painting({ colour: "" }), expected)).toBeNull();
  });
});
