import { describe, expect, it } from "vitest";
import { blockOf, holdsBlock, hostsOf, maskFor, roleOf, sizeOf, split, splitCount, wildcardFor } from "../src/utilities/ip-address/blocks";
import { type Address, BITS, type Family, familyOf, prefixOf, readCidr, withPrefix } from "../src/utilities/ip-address/parse";
import { classify } from "../src/utilities/ip-address/special";
import { embeddedIpv4, writeAddress, writeArpa, writeBinary, writeCidr, writeExpanded, writeHex, writeInteger, writeValue } from "../src/utilities/ip-address/write";

function read(text: string, family: Family = "ipv4") {
  const result = readCidr(text, family);
  if (result.kind !== "reading") throw new Error(`Not a reading: ${text}`);
  return result.reading;
}

function address(text: string, family: Family = "ipv4"): Address {
  return read(text, family).address;
}

function problem(text: string, family: Family = "ipv4"): string {
  const result = readCidr(text, family);
  return result.kind === "error" ? result.message : "";
}

describe("readCidr", () => {
  it("reads a dotted quad and gives it the whole of itself", () => {
    expect(read("192.168.1.130")).toEqual({
      address: { family: "ipv4", value: 3232235906n, zone: "" },
      prefix: 32,
    });
  });

  it("reads the width off the address it was written on", () => {
    expect(read("10.0.0.0/8").prefix).toBe(8);
    expect(read("2001:db8::/32", "ipv6").prefix).toBe(32);
  });

  it("leaves a box nobody has finished with alone", () => {
    expect(readCidr("", "ipv4").kind).toBe("blank");
    expect(readCidr("   ", "ipv6").kind).toBe("blank");
  });

  it("says which of the two went wrong", () => {
    expect(problem("192.168.1.256")).toMatch(/Four numbers/);
    expect(problem("192.168.1.1/33")).toMatch(/0 to 32/);
    expect(problem("2001:db8::/129", "ipv6")).toMatch(/0 to 128/);
    expect(problem("gg::1", "ipv6")).toMatch(/eight groups/);
  });

  it("reads an address as the number it is stored as, which is the other direction of the conversion", () => {
    expect(address("3232235906").value).toBe(3232235906n);
    expect(writeAddress(address("3232235906"))).toBe("192.168.1.130");
    expect(writeAddress(address("0xc0a80182"))).toBe("192.168.1.130");
    expect(writeAddress(address("42540766411282592856903984951653826561", "ipv6"))).toBe("2001:db8::1");
  });

  it("will not read a number that does not fit the family", () => {
    expect(problem("4294967296")).toMatch(/Four numbers/);
    expect(address("4294967295").value).toBe(4294967295n);
  });

  it("refuses an octet written with a leading zero, which is octal to whoever wrote it that way", () => {
    expect(problem("010.0.0.1")).toMatch(/Four numbers/);
    expect(problem("192.168.01.1")).toMatch(/Four numbers/);
    expect(address("0.0.0.0").value).toBe(0n);
  });

  it("reads a zone off an IPv6 address and leaves it out of the arithmetic", () => {
    const scoped = address("fe80::1%eth0", "ipv6");
    expect(scoped).toEqual({ family: "ipv6", value: 338288524927261089654018896841347694593n, zone: "eth0" });
    expect(writeAddress(scoped)).toBe("fe80::1%eth0");
    expect(problem("fe80::1%", "ipv6")).toMatch(/eight groups/);
    expect(problem("192.168.1.1%eth0")).toMatch(/Four numbers/);
  });
});

describe("IPv6 parsing", () => {
  const readsAs = (text: string, expanded: string) => expect(writeExpanded(address(text, "ipv6"))).toBe(expanded);

  it("fills the run of zeros the :: stands for", () => {
    readsAs("::", "0000:0000:0000:0000:0000:0000:0000:0000");
    readsAs("::1", "0000:0000:0000:0000:0000:0000:0000:0001");
    readsAs("2001:db8::", "2001:0db8:0000:0000:0000:0000:0000:0000");
    readsAs("2001:db8::8a2e:370:7334", "2001:0db8:0000:0000:0000:8a2e:0370:7334");
    readsAs("1:2:3:4:5:6:7::", "0001:0002:0003:0004:0005:0006:0007:0000");
  });

  it("reads every group written out", () => {
    readsAs("2001:0db8:85a3:0000:0000:8a2e:0370:7334", "2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });

  it("reads a dotted quad in the last 32 bits", () => {
    readsAs("::ffff:192.168.1.1", "0000:0000:0000:0000:0000:ffff:c0a8:0101");
    readsAs("64:ff9b::192.0.2.33", "0064:ff9b:0000:0000:0000:0000:c000:0221");
  });

  it("refuses what cannot be read back to one address", () => {
    expect(problem("1::2::3", "ipv6")).not.toBe("");
    expect(problem("1:2:3:4:5:6:7:8:9", "ipv6")).not.toBe("");
    expect(problem("1:2:3:4:5:6:7", "ipv6")).not.toBe("");
    expect(problem("1:2:3:4:5:6:7:8::", "ipv6")).not.toBe("");
    expect(problem(":1:2:3:4:5:6:7", "ipv6")).not.toBe("");
    expect(problem("12345::1", "ipv6")).not.toBe("");
    expect(problem("::192.168.1.1.1", "ipv6")).not.toBe("");
    expect(problem("192.168.1.1::", "ipv6")).not.toBe("");
  });
});

describe("writing an address", () => {
  const compressed = (text: string) => writeAddress(address(text, "ipv6"));

  it("takes the longest run of zeros, and the first of two the same length", () => {
    expect(compressed("2001:0db8:0000:0000:0000:8a2e:0370:7334")).toBe("2001:db8::8a2e:370:7334");
    expect(compressed("2001:0:0:1:0:0:0:1")).toBe("2001:0:0:1::1");
    expect(compressed("0:0:1:0:0:1:0:0")).toBe("::1:0:0:1:0:0");
    expect(compressed("::")).toBe("::");
    expect(compressed("::1")).toBe("::1");
  });

  it("leaves a single zero group written out, :: standing for a run of at least two", () => {
    expect(compressed("1:2:3:4:5:6:0:8")).toBe("1:2:3:4:5:6:0:8");
  });

  it("writes a mapped address as the IPv4 one it stands for", () => {
    expect(compressed("::ffff:c0a8:101")).toBe("::ffff:192.168.1.1");
  });

  it("writes the number, the hex and the bits", () => {
    const value = address("192.168.1.130");
    expect(writeInteger(value)).toBe("3232235906");
    expect(writeHex(value)).toBe("0xc0a80182");
    expect(writeBinary(value)).toBe("11000000.10101000.00000001.10000010");
    expect(writeHex(address("::1", "ipv6"))).toBe("0x00000000000000000000000000000001");
  });

  it("writes the name a reverse lookup is asked under", () => {
    expect(writeArpa(address("192.168.1.130"))).toBe("130.1.168.192.in-addr.arpa");
    expect(writeArpa(address("2001:db8::1", "ipv6"))).toBe(
      "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa",
    );
  });

  it("finds the IPv4 address an IPv6 one carries, and none where there is none", () => {
    expect(embeddedIpv4(address("::ffff:192.168.1.1", "ipv6"))).toBe("192.168.1.1");
    expect(embeddedIpv4(address("64:ff9b::c000:221", "ipv6"))).toBe("192.0.2.33");
    expect(embeddedIpv4(address("2002:c000:204::1", "ipv6"))).toBe("192.0.2.4");
    expect(embeddedIpv4(address("2001:db8::1", "ipv6"))).toBe("");
    expect(embeddedIpv4(address("192.168.1.1"))).toBe("");
  });
});

describe("the block an address falls in", () => {
  it("takes the host bits off", () => {
    const { address: value, prefix } = read("192.168.1.130/26");
    const block = blockOf(value, prefix);
    expect(writeCidr(block)).toBe("192.168.1.128/26");
    expect(writeValue(maskFor("ipv4", 26), "ipv4")).toBe("255.255.255.192");
    expect(writeValue(wildcardFor("ipv4", 26), "ipv4")).toBe("0.0.0.63");
    expect(sizeOf(block)).toBe(64n);
  });

  it("has a mask at either end of the range", () => {
    expect(writeValue(maskFor("ipv4", 0), "ipv4")).toBe("0.0.0.0");
    expect(writeValue(maskFor("ipv4", 32), "ipv4")).toBe("255.255.255.255");
    expect(writeValue(maskFor("ipv6", 64), "ipv6")).toBe("ffff:ffff:ffff:ffff::");
  });

  it("spends two addresses of an IPv4 block on the network and the broadcast", () => {
    const block = blockOf(address("192.168.1.130"), 26);
    expect(hostsOf(block)).toEqual({ first: 3232235905n, last: 3232235966n, usable: 62n });
  });

  it("hands both of a /31 back, a point-to-point link having no room to spend either", () => {
    const block = blockOf(address("10.0.0.0"), 31);
    expect(hostsOf(block)).toEqual({ first: 167772160n, last: 167772161n, usable: 2n });
    expect(hostsOf(blockOf(address("10.0.0.1"), 32))).toEqual({ first: 167772161n, last: 167772161n, usable: 1n });
  });

  it("counts every address of an IPv6 block, there being no broadcast to leave out", () => {
    const block = blockOf(address("2001:db8::1", "ipv6"), 64);
    expect(hostsOf(block).usable).toBe(18446744073709551616n);
    expect(sizeOf(block)).toBe(18446744073709551616n);
  });

  it("says where in its block an address sits", () => {
    expect(roleOf(address("192.168.1.128"), blockOf(address("192.168.1.128"), 26))).toBe("Network address");
    expect(roleOf(address("192.168.1.191"), blockOf(address("192.168.1.191"), 26))).toBe("Broadcast address");
    expect(roleOf(address("192.168.1.130"), blockOf(address("192.168.1.130"), 26))).toBe("Usable host");
    expect(roleOf(address("10.0.0.0"), blockOf(address("10.0.0.0"), 31))).toBe("Usable host");
    expect(roleOf(address("10.0.0.1"), blockOf(address("10.0.0.1"), 32))).toBe("A single address");
    expect(roleOf(address("2001:db8::", "ipv6"), blockOf(address("2001:db8::", "ipv6"), 64))).toBe("Network address");
  });
});

describe("containment", () => {
  const holdsText = (outer: string, inner: string, family: Family = "ipv4") => {
    const read1 = read(outer, family);
    const read2 = read(inner, family);
    return holdsBlock(blockOf(read1.address, read1.prefix), blockOf(read2.address, read2.prefix));
  };

  it("tests an address as the single-address block it names", () => {
    expect(holdsText("192.168.1.128/26", "192.168.1.130")).toBe(true);
    expect(holdsText("192.168.1.128/26", "192.168.1.192")).toBe(false);
    expect(holdsText("192.168.1.128/26", "192.168.1.127")).toBe(false);
  });

  it("holds a block only when both of its ends are inside", () => {
    expect(holdsText("10.0.0.0/8", "10.1.2.0/24")).toBe(true);
    expect(holdsText("10.0.0.0/8", "10.0.0.0/8")).toBe(true);
    expect(holdsText("10.1.2.0/24", "10.0.0.0/8")).toBe(false);
    expect(holdsText("2001:db8::/32", "2001:db8:abcd::/48", "ipv6")).toBe(true);
    expect(holdsText("2001:db8::/32", "2001:db9::/48", "ipv6")).toBe(false);
  });

  it("holds everything at a prefix of zero", () => {
    expect(holdsText("0.0.0.0/0", "255.255.255.255")).toBe(true);
    expect(holdsText("::/0", "ffff::1", "ipv6")).toBe(true);
  });
});

describe("splitting a block", () => {
  it("counts what it would come to, whatever that is", () => {
    const block = blockOf(address("10.0.0.0"), 8);
    expect(splitCount(block, 24)).toBe(65536n);
    expect(splitCount(blockOf(address("2001:db8::", "ipv6"), 32), 64)).toBe(4294967296n);
  });

  it("draws no more than it was asked for, and says nothing about the rest", () => {
    const block = blockOf(address("10.0.0.0"), 8);
    const parts = split(block, 24, 4);
    expect(parts.map(writeCidr)).toEqual(["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]);
  });

  it("divides the block into equal ones that meet end to end", () => {
    const block = blockOf(address("192.168.1.0"), 24);
    expect(split(block, 26, 64).map(writeCidr)).toEqual([
      "192.168.1.0/26",
      "192.168.1.64/26",
      "192.168.1.128/26",
      "192.168.1.192/26",
    ]);
  });

  it("refuses a prefix that is not narrower than the block's own", () => {
    const block = blockOf(address("10.0.0.0"), 8);
    expect(splitCount(block, 8)).toBe(0n);
    expect(splitCount(block, 4)).toBe(0n);
    expect(splitCount(block, 33)).toBe(0n);
    expect(split(block, 8, 64)).toEqual([]);
  });
});

describe("classify", () => {
  const named = (text: string, family: Family = "ipv4") => classify(address(text, family)).name;

  it("answers with the narrowest registration that holds the address", () => {
    expect(named("255.255.255.255")).toBe("Limited Broadcast");
    expect(named("192.0.0.171")).toBe("NAT64/DNS64 Discovery");
    expect(named("192.0.0.1")).toBe("DS-Lite");
    expect(named("192.0.0.100")).toBe("IETF Protocol Assignments");
    expect(named("2001:db8::1", "ipv6")).toBe("Documentation");
    expect(named("2001:0:1:2::3", "ipv6")).toBe("TEREDO");
  });

  it("names the three private ranges and the one shared one", () => {
    expect(named("10.1.2.3")).toBe("Private-Use");
    expect(named("172.16.0.1")).toBe("Private-Use");
    expect(named("192.168.1.1")).toBe("Private-Use");
    expect(named("100.64.0.1")).toBe("Shared Address Space");
    expect(classify(address("10.1.2.3")).reach).toBe("private");
    expect(classify(address("fd00::1", "ipv6")).reach).toBe("private");
  });

  it("falls back on what the registry leaves unsaid about each family", () => {
    expect(named("8.8.8.8")).toBe("Global unicast");
    expect(classify(address("8.8.8.8")).reach).toBe("global");
    expect(named("2606:4700::1111", "ipv6")).toBe("Global Unicast");
    expect(named("4000::1", "ipv6")).toBe("Unassigned");
  });

  it("reads the addresses in its own table back as themselves", () => {
    expect(named("127.0.0.1")).toBe("Loopback");
    expect(named("169.254.1.1")).toBe("Link Local");
    expect(named("224.0.0.1")).toBe("Multicast");
    expect(named("::1", "ipv6")).toBe("Loopback");
    expect(named("::", "ipv6")).toBe("Unspecified");
    expect(named("fe80::1", "ipv6")).toBe("Link-Local Unicast");
    expect(named("ff02::1", "ipv6")).toBe("Multicast");
    expect(named("::ffff:192.168.1.1", "ipv6")).toBe("IPv4-Mapped");
  });
});

describe("the width field and the text it edits", () => {
  it("shows the family's full width for an address written without one", () => {
    expect(prefixOf("192.168.1.1", "ipv4")).toBe(32);
    expect(prefixOf("2001:db8::1", "ipv6")).toBe(128);
    expect(prefixOf("10.0.0.0/8", "ipv4")).toBe(8);
    expect(prefixOf("10.0.0.0/99", "ipv4")).toBe(null);
  });

  it("rewrites the suffix rather than adding a second one", () => {
    expect(withPrefix("192.168.1.1", 24)).toBe("192.168.1.1/24");
    expect(withPrefix("192.168.1.1/26", 24)).toBe("192.168.1.1/24");
    expect(withPrefix(" 2001:db8::1/64 ", 48)).toBe("2001:db8::1/48");
  });

  it("names the family a text plainly belongs to, and nothing for a bare number", () => {
    expect(familyOf("2001:db8::1")).toBe("ipv6");
    expect(familyOf("::ffff:192.168.1.1")).toBe("ipv6");
    expect(familyOf("192.168.1.1/24")).toBe("ipv4");
    expect(familyOf("3232235906")).toBe(null);
    expect(familyOf("")).toBe(null);
  });
});

describe("BITS", () => {
  it("is the whole of what the two families differ in", () => {
    expect(BITS).toEqual({ ipv4: 32, ipv6: 128 });
  });
});
