import { describe, expect, it } from "vitest";
import { exactDecimal, floatFacts, floatField, type FloatFormat, floatFormat, hexLiteral, parseFloatText, readFloat, shortestDecimal, stepFloat } from "../src/utilities/calculator/float";
import { bitPattern, characterOf, clearHistory, current, display, dropHistoryEntry, expressionText, fromShare, type Key, type Machine, newMachine, press, readout, setBase, setBits, setMode, setPattern, toggleBit, toShare, writeInBase } from "../src/utilities/calculator/machine";

function type(machine: Machine, ...keys: Key[]): Machine {
  return keys.reduce(press, machine);
}

const programmer = (...keys: Key[]) => type(newMachine("programmer"), ...keys);
const scientific = (...keys: Key[]) => type(newMachine("scientific"), ...keys);

const decimal = (machine: Machine) => writeInBase(machine, 10);

describe("the programmer keypad", () => {
  it("opens on zero, in hexadecimal, sixty-four bits wide", () => {
    const machine = newMachine();

    expect(machine.mode).toBe("programmer");
    expect(machine.base).toBe(16);
    expect(machine.bits).toBe(64);
    expect(display(machine)).toBe("0");
  });

  it("builds a number a digit at a time and reads it in every base", () => {
    const machine = programmer("1", "F");

    expect(readout(machine)).toBe("1F");
    expect(writeInBase(machine, 10)).toBe("31");
    expect(writeInBase(machine, 8)).toBe("37");
    expect(bitPattern(machine)).toBe(0b11111n);
  });

  it("refuses a digit the base has no room for", () => {
    const octal = setBase(newMachine(), 8);

    expect(readout(press(octal, "9"))).toBe("0");
    expect(readout(press(octal, "7"))).toBe("7");
    expect(readout(press(setBase(newMachine(), 10), "A"))).toBe("0");
  });

  it("refuses a keystroke the word could not hold", () => {
    const byte = setBits(newMachine(), 8);
    const filled = type(byte, "F", "F");

    expect(readout(press(filled, "F"))).toBe("FF");
    expect(readout(type(setBase(byte, 10), "2", "5", "6"))).toBe("25");
  });

  it("groups the digits the way the base is read", () => {
    expect(display(programmer("1", "2", "3", "4", "5"))).toBe("1 2345");
    expect(display(type(setBase(newMachine(), 10), "1", "2", "3", "4", "5"))).toBe("12,345");
  });

  it("reads a base other than ten as the bit pattern, and ten as a signed word", () => {
    const byte = type(setBits(newMachine(), 8), "F", "F");

    expect(decimal(byte)).toBe("-1");
    expect(readout(byte)).toBe("FF");
    expect(display(setBase(byte, 10))).toBe("-1");
  });

  it("adds, subtracts, multiplies and divides whole words", () => {
    expect(readout(programmer("F", "F", "add", "1", "equals"))).toBe("100");
    expect(decimal(programmer("A", "sub", "F", "equals"))).toBe("-5");
    expect(decimal(programmer("7", "mul", "6", "equals"))).toBe("42");
    expect(decimal(type(setBase(newMachine(), 10), "7", "div", "2", "equals"))).toBe("3");
    expect(decimal(type(setBase(newMachine(), 10), "7", "mod", "2", "equals"))).toBe("1");
  });

  it("says so rather than answering when a divisor is zero", () => {
    const failed = programmer("8", "div", "0", "equals");

    expect(failed.error).toBe("Cannot divide by zero");
    expect(display(failed)).toBe("Error");
    expect(failed.stack).toEqual([]);
    expect(readout(press(failed, "5"))).toBe("5");
  });

  it("works the bits over", () => {
    expect(readout(programmer("C", "and", "A", "equals"))).toBe("8");
    expect(readout(programmer("C", "or", "A", "equals"))).toBe("E");
    expect(readout(programmer("C", "xor", "A", "equals"))).toBe("6");

    const byte = setBits(newMachine(), 8);
    expect(readout(type(byte, "C", "nor", "A", "equals"))).toBe("F1");
    expect(readout(type(byte, "0", "not"))).toBe("FF");
    expect(decimal(type(byte, "1", "neg"))).toBe("-1");
  });

  it("shifts by one and by a count, and rotates around the word", () => {
    const byte = setBits(newMachine(), 8);

    expect(readout(type(byte, "1", "shl1"))).toBe("2");
    expect(readout(type(byte, "8", "0", "shl1"))).toBe("0");
    expect(readout(type(byte, "8", "0", "shr1"))).toBe("40");
    expect(readout(type(byte, "1", "shl", "3", "equals"))).toBe("8");
    expect(readout(type(byte, "8", "0", "shr", "4", "equals"))).toBe("8");
    expect(readout(type(byte, "F", "F", "shl", "9", "equals"))).toBe("0");
    expect(readout(type(byte, "8", "0", "rol"))).toBe("1");
    expect(readout(type(byte, "1", "ror"))).toBe("80");
  });

  it("swaps byte order a unit at a time", () => {
    const word = setBits(newMachine(), 16);
    const long = setBits(newMachine(), 32);

    expect(readout(type(word, "1", "2", "3", "4", "flip8"))).toBe("3412");
    expect(readout(type(long, "1", "2", "3", "4", "5", "6", "7", "8", "flip16"))).toBe("56781234");
    expect(readout(type(setBits(newMachine(), 8), "A", "B", "flip8"))).toBe("AB");
  });

  it("binds an operator the way C binds it", () => {
    const ten = setBase(newMachine(), 10);

    expect(decimal(type(ten, "1", "add", "2", "mul", "3", "equals"))).toBe("7");
    expect(decimal(type(ten, "2", "mul", "3", "add", "1", "equals"))).toBe("7");
    expect(decimal(type(ten, "1", "shl", "2", "add", "1", "equals"))).toBe("8");
    expect(readout(programmer("1", "or", "2", "xor", "3", "and", "4", "equals"))).toBe("3");
  });

  it("takes a group as the sum it stands for", () => {
    const ten = setBase(newMachine(), 10);

    expect(decimal(type(ten, "2", "mul", "open", "3", "add", "4", "close", "equals"))).toBe("14");
    expect(decimal(type(ten, "2", "mul", "open", "3", "add", "4", "equals"))).toBe("14");
  });

  it("shows the operations still waiting on an operand", () => {
    const machine = type(setBase(newMachine(), 10), "2", "mul", "open", "3", "add");

    expect(expressionText(machine)).toBe("2 × (3 +");
    expect(display(machine)).toBe("3");
  });

  it("gathers the whole expression and works none of it out until equals asks", () => {
    const typed = type(setBase(newMachine(), 10), "1", "2", "add", "3", "4", "sub", "5");

    expect(expressionText(typed)).toBe("12 + 34 −");
    expect(typed.stack).toHaveLength(2);
    expect(display(typed)).toBe("5");
    expect(decimal(press(typed, "equals"))).toBe("41");
  });

  it("leaves a closed group standing in the expression, since equals is the only key that works anything out", () => {
    const closed = type(setBase(newMachine(), 10), "2", "mul", "open", "3", "add", "4", "close");

    expect(expressionText(closed)).toBe("2 × (3 + 4)");
    expect(display(closed)).toBe("4");
    expect(decimal(press(closed, "equals"))).toBe("14");

    expect(expressionText(type(closed, "add"))).toBe("2 × (3 + 4) +");
    expect(expressionText(type(closed, "add", "sub"))).toBe("2 × (3 + 4) −");
    expect(decimal(type(closed, "add", "1", "equals"))).toBe("15");
  });

  it("takes a bracket only while one is open, and counts every one that is", () => {
    const ten = setBase(newMachine(), 10);

    expect(expressionText(type(ten, "2", "add", "close"))).toBe("2 +");
    expect(decimal(type(ten, "open", "open", "1", "add", "2", "close", "close", "mul", "3", "equals"))).toBe("9");
    expect(expressionText(type(ten, "open", "open", "1", "add", "2", "close", "close"))).toBe("((1 + 2))");
    expect(decimal(type(ten, "2", "mul", "open", "3", "add", "4", "equals"))).toBe("14");
  });

  it("says what the number on the display is the answer to, and what another equals would do again", () => {
    const answered = type(setBase(newMachine(), 10), "2", "add", "3", "equals");

    expect(expressionText(answered)).toBe("2 + 3 =");
    expect(display(answered)).toBe("5");

    const again = press(answered, "equals");
    expect(expressionText(again)).toBe("5 + 3 =");
    expect(display(again)).toBe("8");

    expect(expressionText(press(again, "7"))).toBe("");
    expect(expressionText(press(again, "neg"))).toBe("");
    expect(expressionText(press(again, "mul"))).toBe("8 ×");
    expect(expressionText(press(again, "clear"))).toBe("");
    expect(expressionText(press(again, "mplus"))).toBe("5 + 3 =");
  });

  it("takes a second operator key as a change of mind", () => {
    expect(decimal(type(setBase(newMachine(), 10), "2", "add", "mul", "3", "equals"))).toBe("6");
  });

  it("repeats the last operation on a second equals", () => {
    const ten = setBase(newMachine(), 10);
    const summed = type(ten, "2", "add", "3", "equals");

    expect(decimal(summed)).toBe("5");
    expect(decimal(press(summed, "equals"))).toBe("8");
    expect(decimal(press(press(summed, "equals"), "equals"))).toBe("11");
  });

  it("lets a bit be set from the grid", () => {
    const byte = setBits(newMachine(), 8);

    expect(readout(toggleBit(toggleBit(byte, 0), 7))).toBe("81");
    expect(readout(toggleBit(toggleBit(byte, 0), 0))).toBe("0");
    expect(readout(toggleBit(byte, 8))).toBe("0");
  });

  it("narrows what is on screen when the word does", () => {
    const wide = type(newMachine(), "1", "2", "3", "4");
    const byte = setBits(wide, 8);

    expect(readout(byte)).toBe("34");
    expect(readout(setBits(byte, 64))).toBe("34");
  });

  it("reads the word as a character as well as a number", () => {
    expect(characterOf(programmer("4", "1"))).toEqual({ codePoint: "U+0041", glyph: "A" });
    expect(characterOf(programmer("9"))?.glyph).toBe("␉");
    expect(characterOf(programmer("1", "1", "0", "0", "0", "0"))).toBeNull();
  });

  it("has nothing to say about a key the other keypad owns", () => {
    const machine = programmer("5");

    expect(press(machine, "sin")).toBe(machine);
    expect(press(machine, "point")).toBe(machine);
    expect(press(machine, "percent")).toBe(machine);
  });
});

describe("the scientific keypad", () => {
  it("shows the number a double actually holds", () => {
    expect(readout(scientific("0", "point", "1", "add", "0", "point", "2", "equals"))).toBe("0.3");
    expect(readout(scientific("1", "div", "3", "equals"))).toBe("0.333333333333333");
  });

  it("takes a power, a root and a logarithm of either operand", () => {
    expect(readout(scientific("2", "pow", "1", "0", "equals"))).toBe("1024");
    expect(readout(scientific("2", "powOf", "1", "0", "equals"))).toBe("100");
    expect(readout(scientific("8", "root", "3", "equals"))).toBe("2");
    expect(readout(scientific("8", "logBase", "2", "equals"))).toBe("3");
    expect(readout(scientific("9", "sqrt"))).toBe("3");
    expect(readout(scientific("2", "sqr"))).toBe("4");
    expect(readout(scientific("2", "cube"))).toBe("8");
    expect(readout(scientific("4", "recip"))).toBe("0.25");
  });

  it("counts angles in whichever unit the pad is set to", () => {
    expect(readout(scientific("3", "0", "sin"))).toBe("0.5");
    expect(readout(scientific("angle", "0", "cos"))).toBe("1");
    const radians = scientific("angle", "1", "atan");
    expect(radians.angle).toBe("rad");
    expect(readout(radians)).toBe("0.785398163397448");
    expect(readout(scientific("1", "atan"))).toBe("45");
  });

  it("reads a percentage as a share of what it is being added to", () => {
    expect(readout(scientific("2", "0", "0", "add", "1", "0", "percent"))).toBe("20");
    expect(readout(scientific("2", "0", "0", "add", "1", "0", "percent", "equals"))).toBe("220");
    expect(readout(scientific("2", "0", "0", "mul", "1", "0", "percent", "equals"))).toBe("20");
    expect(readout(scientific("5", "0", "percent"))).toBe("0.5");
    expect(readout(scientific("2", "mul", "open", "3", "add", "1", "0", "percent"))).toBe("0.3");
    expect(readout(scientific("2", "mul", "open", "3", "add", "4", "close", "add", "1", "0", "percent"))).toBe("1.4");
  });

  it("types a power of ten onto the number rather than applying it", () => {
    const typed = scientific("5", "ee", "3");

    expect(readout(typed)).toBe("5e3");
    expect(readout(press(typed, "equals"))).toBe("5000");
    expect(readout(press(typed, "sign"))).toBe("5e-3");
    expect(readout(press(scientific("5"), "sign"))).toBe("-5");
  });

  it("keeps a number in memory across everything else", () => {
    const held = scientific("7", "mplus", "clear");

    expect(readout(held)).toBe("0");
    expect(readout(press(held, "mr"))).toBe("7");
    expect(readout(press(type(held, "2", "mminus"), "mr"))).toBe("5");
    expect(readout(press(press(held, "mc"), "mr"))).toBe("0");
  });

  it("takes back a digit that was typed, and nothing of an answer", () => {
    expect(readout(scientific("1", "2", "3", "back"))).toBe("12");
    expect(readout(scientific("1", "back"))).toBe("0");
    const answered = scientific("2", "add", "3", "equals");
    expect(press(answered, "back")).toBe(answered);
  });

  it("says which function could not answer", () => {
    expect(scientific("4", "sign", "sqrt").error).toBe("Square root of a negative number");
    expect(scientific("0", "ln").error).toBe("A logarithm needs a number above zero");
    expect(scientific("2", "asin").error).toBe("That function only takes a number between −1 and 1");
    expect(scientific("1", "point", "5", "fact").error).toBe("A factorial only takes a whole number of zero or more");
    expect(scientific("2", "0", "0", "fact").error).toBe("The result is too large to hold");
    expect(readout(scientific("5", "fact"))).toBe("120");
  });

  it("counts a digit only while the double can hold it", () => {
    const filled = scientific(..."123456789012345".split("") as Key[]);

    expect(readout(filled)).toBe("123456789012345");
    expect(readout(press(filled, "6"))).toBe("123456789012345");
  });
});

describe("switching mode", () => {
  it("carries the number across and leaves the pending work behind", () => {
    const pending = type(setBase(newMachine(), 10), "2", "5", "5", "add", "1", "0");
    const carried = setMode(pending, "scientific");

    expect(readout(carried)).toBe("10");
    expect(carried.stack).toEqual([]);
    expect(current(setMode(scientific("3", "point", "7"), "programmer"))).toBe(3n);
  });

  it("keeps what is in memory, which is not part of the sum", () => {
    const held = setMode(type(setBase(newMachine(), 10), "9", "mplus"), "scientific");

    expect(readout(press(held, "mr"))).toBe("9");
  });
});

describe("the history", () => {
  const decimalPad = (...keys: Key[]) => type(setBase(newMachine(), 10), ...keys);
  const written = (machine: Machine) => machine.history.map((entry) => `${entry.expression} = ${entry.result}`);

  it("keeps what each equals answered, newest first", () => {
    const machine = decimalPad("1", "2", "add", "3", "4", "equals", "5", "mul", "6", "equals");

    expect(written(machine)).toEqual(["5 × 6 = 30", "12 + 34 = 46"]);
  });

  it("records the whole expression rather than the total it had reached", () => {
    expect(written(decimalPad("1", "add", "2", "add", "3", "equals"))).toEqual(["1 + 2 + 3 = 6"]);
  });

  it("closes the groups equals closed, so an entry reads as the expression it answered", () => {
    expect(written(decimalPad("2", "mul", "open", "3", "add", "4", "equals"))).toEqual(["2 × (3 + 4) = 14"]);
    expect(written(decimalPad("2", "mul", "open", "3", "add", "4", "close", "equals"))).toEqual(["2 × (3 + 4) = 14"]);
  });

  it("records what a repeated equals did rather than the key it repeated", () => {
    expect(written(decimalPad("2", "add", "3", "equals", "equals"))).toEqual(["5 + 3 = 8", "2 + 3 = 5"]);
  });

  it("has nothing to record for an equals that worked nothing out, or for an operation that could not answer", () => {
    expect(decimalPad("5", "equals").history).toEqual([]);
    expect(decimalPad("8", "div", "0", "equals").history).toEqual([]);
  });

  it("spells an entry in the base and the mode it was worked out in, and leaves it there", () => {
    const hex = programmer("F", "F", "add", "1", "equals");

    expect(written(hex)).toEqual(["FF + 1 = 100"]);
    expect(written(setBase(hex, 10))).toEqual(["FF + 1 = 100"]);
    expect(written(setMode(hex, "scientific"))).toEqual(["FF + 1 = 100"]);
  });

  it("outlives AC, which clears the sum in hand and not the record of the ones before it", () => {
    expect(written(press(decimalPad("2", "add", "3", "equals"), "clear"))).toEqual(["2 + 3 = 5"]);
  });

  it("lets one entry go, or all of them", () => {
    const both = decimalPad("1", "add", "1", "equals", "2", "add", "2", "equals");

    expect(written(dropHistoryEntry(both, both.history[0].id))).toEqual(["1 + 1 = 2"]);
    expect(clearHistory(both).history).toEqual([]);
    expect(dropHistoryEntry(both, -1).history).toHaveLength(2);
  });

  it("keeps the last hundred answers and lets the oldest go", () => {
    let machine = setBase(newMachine(), 10);
    for (let count = 0; count <= 100; count++) machine = type(machine, "1", "add", String(count % 10) as Key, "equals");

    expect(machine.history).toHaveLength(100);
    expect(machine.history[0].expression).toBe("1 + 0");
    expect(machine.history[99].expression).toBe("1 + 1");
    expect(new Set(machine.history.map((entry) => entry.id)).size).toBe(100);
  });
});

describe("the word read as a float", () => {
  const f16 = floatFormat(16) as FloatFormat;
  const f32 = floatFormat(32) as FloatFormat;
  const f64 = floatFormat(64) as FloatFormat;

  const facts = (bits: bigint, format: FloatFormat): Record<string, string> =>
    Object.fromEntries(
      floatFacts(readFloat(bits, format)).filter((row) => row.value !== "").map((row) => [row.label, row.value]),
    );

  const spelt = (bits: bigint, format: FloatFormat) => shortestDecimal(readFloat(bits, format));

  it("has a format for every word size but the one the standard names none for", () => {
    expect(floatFormat(8)).toBeNull();
    expect([16, 32, 64].map((bits) => floatFormat(bits as 16 | 32 | 64)?.name)).toEqual([
      "binary16",
      "binary32",
      "binary64",
    ]);
  });

  it("reads the bits of a double the way anything else holding one reads them", () => {
    expect(spelt(0x3FB999999999999An, f64)).toBe("0.1");
    expect(facts(0x3FB999999999999An, f64)).toMatchObject({
      "Class": "Normal",
      "Sign": "0 (positive)",
      "Exponent": "-4",
      "Exponent field": "1019",
      "Significand field": "0x999999999999A",
      "Hex float": "0x1.999999999999Ap-4",
    });
  });

  it("spells a narrow format the way something reading that format would, and not the way a double prints", () => {
    expect(spelt(0x3DCCCCCDn, f32)).toBe("0.1");
    expect(readFloat(0x3DCCCCCDn, f32).value).toBe(0.10000000149011612);
    expect(spelt(0x2E66n, f16)).toBe("0.1");
  });

  it("says the value exactly, which is the whole of why the row is drawn", () => {
    expect(facts(0x3FB999999999999An, f64).Exact).toBe("0.1000000000000000055511151231257827021181583404541015625");
    expect(facts(0x2E66n, f16).Exact).toBe("0.0999755859375");
    expect(facts(0x3FE0000000000000n, f64).Exact).toBeUndefined();
  });

  it("tells the classes apart, the two NaNs among them", () => {
    expect([spelt(0n, f64), facts(0n, f64).Class]).toEqual(["0", "Zero"]);
    expect(spelt(1n << 63n, f64)).toBe("-0");
    expect(facts(1n << 63n, f64)).toMatchObject({ Class: "Zero", "Hex float": "-0x0p+0" });
    expect(spelt(1n, f64)).toBe("5e-324");
    expect(facts(1n, f64)).toMatchObject({ Class: "Subnormal", "Hex float": "0x0.0000000000001p-1022" });
    expect(spelt(0x7FF0000000000000n, f64)).toBe("Infinity");
    expect(facts(0x7FF0000000000000n, f64)).toMatchObject({ Class: "Infinity", "Hex float": "inf" });
    expect(facts(0x7FF0000000000000n, f64)["Significand field"]).toBeUndefined();
    expect(facts(0x7FF8000000000000n, f64)).toMatchObject({ Class: "Quiet NaN", Payload: "0x8000000000000" });
    expect(facts(0x7FF0000000000001n, f64)).toMatchObject({ Class: "Signalling NaN", Payload: "0x1" });
  });

  it("says how far it is to the value next door", () => {
    expect(facts(0x3FB999999999999An, f64).Step).toBe("1.3877787807814457e-17");
    expect(facts(0x2E66n, f16).Step).toBe("0.00006103515625");
  });

  it("steps to that value, through zero and no further than infinity", () => {
    expect(stepFloat(0x3FF0000000000000n, f64, true)).toBe(0x3FF0000000000001n);
    expect(stepFloat(0x3FF0000000000000n, f64, false)).toBe(0x3FEFFFFFFFFFFFFFn);
    expect(stepFloat(1n << 63n, f64, true)).toBe(1n);
    expect(stepFloat(0n, f64, false)).toBe((1n << 63n) | 1n);
    expect(stepFloat(0x7FF0000000000000n, f64, true)).toBe(0x7FF0000000000000n);
    expect(stepFloat(0x7FF0000000000000n, f64, false)).toBe(0x7FEFFFFFFFFFFFFFn);
    expect(stepFloat(0x7FF8000000000000n, f64, true)).toBe(0x7FF8000000000000n);
  });

  it("takes a number typed at it, in decimal, in C's hexadecimal, or by name", () => {
    expect(parseFloatText("0.1", f64)).toBe(0x3FB999999999999An);
    expect(parseFloatText("-1.5e3", f64)).toBe(0xC097700000000000n);
    expect(parseFloatText("0x1.999999999999Ap-4", f64)).toBe(0x3FB999999999999An);
    expect(parseFloatText("Infinity", f32)).toBe(0x7F800000n);
    expect(parseFloatText("-inf", f32)).toBe(0xFF800000n);
    expect(parseFloatText("nan", f32)).toBe(0x7FC00000n);
    expect(parseFloatText("-0", f64)).toBe(1n << 63n);
    expect(parseFloatText("1e400", f64)).toBe(0x7FF0000000000000n);
    expect(parseFloatText("-1e-400", f64)).toBe(1n << 63n);
  });

  it("says nothing about a box nobody has finished filling in", () => {
    for (const text of ["", "abc", "1e", ".", "0x", "1.2.3", "--1"]) {
      expect([text, parseFloatText(text, f64)]).toEqual([text, null]);
    }
  });

  it("rounds a decimal once, twice being once too many", () => {
    expect(parseFloatText("0.50000002980232239", f32)).toBe(0x3F000001n);
    expect(Math.fround(Number("0.50000002980232239"))).toBe(0.5);
  });

  it("writes every half float there is in a way that comes back to the same bits", () => {
    const broken: string[] = [];

    for (let bits = 0n; bits < 65536n; bits++) {
      const reading = readFloat(bits, f16);
      if (reading.kind === "nan") continue;
      const spellings = [shortestDecimal(reading), hexLiteral(reading)];
      if (reading.kind !== "infinity") spellings.push(exactDecimal(reading));
      for (const spelling of spellings) {
        if (parseFloatText(spelling, f16) !== bits) broken.push(`${bits.toString(16)} as ${spelling}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it("splits the word into the three fields the format reads it in", () => {
    expect([63, 62, 52, 51, 0].map((index) => floatField(index, f64))).toEqual([
      "sign",
      "exponent",
      "exponent",
      "significand",
      "significand",
    ]);
    expect([15, 10, 9].map((index) => floatField(index, f16))).toEqual(["sign", "exponent", "significand"]);
  });

  it("writes the bits outright, wrapped to the word like every other result", () => {
    const machine = setPattern(newMachine(), 0x3FB999999999999An);

    expect(readout(machine)).toBe("3FB999999999999A");
    expect(bitPattern(machine)).toBe(0x3FB999999999999An);
    expect(bitPattern(setPattern(setBits(newMachine(), 8), 0x1FFn))).toBe(0xFFn);
    expect(setPattern(newMachine("scientific"), 1n).value).toBe(0);
  });
});

describe("the share link", () => {
  it("names only what the mode on screen has", () => {
    const shared = toShare(type(setBase(newMachine(), 10), "1", "2"));

    expect(shared).toMatchObject({ mode: "programmer", base: 10, bits: 64, entry: "12" });
    expect(shared.angle).toBeUndefined();
    expect(shared.second).toBeUndefined();
    expect(toShare(scientific("angle")).bits).toBeUndefined();
  });

  it("opens on the number, the settings and the work still pending", () => {
    const machine = type(setBits(setBase(newMachine(), 10), 16), "2", "mul", "open", "3", "add", "4");
    const reopened = fromShare(toShare(machine));

    expect(reopened.base).toBe(10);
    expect(reopened.bits).toBe(16);
    expect(expressionText(reopened)).toBe(expressionText(machine));
    expect(readout(press(reopened, "equals"))).toBe("14");
  });

  it("carries a bracket that has closed, an expression being a different one without it", () => {
    const closed = type(setBase(newMachine(), 10), "2", "mul", "open", "3", "add", "4", "close");
    const reopened = fromShare(toShare(closed));

    expect(expressionText(reopened)).toBe("2 × (3 + 4)");
    expect(decimal(press(reopened, "equals"))).toBe("14");

    const carried = fromShare(toShare(type(closed, "add", "1")));
    expect(expressionText(carried)).toBe("2 × (3 + 4) +");
    expect(decimal(press(carried, "equals"))).toBe("15");
  });

  it("carries the line above the display, which is on screen like everything else it names", () => {
    const answered = type(setBase(newMachine(), 10), "2", "add", "3", "equals");

    expect(toShare(answered).answered).toBe("2 + 3");
    expect(expressionText(fromShare(toShare(answered)))).toBe("2 + 3 =");
    expect(toShare(type(setBase(newMachine(), 10), "2", "add")).answered).toBeUndefined();
  });

  it("carries the sum in hand and never the record of the ones before it", () => {
    const answered = type(setBase(newMachine(), 10), "2", "add", "3", "equals");

    expect(answered.history).toHaveLength(1);
    expect(toShare(answered).history).toBeUndefined();
    expect(fromShare(toShare(answered)).history).toEqual([]);
  });

  it("falls back rather than opening on something it cannot read", () => {
    expect(fromShare(null)).toEqual(newMachine());
    expect(fromShare({ mode: "sideways", base: 7, bits: 12 })).toMatchObject({
      mode: "programmer",
      base: 16,
      bits: 64,
    });
    expect(fromShare({ mode: "programmer", stack: [["frobnicate", "2"]] }).stack).toEqual([]);
    expect(fromShare({ mode: "programmer", entry: "zzz" }).entry).toBeNull();
    expect(fromShare({ mode: "scientific", value: "nonsense" }).value).toBe(0);
  });
});
