import { describe, expect, it } from "vitest";
import {
  forgetAll,
  type KeyValueStore,
  parseSaved,
  readSaved,
  rememberAgain,
  SAVED_KEY,
  saveTool,
  startingPoint,
  withLoanFields,
} from "./saved";
import { defaultState, encodeState } from "./state";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("saved inputs", () => {
  it("starts empty and remembering", () => {
    const s = readSaved(memory());
    expect(s).toEqual({ v: 1, remember: true, loan: {}, tools: {}, people: [] });
  });

  it("saves each tool and merges the shared loan", () => {
    const store = memory();
    saveTool("mortgage", "v=1&s=a", { balance: 500_000, ratePct: 6.1, offset: 10_000 }, store);
    saveTool("split", "v=1&s=b", { balance: 480_000 }, store);
    const s = readSaved(store);
    expect(s.tools).toEqual({ mortgage: "v=1&s=a", split: "v=1&s=b" });
    expect(s.loan).toEqual({ balance: 480_000, ratePct: 6.1, offset: 10_000 });
  });

  it("drops broken loan fields and unknown tools", () => {
    const s = parseSaved(
      JSON.stringify({
        v: 1,
        remember: true,
        loan: { balance: -1, ratePct: "6", termYears: 25, frequency: "daily", offset: 5 },
        tools: { mortgage: "v=1", nope: "x", debt: 3 },
      }),
    );
    expect(s.loan).toEqual({ termYears: 25, offset: 5 });
    expect(s.tools).toEqual({ mortgage: "v=1" });
  });

  it("starts over on junk or a newer version", () => {
    expect(parseSaved("{not json").tools).toEqual({});
    expect(parseSaved(JSON.stringify({ v: 99, tools: { debt: "v=1" } })).tools).toEqual({});
  });

  it("forgets everything and stops saving until asked again", () => {
    const store = memory();
    saveTool("debt", "v=1&s=a", {}, store);
    forgetAll(store);
    expect(readSaved(store)).toEqual({ v: 1, remember: false, loan: {}, tools: {}, people: [] });
    saveTool("debt", "v=1&s=b", {}, store);
    expect(readSaved(store).tools).toEqual({});
    rememberAgain(store);
    saveTool("debt", "v=1&s=b", {}, store);
    expect(readSaved(store).tools).toEqual({ debt: "v=1&s=b" });
  });

  it("keeps working when storage throws", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readSaved(broken).remember).toBe(true);
    expect(() => saveTool("debt", "v=1", {}, broken)).not.toThrow();
    expect(() => forgetAll(broken)).not.toThrow();
  });

  it("stores plain JSON under one key", () => {
    const store = memory();
    saveTool("fixed", "v=1&b=1", {}, store);
    expect(JSON.parse(store.data.get(SAVED_KEY) ?? "")).toMatchObject({ v: 1 });
  });
});

describe("where a tool starts", () => {
  const mine = encodeState(defaultState("2026-01-01"));
  const theirs = encodeState({ ...defaultState("2026-01-01"), scenarios: [] });
  const data = { v: 1 as const, remember: true, loan: {}, tools: { mortgage: mine }, people: [] };

  it("opens saved inputs when the URL is empty", () => {
    expect(startingPoint("mortgage", "", data)).toEqual({ query: mine, mode: "saved" });
  });

  it("treats a reload of the person's own page as theirs", () => {
    expect(startingPoint("mortgage", `?${mine}`, data)).toEqual({ query: mine, mode: "saved" });
  });

  it("shows a shared link without saving over it", () => {
    expect(startingPoint("mortgage", `?${theirs}`, data)).toEqual({ query: theirs, mode: "link" });
  });

  it("prefers saved inputs for a link from another of our tools", () => {
    expect(startingPoint("mortgage", `?${theirs}&mine=1`, data)).toEqual({
      query: mine,
      mode: "saved",
    });
    const fresh = { ...data, tools: {} };
    expect(startingPoint("mortgage", `?${theirs}&mine=1`, fresh)).toEqual({
      query: theirs,
      mode: "saved",
    });
  });

  it("starts from defaults when nothing is saved", () => {
    expect(startingPoint("debt", "", data)).toEqual({ query: null, mode: "saved" });
  });

  it("uses nothing saved once remembering is off", () => {
    const off = { ...data, remember: false };
    expect(startingPoint("mortgage", "", off)).toEqual({ query: null, mode: "off" });
    expect(startingPoint("mortgage", `?${theirs}`, off)).toEqual({ query: theirs, mode: "off" });
  });
});

describe("withLoanFields", () => {
  it("only sets fields the target has", () => {
    const loan = { balance: 1, ratePct: 2, termYears: 3, startDate: "x" };
    expect(withLoanFields(loan, { balance: 9, offset: 4 })).toEqual({ ...loan, balance: 9 });
  });
});
