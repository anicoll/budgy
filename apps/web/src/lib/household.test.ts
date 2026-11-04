import { describe, expect, it } from "vitest";
import { defaultBudgetState } from "./budgetState";
import { defaultHelp } from "./helpState";
import {
  BUDGET_PEOPLE,
  HELP_PEOPLE,
  isPlaceholderName,
  PAY_PEOPLE,
  type PeopleContext,
  paySalary,
  SACRIFICE_PEOPLE,
  SOM_PEOPLE,
  SPLIT_PEOPLE,
  SUPER_PEOPLE,
  withPaySalary,
} from "./household";
import { defaultPayState } from "./payState";
import { defaultSacrificeState } from "./sacrificeState";
import { type KeyValueStore, mergePeople, readSaved, saveTool } from "./saved";
import { defaultSplitState } from "./splitState";
import { defaultSomState } from "./superMortgageState";
import { defaultSuperState } from "./superState";

const ON = "2026-11-04";
const fresh2: PeopleContext = { fresh: true, household: 2 };
const fresh1: PeopleContext = { fresh: true, household: 1 };
const saved: PeopleContext = { fresh: false, household: 2 };

function memory(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("the pay calculator's salary", () => {
  it("reads the base salary however it's entered", () => {
    expect(paySalary({ ...defaultPayState(ON), amount: 135_000 })).toBe(135_000);
    expect(paySalary({ ...defaultPayState(ON), amount: 5_000, per: "fortnight" })).toBe(130_000);
    const pkg = { ...defaultPayState(ON), amount: 112_000, includesSuper: true, superPct: 12 };
    expect(paySalary(pkg)).toBe(100_000);
  });

  it("writes a salary back in the way it's entered", () => {
    const fn = withPaySalary({ ...defaultPayState(ON), per: "fortnight" }, 130_000);
    expect(fn.per).toBe("fortnight");
    expect(fn.amount).toBe(5_000);
    const pkg = withPaySalary(
      { ...defaultPayState(ON), includesSuper: true, superPct: 12 },
      100_000,
    );
    expect(paySalary(pkg)).toBe(100_000);
  });
});

describe("salary from the pay calculator reaches the other tools", () => {
  it("carries into salary sacrifice, super or mortgage, super and HELP", () => {
    const store = memory();
    const pay = { ...defaultPayState(ON), amount: 142_000, studyLoan: true };
    saveTool("pay", "v=1", {}, store, PAY_PEOPLE.read(pay));
    const people = readSaved(store).people;
    expect(people[0]).toEqual({ salary: 142_000, help: true, hospitalCover: true });

    const sac = SACRIFICE_PEOPLE.apply(defaultSacrificeState(ON), people, fresh1);
    expect(sac.people[0].salary).toBe(142_000);
    expect(sac.people[0].studyLoan).toBe(true);
    expect(SOM_PEOPLE.apply(defaultSomState(ON), people, fresh1).people[0].salary).toBe(142_000);
    expect(SUPER_PEOPLE.apply(defaultSuperState(ON), people, fresh1).people[0].salary).toBe(
      142_000,
    );
    expect(HELP_PEOPLE.apply(defaultHelp(), people, fresh1).income).toBe(142_000);
  });

  it("and back: a salary changed in super or mortgage shows in the pay calculator", () => {
    const people = SOM_PEOPLE.read({
      ...defaultSomState(ON),
      people: [{ ...defaultSomState(ON).people[0], salary: 150_000 }],
    });
    expect(paySalary(PAY_PEOPLE.apply(defaultPayState(ON), people, saved))).toBe(150_000);
  });
});

describe("the household", () => {
  it("doesn't make up names", () => {
    for (const s of [defaultSomState(ON), defaultSuperState(ON)])
      expect(s.people.map((p) => p.name)).toEqual(["You", "Partner"]);
    expect(defaultSplitState(ON).borrowers.map((b) => b.name)).toEqual(["You", "Partner"]);
  });

  it("replaces old placeholder names and shares real ones", () => {
    expect(isPlaceholderName("Alex")).toBe(true);
    const old = defaultSomState(ON);
    old.people[0].name = "Alex";
    old.people[1].name = "Sam";
    const fixed = SOM_PEOPLE.apply(old, [], saved);
    expect(fixed.people.map((p) => p.name)).toEqual(["You", "Partner"]);

    const named = SPLIT_PEOPLE.read({
      ...defaultSplitState(ON),
      borrowers: defaultSplitState(ON).borrowers.map((b, i) => ({ ...b, name: ["Andy", "Jo"][i] })),
    });
    expect(
      SUPER_PEOPLE.apply(defaultSuperState(ON), named, saved).people.map((p) => p.name),
    ).toEqual(["Andy", "Jo"]);
    expect(SOM_PEOPLE.read(defaultSomState(ON))[0].name).toBeUndefined();
  });

  it("gives the budget a partner when planning with a partner", () => {
    const people = [
      { name: "Andy", salary: 120_000 },
      { name: "Jo", salary: 90_000 },
    ];
    const b = BUDGET_PEOPLE.apply(defaultBudgetState(ON), people, fresh2);
    expect(b.people.map((p) => p.name)).toEqual(["Andy", "Jo"]);
    expect(b.people.map((p) => paySalary(p.pay))).toEqual([120_000, 90_000]);
  });

  it("sizes fresh tools to the household but leaves saved ones alone", () => {
    expect(SOM_PEOPLE.apply(defaultSomState(ON), [], fresh1).people).toHaveLength(1);
    const sac = SACRIFICE_PEOPLE.apply(defaultSacrificeState(ON), [], fresh2);
    expect(sac.people).toHaveLength(2);
    expect(sac.mode).toBe("household");
    expect(
      SUPER_PEOPLE.apply(defaultSuperState(ON), [], { fresh: false, household: 1 }).people,
    ).toHaveLength(2);
    expect(SPLIT_PEOPLE.apply(defaultSplitState(ON), [], fresh1).borrowers).toHaveLength(2);
  });

  it("merges what each tool knows without clearing the rest", () => {
    const merged = mergePeople(
      [{ name: "Andy", salary: 120_000, age: 41 }],
      [{ salary: 125_000 }, { name: "Jo" }],
    );
    expect(merged).toEqual([{ name: "Andy", salary: 125_000, age: 41 }, { name: "Jo" }]);
  });
});
