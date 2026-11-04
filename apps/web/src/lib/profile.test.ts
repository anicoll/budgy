import { describe, expect, it } from "vitest";
import {
  buildJourney,
  defaultProfile,
  otherTools,
  type Profile,
  parseProfile,
  planProgress,
  storeProfile,
} from "./profile";
import { forgetAll, type KeyValueStore, readSaved, saveProfile, saveTool } from "./saved";
import { TOOLS } from "./tools";

function memory(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const alex: Profile = {
  earn: "salary",
  home: "loan",
  debts: ["help", "card", "car"],
  lease: "no",
  who: "me",
};

describe("the plan", () => {
  it("walks Alex through their numbers, then ways to get ahead", () => {
    expect(buildJourney(alex).map((s) => s.key)).toEqual([
      "pay",
      "mortgage",
      "debt",
      "rates",
      "refinance",
      "fixed",
      "help",
      "sacrifice",
      "super-mortgage",
      "super",
      "budget",
    ]);
  });

  it("only adds or drops the HELP step for HELP", () => {
    const without = buildJourney({ ...alex, debts: ["card", "car"] }).map((s) => s.key);
    const withHelp = buildJourney(alex).map((s) => s.key);
    expect(withHelp.filter((k) => k !== "help")).toEqual(without);
  });

  it("swaps the loan tools for buying tools when buying", () => {
    const keys = buildJourney({ ...alex, home: "buying" }).map((s) => s.key);
    expect(keys).toContain("borrow");
    expect(keys).toContain("buying");
    expect(keys).not.toContain("mortgage");
    expect(keys).not.toContain("refinance");
  });

  it("adds the split for couples with a loan and the lease when asked", () => {
    const keys = buildJourney({ ...alex, who: "two", lease: "thinking" }).map((s) => s.key);
    expect(keys.indexOf("split")).toBe(keys.indexOf("mortgage") + 1);
    expect(keys).toContain("lease");
  });

  it("puts every tool either in the plan or in the others, once", () => {
    for (const p of [
      alex,
      defaultProfile(),
      { ...alex, earn: "none" as const, home: "neither" as const, debts: [] },
    ]) {
      const all = [...buildJourney(p).map((s) => s.key), ...otherTools(p)];
      expect(all.sort()).toEqual(TOOLS.map((t) => t.key).sort());
    }
  });

  it("marks steps with saved inputs done and finds the next one", () => {
    const steps = buildJourney(alex);
    const { done, next } = planProgress(steps, { pay: "v=1", mortgage: "v=1", budget: "v=1" });
    expect([...done]).toEqual(["pay", "mortgage", "budget"]);
    expect(next).toBe("debt");
    expect(planProgress(steps, Object.fromEntries(steps.map((s) => [s.key, "v=1"]))).next).toBe(
      null,
    );
  });
});

describe("saved answers", () => {
  it("round-trips through the device and survives tools saving", () => {
    const store = memory();
    saveProfile(storeProfile(alex), store);
    saveTool("pay", "v=1&a=1", {}, store);
    expect(parseProfile(readSaved(store).profile)).toEqual(alex);
  });

  it("asks again when the answers are missing, old or broken", () => {
    expect(parseProfile(undefined)).toBe(null);
    expect(parseProfile({ earn: "salary" })).toBe(null);
    expect(parseProfile({ v: 1, earn: "lottery", debts: ["help", "boat"] })).toEqual({
      ...defaultProfile(),
      debts: ["help"],
    });
  });

  it("is wiped by forget everything and not saved while forgetting", () => {
    const store = memory();
    saveProfile(storeProfile(alex), store);
    forgetAll(store);
    expect(readSaved(store).profile).toBeUndefined();
    saveProfile(storeProfile(alex), store);
    expect(readSaved(store).profile).toBeUndefined();
  });
});
