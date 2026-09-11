import type { PageContent } from "../page-document.ts";

export default {
  related: ["/calculator", "/time", "/colour"],
  howItWorks: [
    "Pick a category and a unit, type an amount, and the page converts it into every other unit in the category at once rather than one pair at a time. There are ten categories: distance, area, volume, mass, temperature, speed, data, energy, power and pressure, with between 4 and 16 units each. The page opens on 1 metre. Time is not among them: durations are read on the [time converter](/time).",
    "Every unit is one factor against its category's base unit, such as the metre, the litre or the byte, and a conversion goes into the base and back out. The four temperature scales also carry an offset, since their zeros are in different places.",
    "Imperial and US units use the international definitions, so a yard is exactly 0.9144 m, a mile 1609.344 m and a pound 0.45359237 kg. Where one name covers two sizes, both are listed with the system in the name: US and imperial fluid ounces, pints and gallons, a short ton, a long ton and a tonne, and mechanical and metric horsepower.",
    "Results are rounded to twelve significant digits and switch to exponent form from 10²¹ up and below 10⁻⁶. The amount box takes a decimal, an exponent such as `2e3` or a hexadecimal literal such as `0x10`. Text after the number is refused rather than half read, so `5 m` is an error, not 5.",
  ],
  examples: [
    {
      title: "A 1 TB drive",
      blocks: [
        "Data, 1 Terabyte:",
        { code: "Gigabyte    1000\nGibibyte    931.322574615\nTebibyte    0.909494701773\nMebibyte    953674.316406" },
        "A drive sold as 1 TB holds 10¹² bytes. Software that counts in powers of 1024 shows that as about 931 GiB, and Windows labels the same figure GB, which is where the missing 69 went.",
      ],
    },
    {
      title: "A US gallon",
      blocks: [
        "Volume, 1 Gallon (US):",
        {
          code:
            "Litre                   3.785411784\nGallon (imperial)       0.832674184629\nPint (US)               8\nPint (imperial)         6.66139347703\nFluid ounce (US)        128\nFluid ounce (imperial)  133.227869541",
        },
        "The imperial gallon is 4.54609 L, about a fifth larger, and holds 160 imperial fluid ounces rather than 128. The imperial fluid ounce is the smaller of the two, 28.41 mL against 29.57 mL, so a pint is larger in Britain while an ounce is larger in America.",
      ],
    },
    {
      title: "Body temperature and absolute zero",
      blocks: [
        "Temperature, 100 Fahrenheit gives 37.7777777778 °C, 310.927777778 K and 559.67 °R. Entering 0 Kelvin gives -273.15 °C, -459.67 °F and 0 °R: kelvin and Rankine both start at absolute zero, and differ only in the size of a degree.",
      ],
    },
  ],
  problems: [
    {
      title: "A temperature difference is not a temperature",
      blocks: [
        "Converting 10 °C gives 50 °F, because the page converts a reading on one scale to a reading on the other and the offset comes with it. A rise of 10 °C is a rise of 18 °F. For an interval, convert between kelvin and Rankine, whose zeros coincide: 10 K is 18 °R.",
      ],
    },
    {
      title: "Kilobytes and kibibytes",
      blocks: [
        "kB, MB, GB, TB and PB are powers of 1000, and KiB, MiB, GiB, TiB and PiB powers of 1024; both sets are listed. Network speeds are quoted in bits, so 100 Mbit/s moves at most 12.5 MB, or 11.92 MiB, a second.",
      ],
    },
    {
      title: "Recipes that are not American",
      blocks: [
        "The teaspoon, tablespoon and cup here are the US ones, 4.93 mL, 14.79 mL and 236.59 mL. A recipe written with a 250 mL metric cup will come out short if its cups are converted as US ones, and no metric cup is listed.",
      ],
    },
    {
      title: "Which ton, which horsepower",
      blocks: [
        "A short ton is 907.18474 kg, a long ton 1016.0469088 kg and a tonne 1000 kg, and none of them is called simply a ton here. Horsepower is 745.7 W and metric horsepower (PS) 735.5 W, so the same engine can be rated at 100 hp or at 101.39 PS.",
      ],
    },
  ],
  faq: [
    {
      question: "How precise are the results?",
      answer:
        "Twelve significant digits. A double carries about fifteen or sixteen, and the last few are where the arithmetic's rounding error lives, so dropping them leaves an exact conversion exact: a foot comes out as 12 inches rather than the 12.000000000000002 the division gives.",
    },
    {
      question: "Which calorie does the page use?",
      answer:
        "Calorie is the thermochemical calorie, exactly 4.184 J. The Calorie on a food label is a kilocalorie, 4184 J, which is listed separately, so convert food energy from Kilocalorie rather than Calorie.",
    },
    {
      question: "Why is Mach a fixed speed?",
      answer:
        "The page takes Mach 1 as 340.29 m/s, the speed of sound in dry air at sea level at 15 °C. The real speed of sound depends on the air's temperature, so in the cold air at cruising altitude Mach 1 is slower than this figure.",
    },
  ],
  references: [
    {
      title: "The International System of Units (SI Brochure), BIPM",
      url: "https://www.bipm.org/en/publications/si-brochure",
    },
    {
      title: "NIST Special Publication 811, Guide for the Use of the SI",
      url: "https://www.nist.gov/pml/special-publication-811",
    },
    { title: "Prefixes for binary multiples, NIST", url: "https://physics.nist.gov/cuu/Units/binary.html" },
    {
      title: "Unit conversion, NIST Office of Weights and Measures",
      url: "https://www.nist.gov/pml/owm/metric-si/unit-conversion",
    },
  ],
} satisfies PageContent;
