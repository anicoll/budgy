import { describe, expect, it } from "vitest";
import { ideas, snapshot } from "./dashboard";
import { defaultDebtState, encodeDebtState } from "./debtState";
import { defaultHelp, encodeHelp } from "./helpState";
import { defaultPayState, encodePayState } from "./payState";
import { emptySaved, type SavedData, type ToolKey } from "./saved";

function filled(): SavedData {
  const data = emptySaved();
  data.tools = {
    pay: encodePayState(defaultPayState("2026-11-04")),
    debt: encodeDebtState(defaultDebtState("2026-11-04")),
    help: encodeHelp(defaultHelp()),
    mortgage: "v=1",
  };
  data.loan = { balance: 600_000, ratePct: 7.5, termYears: 25, frequency: "monthly", offset: 0 };
  return data;
}

const everything = new Set<ToolKey>(["pay", "mortgage", "rates", "debt", "help"]);

describe("dashboard snapshot", () => {
  it("is empty until a tool has saved something", () => {
    expect(snapshot(emptySaved())).toEqual([]);
    expect(ideas(emptySaved(), everything)).toEqual([]);
  });

  it("shows pay, the home loan, other debts and HELP", () => {
    const tiles = snapshot(filled());
    expect(tiles.map((t) => t.key)).toEqual(["pay", "mortgage", "debt", "help"]);
    expect(tiles[1].value).toBe("$600,000");
    expect(tiles[1].sub).toBe("7.5% with 25 years left");
    expect(tiles[2].value).toBe("$23,500");
  });

  it("skips the debts tile once everything is paid off", () => {
    const data = filled();
    const cleared = defaultDebtState("2026-11-04");
    cleared.debts = cleared.debts.map((d) => ({ ...d, balance: 0 }));
    data.tools.debt = encodeDebtState(cleared);
    expect(snapshot(data).map((t) => t.key)).not.toContain("debt");
  });
});

describe("ways to get ahead", () => {
  it("finds a rate gap, a debt order, extra repayments and a HELP answer", () => {
    const found = ideas(filled(), everything);
    expect(found.map((i) => i.key)).toEqual(["rates", "debt", "mortgage", "help"]);
    for (const i of found) expect(i.headline).not.toMatch(/NaN|\$0\b/);
  });

  it("leaves out the rate idea when the rate is already low", () => {
    const data = filled();
    data.loan.ratePct = 4;
    expect(ideas(data, everything).map((i) => i.key)).not.toContain("rates");
  });

  it("only offers ideas for tools in the plan", () => {
    expect(ideas(filled(), new Set<ToolKey>(["debt"])).map((i) => i.key)).toEqual(["debt"]);
  });
});
