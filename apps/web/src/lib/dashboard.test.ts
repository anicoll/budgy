import { describe, expect, it } from "vitest";
import { defaultBudgetState, encodeBudgetState } from "./budgetState";
import { cashFlow, debtList, ideas, loanOutlook, savedLoan, snapshot } from "./dashboard";
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

describe("dashboard pictures", () => {
  it("shows take-home alone until there's a budget", () => {
    const flow = cashFlow(filled());
    expect(flow?.income).toBeGreaterThan(0);
    expect(flow?.left).toBeNull();
    expect(flow?.parts).toEqual([]);
  });

  it("splits a budget into its biggest categories and what's left", () => {
    const data = filled();
    const b = defaultBudgetState("2026-11-04");
    b.categories = b.categories.map((c, i) => ({
      ...c,
      lines: c.lines.map((l, j) =>
        j === 0 ? { ...l, amount: 100 * (i + 1), per: "fortnight" } : l,
      ),
    }));
    data.tools.budget = encodeBudgetState(b);
    const flow = cashFlow(data);
    expect(flow).not.toBeNull();
    expect(flow?.parts.length).toBeLessThanOrEqual(4);
    expect(flow?.parts[0].amount).toBeGreaterThanOrEqual(flow?.parts[1]?.amount ?? 0);
    const spent = flow?.parts.reduce((t, p) => t + p.amount, 0) ?? 0;
    // Rounding to the cent per part can be out by a few cents in all.
    expect(Math.abs((flow?.income ?? 0) - spent - (flow?.left ?? 0))).toBeLessThan(10);
  });

  it("pays the home loan off sooner with a little extra", () => {
    const loan = savedLoan(filled());
    const o = loan ? loanOutlook(loan) : null;
    expect(o).not.toBeNull();
    expect(o?.per).toBe("a month");
    expect((o?.more.payoffDate ?? "") < (o?.now.payoffDate ?? "")).toBe(true);
    expect(o?.saved).toBeGreaterThan(0);
  });

  it("lists each debt and HELP, biggest first", () => {
    const list = debtList(filled());
    expect(list.map((d) => d.key)).toContain("help");
    expect(list.filter((d) => d.key === "debt").length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++)
      expect(list[i - 1].balance).toBeGreaterThanOrEqual(list[i].balance);
    for (const d of list) expect(d.note).not.toMatch(/NaN|undefined/);
  });
});
