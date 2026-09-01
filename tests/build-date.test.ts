import { describe, expect, it } from "vitest";
import { BUILD_DATE, currentAsOf } from "../src/common/build-date";

describe("build date", () => {
  it("is the minute of the build, said in UTC", () => {
    expect(BUILD_DATE).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
  });

  it("names the publications and the date in one sentence", () => {
    expect(currentAsOf("Natural Earth")).toBe(
      `Read from Natural Earth when the site was built. Current as of ${BUILD_DATE}.`,
    );
  });
});
