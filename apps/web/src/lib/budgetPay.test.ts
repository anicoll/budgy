import { describe, expect, it } from "vitest";
import { decodeBudgetState, defaultBudgetState, encodeBudgetState } from "./budgetState";

const strip = <T>(v: T): T => JSON.parse(JSON.stringify(v, (k, x) => (k === "id" ? undefined : x)));
const encodeRaw = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("budget URL state: this pay and due dates", () => {
  it("round-trips the pay day, mode and due dates", () => {
    const s = defaultBudgetState("2026-11-04");
    s.mode = "pay";
    s.payDay = { every: "week", last: "2026-11-06" };
    s.categories[0].lines[0].due = "2026-11-15";
    const back = decodeBudgetState(encodeBudgetState(s));
    expect(strip(back)).toEqual(strip(s));
    expect(back.categories[0].lines[0].due).toBe("2026-11-15");
  });

  it("leaves untouched budgets without the new key, and old links decode", () => {
    const s = defaultBudgetState("2026-11-04");
    const b = new URLSearchParams(encodeBudgetState(s)).get("b") as string;
    expect(JSON.parse(Buffer.from(b, "base64url").toString())).not.toHaveProperty("y");
    const old = encodeRaw({
      p: [["A", 1, null, 100, 1]],
      o: [],
      c: [["Home", 0, [["Rent", 500, 0]]]],
      w: 2,
    });
    const d = decodeBudgetState(`v=1&b=${old}`);
    expect(d.mode).toBe("month");
    expect(d.payDay).toEqual({ every: "fortnight", last: "" });
    expect(d.categories[0].lines[0].due).toBeUndefined();
  });

  it("drops junk dates and modes", () => {
    const b = encodeRaw({
      p: [],
      o: [],
      c: [["Home", 0, [["Rent", 500, 0, "tomorrow"]]]],
      y: [9, 9, "2026-13-45"],
    });
    const d = decodeBudgetState(`v=1&b=${b}`);
    expect(d.categories[0].lines[0].due).toBeUndefined();
    expect(d.mode).toBe("month");
    expect(d.payDay).toEqual({ every: "fortnight", last: "" });
  });
});
