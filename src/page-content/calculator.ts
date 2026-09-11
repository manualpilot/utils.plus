import type { PageContent } from "../page-document.ts";

export default {
  related: ["/converter", "/ip-address", "/codec", "/hex"],
  howItWorks: [
    "Two pads share one display. Programmer, which the page opens on, works in whole words of 8, 16, 32 or 64 bits, typed in hexadecimal, octal or decimal. Scientific works in double-precision floating point, with trigonometry in degrees or radians, logarithms, roots and powers. A number carries across when you switch; a half-typed sum does not.",
    "Programmer results are wrapped to the word, so a sum overflows as a fixed-width integer does in C, without an error: in an 8-bit word `127 + 1` is -128. Decimal reads the word as signed two's complement, hexadecimal and octal show the bit pattern, and the bit grid is the word itself, so clicking a bit flips it. A value that is a Unicode code point is shown as one, for the [Unicode page](/unicode) to look up.",
    "Nothing is worked out until equals, and operators bind as in C: multiplication before addition, shifts looser than both, then AND, XOR and OR. `RoL` and `RoR` rotate, `NEG` negates, and `flip₈` and `flip₁₆` reverse the order of bytes or 16-bit words.",
    "At 16, 32 and 64 bits a Float card reads the same bits as an IEEE 754 binary16, binary32 or binary64 value and tints the grid by sign, exponent and significand. The standard has no 8-bit binary format, so an 8-bit word has no card. Typing a decimal or a C hexadecimal float such as `0x1.8p1` into the card loads its bits, the Exact row gives the stored value in full, and the arrows step to the neighbouring floats.",
  ],
  examples: [
    {
      title: "A negative number in an 8-bit word",
      blocks: [
        "Set the word size to 8-bit and the base to DEC, type `5` and press NEG:",
        { code: "DEC   -5\nHEX   FB\nOCT   373\nBits  1111 1011" },
        "At 16-bit the display stays at -5 and the hexadecimal becomes `FFFB`, the new high bits copying the sign bit. Narrowing keeps only the low bits: a 16-bit `12F4` cut to 8 bits is `F4`, which is -12.",
      ],
    },
    {
      title: "What 0.1 is stored as",
      blocks: [
        "At 32-bit, type `0.1` into the Float card. The word becomes `3DCCCCCD` and the card reads:",
        {
          code:
            "Exact              0.100000001490116119384765625\nHex float          0x1.99999Ap-4\nExponent           -4\nSignificand field  0x4CCCCD\nStep               7.450580596923828e-9",
        },
        "At 64-bit the same input gives `3FB999999999999A`, whose exact value is 0.1000000000000000055511151231257827021181583404541015625. Neither is a tenth.",
      ],
    },
    {
      title: "Precedence as C has it",
      blocks: [
        { code: "1 + 2 << 3 = 24\n6 AND 3 + 1 = 4" },
        "The shift waits for the sum, and AND waits for the addition, so the second is `6 AND 4`. It is the same trap as `x & mask == 0` in C, which compares before it masks.",
      ],
    },
  ],
  problems: [
    {
      title: "0.1 + 0.2 shows 0.3",
      blocks: [
        "The scientific pad rounds what it shows to 15 significant digits, so `0.1 + 0.2` displays 0.3 although the double it holds is 0.30000000000000004. The Float card at 64-bit shows what is really stored.",
      ],
    },
    {
      title: "A right shift of a negative number",
      blocks: [
        "`>>` shifts the bit pattern and fills from the left with zeros, which is a logical shift. In an 8-bit word -8 is `F8`, and `-8 >> 1` gives `7C`, which is 124 rather than the -4 an arithmetic shift would give. That matches `>>>` in Java and JavaScript, or `>>` on an unsigned type in C.",
      ],
    },
    {
      title: "Remainders of negative numbers",
      blocks: [
        "Division and `mod` truncate towards zero, as in C, Java and JavaScript, so `-7 ÷ 2` is -3 and `-7 mod 2` is -1. Python's `//` and `%` round towards minus infinity and give -4 and 1, so a result checked against Python can look wrong when it is not.",
      ],
    },
  ],
  faq: [
    {
      question: "Why does FF show as -1 in decimal?",
      answer:
        "Decimal reads the word as a signed two's complement number, and in an 8-bit word the top bit is worth -128. `FF` is 1111 1111, which is -128 + 127 = -1. At 16 bits the same `FF` is 255, because the sign bit is then bit 15 and it is clear.",
    },
    {
      question: "What does the Step row on the Float card mean?",
      answer:
        "It is the gap between neighbouring floats at the value's exponent, often called one unit in the last place. For 0.1 as a binary32 it is about 7.45 × 10⁻⁹, so a single cannot tell apart two numbers that close together near 0.1.",
    },
    {
      question: "Can I use the keyboard?",
      answer:
        "Yes. Digits, `+ - * /`, Enter, Escape and Backspace work, as do `&`, `|`, `^` and `~` for the bitwise keys, `<` and `>` for the shifts and `n` for NEG. Hovering over a key shows its keystroke.",
    },
    {
      question: "How does the percent key work?",
      answer:
        "After + or -, percent takes a share of what it is being added to or subtracted from, so `200 + 15 % =` gives 230. Anywhere else it divides by 100. On the programmer pad the `%` keystroke is `mod` instead.",
    },
  ],
  references: [
    {
      title: "IEEE 754-2019, Standard for Floating-Point Arithmetic",
      url: "https://standards.ieee.org/ieee/754/6210/",
    },
    {
      title: "What Every Computer Scientist Should Know About Floating-Point Arithmetic",
      url: "https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html",
    },
    {
      title: "Floating-point arithmetic: issues and limitations, Python tutorial",
      url: "https://docs.python.org/3/tutorial/floatingpoint.html",
    },
    {
      title: "C operator precedence, cppreference",
      url: "https://en.cppreference.com/w/c/language/operator_precedence",
    },
  ],
} satisfies PageContent;
