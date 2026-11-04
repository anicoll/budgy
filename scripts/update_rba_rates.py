"""Refresh the RBA average home loan rates in the engine.

Downloads Table F6 (Housing Lending Rates) as the Excel workbook, which has
rates to two decimal places (the CSV rounds them to one), and rewrites the
snapshot in packages/engine/src/mortgage/rbaRates.ts. Each rate line there
ends with a comment naming its new and outstanding series IDs, so this script
only touches numbers it can match to a series.

Usage: python3 scripts/update_rba_rates.py [path/to/f06hist.xlsx]
With no path it downloads the workbook from the RBA. Standard library only.
"""

import datetime as dt
import pathlib
import re
import sys
import urllib.request
import zipfile
from io import BytesIO
from xml.etree import ElementTree as ET

URL = "https://www.rba.gov.au/statistics/tables/xls/f06hist.xlsx"
TARGET = pathlib.Path(__file__).resolve().parent.parent / "packages/engine/src/mortgage/rbaRates.ts"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def load(path: str | None) -> bytes:
    if path:
        return pathlib.Path(path).read_bytes()
    req = urllib.request.Request(URL, headers={"User-Agent": "budgy rate update (GitHub Actions)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def read_sheet(data: bytes) -> list[dict[str, str]]:
    """The Data sheet as rows of {column letter: value}."""
    z = zipfile.ZipFile(BytesIO(data))
    strings = [
        "".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)
    ]
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.iter(f"{{{NS['m']}}}row"):
        cells = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            if v is None or v.text is None:
                continue
            col = re.match(r"[A-Z]+", c.get("r", "")).group(0)
            cells[col] = strings[int(v.text)] if c.get("t") == "s" else v.text
        if cells:
            rows.append(cells)
    return rows


def excel_date(serial: str) -> dt.date:
    return dt.date(1899, 12, 30) + dt.timedelta(days=int(float(serial)))


def parse_published(text: str) -> dt.date:
    for fmt in ("%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            pass
    return excel_date(text)


def main() -> int:
    rows = read_sheet(load(sys.argv[1] if len(sys.argv) > 1 else None))
    ids = next(r for r in rows if r.get("A") == "Series ID")
    column = {v: k for k, v in ids.items() if k != "A"}
    published_row = next(r for r in rows if r.get("A") == "Publication date")

    source = TARGET.read_text()
    line_re = re.compile(
        r"(\{ new: )([0-9.]+)(, outstanding: )([0-9.]+)( \}, // )([A-Z0-9]+), ([A-Z0-9]+)"
    )
    wanted = [(m.group(6), m.group(7)) for m in line_re.finditer(source)]
    if not wanted:
        print("no series lines found in", TARGET, file=sys.stderr)
        return 1
    needed = {s for pair in wanted for s in pair}
    missing = needed - column.keys()
    if missing:
        print("series missing from F6:", ", ".join(sorted(missing)), file=sys.stderr)
        return 1

    data_rows = [
        r for r in rows if re.fullmatch(r"\d+(\.0)?", r.get("A", "")) and all(column[s] in r for s in needed)
    ]
    latest = data_rows[-1]
    month = excel_date(latest["A"]).strftime("%Y-%m")
    published = parse_published(published_row[column[wanted[0][0]]]).isoformat()

    def rate(series: str) -> str:
        # Percent to a decimal with no float noise: 6.15 -> 0.0615.
        value = round(float(latest[column[series]]) / 100, 6)
        if not 0.01 < value < 0.2:
            raise ValueError(f"{series} = {value} looks wrong")
        return repr(value)

    def replace(m: re.Match) -> str:
        return f"{m.group(1)}{rate(m.group(6))}{m.group(3)}{rate(m.group(7))}{m.group(5)}{m.group(6)}, {m.group(7)}"

    updated = line_re.sub(replace, source)
    updated = re.sub(r'(  month: ")[0-9-]+(",)', rf"\g<1>{month}\2", updated, count=1)
    updated = re.sub(r'(  published: ")[0-9-]+(",)', rf"\g<1>{published}\2", updated, count=1)

    if updated == source:
        print(f"already up to date ({month})")
    else:
        TARGET.write_text(updated)
        print(f"updated to {month}, published {published}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
