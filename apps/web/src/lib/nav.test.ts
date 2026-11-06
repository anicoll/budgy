import { describe, expect, it } from "vitest";
import { viewParam } from "./nav";

describe("home page views", () => {
  it("reads each view from the query string", () => {
    expect(viewParam("tools")).toBe("tools");
    expect(viewParam("ideas")).toBe("ideas");
    expect(viewParam("settings")).toBe("settings");
  });

  it("keeps older links working", () => {
    expect(viewParam("all")).toBe("tools");
    expect(viewParam("answers")).toBe("settings");
  });

  it("falls back to the dashboard", () => {
    expect(viewParam(null)).toBeNull();
    expect(viewParam("nope")).toBeNull();
  });
});
