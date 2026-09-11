import type { PageContent } from "../page-document.ts";

export default {
  related: ["/image", "/qr-code", "/converter"],
  howItWorks: [
    "The page holds one colour as 8-bit sRGB channels and an opacity, and every box is a view of it: hex, CSS name, RGB, HSL, HSV, CMYK, LAB, LCH, OKLAB and OKLCH. Any box accepts any of those notations, so a hex pasted into the OKLCH box is read and rewritten as OKLCH. LAB and LCH use the D50 white point and OKLAB and OKLCH use D65, as CSS Color 4 defines them, so the values paste straight into a stylesheet. Where the colour has no CSS name, the name box offers the nearest of the 148.",
    "The Contrast card measures the colour against a background, white unless you change it, with the WCAG 2 formula, and marks AA and AAA for normal and large text and AA for interface parts. A colour with opacity is blended onto the background first, as a browser would.",
    "The Palette card builds tints and shades and five harmonies by turning the hue in OKLCH at the colour's own lightness and chroma. A partner outside sRGB loses chroma until it fits, rather than having a channel clipped, which would shift its hue. Clicking a swatch takes it as the colour.",
    "The Colour vision card redraws the pair as seen with protanopia, deuteranopia and tritanopia, using the Machado, Oliveira and Fernandes (2009) model at full severity, and with achromatopsia as luminance alone. For a whole picture, the Greyscale adjustment in the [image editor](/image) is a rough stand-in for the last of these.",
  ],
  examples: [
    {
      title: "One colour, every notation",
      blocks: [
        "The page opens on `#ff7043`, which it writes as:",
        {
          code:
            "RGB    rgb(255, 112, 67)\nHSL    hsl(14, 100%, 63%)\nHSV    hsv(14, 74%, 100%)\nCMYK   cmyk(0%, 56%, 74%, 0%)\nLAB    lab(65.13% 53.75 52.1)\nLCH    lch(65.13% 74.85 44.11)\nOKLAB  oklab(71.24% 0.1461 0.1132)\nOKLCH  oklch(71.24% 0.1848 37.77)",
        },
        "The nearest CSS name is `tomato`. On white it manages 2.74:1 and fails every level; on black it is 7.65:1 and passes them all.",
      ],
    },
    {
      title: "The lightest grey that passes AA on white",
      blocks: [
        {
          code:
            "#767676 on #ffffff   4.54:1   Passes AA, and AAA at large sizes\n#777777 on #ffffff   4.47:1   Large text and interface parts only",
        },
        "One step in each channel separates a pass from a fail for body text. For AAA the lightest grey is `#595959`, at 7.00:1.",
      ],
    },
    {
      title: "Half-transparent black",
      blocks: [
        "`rgba(0, 0, 0, 0.5)` is written in hex as `#00000080`. On white it is blended to `#808080` before it is measured, so the ratio is 3.94:1, enough for large text but not for body text.",
      ],
    },
  ],
  problems: [
    {
      title: "An OKLCH colour comes back changed",
      blocks: [
        "The page works in sRGB only. `oklch(70% 0.3 150)` is a green no sRGB screen can show, so it loses chroma until it fits, as a palette partner does, and comes back as `#00be58`, or `oklch(70.05% 0.1928 150.03)`: the lightness and the hue stay where they were and only the chroma has dropped. That value survives the round trip, and every chroma from 0.193 up at that lightness and hue lands on the same colour. `color(display-p3 …)` is not read at all.",
      ],
    },
    {
      title: "Enough contrast does not make two colours distinguishable",
      blocks: [
        "Contrast is a ratio of luminance and nothing else. Under deuteranopia a red `#d32f2f` and a green `#388e3c` become `#8b7c28` and `#867a42`, which few people could tell apart, so check the vision tiles as well as the ratio when colour alone carries a meaning.",
      ],
    },
    {
      title: "HSL lightness is not how light a colour looks",
      blocks: [
        "`hsl(60, 100%, 50%)` and `hsl(240, 100%, 50%)` share a lightness of 50%, yet the yellow is 1.07:1 on white and the blue 8.59:1. Their OKLCH lightness, 96.8% against 45.2%, is much closer to what the eye sees, which is why the palette turns hues in OKLCH.",
      ],
    },
    {
      title: "CMYK is a formula, not a print profile",
      blocks: [
        "The CMYK box uses the plain conversion, with no printer or paper profile, and rounds to whole percentages, so even the round trip drifts: `cmyk(0%, 56%, 74%, 0%)` reads back as `#ff7042`. What a press prints depends on its own profile.",
      ],
    },
  ],
  faq: [
    {
      question: "What contrast ratio does WCAG require?",
      answer:
        "Level AA asks for 4.5:1 for normal text and 3:1 for large text, which WCAG defines as at least 18 point, or 14 point bold. Level AAA asks for 7:1 and 4.5:1. Interface components and meaningful graphics need 3:1 against what is next to them.",
    },
    {
      question: "Why does this page say 4.49 where another checker says 4.5?",
      answer:
        "The ratio is truncated to two decimals rather than rounded, so a pair at 4.497:1 shows as 4.49 and fails AA. WCAG says the computed ratio should not be rounded, giving 4.499:1 as an example that does not meet 4.5:1.",
    },
    {
      question: "Why are the palette's harmonies not reversible?",
      answer:
        "A partner outside sRGB loses chroma to fit, and the way back cannot restore it. The complement of `#ff7043` is `#00b5d7`, and the complement of that is `#e68466`, a softer orange than the one you started with.",
    },
  ],
  references: [
    {
      title: "Understanding Success Criterion 1.4.3: Contrast (Minimum), WCAG 2.2",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    },
    {
      title: "Understanding Success Criterion 1.4.11: Non-text Contrast, WCAG 2.2",
      url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html",
    },
    { title: "CSS Color Module Level 4, W3C", url: "https://www.w3.org/TR/css-color-4/" },
    {
      title: "A perceptual color space for image processing, Björn Ottosson",
      url: "https://bottosson.github.io/posts/oklab/",
    },
    {
      title: "A Physiologically-based Model for Simulation of Color Vision Deficiency, Machado, Oliveira and Fernandes",
      url: "https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html",
    },
  ],
} satisfies PageContent;
