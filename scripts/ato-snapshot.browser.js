// Refresh packages/engine/src/golden/data/ato-pages.json from a web browser.
//
// The ATO turns away scripted requests from cloud servers (GitHub Actions gets
// a 403), but its pages load fine in a normal browser. So: open any page on
// https://www.ato.gov.au, paste this into the developer console, and it fetches
// the pages below from the same site, keeps the tables the engine uses, and
// prints the snapshot (and copies it to the clipboard where the browser
// allows). Save it over ato-pages.json, run `pnpm lint:fix`, then
// `pnpm --filter @budgy/engine test` says which rules need updating.
//
// It does what scripts/update_ato_rules.py does. Keep PAGES, the caption
// patterns and MIN_YEAR the same in both.

(async () => {
  const MIN_YEAR = 2024; // drop tables and rows for income years before 2024-25
  const PAGES = {
    resident: [
      "/tax-rates-and-codes/tax-rates-australian-residents",
      [/^Resident tax rates \d{4}–\d{2}$/],
    ],
    foreign: ["/tax-rates-and-codes/tax-rates-foreign-residents", [/^Foreign resident tax rates/]],
    whm: [
      "/tax-rates-and-codes/tax-rates-working-holiday-makers",
      [/^Working holiday maker tax rates/],
    ],
    help: [
      "/tax-rates-and-codes/study-and-training-loan-minimum-repayment-income-and-rates",
      [/repayment (income )?thresholds and rates/],
    ],
    helpIndexation: [
      "/tax-rates-and-codes/study-and-training-support-loans-indexation-rates",
      [/^Indexation rate table$/],
    ],
    medicare: [
      "/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners",
      [/Medicare levy thresholds for a single individual/],
    ],
    mls: [
      "/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates",
      [/^MLS income thresholds and rates for/],
    ],
    superGuarantee: [
      "/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee",
      [/Super guarantee percentage/, /Maximum contribution base/],
    ],
    contributionCaps: [
      "/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps",
      [/^Table 1\.1: Concessional contributions caps$/, /Non-concessional contributions cap$/],
    ],
  };
  const YEAR_IN_TEXT = { medicare: /In (\d{4}–\d{2}), you don/ };
  const MONTHS =
    "January February March April May June July August September October November December".split(
      " ",
    );

  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const startYear = (s) => {
    const m = /(\d{4})–\d{2}/.exec(s);
    return m ? Number(m[1]) : null;
  };
  // Visible text only, like the Python script (which skips <script> and <style>).
  const visibleText = (doc) => {
    for (const el of doc.querySelectorAll("script, style")) el.remove();
    return norm(doc.body.textContent);
  };

  if (location.hostname !== "www.ato.gov.au") throw new Error("Run this on a www.ato.gov.au page.");
  const out = {};
  for (const [key, [path, patterns]] of Object.entries(PAGES)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${key}: ${res.status} from ${path}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const tables = [...doc.querySelectorAll("table")].map((t) => ({
      caption: norm(t.caption?.textContent ?? ""),
      rows: [...t.rows].map((r) => [...r.cells].map((c) => norm(c.textContent))),
    }));
    const text = visibleText(doc);
    for (const p of patterns) {
      if (!tables.some((t) => p.test(t.caption))) throw new Error(`${key}: no table matching ${p}`);
    }
    const m = /Last updated (\d{1,2}) ([A-Z][a-z]+) (\d{4})/.exec(text);
    const month = m ? MONTHS.indexOf(m[2]) + 1 : 0;
    const page = {
      url: `https://www.ato.gov.au${path}`,
      updated: month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null,
      tables: tables
        .filter((t) => patterns.some((p) => p.test(t.caption)))
        .filter((t) => !(startYear(t.caption) !== null && startYear(t.caption) < MIN_YEAR))
        .map((t) => ({
          caption: t.caption,
          rows: t.rows.filter(
            (r) => !(/^\d{4}–\d{2}$/.test(r[0] ?? "") && startYear(r[0]) < MIN_YEAR),
          ),
        })),
    };
    if (YEAR_IN_TEXT[key]) {
      const y = YEAR_IN_TEXT[key].exec(text);
      if (!y) throw new Error(`${key}: couldn't find which year the page is for`);
      page.year = y[1];
    }
    out[key] = page;
  }
  const json = `${JSON.stringify(out, null, 2)}\n`;
  try {
    await navigator.clipboard.writeText(json);
    console.log("Copied the snapshot to the clipboard.");
  } catch {
    console.log("Couldn't copy to the clipboard; copy the snapshot from below.");
  }
  console.log(json);
  return json;
})();
