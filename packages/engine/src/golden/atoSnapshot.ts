import { HELP_INDEXATION, HELP_THRESHOLDS_PUBLISHED_TO } from "../help/early";
import type { Cents } from "../money/cents";
import { SUPER_RULES, type SuperRules } from "../super/rules";
import { type Bracket, TAX_RULES, type TaxRules } from "../tax/rules";

/**
 * Reads the ATO's rate tables (as scripts/update_ato_rules.py copies them into
 * data/ato-pages.json) and lists every figure that doesn't match the engine.
 *
 * Years before the engine's first year are ignored. A year after the engine's
 * last one is reported as missing, because the engine would carry the last
 * year forward. Anything we can't read is reported too, so a reworded ATO page
 * fails the check instead of passing it by saying nothing.
 */

export interface AtoTable {
  caption: string;
  rows: string[][];
}

export interface AtoPage {
  url: string;
  updated: string | null;
  tables: AtoTable[];
  /** The income year a page is for, when it says so in the text rather than a caption. */
  year?: string;
}

export type AtoSnapshot = Record<string, AtoPage>;

export interface Finding {
  page: string;
  url: string;
  year: string;
  /** Where the value lives in the engine, such as `TAX_RULES 2026-27 help.nil`. */
  field: string;
  kind: "differs" | "missing year" | "unreadable";
  ato: string;
  engine?: string;
}

// --- reading the ATO's wording -------------------------------------------------

/** "2026–27" (en dash, as the ATO writes it) to "2026-27". */
export function incomeYear(text: string): string | undefined {
  const m = /(\d{4})[–-](\d{2})/.exec(text);
  return m ? `${m[1]}-${m[2]}` : undefined;
}

/** Every dollar amount in the text, in cents. "$1,234.50" is 123450. */
export function dollars(text: string): Cents[] {
  return [...text.matchAll(/\$([\d,]+(?:\.\d+)?)/g)].map(
    (m) => Math.round(Number(m[1].replaceAll(",", "")) * 100) as Cents,
  );
}

/** The first percentage in the text as a fraction. "4% (previously 4.7%)" is 0.04. */
export function percent(text: string): number | undefined {
  const m = /([\d.]+)\s*%/.exec(text);
  return m ? round(Number(m[1]) / 100) : undefined;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** "37c for each $1 over $135,000" or "30c for each $1" as a bracket. */
function centsPerDollar(text: string): Bracket | undefined {
  const m = /([\d.]+)c for each \$1(?: over \$([\d,]+))?/.exec(text);
  if (!m) return undefined;
  const from = m[2] ? dollars(`$${m[2]}`)[0] : (0 as Cents);
  return { from, rate: round(Number(m[1]) / 100) };
}

/** A "Taxable income | Tax on this income" table as brackets, or undefined if a row doesn't read. */
export function brackets(table: AtoTable): Bracket[] | undefined {
  const out: Bracket[] = [];
  for (const [, tax] of table.rows.slice(1)) {
    if (/^nil$/i.test(tax ?? "")) continue;
    const b = centsPerDollar(tax ?? "");
    if (!b) return undefined;
    out.push(b);
  }
  return out.length ? out : undefined;
}

/** A marginal HELP table (2025-26 on). Undefined for the older percentage-of-income tables. */
export function helpRules(table: AtoTable): TaxRules["help"] | undefined {
  const rows = table.rows.slice(1);
  if (rows.length !== 4) return undefined;
  const [nil, band1, band2, top] = rows;
  const b1 = centsPerDollar(band1[1]);
  const b2 = centsPerDollar(band2[1]);
  const topRate = percent(top[1]);
  if (!/^nil$/i.test(nil[1]) || !b1 || !b2 || topRate === undefined) return undefined;
  if (!/of your total/i.test(top[1])) return undefined;
  return {
    nil: dollars(nil[0])[1],
    band1To: dollars(band1[0])[1],
    band1Rate: b1.rate,
    band2Base: dollars(band2[1])[0],
    band2Rate: b2.rate,
    topFrom: dollars(top[0])[0],
    topRate,
  };
}

// --- comparing with the engine -------------------------------------------------

const money = (c: number | undefined) =>
  c === undefined ? "none" : `$${(c / 100).toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
const pct = (r: number | undefined) => (r === undefined ? "none" : `${round(r * 100)}%`);
const showBrackets = (bs: Bracket[]) =>
  bs.map((b) => `${pct(b.rate)} over ${money(b.from)}`).join(", ");

const fyFrom = (start: number) => `${start}-${String((start + 1) % 100).padStart(2, "0")}`;

class Checker {
  findings: Finding[] = [];
  constructor(
    readonly key: string,
    readonly page: AtoPage,
  ) {}

  add(f: Omit<Finding, "page" | "url">) {
    this.findings.push({ page: this.key, url: this.page.url, ...f });
  }

  tables(pattern: RegExp): AtoTable[] {
    const found = this.page.tables.filter((t) => pattern.test(t.caption));
    if (!found.length)
      this.add({ year: "", field: "", kind: "unreadable", ato: `no table matching ${pattern}` });
    return found;
  }

  /** The engine's rules for a year: exact, too early to check, or missing. */
  year<R extends { year: string }>(
    list: R[],
    fy: string | undefined,
    caption: string,
    name: string,
  ): R | undefined {
    if (!fy) {
      this.add({
        year: "",
        field: name,
        kind: "unreadable",
        ato: `no income year in "${caption}"`,
      });
      return undefined;
    }
    if (fy < list[0].year) return undefined;
    const r = list.find((x) => x.year === fy);
    if (!r)
      this.add({
        year: fy,
        field: name,
        kind: "missing year",
        ato: `published for ${fy}`,
        engine: `carries ${list[list.length - 1].year} forward`,
      });
    return r;
  }

  same(year: string, field: string, ato: number, engine: number, show: (n: number) => string) {
    if (Math.abs(ato - engine) > 1e-9)
      this.add({ year, field, kind: "differs", ato: show(ato), engine: show(engine) });
  }
}

function checkBrackets(c: Checker, pattern: RegExp, field: "resident" | "foreign" | "whm") {
  for (const t of c.tables(pattern)) {
    const fy = incomeYear(t.caption);
    const rules = c.year(TAX_RULES, fy, t.caption, "TAX_RULES");
    if (!rules || !fy) continue;
    const ato = brackets(t);
    const name = `TAX_RULES ${fy} ${field}`;
    if (!ato) {
      c.add({ year: fy, field: name, kind: "unreadable", ato: t.caption });
      continue;
    }
    const engine = rules[field];
    const same =
      ato.length === engine.length &&
      ato.every((b, i) => b.from === engine[i].from && Math.abs(b.rate - engine[i].rate) < 1e-9);
    if (!same)
      c.add({
        year: fy,
        field: name,
        kind: "differs",
        ato: showBrackets(ato),
        engine: showBrackets(engine),
      });
  }
}

function checkHelp(c: Checker) {
  let latest = "";
  for (const t of c.tables(/repayment (income )?thresholds and rates/)) {
    const fy = incomeYear(t.caption);
    if (fy && fy < TAX_RULES[0].year) continue;
    const rules = c.year(TAX_RULES, fy, t.caption, "TAX_RULES");
    if (!fy) continue;
    if (fy > latest) latest = fy;
    if (!rules) continue;
    const ato = helpRules(t);
    if (!ato) {
      c.add({ year: fy, field: `TAX_RULES ${fy} help`, kind: "unreadable", ato: t.caption });
      continue;
    }
    for (const k of Object.keys(ato) as (keyof TaxRules["help"])[]) {
      c.same(
        fy,
        `TAX_RULES ${fy} help.${k}`,
        ato[k],
        rules.help[k],
        k.endsWith("Rate") ? pct : money,
      );
    }
  }
  if (latest > HELP_THRESHOLDS_PUBLISHED_TO)
    c.add({
      year: latest,
      field: "HELP_THRESHOLDS_PUBLISHED_TO",
      kind: "differs",
      ato: latest,
      engine: HELP_THRESHOLDS_PUBLISHED_TO,
    });
}

function checkMedicare(c: Checker) {
  const fy = c.page.year ? incomeYear(c.page.year) : undefined;
  for (const t of c.tables(/Medicare levy thresholds for a single individual/)) {
    const rules = c.year(TAX_RULES, fy, c.page.year ?? t.caption, "TAX_RULES");
    if (!rules || !fy) continue;
    const row = t.rows.find((r) => /all other taxpayers/i.test(r[0]));
    const [low] = dollars(row?.[1] ?? "");
    const [high] = dollars(row?.[2] ?? "");
    if (low === undefined || high === undefined) {
      c.add({ year: fy, field: `TAX_RULES ${fy} medicare`, kind: "unreadable", ato: t.caption });
      continue;
    }
    const m = rules.medicare;
    c.same(fy, `TAX_RULES ${fy} medicare.lowSingle`, low, m.lowSingle, money);
    // The levy shades in at `shadeIn` until it reaches `rate`, which fixes the upper threshold.
    const upper = Math.floor((low * m.shadeIn) / (m.shadeIn - m.rate) / 100) * 100;
    c.same(
      fy,
      `TAX_RULES ${fy} medicare upper threshold (from rate and shadeIn)`,
      high,
      upper,
      money,
    );
  }
}

function checkMls(c: Checker) {
  for (const t of c.tables(/^MLS income thresholds and rates for/)) {
    const fy = incomeYear(t.caption);
    const rules = c.year(TAX_RULES, fy, t.caption, "TAX_RULES");
    if (!rules || !fy) continue;
    const row = (re: RegExp) => t.rows.find((r) => re.test(r[0]));
    const tiers = (r: string[] | undefined) =>
      r ? [dollars(r[1])[0], dollars(r[2])[1], dollars(r[3])[1]] : [];
    const single = tiers(row(/^single/i));
    const family = tiers(row(/^family/i));
    const rates = (row(/surcharge/i) ?? []).slice(2).map(percent);
    if (
      single.length !== 3 ||
      family.length !== 3 ||
      rates.length !== 3 ||
      [...single, ...family, ...rates].some((v) => v === undefined)
    ) {
      c.add({ year: fy, field: `TAX_RULES ${fy} mls`, kind: "unreadable", ato: t.caption });
      continue;
    }
    for (let i = 0; i < 3; i++) {
      c.same(fy, `TAX_RULES ${fy} mls.single[${i}]`, single[i], rules.mls.single[i], money);
      c.same(fy, `TAX_RULES ${fy} mls.family[${i}]`, family[i], rules.mls.family[i], money);
      c.same(fy, `TAX_RULES ${fy} mls.rates[${i}]`, rates[i] as number, rules.mls.rates[i], pct);
    }
  }
}

/** Rows of "<income year> | <value>" tables, checked against one SUPER_RULES field. */
function checkSuperByYear(
  c: Checker,
  pattern: RegExp,
  field: keyof SuperRules,
  value: (row: string[]) => number | undefined,
  show: (n: number) => string,
) {
  for (const t of c.tables(pattern)) {
    for (const row of t.rows.slice(1)) {
      const fy = incomeYear(row[0]);
      const rules = c.year(SUPER_RULES, fy, row[0], "SUPER_RULES");
      if (!rules || !fy) continue;
      const v = value(row);
      if (v === undefined) {
        c.add({
          year: fy,
          field: `SUPER_RULES ${fy} ${field}`,
          kind: "unreadable",
          ato: row.join(" | "),
        });
        continue;
      }
      c.same(fy, `SUPER_RULES ${fy} ${field}`, v, rules[field] as number, show);
    }
  }
}

function checkSuperGuarantee(c: Checker) {
  const last = SUPER_RULES[SUPER_RULES.length - 1];
  for (const t of c.tables(/Super guarantee percentage/)) {
    for (const row of t.rows.slice(1)) {
      const m = /^1 July (\d{4})(?: [–-] 30 June \d{4}| onwards)$/.exec(row[0]);
      if (!m) continue; // e.g. "1 July 2002 – 30 June 2013"
      const fy = fyFrom(Number(m[1]));
      const rate = Number(row[1]) / 100;
      if (Number.isNaN(rate)) {
        c.add({
          year: fy,
          field: `SUPER_RULES ${fy} sgRate`,
          kind: "unreadable",
          ato: row.join(" | "),
        });
        continue;
      }
      if (fy < SUPER_RULES[0].year) continue;
      // "onwards" past the last year is what carrying the last year forward does already.
      const rules =
        SUPER_RULES.find((r) => r.year === fy) ??
        (row[0].endsWith("onwards") && fy > last.year
          ? last
          : c.year(SUPER_RULES, fy, row[0], "SUPER_RULES"));
      if (rules) c.same(fy, `SUPER_RULES ${fy} sgRate`, round(rate), rules.sgRate, pct);
    }
  }
  checkSuperByYear(
    c,
    /Maximum contribution base from/,
    "maxContributionBase",
    (r) => dollars(r[1])[0],
    money,
  );
  checkSuperByYear(
    c,
    /Maximum contribution base up to/,
    "maxContributionBase",
    (r) => {
      const [quarter] = dollars(r[1]);
      return quarter === undefined ? undefined : quarter * 4;
    },
    money,
  );
}

function checkCaps(c: Checker) {
  checkSuperByYear(
    c,
    /^Table 1\.1: Concessional contributions caps$/,
    "concessionalCap",
    (r) => dollars(r[3] ?? "")[0],
    money,
  );
  checkSuperByYear(
    c,
    /Non-concessional contributions cap$/,
    "nonConcessionalCap",
    (r) => dollars(r[1] ?? "")[0],
    money,
  );
}

function checkHelpIndexation(c: Checker) {
  const first = HELP_INDEXATION[0].year;
  const last = HELP_INDEXATION[HELP_INDEXATION.length - 1].year;
  for (const t of c.tables(/^Indexation rate table$/)) {
    for (const row of t.rows.slice(1)) {
      const year = Number(row[0]);
      const rate = percent(row[1] ?? "");
      if (!Number.isInteger(year) || rate === undefined) {
        c.add({ year: row[0], field: "HELP_INDEXATION", kind: "unreadable", ato: row.join(" | ") });
        continue;
      }
      if (year < first) continue;
      const hit = HELP_INDEXATION.find((r) => r.year === year);
      if (!hit) {
        c.add({
          year: String(year),
          field: "HELP_INDEXATION",
          kind: "missing year",
          ato: `1 June ${year}: ${pct(rate)}`,
          engine: year > last ? `ends at ${last}` : "none",
        });
        continue;
      }
      c.same(String(year), `HELP_INDEXATION ${year}`, rate, hit.rate, pct);
    }
  }
}

const CHECKS: Record<string, (c: Checker) => void> = {
  resident: (c) => checkBrackets(c, /^Resident tax rates/, "resident"),
  foreign: (c) => checkBrackets(c, /^Foreign resident tax rates/, "foreign"),
  whm: (c) => checkBrackets(c, /^Working holiday maker tax rates/, "whm"),
  help: checkHelp,
  helpIndexation: checkHelpIndexation,
  medicare: checkMedicare,
  mls: checkMls,
  superGuarantee: checkSuperGuarantee,
  contributionCaps: checkCaps,
};

/** Every place the snapshot and the engine disagree. Empty when they match. */
export function compareWithEngine(snapshot: AtoSnapshot): Finding[] {
  const out: Finding[] = [];
  for (const [key, check] of Object.entries(CHECKS)) {
    const page = snapshot[key];
    if (!page) {
      out.push({
        page: key,
        url: "",
        year: "",
        field: "",
        kind: "unreadable",
        ato: "page missing from snapshot",
      });
      continue;
    }
    const c = new Checker(key, page);
    check(c);
    out.push(...c.findings);
  }
  return out;
}

/** The findings as a Markdown table for the PR the yearly workflow opens. */
export function formatFindings(findings: Finding[]): string {
  if (!findings.length) return "The engine matches every ATO figure in the snapshot.";
  const cell = (s: string) => s.replaceAll("|", "\\|");
  const lines = [
    "| Year | Engine value | ATO says | Engine has | Source |",
    "| --- | --- | --- | --- | --- |",
    ...findings.map(
      (f) =>
        `| ${f.year || "?"} | \`${cell(f.field || f.page)}\`${f.kind === "differs" ? "" : ` (${f.kind})`} | ${cell(f.ato)} | ${cell(f.engine ?? "")} | [${f.page}](${f.url}) |`,
    ),
  ];
  return lines.join("\n");
}
