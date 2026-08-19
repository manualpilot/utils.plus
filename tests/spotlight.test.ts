import { describe, expect, it } from "vitest";
import { filterUtilities } from "../src/spotlight";
import { utilities } from "../src/utility-registry";

const actions = utilities.map(({ path, label, title }) => ({ id: path, label, description: title }));

const matches = (query: string) => filterUtilities(query, actions).map((action) => "id" in action ? action.id : "");

describe("filterUtilities", () => {
  it("leaves an empty query with every utility, in the order the navbar lists them", () => {
    expect(filterUtilities("", actions)).toBe(actions);
    expect(filterUtilities("   ", actions)).toBe(actions);
  });

  it("puts an exact name first", () => {
    expect(matches("json")[0]).toBe("/json");
    expect(matches("cron")[0]).toBe("/cron");
  });

  it("finds a utility by a keyword its name never says", () => {
    expect(matches("base64")[0]).toBe("/codec");
    expect(matches("ulid")[0]).toBe("/unique-id");
    expect(matches("bcrypt")[0]).toBe("/hasher");
    expect(matches("ssh")[0]).toBe("/keygen");
  });

  it("survives a typo and a half-typed name", () => {
    expect(matches("colur")[0]).toBe("/colour");
    expect(matches("markdwn")[0]).toBe("/markdown");
    expect(matches("passph")[0]).toBe("/passphrase");
  });

  it("prefers the name over another utility's keyword", () => {
    expect(matches("diff")[0]).toBe("/diff");
    expect(matches("time")[0]).toBe("/time");
  });

  it("answers nothing for a query no utility is about", () => {
    expect(matches("qqqqzzzz")).toEqual([]);
  });

  it("drops an action the filter was not given, whatever the search ranks", () => {
    const [first, ...rest] = actions;
    expect(filterUtilities(first.label, rest).map((action) => "id" in action ? action.id : "")).not.toContain(first.id);
  });
});
