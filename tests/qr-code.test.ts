// @vitest-environment node
import { describe, expect, it } from "vitest";
import { qrModules } from "../src/common/qr";
import { qrSvg } from "../src/utilities/qr-code/image";
import { addressProblem, linkProblem, linkUrl, numberProblem, telNumber, writeCall, writeMail, writeSms } from "../src/utilities/qr-code/links";
import { type Fields, pickCorrection, pickKind, writePayload } from "../src/utilities/qr-code/payload";
import { writeVCard } from "../src/utilities/qr-code/vcard";
import { keyProblem, pickSecurity, ssidProblem, writeWifi } from "../src/utilities/qr-code/wifi";
import { scanQr } from "./scan-qr";

const BLANK: Fields = {
  text: "",
  url: "",
  wifi: { ssid: "", password: "", security: "WPA", hidden: false },
  vcard: { first: "", last: "", org: "", job: "", phone: "", email: "", website: "", address: "", note: "" },
  mail: { address: "", subject: "", body: "" },
  phone: "",
  sms: { number: "", message: "" },
};

const CARD = { ...BLANK.vcard, first: "Ada", last: "Lovelace" };

describe("a link", () => {
  it("adds the scheme somebody left off and leaves the one they typed", () => {
    expect(linkUrl("example.com")).toBe("https://example.com/");
    expect(linkUrl("http://example.com/a")).toBe("http://example.com/a");
    expect(linkUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("emits the reading a scanner makes and not the keystrokes", () => {
    expect(linkUrl("EXAMPLE.com/a b")).toBe("https://example.com/a%20b");
  });

  it("says so where there is no address to be made of it", () => {
    expect(linkProblem("")).toBeNull();
    expect(linkProblem("example.com")).toBeNull();
    expect(linkProblem("http://")).toBe("Enter a web address");
    expect(linkProblem("a b.com")).toBe("Enter a web address");
  });
});

describe("a number", () => {
  it("keeps what is dialled and drops what it was written with", () => {
    expect(telNumber("+44 (0)20 7946-0958")).toBe("+4402079460958");
    expect(telNumber("555.0100 ,, 42")).toBe("5550100,,42");
  });

  it("is a tel: only once there is something to dial", () => {
    expect(writeCall("+15550100")).toBe("tel:+15550100");
    expect(writeCall("")).toBe("");
    expect(writeCall("+")).toBe("");
  });

  it("refuses what no keypad could send and what has no digits at all", () => {
    expect(numberProblem("")).toBeNull();
    expect(numberProblem("+44 (0)20 7946 0958")).toBeNull();
    expect(numberProblem("call me")).toBe("A number is digits, spaces and + - ( )");
    expect(numberProblem("+")).toBe("A number needs at least one digit");
  });
});

describe("a message", () => {
  it("writes a mailto with only the parts somebody filled in", () => {
    expect(writeMail({ address: "a@b.com", subject: "", body: "" })).toBe("mailto:a@b.com");
    expect(writeMail({ address: "a@b.com", subject: "Hi there", body: "Line one" })).toBe(
      "mailto:a@b.com?subject=Hi%20there&body=Line%20one",
    );
    expect(writeMail({ address: "", subject: "Hi", body: "" })).toBe("");
  });

  it("writes SMSTO, where the message runs to the end and a colon in it is safe", () => {
    expect(writeSms({ number: "+15550100", message: "" })).toBe("SMSTO:+15550100");
    expect(writeSms({ number: "+1 555 0100", message: "note: bring cake" })).toBe("SMSTO:+15550100:note: bring cake");
    expect(writeSms({ number: "", message: "hi" })).toBe("");
  });

  it("takes an address with an @ and a host, and refuses one without", () => {
    expect(addressProblem("")).toBeNull();
    expect(addressProblem("a@b.com")).toBeNull();
    expect(addressProblem("nobody")).toBe("Enter a valid address");
    expect(addressProblem("a@b")).toBe("Enter a valid address");
  });
});

describe("a network", () => {
  it("writes the fields in the order the format publishes them, and holds out for a name", () => {
    expect(writeWifi({ ssid: "Home", password: "hunter2!!", security: "WPA", hidden: false })).toBe(
      "WIFI:T:WPA;S:Home;P:hunter2!!;;",
    );
    expect(writeWifi({ ssid: "", password: "hunter2!!", security: "WPA", hidden: false })).toBe("");
  });

  it("leaves out the key an open network has none of, and marks a hidden one", () => {
    expect(writeWifi({ ssid: "Cafe", password: "ignored", security: "nopass", hidden: true })).toBe(
      "WIFI:T:nopass;S:Cafe;H:true;;",
    );
  });

  it("escapes the five characters the format spends, and quotes nothing", () => {
    expect(writeWifi({ ssid: "a;b,c:d\"e\\f", password: "", security: "nopass", hidden: false })).toBe(
      `WIFI:T:nopass;S:${String.raw`a\;b\,c\:d\"e\\f`};;`,
    );
    expect(writeWifi({ ssid: "beef", password: "", security: "nopass", hidden: false })).toBe(
      "WIFI:T:nopass;S:beef;;",
    );
  });

  it("holds a name to the 32 octets 802.11 gives it, counted as octets", () => {
    expect(ssidProblem("a".repeat(32))).toBeNull();
    expect(ssidProblem("a".repeat(33))).toBe("A network name is 32 bytes");
    expect(ssidProblem("\u2615".repeat(11))).toBe("A network name is 32 bytes");
  });

  it("holds a key to the lengths its own standard accepts", () => {
    expect(keyProblem("", "WPA")).toBeNull();
    expect(keyProblem("ignored", "nopass")).toBeNull();
    expect(keyProblem("hunter2", "WPA")).toBe("A WPA key is 8 to 63 characters, or 64 hex digits");
    expect(keyProblem("hunter22", "WPA")).toBeNull();
    expect(keyProblem("z".repeat(64), "WPA")).toBe("A WPA key is 8 to 63 characters, or 64 hex digits");
    expect(keyProblem("0".repeat(64), "WPA")).toBeNull();
    expect(keyProblem("abcde", "WEP")).toBeNull();
    expect(keyProblem("abcdef", "WEP")).toBe("A WEP key is 5 or 13 characters, or 10 or 26 hex digits");
    expect(keyProblem("0123456789", "WEP")).toBeNull();
  });

  it("reads a security back off a link and falls back to the one most networks are", () => {
    expect(pickSecurity("WEP")).toBe("WEP");
    expect(pickSecurity("nopass")).toBe("nopass");
    expect(pickSecurity("something else")).toBe("WPA");
  });
});

describe("a contact card", () => {
  it("writes the lines a reader needs and none of the ones nobody filled in", () => {
    expect(writeVCard(CARD).split("\r\n")).toEqual([
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lovelace;Ada;;;",
      "FN:Ada Lovelace",
      "END:VCARD",
    ]);
  });

  it("dials the phone, resolves the website and puts the address in the street", () => {
    const lines = writeVCard({
      ...CARD,
      org: "Analytical Engines",
      job: "Programmer",
      phone: "+44 (0)20 7946 0958",
      email: "ada@example.com",
      website: "example.com",
      address: "12 Long Street, London",
      note: "Met at the fair",
    }).split("\r\n");

    expect(lines).toContain("ORG:Analytical Engines");
    expect(lines).toContain("TITLE:Programmer");
    expect(lines).toContain("TEL;TYPE=CELL:+4402079460958");
    expect(lines).toContain("EMAIL;TYPE=INTERNET:ada@example.com");
    expect(lines).toContain("URL:https://example.com/");
    expect(lines).toContain("ADR;TYPE=HOME:;;12 Long Street\\, London;;;;");
    expect(lines).toContain("NOTE:Met at the fair");
  });

  it("escapes what separates a value's parts, and folds a newline into the one the format has", () => {
    const lines = writeVCard({ ...CARD, note: "one;two,three\nfour\\five" }).split("\r\n");
    expect(lines).toContain(String.raw`NOTE:one\;two\,three\nfour\\five`);
  });

  it("is an organisation's card where there is no person on it, and nothing where there is neither", () => {
    const lines = writeVCard({ ...BLANK.vcard, org: "Analytical Engines" }).split("\r\n");
    expect(lines).toContain("N:;;;;");
    expect(lines).toContain("FN:Analytical Engines");
    expect(writeVCard({ ...BLANK.vcard, note: "nobody" })).toBe("");
  });
});

describe("writePayload", () => {
  it("hands each kind to the writer that spells it", () => {
    expect(writePayload("text", { ...BLANK, text: "  hello  " })).toBe("  hello  ");
    expect(writePayload("text", { ...BLANK, text: "   " })).toBe("");
    expect(writePayload("url", { ...BLANK, url: "example.com" })).toBe("https://example.com/");
    expect(writePayload("phone", { ...BLANK, phone: "+1 555 0100" })).toBe("tel:+15550100");
    expect(writePayload("email", { ...BLANK, mail: { address: "a@b.com", subject: "", body: "" } }))
      .toBe("mailto:a@b.com");
    expect(writePayload("vcard", { ...BLANK, vcard: CARD })).toContain("FN:Ada Lovelace");
    expect(writePayload("wifi", { ...BLANK, wifi: { ...BLANK.wifi, ssid: "Home", security: "nopass" } }))
      .toBe("WIFI:T:nopass;S:Home;;");
  });

  it("reads a kind and a correction level back off a link, and falls back where it cannot", () => {
    expect(pickKind("wifi")).toBe("wifi");
    expect(pickKind("nothing")).toBe("text");
    expect(pickKind(undefined)).toBe("text");
    expect(pickCorrection("H")).toBe("H");
    expect(pickCorrection("nothing")).toBe("M");
  });
});

describe("the file the code is saved as", () => {
  it("is a document of its own rather than the markup the page draws", () => {
    const svg = qrSvg(qrModules("hello")!);
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("<rect width=\"29\" height=\"29\" fill=\"#fff\"/>");
    expect(svg).toContain("viewBox=\"0 0 29 29\"");
    expect(svg).toContain("width=\"232\" height=\"232\"");
  });
});

describe("what a camera reads back", () => {
  it.each([
    ["a network with a key", writeWifi({ ssid: "Café ☕", password: "hunter2!!", security: "WPA", hidden: true })],
    ["a contact card", writeVCard({ ...CARD, org: "Analytical Engines", email: "ada@example.com" })],
    ["a message with a colon in it", writeSms({ number: "+15550100", message: "note: bring cake" })],
    ["an address with a query", writeMail({ address: "a@b.com", subject: "Hi there", body: "Line one" })],
  ])("reads back as %s", (_, payload) => {
    expect(scanQr(qrModules(payload)!)).toBe(payload);
  });

  it.each(["L", "M", "Q", "H"] as const)("reads back at %s correction", (correction) => {
    expect(scanQr(qrModules("https://utils.plus/qr-code", correction)!)).toBe("https://utils.plus/qr-code");
  });
});
