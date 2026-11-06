import { deflateRawSync } from "node:zlib";
import { encode } from "uqr";
import { describe, expect, it } from "vitest";
import { defaultBudgetState, encodeBudgetState } from "./budgetState";
import { defaultDebtState, encodeDebtState } from "./debtState";
import {
  decodeMoveFragment,
  describeSaved,
  encodeMoveFragment,
  isEmpty,
  moveLink,
  packQuery,
  unpackQuery,
} from "./moveLink";
import { defaultPayState, encodePayState } from "./payState";
import { emptySaved, type KeyValueStore, readSaved, replaceSaved, type SavedData } from "./saved";
import { defaultState, encodeState } from "./state";
import { defaultSuperState, encodeSuperState } from "./superState";

function memory(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const sample: SavedData = {
  v: 1,
  remember: false,
  loan: { balance: 600_000, ratePct: 6.1, termYears: 25, frequency: "fortnightly", offset: 20_000 },
  tools: { mortgage: "v=1&b=600000", pay: "v=2&s=120000" },
  people: [{ name: "Sam", salary: 120_000, help: true }, { salary: 90_000 }],
  profile: { earn: "salary", home: "mortgage" },
};

describe("move link", () => {
  it("round-trips a full record, compressed", async () => {
    const frag = await encodeMoveFragment(sample);
    expect(frag.startsWith("d2.")).toBe(true);
    expect(frag).not.toMatch(/[+/=]/);
    const back = await decodeMoveFragment(`#${frag}`);
    expect(back).toEqual({ ...sample, remember: true });
  });

  it("keeps a realistic household short enough for a link", async () => {
    const tools: SavedData["tools"] = {};
    for (const t of ["mortgage", "debt", "refinance", "fixed", "pay", "budget"] as const)
      tools[t] = "v=3&a=612000&r=6.04&t=27&f=fortnightly&o=45000&items=rent.2000,food.900,car.400";
    const frag = await encodeMoveFragment({ ...sample, tools });
    expect(frag.length).toBeLessThan(1_000);
  });

  it("keeps a full household's QR code small", async () => {
    // The tools a household is most likely to have filled in.
    const day = "2026-11-06";
    const tools: SavedData["tools"] = {
      mortgage: encodeState(defaultState(day)),
      pay: encodePayState(defaultPayState(day)),
      budget: encodeBudgetState(defaultBudgetState(day)),
      debt: encodeDebtState(defaultDebtState(day)),
      super: encodeSuperState(defaultSuperState(day)),
    };
    const link = await moveLink({ ...sample, tools }, "https://budgy.nicoll.dev");
    const plain = Buffer.from(JSON.stringify({ ...sample, tools })).toString("base64url");
    expect(link.length).toBeLessThan(plain.length / 4);
    expect(encode(link, { ecc: "L" }).version).toBeLessThanOrEqual(12);
  });

  it("packs base64 JSON inside query strings, nested too, and gives it back exactly", () => {
    const day = "2026-11-06";
    for (const q of [
      encodeBudgetState(defaultBudgetState(day)), // base64 JSON holding another query string
      encodeSuperState(defaultSuperState(day)),
      "v=1&b=30000&i=90000",
      "v=1&s=not+base64%20at=all",
      "plain text",
      "",
    ]) {
      expect(unpackQuery(packQuery(q))).toBe(q);
    }
    expect(JSON.stringify(packQuery(encodeSuperState(defaultSuperState(day))))).toContain('"$j"');
  });

  it("still reads older d1 links", async () => {
    const d1 = deflateRawSync(JSON.stringify(sample)).toString("base64url");
    expect(await decodeMoveFragment(`d1.${d1}`)).toEqual({ ...sample, remember: true });
  });

  it("reads the plain JSON form", async () => {
    const json = Buffer.from(JSON.stringify(sample)).toString("base64url");
    expect(await decodeMoveFragment(`j1.${json}`)).toEqual({ ...sample, remember: true });
  });

  it("builds a link to the import page", async () => {
    const link = await moveLink(sample, "https://budgy.nicoll.dev");
    expect(link.startsWith("https://budgy.nicoll.dev/import/#d2.")).toBe(true);
  });

  it("gives nothing for broken, foreign or empty links", async () => {
    expect(await decodeMoveFragment("")).toBeNull();
    expect(await decodeMoveFragment("#")).toBeNull();
    expect(await decodeMoveFragment("#d1.not-really-deflate")).toBeNull();
    expect(await decodeMoveFragment("#d2.not-really-deflate")).toBeNull();
    expect(await decodeMoveFragment("#x9.abc")).toBeNull();
    const wrongVersion = Buffer.from(JSON.stringify({ ...sample, v: 99 })).toString("base64url");
    expect(await decodeMoveFragment(`j1.${wrongVersion}`)).toBeNull();
    expect(await decodeMoveFragment(await encodeMoveFragment(emptySaved()))).toBeNull();
  });

  it("drops bad values instead of importing them", async () => {
    const bad = { ...sample, loan: { balance: -5, ratePct: "lots" }, people: [{ salary: 1e12 }] };
    const json = Buffer.from(JSON.stringify(bad)).toString("base64url");
    const back = await decodeMoveFragment(`j1.${json}`);
    expect(back?.loan).toEqual({});
    expect(back?.people).toEqual([{}]);
  });

  it("says what a record holds", () => {
    expect(describeSaved(sample, (t) => t.toUpperCase())).toEqual([
      "Your answers from the home page",
      "Your home loan",
      "2 people's pay details",
      "Inputs for 2 tools: MORTGAGE, PAY",
    ]);
    expect(isEmpty(emptySaved())).toBe(true);
  });

  it("replaces what's saved and turns remembering on", () => {
    const store = memory();
    expect(replaceSaved({ ...sample, remember: false }, store)).toBe(true);
    expect(readSaved(store)).toEqual({ ...sample, remember: true });
    expect(replaceSaved(sample, null)).toBe(false);
  });
});
