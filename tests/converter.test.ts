import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount } from "../src/utilities/converter/amount";
import { CATEGORIES, pickCategory, pickUnit } from "../src/utilities/converter/categories";
import { type Category, convert, type Unit } from "../src/utilities/converter/unit";

function unitOf(category: Category, id: string): Unit {
  const unit = category.units.find((item) => item.id === id);
  if (!unit) throw new Error(`${category.id} has no unit ${id}`);
  return unit;
}

function written(categoryId: string, from: string, to: string, value: number): string {
  const category = pickCategory(categoryId);
  return formatAmount(convert(value, unitOf(category, from), unitOf(category, to)));
}

describe("distance", () => {
  it("converts through the definitions rather than through a rounding of them", () => {
    expect(written("distance", "mi", "km", 1)).toBe("1.609344");
    expect(written("distance", "in", "cm", 1)).toBe("2.54");
    expect(written("distance", "m", "ft", 1)).toBe("3.28083989501");
    expect(written("distance", "nmi", "m", 1)).toBe("1852");
  });

  it("reaches both ends of what a double can hold", () => {
    expect(written("distance", "ly", "km", 1)).toBe("9460730472580");
    expect(written("distance", "nm", "m", 1)).toBe("1e-9");
    expect(written("distance", "mm", "ly", 1)).toBe("1.05700083402e-19");
  });
});

describe("area and volume", () => {
  it("squares and cubes the lengths they are built on", () => {
    expect(written("area", "ha", "ac", 1)).toBe("2.47105381467");
    expect(written("area", "mi2", "km2", 1)).toBe("2.58998811034");
    expect(written("volume", "gal", "l", 1)).toBe("3.785411784");
    expect(written("volume", "m3", "l", 1)).toBe("1000");
  });

  it("keeps the US and imperial measures of the same name apart", () => {
    expect(written("volume", "gal-imp", "l", 1)).toBe("4.54609");
    expect(written("volume", "l", "floz", 1)).toBe("33.8140227018");
    expect(written("volume", "l", "floz-imp", 1)).toBe("35.1950797279");
  });
});

describe("mass", () => {
  it("converts the weights", () => {
    expect(written("mass", "kg", "lb", 1)).toBe("2.20462262185");
    expect(written("mass", "oz", "g", 1)).toBe("28.349523125");
    expect(written("mass", "st", "lb", 1)).toBe("14");
    expect(written("mass", "ton-us", "kg", 1)).toBe("907.18474");
  });
});

describe("temperature", () => {
  it("takes the offset of the scale as well as the size of its degree", () => {
    expect(written("temperature", "c", "f", 100)).toBe("212");
    expect(written("temperature", "c", "f", 0)).toBe("32");
    expect(written("temperature", "f", "c", 32)).toBe("0");
    expect(written("temperature", "k", "c", 0)).toBe("-273.15");
    expect(written("temperature", "r", "k", 491.67)).toBe("273.15");
  });

  it("meets the two scales where they cross", () => {
    expect(written("temperature", "c", "f", -40)).toBe("-40");
  });

  it("puts absolute zero at nothing on every scale", () => {
    expect(written("temperature", "c", "k", -273.15)).toBe("0");
    expect(written("temperature", "f", "r", -459.67)).toBe("0");
    expect(written("temperature", "f", "k", -459.67)).toBe("0");
    expect(written("temperature", "r", "c", 0)).toBe("-273.15");
  });

  it("leaves a real reading near zero where it is", () => {
    expect(written("temperature", "k", "k", 1e-13)).toBe("1e-13");
    expect(written("temperature", "k", "r", 1e-13)).toBe("1.8e-13");
  });
});

describe("speed", () => {
  it("converts the speeds", () => {
    expect(written("speed", "km-h", "mph", 100)).toBe("62.1371192237");
    expect(written("speed", "kn", "km-h", 1)).toBe("1.852");
    expect(written("speed", "m-s", "km-h", 1)).toBe("3.6");
  });
});

describe("data", () => {
  it("counts the SI prefixes in thousands and the binary ones in 1024s", () => {
    expect(written("data", "byte", "bit", 1)).toBe("8");
    expect(written("data", "kib", "byte", 1)).toBe("1024");
    expect(written("data", "gb", "mib", 1)).toBe("953.674316406");
    expect(written("data", "tib", "gb", 1)).toBe("1099.51162778");
    expect(written("data", "mbit", "kb", 1)).toBe("125");
  });
});

describe("energy, power and pressure", () => {
  it("converts the work, the rate of it and the force behind it", () => {
    expect(written("energy", "kwh", "j", 1)).toBe("3600000");
    expect(written("energy", "kcal", "kj", 1)).toBe("4.184");
    expect(written("energy", "btu", "j", 1)).toBe("1055.05585262");
    expect(written("power", "hp", "watt", 1)).toBe("745.699871582");
    expect(written("power", "kw", "hp", 1)).toBe("1.3410220896");
    expect(written("power", "kw", "ps", 1)).toBe("1.3596216173");
    expect(written("pressure", "atm", "kpa", 1)).toBe("101.325");
    expect(written("pressure", "bar", "psi", 1)).toBe("14.503773773");
    expect(written("pressure", "psi", "kpa", 1)).toBe("6.89475729317");
  });

  it("keeps the torr and the millimetre of mercury apart", () => {
    expect(written("pressure", "torr", "pa", 1)).not.toBe(written("pressure", "mmhg", "pa", 1));
    expect(written("pressure", "atm", "torr", 1)).toBe("760");
  });
});

describe("every unit on the page", () => {
  const units = CATEGORIES.flatMap((category) => category.units.map((unit) => ({ category, unit })));

  it.each(CATEGORIES)("$id names its units once each and opens on one of them", (category) => {
    const ids = category.units.map((unit) => unit.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(category.defaultUnit);
    expect(category.units.length).toBeGreaterThan(1);
  });

  it("gives every category its own id, and every unit a name and a symbol", () => {
    const ids = CATEGORIES.map((category) => category.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const { unit } of units) {
      expect(unit.name.length, unit.id).toBeGreaterThan(0);
      expect(unit.symbol.length, unit.id).toBeGreaterThan(0);
    }
  });

  it("scales by a factor that is a real, positive size", () => {
    for (const { category, unit } of units) {
      expect(Number.isFinite(unit.factor), `${category.id}/${unit.id}`).toBe(true);
      expect(unit.factor, `${category.id}/${unit.id}`).toBeGreaterThan(0);
    }
  });

  it("leaves the zero where it is outside of temperature", () => {
    for (const { category, unit } of units) {
      if (category.id === "temperature") continue;
      expect(unit.offset, `${category.id}/${unit.id}`).toBeUndefined();
    }
  });

  it("hands back what it was given when the two units are one", () => {
    for (const { unit } of units) expect(formatAmount(convert(7.25, unit, unit))).toBe("7.25");
  });

  it("comes back to where it started through any other unit", () => {
    for (const category of CATEGORIES) {
      for (const from of category.units) {
        for (const to of category.units) {
          const there = convert(12.5, from, to);
          expect(formatAmount(convert(there, to, from)), `${category.id}: ${from.id} to ${to.id}`).toBe("12.5");
        }
      }
    }
  });
});

describe("picking from a link", () => {
  it("takes what the hash names", () => {
    expect(pickCategory("pressure").id).toBe("pressure");
    expect(pickUnit(pickCategory("mass"), "lb").id).toBe("lb");
  });

  it("falls back to the defaults for anything else", () => {
    expect(pickCategory(undefined)).toBe(CATEGORIES[0]);
    expect(pickCategory("gravity")).toBe(CATEGORIES[0]);
    expect(pickUnit(pickCategory("distance"), null).id).toBe("m");
    expect(pickUnit(pickCategory("distance"), "furlong").id).toBe("m");
  });
});

describe("reading an amount", () => {
  it("takes a number however it was written", () => {
    expect(parseAmount("1.5")).toBe(1.5);
    expect(parseAmount("  -40 ")).toBe(-40);
    expect(parseAmount("2e3")).toBe(2000);
    expect(parseAmount("0x10")).toBe(16);
    expect(parseAmount(".5")).toBe(0.5);
  });

  it("has nothing to convert for a blank box", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });

  it("refuses what is not a number, units written after it included", () => {
    expect(parseAmount("5 m")).toBeNull();
    expect(parseAmount("half")).toBeNull();
    expect(parseAmount("1,5")).toBeNull();
    expect(parseAmount("Infinity")).toBeNull();
    expect(parseAmount("NaN")).toBeNull();
  });
});

describe("writing a result", () => {
  it("keeps the digits that are the answer and drops the ones that are the arithmetic", () => {
    expect(formatAmount(0.1 + 0.2)).toBe("0.3");
    expect(formatAmount(1 / 3)).toBe("0.333333333333");
    expect(formatAmount(2.5)).toBe("2.5");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(-0)).toBe("0");
  });

  it("leaves a whole number whole, and reaches for an exponent only where JavaScript does", () => {
    expect(formatAmount(1e15)).toBe("1000000000000000");
    expect(formatAmount(1e21)).toBe("1e+21");
    expect(formatAmount(1e-6)).toBe("0.000001");
    expect(formatAmount(1e-7)).toBe("1e-7");
  });

  it("has nothing to write for a conversion that ran off the end of a double", () => {
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe("");
    expect(formatAmount(Number.NaN)).toBe("");
  });
});
