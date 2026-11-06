"""Refresh the snapshot of ATO rate tables the engine is checked against.

Fetches the ATO pages behind the engine's tax, Medicare, HELP and super rules,
keeps the tables we use (by caption) from 2024-25 on, and rewrites
packages/engine/src/golden/data/ato-pages.json. The engine test
src/golden/ato.snapshot.test.ts then compares every year in the snapshot with
TAX_RULES, SUPER_RULES and HELP_INDEXATION, so a new or changed ATO figure
shows up as a failing test that names the value and the page.

This script only copies text out of the pages. Reading the numbers happens in
TypeScript (src/golden/atoSnapshot.ts), next to the rules it checks.

Run it through scripts/update-ato-rules.sh, which also compares the engine
and opens a PR. The ATO answers GitHub Actions (and other cloud servers) with
a 403, so run it locally. If the ATO turns your machine away too,
scripts/ato-snapshot.browser.js does the same extraction in a browser. Keep
PAGES, the caption patterns and MIN_YEAR the same in both.

Usage: python3 -I scripts/update_ato_rules.py [--html-dir DIR]
With --html-dir it reads DIR/<key>.html instead of fetching (for testing).
Standard library only. Exits non-zero if a page can't be fetched or a table
we rely on has gone, so the scheduled run fails loudly instead of quietly.
"""

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "packages/engine/src/golden/data/ato-pages.json"
ATO = "https://www.ato.gov.au"
MIN_YEAR = 2024  # drop tables and rows for income years before 2024-25

# key: (path, caption patterns that must each match at least one table)
PAGES: dict[str, tuple[str, list[str]]] = {
    "resident": ("/tax-rates-and-codes/tax-rates-australian-residents", [r"^Resident tax rates \d{4}–\d{2}$"]),
    "foreign": ("/tax-rates-and-codes/tax-rates-foreign-residents", [r"^Foreign resident tax rates"]),
    "whm": ("/tax-rates-and-codes/tax-rates-working-holiday-makers", [r"^Working holiday maker tax rates"]),
    "help": (
        "/tax-rates-and-codes/study-and-training-loan-minimum-repayment-income-and-rates",
        [r"repayment (income )?thresholds and rates"],
    ),
    "helpIndexation": (
        "/tax-rates-and-codes/study-and-training-support-loans-indexation-rates",
        [r"^Indexation rate table$"],
    ),
    "medicare": (
        "/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners",
        [r"Medicare levy thresholds for a single individual"],
    ),
    "mls": (
        "/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates",
        [r"^MLS income thresholds and rates for"],
    ),
    "superGuarantee": (
        "/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee",
        [r"Super guarantee percentage", r"Maximum contribution base"],
    ),
    "contributionCaps": (
        "/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps",
        [r"^Table 1\.1: Concessional contributions caps$", r"Non-concessional contributions cap$"],
    ),
}

# The Medicare page has one table and says which year it's for in the text.
YEAR_IN_TEXT = {"medicare": r"In (\d{4}–\d{2}), you don"}

MONTHS = "January February March April May June July August September October November December".split()


def norm(s: str) -> str:
    return " ".join(s.split())


class Tables(HTMLParser):
    """Collects each <table>'s caption and cell text, and the page's visible text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[dict] = []
        self.text: list[str] = []
        self._skip = 0  # inside <script> or <style>
        self._table: dict | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._caption: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        elif tag == "table":
            self._table = {"caption": "", "rows": []}
        elif self._table is None:
            return
        elif tag == "caption":
            self._caption = []
        elif tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
        elif self._table is None:
            return
        elif tag == "caption" and self._caption is not None:
            self._table["caption"] = norm("".join(self._caption))
            self._caption = None
        elif tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(norm("".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self._table["rows"].append(self._row)
            self._row = None
        elif tag == "table":
            self.tables.append(self._table)
            self._table = None

    def handle_data(self, data):
        if self._skip:
            return
        self.text.append(data)
        if self._caption is not None:
            self._caption.append(data)
        elif self._cell is not None:
            self._cell.append(data)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "budgy rules check (GitHub Actions; https://budgy.nicoll.dev)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8")
        except OSError as e:
            if attempt == 2:
                raise RuntimeError(f"couldn't fetch {url}: {e}") from e
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def start_year(s: str) -> int | None:
    m = re.search(r"(\d{4})–\d{2}", s)
    return int(m.group(1)) if m else None


def extract(key: str, url: str, patterns: list[str], html: str) -> dict:
    p = Tables()
    p.feed(html)
    text = norm("".join(p.text))
    page: dict = {"url": url, "updated": None, "tables": []}
    m = re.search(r"Last updated (\d{1,2}) ([A-Z][a-z]+) (\d{4})", text)
    if m and m.group(2) in MONTHS:
        page["updated"] = f"{m.group(3)}-{MONTHS.index(m.group(2)) + 1:02d}-{int(m.group(1)):02d}"
    for pattern in patterns:
        if not any(re.search(pattern, t["caption"]) for t in p.tables):
            raise RuntimeError(f"{key}: no table with a caption matching {pattern!r} on {url}")
    for t in p.tables:
        if not any(re.search(pat, t["caption"]) for pat in patterns):
            continue
        y = start_year(t["caption"])
        if y is not None and y < MIN_YEAR:
            continue
        rows = [r for r in t["rows"] if not (re.fullmatch(r"\d{4}–\d{2}", r[0] if r else "") and start_year(r[0]) < MIN_YEAR)]
        page["tables"].append({"caption": t["caption"], "rows": rows})
    if key in YEAR_IN_TEXT:
        y = re.search(YEAR_IN_TEXT[key], text)
        if not y:
            raise RuntimeError(f"{key}: couldn't find which year the page is for on {url}")
        page["year"] = y.group(1)
    return page


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html-dir", type=pathlib.Path)
    ap.add_argument("--out", type=pathlib.Path, default=TARGET)
    args = ap.parse_args()

    old = json.loads(args.out.read_text()) if args.out.exists() else {}
    pages = {}
    for key, (path, patterns) in PAGES.items():
        url = ATO + path
        html = (args.html_dir / f"{key}.html").read_text() if args.html_dir else fetch(url)
        pages[key] = extract(key, url, patterns, html)

    args.out.write_text(json.dumps(pages, indent=2, ensure_ascii=False) + "\n")

    for key, page in pages.items():
        before = old.get(key)
        if before == page:
            continue
        what = "new" if before is None else "changed"
        if before and before.get("tables") == page["tables"] and before.get("year") == page.get("year"):
            what = f"only the page date changed ({before.get('updated')} to {page['updated']})"
        print(f"- {key}: {what}, {page['url']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
