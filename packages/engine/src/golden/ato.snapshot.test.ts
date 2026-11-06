import { describe, expect, it } from "vitest";
import {
  type AtoSnapshot,
  brackets,
  compareWithEngine,
  dollars,
  formatFindings,
  helpRules,
  incomeYear,
  percent,
} from "./atoSnapshot";
import snapshot from "./data/ato-pages.json";

/**
 * The engine against the ATO's own tables, as scripts/update-ato-rules.sh last
 * copied them. That script refreshes the snapshot each July to September and
 * opens a PR, and this test fails on it until the rules tables catch up,
 * naming each value and the page it comes from.
 */

const ato = snapshot as AtoSnapshot;
const clone = (): AtoSnapshot => JSON.parse(JSON.stringify(ato));
// The tests below change the snapshot and look only at what the change adds, so
// they still pass on a refreshed snapshot that the rules haven't caught up with.
const before = new Set(compareWithEngine(ato).map((f) => JSON.stringify(f)));
const added = (s: AtoSnapshot) =>
  compareWithEngine(s).filter((f) => !before.has(JSON.stringify(f)));
// The engine has no Node or DOM types; vitest prints this to the job log.
declare const console: { log(message: string): void };

describe("reading the ATO's wording", () => {
  it("reads years, dollars and percentages", () => {
    expect(incomeYear("Resident tax rates 2026–27")).toBe("2026-27");
    expect(dollars("$129,718 – $186,050")).toEqual([12_971_800, 18_605_000]);
    expect(dollars("$7,483.05")).toEqual([748_305]);
    expect(percent("4% (previously 4.7%)")).toBe(0.04);
    expect(percent("1.25%")).toBe(0.0125);
  });

  it("reads the 2026-27 resident brackets", () => {
    const t = ato.resident.tables.find((x) => x.caption.endsWith("2026–27"));
    expect(t && brackets(t)).toEqual([
      { from: 1_820_000, rate: 0.15 },
      { from: 4_500_000, rate: 0.3 },
      { from: 13_500_000, rate: 0.37 },
      { from: 19_000_000, rate: 0.45 },
    ]);
  });

  it("reads the 2026-27 HELP thresholds and skips the older percentage tables", () => {
    const [y2027, , y2025] = ato.help.tables;
    expect(helpRules(y2027)).toEqual({
      nil: 6_952_800,
      band1To: 12_971_700,
      band1Rate: 0.15,
      band2Base: 902_800,
      band2Rate: 0.17,
      topFrom: 18_605_100,
      topRate: 0.1,
    });
    expect(helpRules(y2025)).toBeUndefined();
  });
});

describe("the engine against the ATO snapshot", () => {
  it("checks every page", () => {
    expect(Object.keys(ato).sort()).toEqual(
      [
        "contributionCaps",
        "foreign",
        "help",
        "helpIndexation",
        "medicare",
        "mls",
        "resident",
        "superGuarantee",
        "whm",
      ].sort(),
    );
  });

  it("matches every published figure", () => {
    const findings = compareWithEngine(ato);
    if (findings.length) {
      // scripts/update-ato-rules.sh copies this block into the PR it opens.
      console.log(`<!-- ato-report -->\n${formatFindings(findings)}\n<!-- /ato-report -->`);
    }
    expect(findings).toEqual([]);
  });

  it("flags a changed threshold", () => {
    const s = clone();
    s.help.tables[0].rows[1][0] = "$0 – $70,000";
    expect(added(s)).toMatchObject([
      {
        page: "help",
        year: "2026-27",
        field: "TAX_RULES 2026-27 help.nil",
        kind: "differs",
        ato: "$70,000",
        engine: "$69,528",
      },
    ]);
  });

  it("flags a year the engine doesn't have yet", () => {
    const s = clone();
    s.contributionCaps.tables[0].rows.splice(1, 0, ["2027–28", "n/a", "All ages", "$35,000"]);
    s.helpIndexation.tables[0].rows.splice(1, 0, ["2027", "3.1%"]);
    const found = added(s);
    expect(found).toMatchObject([
      { page: "helpIndexation", year: "2027", kind: "missing year" },
      { page: "contributionCaps", year: "2027-28", field: "SUPER_RULES", kind: "missing year" },
    ]);
    expect(formatFindings(found)).toContain("| 2027-28 | `SUPER_RULES` (missing year) |");
  });

  it("flags new HELP thresholds as a reason to move HELP_THRESHOLDS_PUBLISHED_TO", () => {
    const s = clone();
    const next = JSON.parse(JSON.stringify(s.help.tables[0]));
    next.caption = "Table 1: 2027–28 repayment thresholds and rates";
    next.rows[1][0] = "$0 – $71,000";
    s.help.tables.unshift(next);
    const fields = added(s).map((f) => f.field);
    expect(fields).toContain("HELP_THRESHOLDS_PUBLISHED_TO");
    expect(fields).toContain("TAX_RULES 2027-28 help.nil");
  });

  it("treats 'onwards' past the last super year as carried forward, unless the rate changes", () => {
    const s = clone();
    s.superGuarantee.tables[0].rows[1] = ["1 July 2027 onwards", "12.50", "12"];
    expect(added(s)).toMatchObject([
      { page: "superGuarantee", year: "2027-28", kind: "differs", ato: "12.5%", engine: "12%" },
    ]);
  });

  it("fails rather than passing quietly when a table can't be read", () => {
    const s = clone();
    s.mls.tables[0].rows[1][2] = "see below";
    for (const t of s.resident.tables) t.caption = "Rates for residents";
    const kinds = added(s).map((f) => `${f.page} ${f.kind}`);
    expect(kinds).toEqual(["resident unreadable", "mls unreadable"]);
  });
});
